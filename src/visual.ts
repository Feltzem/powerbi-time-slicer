"use strict";

import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import FilterAction = powerbi.FilterAction;
import PrimitiveValue = powerbi.PrimitiveValue;
import Fill = powerbi.Fill;

const ADVANCED_FILTER_TYPE = 0; // Power BI advanced filter type identifier (schema#advanced)
const ADVANCED_FILTER_SCHEMA =
  "http" + "://powerbi.com/product/schema#advanced";
const INVALID_TIME_MESSAGE = "Enter a valid time (e.g. 07:30, 7:30 AM, 1730).";
const FULL_DAY_MINUTES = 1440;
const DEFAULT_SNAP_INTERVAL = 15;
const SNAP_INTERVALS = [1, 5, 10, 15, 30, 60];
const PRESET_RANGES_OBJECT_NAME = "presetRanges";

interface PresetRangeSettings {
  label: string;
  start: string;
  end: string;
}

interface PresetRangeDefinition extends PresetRangeSettings {
  key: string;
  defaultStartMinutes: number;
  defaultEndMinutes: number;
}

interface ResolvedPresetRange {
  key: string;
  label: string;
  start: number;
  end: number;
  isValid: boolean;
}

const DEFAULT_PRESET_RANGES: PresetRangeDefinition[] = [
  {
    key: "preset1",
    label: "AM Peak",
    start: "07:00",
    end: "09:00",
    defaultStartMinutes: 420,
    defaultEndMinutes: 540,
  },
  {
    key: "preset2",
    label: "Inter-Peak",
    start: "10:00",
    end: "12:00",
    defaultStartMinutes: 600,
    defaultEndMinutes: 720,
  },
  {
    key: "preset3",
    label: "PM Peak",
    start: "16:00",
    end: "18:00",
    defaultStartMinutes: 960,
    defaultEndMinutes: 1080,
  },
  {
    key: "preset4",
    label: "Custom",
    start: "09:00",
    end: "17:00",
    defaultStartMinutes: 540,
    defaultEndMinutes: 1020,
  },
];

interface TimeSlicerSettings {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  showLabels: boolean;
  timeFormat: string;
  compactMode: boolean;
  snapInterval: number;
  customStartTime: number;
  customEndTime: number;
  presetRanges: PresetRangeSettings[];
  selectedStartTime?: number;
  selectedEndTime?: number;
}

export class Visual implements IVisual {
  private target: HTMLElement;
  private host: IVisualHost;
  private selectionManager: ISelectionManager;
  private container: HTMLDivElement;
  private titleElement!: HTMLDivElement;
  private sliderContainer!: HTMLDivElement;
  private minSlider!: HTMLInputElement;
  private maxSlider!: HTMLInputElement;
  private minInput!: HTMLInputElement;
  private maxInput!: HTMLInputElement;
  private currentLabel!: HTMLDivElement;
  private labelsContainer!: HTMLDivElement;
  private playButton!: HTMLButtonElement;
  private resetButton!: HTMLButtonElement;
  private rangeTrack!: HTMLDivElement;
  private controlsContainer!: HTMLDivElement;
  private quickSelectContainer!: HTMLDivElement;
  private presetButtons: Array<{
    button: HTMLButtonElement;
    key: string;
  }> = [];
  private settings?: TimeSlicerSettings;
  private currentMinTime: number = 0; // 00:00
  private currentMaxTime: number = 1440; // 24:00
  private isPlaying: boolean = false;
  private playInterval: number = 0;
  private dataView?: DataView;
  private lastPersistedRangeKey?: string;
  private hasAppliedPersistedFilter: boolean = false;
  private isSliderInteractionActive: boolean = false;
  private filterDebounceTimer: number = 0;

  constructor(options: VisualConstructorOptions) {
    this.target = options.element;
    this.host = options.host;
    this.selectionManager = this.host.createSelectionManager();

    this.container = document.createElement("div");
    this.container.className = "timeSlicerVisual";
    this.target.appendChild(this.container);

    this.createSliderInterface();
  }
  private createSliderInterface(): void {
    this.titleElement = document.createElement("div");
    this.titleElement.className = "visual-title";
    this.titleElement.textContent = "Time Range";
    this.container.appendChild(this.titleElement);

    this.labelsContainer = document.createElement("div");
    this.labelsContainer.className = "time-labels-row";
    this.container.appendChild(this.labelsContainer);

    this.minInput = document.createElement("input");
    this.minInput.type = "text";
    this.minInput.className = "time-label time-input time-label--start";
    this.minInput.setAttribute("aria-label", "Start time input");
    this.minInput.title = "Start time";
    this.minInput.dataset.defaultTitle = "Start time";
    this.minInput.addEventListener("blur", () => this.onMinInputChange());
    this.minInput.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.onMinInputChange();
        (event.target as HTMLInputElement).blur();
      }
    });
    this.labelsContainer.appendChild(this.minInput);

    this.currentLabel = document.createElement("div");
    this.currentLabel.className = "selected-badge";
    this.labelsContainer.appendChild(this.currentLabel);

    this.maxInput = document.createElement("input");
    this.maxInput.type = "text";
    this.maxInput.className = "time-label time-input time-label--end";
    this.maxInput.setAttribute("aria-label", "End time input");
    this.maxInput.title = "End time";
    this.maxInput.dataset.defaultTitle = "End time";
    this.maxInput.addEventListener("blur", () => this.onMaxInputChange());
    this.maxInput.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.onMaxInputChange();
        (event.target as HTMLInputElement).blur();
      }
    });
    this.labelsContainer.appendChild(this.maxInput);

    this.sliderContainer = document.createElement("div");
    this.sliderContainer.className = "slider-container";
    this.container.appendChild(this.sliderContainer);

    const trackBackground = document.createElement("div");
    trackBackground.className = "slider-track-bg";
    this.sliderContainer.appendChild(trackBackground);

    this.rangeTrack = document.createElement("div");
    this.rangeTrack.className = "slider-track-fill";
    trackBackground.appendChild(this.rangeTrack);

    this.minSlider = document.createElement("input");
    this.minSlider.type = "range";
    this.minSlider.className = "range-slider min-slider";
    this.minSlider.min = "0";
    this.minSlider.max = "1440";
    this.minSlider.step = DEFAULT_SNAP_INTERVAL.toString();
    this.minSlider.value = "0";
    this.minSlider.addEventListener("input", () => this.onMinSliderChange());
    this.minSlider.addEventListener("change", () =>
      this.commitSliderInteraction(),
    );
    this.minSlider.addEventListener("mousedown", () =>
      this.beginSliderInteraction(this.minSlider),
    );
    this.minSlider.addEventListener("touchstart", () =>
      this.beginSliderInteraction(this.minSlider),
    );
    this.sliderContainer.appendChild(this.minSlider);

    this.maxSlider = document.createElement("input");
    this.maxSlider.type = "range";
    this.maxSlider.className = "range-slider max-slider";
    this.maxSlider.min = "0";
    this.maxSlider.max = "1440";
    this.maxSlider.step = DEFAULT_SNAP_INTERVAL.toString();
    this.maxSlider.value = "1440";
    this.maxSlider.addEventListener("input", () => this.onMaxSliderChange());
    this.maxSlider.addEventListener("change", () =>
      this.commitSliderInteraction(),
    );
    this.maxSlider.addEventListener("mousedown", () =>
      this.beginSliderInteraction(this.maxSlider),
    );
    this.maxSlider.addEventListener("touchstart", () =>
      this.beginSliderInteraction(this.maxSlider),
    );
    this.sliderContainer.appendChild(this.maxSlider);

    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "controls-row";
    this.container.appendChild(this.controlsContainer);

    this.playButton = document.createElement("button");
    this.playButton.className = "btn-play";
    this.playButton.type = "button";
    this.playButton.setAttribute("aria-label", "Play time range animation");
    this.playButton.addEventListener("click", () => this.togglePlay());
    this.controlsContainer.appendChild(this.playButton);
    this.setPlayButtonState(false);

    this.resetButton = document.createElement("button");
    this.resetButton.className = "btn-reset";
    this.resetButton.type = "button";
    this.resetButton.textContent = "Reset";
    this.resetButton.addEventListener("click", () => this.resetSlider());
    this.controlsContainer.appendChild(this.resetButton);

    this.quickSelectContainer = document.createElement("div");
    this.quickSelectContainer.className = "preset-row";
    this.container.appendChild(this.quickSelectContainer);

    DEFAULT_PRESET_RANGES.forEach((item) => {
      const button = document.createElement("button");
      button.className = "preset-btn";
      button.type = "button";
      button.addEventListener("click", () => {
        const preset = this.getResolvedPresetRange(item.key);
        if (!preset.isValid) {
          console.warn(
            `${preset.label} quick select range is invalid. Update its settings to enable the button.`,
          );
          return;
        }
        this.selectTimeRange(preset.start, preset.end);
      });
      this.quickSelectContainer.appendChild(button);
      this.presetButtons.push({
        button,
        key: item.key,
      });
    });

    this.updatePresetButtons();
    this.updateLabels();
    this.updateRangeTrack();
  }

  private setPlayButtonState(isPlaying: boolean): void {
    if (!this.playButton) {
      return;
    }

    this.playButton.classList.toggle("playing", isPlaying);
    this.playButton.setAttribute(
      "aria-label",
      isPlaying ? "Pause time range animation" : "Play time range animation",
    );
    this.playButton.replaceChildren(Visual.createPlayIcon(isPlaying));
  }

  private updatePresetButtonStates(): void {
    this.presetButtons.forEach((preset) => {
      const range = this.getResolvedPresetRange(preset.key);
      const isActive =
        range.isValid &&
        range.start === this.currentMinTime &&
        range.end === this.currentMaxTime;
      preset.button.classList.toggle("is-active", isActive);
    });
  }

  private static createPlayIcon(isPlaying: boolean): SVGSVGElement {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    const path = document.createElementNS(namespace, "path");

    svg.setAttribute("viewBox", "0 0 256 256");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    path.setAttribute(
      "d",
      isPlaying ? "M88 56h32v144H88zm48 0h32v144h-32z" : "M96 56v144l112-72z",
    );

    svg.appendChild(path);
    return svg;
  }

  private bringToFront(slider: HTMLInputElement): void {
    // Reset z-index for both sliders
    this.minSlider.style.zIndex = "3";
    this.maxSlider.style.zIndex = "3";

    // Bring the active slider to front
    slider.style.zIndex = "5";
  }

  private beginSliderInteraction(slider: HTMLInputElement): void {
    this.isSliderInteractionActive = true;
    this.bringToFront(slider);
  }

  private commitSliderInteraction(): void {
    this.clearScheduledFilterApplication();
    this.applyFilter(true);
    this.isSliderInteractionActive = false;
  }

  private onMinSliderChange(): void {
    this.isSliderInteractionActive = true;

    const minValue = this.snapMinutes(parseInt(this.minSlider.value, 10), 0);
    const maxValue = this.snapMinutes(
      parseInt(this.maxSlider.value, 10),
      FULL_DAY_MINUTES,
    );
    const range = this.normalizeRange(minValue, maxValue, "end");

    this.currentMinTime = range.min;
    this.currentMaxTime = range.max;
    this.syncSliderValues();

    this.updateLabels();
    this.updateRangeTrack();
    this.scheduleFilterApplication();
  }

  private onMaxSliderChange(): void {
    this.isSliderInteractionActive = true;

    const minValue = this.snapMinutes(parseInt(this.minSlider.value, 10), 0);
    const maxValue = this.snapMinutes(
      parseInt(this.maxSlider.value, 10),
      FULL_DAY_MINUTES,
    );
    const range = this.normalizeRange(minValue, maxValue, "start");

    this.currentMinTime = range.min;
    this.currentMaxTime = range.max;
    this.syncSliderValues();

    this.updateLabels();
    this.updateRangeTrack();
    this.scheduleFilterApplication();
  }

  private updateLabels(): void {
    this.setInputValidity(this.minInput, true);
    this.setInputValidity(this.maxInput, true);

    const formattedMin = this.formatMinutes(this.currentMinTime);
    const formattedMax = this.formatMinutes(this.currentMaxTime);

    if (this.minInput) {
      this.minInput.value = formattedMin;
    }

    if (this.maxInput) {
      this.maxInput.value = formattedMax;
    }

    const isFiltered = !(
      this.currentMinTime === 0 && this.currentMaxTime === 1440
    );
    const shouldShowFilter = isFiltered;
    if (this.minInput) {
      this.minInput.classList.toggle("is-filtered", shouldShowFilter);
    }
    if (this.maxInput) {
      this.maxInput.classList.toggle("is-filtered", shouldShowFilter);
    }

    if (this.currentLabel) {
      const timeDiff = this.currentMaxTime - this.currentMinTime;
      this.currentLabel.textContent = this.formatDurationLabel(timeDiff);
      this.currentLabel.classList.toggle("is-filtered", isFiltered);
    }

    this.updatePresetButtonStates();
  }

  private updateRangeTrack(): void {
    const minPercent = (this.currentMinTime / 1440) * 100;
    const maxPercent = (this.currentMaxTime / 1440) * 100;

    this.rangeTrack.style.left = `${minPercent}%`;
    this.rangeTrack.style.width = `${Math.max(0, maxPercent - minPercent)}%`;
  }

  private togglePlay(): void {
    if (this.isPlaying) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  }

  private startPlay(): void {
    this.stopPlay();
    this.isPlaying = true;
    this.setPlayButtonState(true);

    if (this.isFullRange(this.currentMinTime, this.currentMaxTime)) {
      this.setCurrentRange(0, this.getSnapInterval());
      this.updatePlaybackFrame();
    }

    this.playInterval = window.setInterval(() => {
      this.advancePlaybackRange();
      this.updatePlaybackFrame();
    }, 500);
  }

  private stopPlay(): void {
    this.isPlaying = false;
    this.setPlayButtonState(false);
    if (this.playInterval) {
      window.clearInterval(this.playInterval);
      this.playInterval = 0;
    }
  }

  private advancePlaybackRange(): void {
    const snapInterval = this.getSnapInterval();
    const duration = this.getPlaybackDuration();

    if (this.currentMaxTime >= FULL_DAY_MINUTES) {
      this.setCurrentRange(0, duration);
      return;
    }

    const nextMin = this.currentMinTime + snapInterval;
    const nextMax = this.currentMaxTime + snapInterval;

    if (nextMax > FULL_DAY_MINUTES) {
      this.setCurrentRange(0, duration);
      return;
    }

    this.setCurrentRange(nextMin, nextMax);
  }

  private getPlaybackDuration(): number {
    const snapInterval = this.getSnapInterval();
    const duration = this.currentMaxTime - this.currentMinTime;

    if (duration <= 0 || duration >= FULL_DAY_MINUTES) {
      return snapInterval;
    }

    return Math.max(snapInterval, Math.min(FULL_DAY_MINUTES, duration));
  }

  private updatePlaybackFrame(): void {
    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter(false);
  }

  private resetSlider(): void {
    this.stopPlay();
    this.currentMinTime = 0; // 00:00
    this.currentMaxTime = FULL_DAY_MINUTES; // 24:00

    this.syncSliderValues();

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter(true);
  }

  private onMinInputChange(): void {
    if (!this.minInput) {
      return;
    }

    const parsedMinutes = this.parseTimeInput(this.minInput.value);
    if (parsedMinutes === null) {
      this.setInputValidity(this.minInput, false, INVALID_TIME_MESSAGE);
      this.minInput.classList.remove("is-filtered");
      return;
    }

    this.setInputValidity(this.minInput, true);

    this.stopPlay();

    const range = this.normalizeRange(
      parsedMinutes,
      this.currentMaxTime,
      "end",
    );
    this.currentMinTime = range.min;
    this.currentMaxTime = range.max;
    this.syncSliderValues();

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter(true);
  }

  private onMaxInputChange(): void {
    if (!this.maxInput) {
      return;
    }

    const parsedMinutes = this.parseTimeInput(this.maxInput.value);
    if (parsedMinutes === null) {
      this.setInputValidity(this.maxInput, false, INVALID_TIME_MESSAGE);
      this.maxInput.classList.remove("is-filtered");
      return;
    }

    this.setInputValidity(this.maxInput, true);

    this.stopPlay();

    const range = this.normalizeRange(
      this.currentMinTime,
      parsedMinutes,
      "start",
    );
    this.currentMinTime = range.min;
    this.currentMaxTime = range.max;
    this.syncSliderValues();

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter(true);
  }

  // Parse user-entered times such as "07:30", "7:30 AM", or "1730" into minutes.
  private parseTimeInput(rawValue: string): number | null {
    if (!rawValue) {
      return null;
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }

    const ampmMatch = trimmed.match(
      /^([0-9]{1,2})(?::([0-9]{2})(?::([0-9]{2}))?)?\s*(AM|PM)?$/i,
    );

    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
      const seconds = ampmMatch[3] ? parseInt(ampmMatch[3], 10) : 0;
      const suffix = ampmMatch[4]?.toUpperCase();

      if (minutes >= 60 || seconds >= 60) {
        return null;
      }

      if (suffix) {
        if (hours > 12 || hours < 1) {
          return null;
        }

        if (hours === 12) {
          hours = suffix === "AM" ? 0 : 12;
        } else if (suffix === "PM") {
          hours += 12;
        }
      } else {
        if (hours > 24 || hours < 0) {
          return null;
        }

        if (hours === 24 && minutes !== 0) {
          return null;
        }
      }

      const baseMinutes = hours * 60 + minutes;
      const roundedSeconds = seconds >= 30 ? 1 : 0;
      return Math.min(1440, baseMinutes + roundedSeconds);
    }

    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      if (numericValue >= 0 && numericValue <= 24) {
        let hours = Math.floor(numericValue);
        let minutes = Math.round((numericValue - hours) * 60);

        if (minutes === 60) {
          hours += 1;
          minutes = 0;
        }

        if (hours > 24 || minutes >= 60) {
          return null;
        }

        if (hours === 24 && minutes !== 0) {
          return null;
        }

        return Math.min(1440, hours * 60 + minutes);
      }

      if (numericValue >= 0 && numericValue <= 2400) {
        const hours = Math.floor(numericValue / 100);
        const minutes = Math.round(numericValue % 100);
        if (hours > 24 || minutes >= 60) {
          return null;
        }

        if (hours === 24 && minutes !== 0) {
          return null;
        }

        return Math.min(1440, hours * 60 + minutes);
      }
    }

    return null;
  }

  private selectTimeRange(startTime: number, endTime: number): void {
    this.stopPlay();

    this.setCurrentRange(startTime, endTime);

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter(true);
  }

  private scheduleFilterApplication(): void {
    this.clearScheduledFilterApplication();

    this.filterDebounceTimer = window.setTimeout(() => {
      this.filterDebounceTimer = 0;
      this.applyFilter(false);
    }, 150);
  }

  private clearScheduledFilterApplication(): void {
    if (this.filterDebounceTimer) {
      window.clearTimeout(this.filterDebounceTimer);
      this.filterDebounceTimer = 0;
    }
  }

  private applyFilter(persistRange: boolean = false): void {
    if (
      !this.dataView ||
      !this.dataView.categorical ||
      !this.dataView.categorical.categories ||
      !this.dataView.categorical.categories[0]
    ) {
      return;
    }

    // If full range is selected (00:00 to 24:00), clear the filter
    if (this.currentMinTime === 0 && this.currentMaxTime === 1440) {
      this.clearFilter();
      if (persistRange) {
        this.persistCurrentRange();
      }
      return;
    }

    // Get the actual column information from the data view
    const timeColumn = this.dataView.categorical.categories[0];
    const target = this.getFilterTarget(timeColumn);
    if (!target) {
      console.warn("Unable to resolve filter target for time column");
      return;
    }

    const sampleValue = this.getFirstDefinedValue(
      timeColumn.values as PrimitiveValue[],
    );
    const startTime = this.getFilterValueForMinutes(
      this.currentMinTime,
      sampleValue,
    );
    const endTime = this.getFilterValueForMinutes(
      this.currentMaxTime,
      sampleValue,
    );

    const lower = startTime <= endTime ? startTime : endTime;
    const upper = startTime <= endTime ? endTime : startTime;

    const filter = {
      $schema: ADVANCED_FILTER_SCHEMA,
      target,
      filterType: ADVANCED_FILTER_TYPE,
      logicalOperator: "And",
      conditions: [
        {
          operator: "GreaterThanOrEqual",
          value: lower,
        },
        {
          operator: "LessThanOrEqual",
          value: upper,
        },
      ],
    };

    try {
      this.host.applyJsonFilter(
        filter,
        "general",
        "filter",
        FilterAction.merge,
      );
      if (persistRange) {
        this.persistCurrentRange();
      }
    } catch (error) {
      console.error("Error applying time filter", error);
    }
  }

  private setCurrentRange(startTime: number, endTime: number): void {
    const range = this.normalizeRange(startTime, endTime);
    this.currentMinTime = range.min;
    this.currentMaxTime = range.max;
    this.syncSliderValues();
  }

  private getRangeKey(startTime: number, endTime: number): string {
    return `${startTime}:${endTime}`;
  }

  private isFullRange(startTime: number, endTime: number): boolean {
    return startTime === 0 && endTime === 1440;
  }

  private persistCurrentRange(): void {
    const rangeKey = this.getRangeKey(this.currentMinTime, this.currentMaxTime);
    if (this.lastPersistedRangeKey === rangeKey) {
      return;
    }

    this.lastPersistedRangeKey = rangeKey;

    this.host.persistProperties({
      merge: [
        {
          objectName: "timeSlicerSettings",
          properties: {
            selectedStartTime: this.currentMinTime,
            selectedEndTime: this.currentMaxTime,
          },
          selector: null as any,
        },
      ],
    });
  }

  private clearFilter(): void {
    try {
      this.selectionManager.clear();
      this.host.applyJsonFilter(
        null as unknown as powerbi.IFilter,
        "general",
        "filter",
        FilterAction.remove,
      );
    } catch (error) {
      console.error("Error clearing filter:", error);
    }
  }

  private getFilterTarget(
    column: any,
  ): { table: string; column: string } | undefined {
    const source = column?.source;
    if (!source) {
      return undefined;
    }

    const identityExpr =
      source.identityExprs?.[0] ||
      column.identityFields?.[0] ||
      column.identityExprs?.[0];
    const columnExpr = identityExpr && (identityExpr as any).column;
    if (columnExpr?.entity && columnExpr?.name) {
      return {
        table: columnExpr.entity,
        column: columnExpr.name,
      };
    }

    const queryName = source.queryName;
    if (queryName) {
      const targetFromQuery = this.parseTargetFromQueryName(queryName);
      if (targetFromQuery) {
        return targetFromQuery;
      }
    }

    if (source.displayName) {
      return {
        table: source.displayName,
        column: source.displayName,
      };
    }

    return undefined;
  }

  private parseTargetFromQueryName(
    reference: string,
  ): { table: string; column: string } | undefined {
    const bracketMatch = reference.match(/'?([^'\[]+)'?\[([^\]]+)\]/);
    if (bracketMatch && bracketMatch.length >= 3) {
      return {
        table: bracketMatch[1],
        column: bracketMatch[2],
      };
    }

    const dotParts = reference.split(".");
    if (dotParts.length >= 2) {
      return {
        table: dotParts[0],
        column: dotParts.slice(1).join("."),
      };
    }

    return undefined;
  }

  private getFirstDefinedValue(
    values: PrimitiveValue[],
  ): PrimitiveValue | undefined {
    for (const value of values) {
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return undefined;
  }

  private getFilterValueForMinutes(
    minutes: number,
    sampleValue: PrimitiveValue | undefined,
  ): PrimitiveValue {
    if (sampleValue instanceof Date) {
      const baseDate = new Date(sampleValue.getTime());
      baseDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return baseDate;
    }

    if (typeof sampleValue === "number") {
      if (
        Number.isFinite(sampleValue) &&
        sampleValue >= 0 &&
        sampleValue <= 1
      ) {
        return minutes / 1440;
      }
      return minutes;
    }

    if (typeof sampleValue === "string") {
      const trimmed = sampleValue.trim();
      const includeSeconds = /:\d{2}(?::\d{2})?$/.test(trimmed)
        ? trimmed.split(":").length === 3
        : false;
      const usesAmPm = /\s?(AM|PM)$/i.test(trimmed);
      const preserveLeadingZero = usesAmPm && /^0\d/.test(trimmed);

      return this.formatMinutesAsString(
        minutes,
        includeSeconds,
        usesAmPm,
        preserveLeadingZero,
      );
    }

    return minutes;
  }

  private getMinutesForFilterValue(
    value: PrimitiveValue,
    sampleValue: PrimitiveValue | undefined,
  ): number | undefined {
    if (value instanceof Date) {
      const baseMinutes = value.getHours() * 60 + value.getMinutes();

      if (sampleValue instanceof Date) {
        const filterMidnight = new Date(value.getTime());
        filterMidnight.setHours(0, 0, 0, 0);

        const sampleMidnight = new Date(sampleValue.getTime());
        sampleMidnight.setHours(0, 0, 0, 0);

        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        const dayOffset = Math.round(
          (filterMidnight.getTime() - sampleMidnight.getTime()) /
            millisecondsPerDay,
        );

        return dayOffset * 1440 + baseMinutes;
      }

      return baseMinutes;
    }

    if (typeof value === "number") {
      if (
        typeof sampleValue === "number" &&
        Number.isFinite(sampleValue) &&
        sampleValue >= 0 &&
        sampleValue <= 1
      ) {
        return value * 1440;
      }

      return value;
    }

    if (typeof value === "string") {
      return this.parseTimeInput(value) ?? undefined;
    }

    return undefined;
  }

  private getRangeFromJsonFilters(
    filters: powerbi.IFilter[] | undefined,
    column: any,
  ): { min: number; max: number } | undefined {
    if (!filters || filters.length === 0) {
      return undefined;
    }

    const target = this.getFilterTarget(column);
    if (!target) {
      return undefined;
    }

    const sampleValue = this.getFirstDefinedValue(
      column.values as PrimitiveValue[],
    );

    for (const candidate of filters as any[]) {
      if (
        candidate?.$schema !== ADVANCED_FILTER_SCHEMA ||
        !candidate?.target ||
        candidate.target.table !== target.table ||
        candidate.target.column !== target.column ||
        !Array.isArray(candidate.conditions)
      ) {
        continue;
      }

      let lowerBound: number | undefined;
      let upperBound: number | undefined;

      for (const condition of candidate.conditions) {
        const minutes = this.getMinutesForFilterValue(
          condition?.value,
          sampleValue,
        );

        if (typeof minutes !== "number" || !Number.isFinite(minutes)) {
          continue;
        }

        if (
          condition.operator === "GreaterThan" ||
          condition.operator === "GreaterThanOrEqual"
        ) {
          lowerBound = minutes;
        }

        if (
          condition.operator === "LessThan" ||
          condition.operator === "LessThanOrEqual"
        ) {
          upperBound = minutes;
        }
      }

      if (typeof lowerBound === "number" && typeof upperBound === "number") {
        const min = this.clampMinutes(Math.min(lowerBound, upperBound), 0);
        const max = this.clampMinutes(Math.max(lowerBound, upperBound), 1440);

        if (min < max) {
          return { min, max };
        }
      }
    }

    return undefined;
  }

  private getRangeFromPersistedSettings():
    | { min: number; max: number }
    | undefined {
    if (!this.settings) {
      return undefined;
    }

    if (
      typeof this.settings.selectedStartTime !== "number" ||
      typeof this.settings.selectedEndTime !== "number"
    ) {
      return undefined;
    }

    const min = this.clampMinutes(this.settings.selectedStartTime, 0);
    const max = this.clampMinutes(this.settings.selectedEndTime, 1440);

    return min < max ? { min, max } : undefined;
  }

  private formatMinutesAsString(
    minutes: number,
    includeSeconds: boolean,
    useTwelveHourClock: boolean,
    preserveLeadingZeroOnHour: boolean,
  ): string {
    const boundedMinutes = Math.max(0, Math.min(1439, Math.round(minutes)));
    const hours24 = Math.floor(boundedMinutes / 60);
    const mins = boundedMinutes % 60;
    const secondsSegment = includeSeconds ? ":00" : "";

    if (useTwelveHourClock) {
      const suffix = hours24 >= 12 ? "PM" : "AM";
      const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
      const hourText = preserveLeadingZeroOnHour
        ? hour12.toString().padStart(2, "0")
        : hour12.toString();
      return `${hourText}:${mins
        .toString()
        .padStart(2, "0")}${secondsSegment} ${suffix}`.trim();
    }

    return `${hours24.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}${secondsSegment}`;
  }

  private formatMinutes(minutes: number): string {
    const format = this.settings?.timeFormat || "HH:MM";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (format === "h:mm A") {
      const period = hours >= 12 ? "PM" : "AM";
      const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHour}:${mins.toString().padStart(2, "0")} ${period}`;
    }

    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  }

  private formatDurationLabel(minutes: number): string {
    const boundedMinutes = Math.max(
      0,
      Math.min(FULL_DAY_MINUTES, Math.round(minutes)),
    );
    const hours = Math.floor(boundedMinutes / 60);
    const mins = boundedMinutes % 60;
    const parts: string[] = [];

    if (hours > 0) {
      parts.push(`${hours}h`);
    }

    if (mins > 0 || parts.length === 0) {
      parts.push(`${mins}m`);
    }

    return `${parts.join(" ")} selected`;
  }

  private getSnapInterval(): number {
    return Visual.normalizeSnapInterval(
      this.settings?.snapInterval ?? DEFAULT_SNAP_INTERVAL,
    );
  }

  private snapMinutes(
    value: number | undefined,
    defaultValue: number,
  ): number {
    const numeric =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : defaultValue;
    const snapInterval = this.getSnapInterval();
    const rounded = Math.round(numeric / snapInterval) * snapInterval;
    return Math.max(0, Math.min(FULL_DAY_MINUTES, rounded));
  }

  private normalizeRange(
    startTime: number,
    endTime: number,
    preserve: "start" | "end" | "none" = "none",
  ): { min: number; max: number } {
    let min = this.snapMinutes(startTime, 0);
    let max = this.snapMinutes(endTime, FULL_DAY_MINUTES);
    const snapInterval = this.getSnapInterval();

    if (max <= min) {
      if (preserve === "end") {
        min = Math.max(0, max - snapInterval);
        if (max <= min) {
          max = Math.min(FULL_DAY_MINUTES, min + snapInterval);
        }
      } else if (preserve === "start") {
        max = Math.min(FULL_DAY_MINUTES, min + snapInterval);
        if (max <= min) {
          min = Math.max(0, max - snapInterval);
        }
      } else if (min >= FULL_DAY_MINUTES) {
        min = Math.max(0, FULL_DAY_MINUTES - snapInterval);
        max = FULL_DAY_MINUTES;
      } else {
        max = Math.min(FULL_DAY_MINUTES, min + snapInterval);
      }
    }

    return { min, max };
  }

  private syncSliderValues(): void {
    if (this.minSlider) {
      this.minSlider.value = this.currentMinTime.toString();
    }

    if (this.maxSlider) {
      this.maxSlider.value = this.currentMaxTime.toString();
    }
  }

  private clampMinutes(
    value: number | undefined,
    defaultValue: number,
  ): number {
    return this.snapMinutes(value, defaultValue);
  }

  private getResolvedPresetRange(key: string): ResolvedPresetRange {
    const definition =
      DEFAULT_PRESET_RANGES.find((item) => item.key === key) ||
      DEFAULT_PRESET_RANGES[0];
    const index = DEFAULT_PRESET_RANGES.indexOf(definition);
    const configuredRange = this.settings?.presetRanges?.[index];
    const label = this.normalizePresetLabel(
      configuredRange?.label,
      definition.label,
    );
    const start = this.parsePresetTime(
      configuredRange?.start,
      definition.defaultStartMinutes,
    );
    const end = this.parsePresetTime(
      configuredRange?.end,
      definition.defaultEndMinutes,
    );
    const resolvedStart = start ?? definition.defaultStartMinutes;
    const resolvedEnd = end ?? definition.defaultEndMinutes;

    return {
      key: definition.key,
      label,
      start: resolvedStart,
      end: resolvedEnd,
      isValid:
        typeof start === "number" &&
        typeof end === "number" &&
        resolvedStart < resolvedEnd,
    };
  }

  private parsePresetTime(
    value: string | undefined,
    defaultMinutes: number,
  ): number | undefined {
    if (typeof value !== "string" || value.trim() === "") {
      return this.clampMinutes(defaultMinutes, defaultMinutes);
    }

    const parsed = this.parseTimeInput(value);
    if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
      return undefined;
    }

    return this.clampMinutes(parsed, defaultMinutes);
  }

  private normalizePresetLabel(
    value: string | undefined,
    defaultValue: string,
  ): string {
    const label = typeof value === "string" ? value.trim() : "";
    return label || defaultValue;
  }

  private updatePresetButtons(): void {
    this.presetButtons.forEach((presetButton) => {
      const preset = this.getResolvedPresetRange(presetButton.key);
      presetButton.button.textContent = this.formatPresetButtonLabel(preset);

      if (preset.isValid) {
        presetButton.button.title = `Apply ${preset.label} ${this.formatMinutes(
          preset.start,
        )} to ${this.formatMinutes(preset.end)}`;
        presetButton.button.disabled = false;
        presetButton.button.setAttribute("aria-disabled", "false");
      } else {
        presetButton.button.title =
          "Set valid start and end values in Custom Time Ranges.";
        presetButton.button.disabled = true;
        presetButton.button.setAttribute("aria-disabled", "true");
      }
    });

    this.updatePresetButtonStates();
  }

  private formatPresetButtonLabel(preset: ResolvedPresetRange): string {
    if (!preset.isValid) {
      return `${preset.label} (Invalid range)`;
    }

    return `${preset.label} (${this.formatPresetRange(preset)})`;
  }

  private formatPresetRange(preset: ResolvedPresetRange): string {
    const canUseHourRange =
      preset.key !== "preset4" &&
      preset.start % 60 === 0 &&
      preset.end % 60 === 0;

    if (canUseHourRange) {
      return `${preset.start / 60}-${preset.end / 60}`;
    }

    return `${this.formatMinutes(preset.start)}-${this.formatMinutes(
      preset.end,
    )}`;
  }

  private extractTableName(queryName: string): string {
    if (!queryName) return "Table";

    const parts = queryName.split(".");
    return parts.length > 1 ? parts[0] : "Table";
  }

  private getDebugSampleValues(
    values:
      | PrimitiveValue[]
      | { length?: number; [index: number]: PrimitiveValue },
  ): PrimitiveValue[] {
    if (!values) {
      return [];
    }

    if (Array.isArray(values)) {
      return values.slice(0, 5);
    }

    const length =
      typeof values.length === "number" && Number.isFinite(values.length)
        ? Math.max(0, Math.min(5, values.length))
        : 0;

    const samples: PrimitiveValue[] = [];
    for (let index = 0; index < length; index += 1) {
      samples.push(values[index]);
    }

    return samples;
  }

  public update(options: VisualUpdateOptions) {
    this.settings = Visual.parseSettings(
      options && options.dataViews && options.dataViews[0],
      this.getThemeDefaults(),
    );

    this.applySettings();

    if (
      options.dataViews &&
      options.dataViews[0] &&
      options.dataViews[0].categorical
    ) {
      this.dataView = options.dataViews[0];
      const categorical = options.dataViews[0].categorical;

      if (categorical.categories && categorical.categories[0]) {
        // Log column information for debugging
        const column = categorical.categories[0];
        console.log("Time column info:", {
          displayName: column.source.displayName,
          queryName: column.source.queryName,
          type: column.source.type,
          sampleValues: this.getDebugSampleValues(
            column.values as
              | PrimitiveValue[]
              | {
                  length?: number;
                  [index: number]: PrimitiveValue;
                },
          ),
        });

        // For time slicer, we don't need to process the data values
        // The slider ranges are fixed from 0-1440 minutes (00:00-24:00)

        const restoredRange = this.getRangeFromJsonFilters(
          options.jsonFilters,
          column,
        );
        const persistedRange = this.getRangeFromPersistedSettings();
        const shouldRestoreRange =
          !this.isSliderInteractionActive && !this.isPlaying;

        if (shouldRestoreRange && restoredRange) {
          this.setCurrentRange(restoredRange.min, restoredRange.max);
          this.hasAppliedPersistedFilter = true;
        } else if (shouldRestoreRange && persistedRange) {
          this.setCurrentRange(persistedRange.min, persistedRange.max);
        }

        // Initialize time values if not set
        if (this.currentMaxTime === 0) {
          this.currentMinTime = 0; // 00:00
          this.currentMaxTime = 1440; // 24:00
          this.minSlider.value = this.currentMinTime.toString();
          this.maxSlider.value = this.currentMaxTime.toString();
        }

        this.updateLabels();
        this.updateRangeTrack();

        if (
          shouldRestoreRange &&
          !restoredRange &&
          persistedRange &&
          !this.hasAppliedPersistedFilter &&
          !this.isFullRange(persistedRange.min, persistedRange.max)
        ) {
          this.hasAppliedPersistedFilter = true;
          this.applyFilter();
        }
      }
    }
  }

  private applySettings(): void {
    if (!this.settings) return;

    const compactMode = this.settings.compactMode === true;
    const darkMode = this.isDarkColor(this.settings.backgroundColor);
    const snapInterval = this.getSnapInterval();

    this.container.classList.toggle("compact", compactMode);
    this.container.classList.toggle("theme-dark", darkMode);

    const accentColor = this.settings.accentColor || "#0072BC";
    const backgroundColor = this.settings.backgroundColor || "#FFFFFF";
    const textColor =
      this.settings.textColor || (darkMode ? "#F8FAFC" : "#0F172A");
    const accentLight = this.mixColors(
      accentColor,
      darkMode ? backgroundColor : "#FFFFFF",
      darkMode ? 0.28 : 0.82,
      darkMode ? "#005A94" : "#D1E6F3",
    );
    const accentDark = this.mixColors(
      accentColor,
      darkMode ? "#000000" : "#0F172A",
      0.18,
      "#0362A2",
    );
    const surfaceColor = darkMode ? "#1E293B" : "#F8FAFC";
    const borderColor = darkMode ? "#334155" : "#E2E8F0";
    const secondaryTextColor = darkMode ? "#94A3B8" : "#64748B";
    const resetColor = darkMode ? "#1E293B" : "#F1F5F9";
    const resetTextColor = darkMode ? "#CBD5E1" : "#475569";

    this.container.style.setProperty("--color-accent", accentColor);
    this.container.style.setProperty("--color-accent-light", accentLight);
    this.container.style.setProperty("--color-accent-dark", accentDark);
    this.container.style.setProperty("--color-bg", backgroundColor);
    this.container.style.setProperty("--color-surface", surfaceColor);
    this.container.style.setProperty("--color-border", borderColor);
    this.container.style.setProperty("--color-track-bg", borderColor);
    this.container.style.setProperty("--color-thumb", "#FFFFFF");
    this.container.style.setProperty("--color-text-primary", textColor);
    this.container.style.setProperty(
      "--color-text-secondary",
      secondaryTextColor,
    );
    this.container.style.setProperty("--color-success", "#10B981");
    this.container.style.setProperty("--color-reset", resetColor);
    this.container.style.setProperty("--color-reset-text", resetTextColor);
    this.container.style.backgroundColor = backgroundColor;
    this.container.style.color = textColor;

    this.minSlider.step = snapInterval.toString();
    this.maxSlider.step = snapInterval.toString();
    this.setCurrentRange(this.currentMinTime, this.currentMaxTime);

    const showInputs = this.settings.showLabels !== false || compactMode;
    if (this.labelsContainer) {
      this.labelsContainer.style.justifyContent = showInputs
        ? "space-between"
        : "center";
    }

    if (this.minInput) {
      this.minInput.style.display = showInputs ? "" : "none";
    }

    if (this.maxInput) {
      this.maxInput.style.display = showInputs ? "" : "none";
    }

    if (this.controlsContainer) {
      this.controlsContainer.style.display = compactMode ? "none" : "";
    }

    if (this.quickSelectContainer) {
      this.quickSelectContainer.style.display = compactMode ? "none" : "";
    }

    if (this.titleElement) {
      this.titleElement.style.display = compactMode ? "none" : "";
    }

    if (this.sliderContainer) {
      this.sliderContainer.style.height = compactMode ? "20px" : "20px";
    }

    this.updatePresetButtons();

    this.updateRangeTrack();
    this.updateLabels();
    this.setPlayButtonState(this.isPlaying);
  }

  private getThemeDefaults(): {
    accentColor: string;
    backgroundColor: string;
    textColor: string;
  } {
    const palette = (this.host as any)?.colorPalette;
    const backgroundColor =
      Visual.readPaletteColor(palette?.background) || "#FFFFFF";
    const textColor =
      Visual.readPaletteColor(palette?.foreground) ||
      (this.isDarkColor(backgroundColor) ? "#F8FAFC" : "#0F172A");

    return {
      accentColor: "#0072BC",
      backgroundColor,
      textColor,
    };
  }

  private static parseSettings(
    dataView: DataView,
    themeDefaults: {
      accentColor: string;
      backgroundColor: string;
      textColor: string;
    },
  ): TimeSlicerSettings {
    const objects = dataView?.metadata?.objects;
    const legacyCustomStartTime = Visual.getOptionalNumberValue(
      objects,
      "timeSlicerSettings",
      "customStartTime",
    );
    const legacyCustomEndTime = Visual.getOptionalNumberValue(
      objects,
      "timeSlicerSettings",
      "customEndTime",
    );

    return {
      accentColor: Visual.getColorValue(
        objects,
        "timeSlicerSettings",
        "accentColor",
        Visual.getColorValue(
          objects,
          "timeSlicerSettings",
          "sliderColor",
          themeDefaults.accentColor,
        ),
      ),
      backgroundColor: Visual.getColorValue(
        objects,
        "timeSlicerSettings",
        "backgroundColor",
        themeDefaults.backgroundColor,
      ),
      textColor: Visual.getColorValue(
        objects,
        "timeSlicerSettings",
        "textColor",
        themeDefaults.textColor,
      ),
      showLabels: Visual.getValue(
        objects,
        "timeSlicerSettings",
        "showLabels",
        true,
      ),
      timeFormat: Visual.getValue(
        objects,
        "timeSlicerSettings",
        "timeFormat",
        "HH:MM",
      ),
      compactMode: Visual.getValue(
        objects,
        "timeSlicerSettings",
        "compactMode",
        false,
      ),
      snapInterval: Visual.normalizeSnapInterval(
        Visual.getNumberValue(
          objects,
          "timeSlicerSettings",
          "snapInterval",
          DEFAULT_SNAP_INTERVAL,
        ),
      ),
      customStartTime: legacyCustomStartTime ?? 540,
      customEndTime: legacyCustomEndTime ?? 1020,
      presetRanges: Visual.parsePresetRangeSettings(
        objects,
        legacyCustomStartTime,
        legacyCustomEndTime,
      ),
      selectedStartTime: Visual.getOptionalNumberValue(
        objects,
        "timeSlicerSettings",
        "selectedStartTime",
      ),
      selectedEndTime: Visual.getOptionalNumberValue(
        objects,
        "timeSlicerSettings",
        "selectedEndTime",
      ),
    };
  }

  private static parsePresetRangeSettings(
    objects: any,
    legacyCustomStartTime: number | undefined,
    legacyCustomEndTime: number | undefined,
  ): PresetRangeSettings[] {
    return DEFAULT_PRESET_RANGES.map((preset) => {
      const startPropertyName = `${preset.key}Start`;
      const endPropertyName = `${preset.key}End`;
      const hasPresetStart = Visual.hasObjectProperty(
        objects,
        PRESET_RANGES_OBJECT_NAME,
        startPropertyName,
      );
      const hasPresetEnd = Visual.hasObjectProperty(
        objects,
        PRESET_RANGES_OBJECT_NAME,
        endPropertyName,
      );
      let start = Visual.getStringValue(
        objects,
        PRESET_RANGES_OBJECT_NAME,
        startPropertyName,
        preset.start,
      );
      let end = Visual.getStringValue(
        objects,
        PRESET_RANGES_OBJECT_NAME,
        endPropertyName,
        preset.end,
      );

      if (
        preset.key === "preset4" &&
        !hasPresetStart &&
        typeof legacyCustomStartTime === "number"
      ) {
        start = Visual.formatSettingsTimeValue(legacyCustomStartTime);
      }

      if (
        preset.key === "preset4" &&
        !hasPresetEnd &&
        typeof legacyCustomEndTime === "number"
      ) {
        end = Visual.formatSettingsTimeValue(legacyCustomEndTime);
      }

      return {
        label: Visual.getStringValue(
          objects,
          PRESET_RANGES_OBJECT_NAME,
          `${preset.key}Label`,
          preset.label,
        ),
        start,
        end,
      };
    });
  }

  private static readPaletteColor(
    value: string | { value?: string } | undefined,
  ): string | undefined {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value?.value === "string") {
      return value.value;
    }

    return undefined;
  }

  private static normalizeSnapInterval(value: number): number {
    return SNAP_INTERVALS.indexOf(value) >= 0
      ? value
      : DEFAULT_SNAP_INTERVAL;
  }

  private static getValue(
    objects: any,
    objectName: string,
    propertyName: string,
    defaultValue: any,
  ): any {
    if (
      objects &&
      objects[objectName] &&
      objects[objectName][propertyName] !== undefined
    ) {
      return objects[objectName][propertyName];
    }
    return defaultValue;
  }

  private static hasObjectProperty(
    objects: any,
    objectName: string,
    propertyName: string,
  ): boolean {
    return (
      objects &&
      objects[objectName] &&
      objects[objectName][propertyName] !== undefined
    );
  }

  private static getStringValue(
    objects: any,
    objectName: string,
    propertyName: string,
    defaultValue: string,
  ): string {
    const value = Visual.getValue(
      objects,
      objectName,
      propertyName,
      defaultValue,
    );
    return value === undefined || value === null ? defaultValue : String(value);
  }

  private static formatSettingsTimeValue(minutes: number): string {
    const boundedMinutes = Math.max(
      0,
      Math.min(FULL_DAY_MINUTES, Math.round(minutes)),
    );
    if (boundedMinutes === FULL_DAY_MINUTES) {
      return "24:00";
    }

    const hours = Math.floor(boundedMinutes / 60);
    const mins = boundedMinutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}`;
  }

  private static getNumberValue(
    objects: any,
    objectName: string,
    propertyName: string,
    defaultValue: number,
  ): number {
    const value = Visual.getValue(
      objects,
      objectName,
      propertyName,
      defaultValue,
    );
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : defaultValue;
  }

  private static getOptionalNumberValue(
    objects: any,
    objectName: string,
    propertyName: string,
  ): number | undefined {
    const value = Visual.getValue(
      objects,
      objectName,
      propertyName,
      undefined,
    );
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : undefined;
  }

  private static getColorValue(
    objects: any,
    objectName: string,
    propertyName: string,
    defaultColor: string,
  ): string {
    const value = Visual.getValue(
      objects,
      objectName,
      propertyName,
      defaultColor,
    );

    if (typeof value === "string") {
      return value;
    }

    const solidColor = value?.solid?.color;
    if (typeof solidColor === "string") {
      return solidColor;
    }

    return defaultColor;
  }

  private static createColorFill(color: string): Fill {
    return {
      solid: {
        color,
      },
    };
  }

  private mixColors(
    baseColor: string,
    mixColor: string,
    mixAmount: number,
    fallbackColor: string,
  ): string {
    const base = Visual.parseHexColor(baseColor);
    const mix = Visual.parseHexColor(mixColor);

    if (!base || !mix) {
      return fallbackColor;
    }

    const ratio = Math.max(0, Math.min(1, mixAmount));

    return Visual.toHexColor({
      r: Math.round(base.r * (1 - ratio) + mix.r * ratio),
      g: Math.round(base.g * (1 - ratio) + mix.g * ratio),
      b: Math.round(base.b * (1 - ratio) + mix.b * ratio),
    });
  }

  private isDarkColor(color: string): boolean {
    const parsed = Visual.parseHexColor(color);
    if (!parsed) {
      return false;
    }

    const toLinear = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };

    const luminance =
      0.2126 * toLinear(parsed.r) +
      0.7152 * toLinear(parsed.g) +
      0.0722 * toLinear(parsed.b);

    return luminance < 0.3;
  }

  private static parseHexColor(
    color: string,
  ): { r: number; g: number; b: number } | undefined {
    const normalized = color.trim();
    const shortMatch = normalized.match(/^#([0-9a-fA-F]{3})$/);
    if (shortMatch) {
      const expanded = shortMatch[1]
        .split("")
        .map((value) => value + value)
        .join("");
      return Visual.parseHexColor(`#${expanded}`);
    }

    const match = normalized.match(/^#([0-9a-fA-F]{6})$/);
    if (!match) {
      return undefined;
    }

    return {
      r: parseInt(match[1].slice(0, 2), 16),
      g: parseInt(match[1].slice(2, 4), 16),
      b: parseInt(match[1].slice(4, 6), 16),
    };
  }

  private static toHexColor(color: {
    r: number;
    g: number;
    b: number;
  }): string {
    const toHex = (value: number) => value.toString(16).padStart(2, "0");
    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
  }

  private setInputValidity(
    input: HTMLInputElement | undefined,
    isValid: boolean,
    message: string = "",
  ): void {
    if (!input) {
      return;
    }

    input.classList.toggle("is-invalid", !isValid);
    if (!isValid) {
      input.setAttribute("aria-invalid", "true");
      input.title = message || input.title;
    } else {
      input.removeAttribute("aria-invalid");
      const defaultTitle = input.dataset.defaultTitle;
      if (defaultTitle) {
        input.title = defaultTitle;
      }
    }
  }

  public enumerateObjectInstances(
    options: EnumerateVisualObjectInstancesOptions,
  ): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
    const settings: VisualObjectInstance[] = [];

    if (options.objectName === "timeSlicerSettings") {
      settings.push({
        objectName: "timeSlicerSettings",
        properties: {
          accentColor: Visual.createColorFill(
            this.settings?.accentColor || "#0072BC",
          ),
          backgroundColor: Visual.createColorFill(
            this.settings?.backgroundColor || "#FFFFFF",
          ),
          textColor: Visual.createColorFill(
            this.settings?.textColor || "#0F172A",
          ),
          showLabels: this.settings?.showLabels !== false,
          timeFormat: this.settings?.timeFormat || "HH:MM",
          compactMode: this.settings?.compactMode === true,
          snapInterval: this.getSnapInterval().toString(),
        },
        selector: null as any,
      });
    }

    if (options.objectName === PRESET_RANGES_OBJECT_NAME) {
      const presetProperties: Record<string, string> = {};

      DEFAULT_PRESET_RANGES.forEach((preset, index) => {
        const settings = this.settings?.presetRanges?.[index];
        presetProperties[`${preset.key}Label`] =
          settings?.label ?? preset.label;
        presetProperties[`${preset.key}Start`] =
          settings?.start ?? preset.start;
        presetProperties[`${preset.key}End`] = settings?.end ?? preset.end;
      });

      settings.push({
        objectName: PRESET_RANGES_OBJECT_NAME,
        properties: presetProperties,
        selector: null as any,
      });
    }

    return settings;
  }
}
