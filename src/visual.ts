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
const INVALID_TIME_MESSAGE = "Enter a valid time (e.g. 07:30, 7:30 AM, 1730).";

interface TimeSlicerSettings {
  sliderColor: string;
  textColor: string;
  showLabels: boolean;
  timeFormat: string;
  compactMode: boolean;
  customStartTime: number;
  customEndTime: number;
}

export class Visual implements IVisual {
  private target: HTMLElement;
  private host: IVisualHost;
  private selectionManager: ISelectionManager;
  private container: HTMLDivElement;
  private titleElement: HTMLDivElement;
  private sliderContainer: HTMLDivElement;
  private minSlider: HTMLInputElement;
  private maxSlider: HTMLInputElement;
  private minInput: HTMLInputElement;
  private maxInput: HTMLInputElement;
  private currentLabel: HTMLDivElement;
  private labelsContainer: HTMLDivElement;
  private playButton: HTMLButtonElement;
  private rangeTrack: HTMLDivElement;
  private controlsContainer: HTMLDivElement;
  private quickSelectContainer: HTMLDivElement;
  private customQuickSelectButton: HTMLButtonElement;
  private settings: TimeSlicerSettings;
  private timeValues: number[]; // Minutes from midnight (0-1440)
  private currentMinTime: number = 0; // 00:00
  private currentMaxTime: number = 1440; // 24:00
  private isPlaying: boolean = false;
  private playInterval: number;
  private dataView: DataView;

  constructor(options: VisualConstructorOptions) {
    this.target = options.element;
    this.host = options.host;
    this.selectionManager = this.host.createSelectionManager();

    this.container = document.createElement("div");
    this.container.className = "time-slicer-container";
    this.target.appendChild(this.container);

    this.createSliderInterface();
  }
  private createSliderInterface(): void {
    // Title
    this.titleElement = document.createElement("div");
    this.titleElement.className = "slicer-title";
    this.titleElement.textContent = "Time Range";
    this.container.appendChild(this.titleElement);

    // Labels container
    this.labelsContainer = document.createElement("div");
    this.labelsContainer.className = "labels-container";
    this.container.appendChild(this.labelsContainer);

    this.minInput = document.createElement("input");
    this.minInput.type = "text";
    this.minInput.className = "date-label time-input min-label";
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
    this.currentLabel.className = "date-label current-label";
    this.labelsContainer.appendChild(this.currentLabel);

    this.maxInput = document.createElement("input");
    this.maxInput.type = "text";
    this.maxInput.className = "date-label time-input max-label";
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

    // Slider container
    this.sliderContainer = document.createElement("div");
    this.sliderContainer.className = "slider-container";
    this.container.appendChild(this.sliderContainer);

    // Range track
    this.rangeTrack = document.createElement("div");
    this.rangeTrack.className = "range-track";
    this.sliderContainer.appendChild(this.rangeTrack);

    // Min slider - 0 to 1440 minutes (00:00 to 24:00)
    this.minSlider = document.createElement("input");
    this.minSlider.type = "range";
    this.minSlider.className = "range-slider min-slider";
    this.minSlider.min = "0";
    this.minSlider.max = "1440";
    this.minSlider.step = "15"; // 15-minute increments
    this.minSlider.value = "0";
    this.minSlider.addEventListener("input", () => this.onMinSliderChange());
    this.minSlider.addEventListener("mousedown", () =>
      this.bringToFront(this.minSlider)
    );
    this.minSlider.addEventListener("touchstart", () =>
      this.bringToFront(this.minSlider)
    );
    this.sliderContainer.appendChild(this.minSlider);

    // Max slider - 0 to 1440 minutes (00:00 to 24:00)
    this.maxSlider = document.createElement("input");
    this.maxSlider.type = "range";
    this.maxSlider.className = "range-slider max-slider";
    this.maxSlider.min = "0";
    this.maxSlider.max = "1440";
    this.maxSlider.step = "15"; // 15-minute increments
    this.maxSlider.value = "1440";
    this.maxSlider.addEventListener("input", () => this.onMaxSliderChange());
    this.maxSlider.addEventListener("mousedown", () =>
      this.bringToFront(this.maxSlider)
    );
    this.maxSlider.addEventListener("touchstart", () =>
      this.bringToFront(this.maxSlider)
    );
    this.sliderContainer.appendChild(this.maxSlider);

    // Control buttons
    this.controlsContainer = document.createElement("div");
    this.controlsContainer.className = "controls-container";
    this.container.appendChild(this.controlsContainer);

    this.playButton = document.createElement("button");
    this.playButton.className = "play-button";
    this.playButton.textContent = "▶";
    this.playButton.addEventListener("click", () => this.togglePlay());
    this.controlsContainer.appendChild(this.playButton);

    const resetButton = document.createElement("button");
    resetButton.className = "reset-button";
    resetButton.textContent = "Reset";
    resetButton.addEventListener("click", () => this.resetSlider());
    this.controlsContainer.appendChild(resetButton);

    // Quick select buttons
    this.quickSelectContainer = document.createElement("div");
    this.quickSelectContainer.className = "quick-select-container";
    this.container.appendChild(this.quickSelectContainer);

    const quickSelects = [
      { label: "Morning (7-9)", startTime: 420, endTime: 540 }, // 7:00 AM to 9:00 AM
      { label: "Inter-Peak (10-12)", startTime: 600, endTime: 720 }, // 10:00 AM to 12:00 PM
      { label: "PM Peak (16-18)", startTime: 960, endTime: 1080 }, // 4:00 PM to 6:00 PM
    ];

    quickSelects.forEach((item) => {
      const button = document.createElement("button");
      button.className = "quick-select-button";
      button.textContent = item.label;
      button.addEventListener("click", () =>
        this.selectTimeRange(item.startTime, item.endTime)
      );
      this.quickSelectContainer.appendChild(button);
    });

    this.customQuickSelectButton = document.createElement("button");
    this.customQuickSelectButton.className = "quick-select-button";
    this.customQuickSelectButton.addEventListener("click", () => {
      const customRange = this.getCustomRange();
      if (!customRange.isValid) {
        console.warn(
          "Custom quick select range is invalid. Update its settings to enable the button."
        );
        return;
      }
      this.selectTimeRange(customRange.start, customRange.end);
    });
    this.quickSelectContainer.appendChild(this.customQuickSelectButton);

    this.updateCustomQuickSelectButton();
  }

  private bringToFront(slider: HTMLInputElement): void {
    // Reset z-index for both sliders
    this.minSlider.style.zIndex = "3";
    this.maxSlider.style.zIndex = "3";

    // Bring the active slider to front
    slider.style.zIndex = "5";
  }

  private onMinSliderChange(): void {
    const minValue = parseInt(this.minSlider.value);
    const maxValue = parseInt(this.maxSlider.value);

    if (minValue >= maxValue) {
      this.minSlider.value = Math.max(0, maxValue - 15).toString();
      this.currentMinTime = Math.max(0, maxValue - 15);
    } else {
      this.currentMinTime = minValue;
    }

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter();
  }

  private onMaxSliderChange(): void {
    const minValue = parseInt(this.minSlider.value);
    const maxValue = parseInt(this.maxSlider.value);

    if (maxValue <= minValue) {
      this.maxSlider.value = Math.min(1440, minValue + 15).toString();
      this.currentMaxTime = Math.min(1440, minValue + 15);
    } else {
      this.currentMaxTime = maxValue;
    }

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter();
  }

  private updateLabels(): void {
    const forceLabelsInCompact = this.settings?.compactMode === true;
    const labelsEnabled =
      this.settings?.showLabels !== false || forceLabelsInCompact;

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

    if (labelsEnabled && this.currentLabel) {
      const timeDiff = this.currentMaxTime - this.currentMinTime;
      const hours = Math.floor(timeDiff / 60);
      const minutes = timeDiff % 60;
      const statusText = isFiltered ? " (FILTERING)" : "";
      this.currentLabel.textContent = `${hours}h ${minutes}m selected${statusText}`;
    }
  }

  private updateRangeTrack(): void {
    const minPercent = (this.currentMinTime / 1440) * 100;
    const maxPercent = (this.currentMaxTime / 1440) * 100;

    this.rangeTrack.style.background = `linear-gradient(to right, 
            #ddd 0%, 
            #ddd ${minPercent}%, 
            ${this.settings?.sliderColor || "#007acc"} ${minPercent}%, 
            ${this.settings?.sliderColor || "#007acc"} ${maxPercent}%, 
            #ddd ${maxPercent}%, 
            #ddd 100%)`;
  }

  private togglePlay(): void {
    if (this.isPlaying) {
      this.stopPlay();
    } else {
      this.startPlay();
    }
  }

  private startPlay(): void {
    this.isPlaying = true;
    this.playButton.textContent = "⏸";

    this.playInterval = window.setInterval(() => {
      if (this.currentMaxTime >= 1440) {
        this.stopPlay();
        return;
      }

      this.currentMinTime = Math.min(this.currentMinTime + 15, 1425); // Move 15 minutes, max 23:45
      this.currentMaxTime = Math.min(this.currentMaxTime + 15, 1440); // Move 15 minutes, max 24:00

      this.minSlider.value = this.currentMinTime.toString();
      this.maxSlider.value = this.currentMaxTime.toString();

      this.updateLabels();
      this.updateRangeTrack();
      this.applyFilter();
    }, 500);
  }

  private stopPlay(): void {
    this.isPlaying = false;
    this.playButton.textContent = "▶";
    if (this.playInterval) {
      clearInterval(this.playInterval);
    }
  }

  private resetSlider(): void {
    this.stopPlay();
    this.currentMinTime = 0; // 00:00
    this.currentMaxTime = 1440; // 24:00

    this.minSlider.value = this.currentMinTime.toString();
    this.maxSlider.value = this.currentMaxTime.toString();

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter();
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

    const normalized = this.clampMinutes(parsedMinutes, parsedMinutes);
    const maxAllowed = Math.max(0, this.currentMaxTime - 15);
    this.currentMinTime = Math.min(normalized, maxAllowed);
    this.minSlider.value = this.currentMinTime.toString();

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter();
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

    const normalized = this.clampMinutes(parsedMinutes, parsedMinutes);
    const minAllowed = Math.min(1440, this.currentMinTime + 15);
    this.currentMaxTime = Math.max(normalized, minAllowed);
    this.maxSlider.value = this.currentMaxTime.toString();

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter();
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
      /^([0-9]{1,2})(?::([0-9]{2})(?::([0-9]{2}))?)?\s*(AM|PM)?$/i
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

    this.currentMinTime = startTime;
    this.currentMaxTime = endTime;

    this.minSlider.value = this.currentMinTime.toString();
    this.maxSlider.value = this.currentMaxTime.toString();

    this.updateLabels();
    this.updateRangeTrack();
    this.applyFilter();
  }

  private applyFilter(): void {
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
      timeColumn.values as PrimitiveValue[]
    );
    const startTime = this.getFilterValueForMinutes(
      this.currentMinTime,
      sampleValue
    );
    const endTime = this.getFilterValueForMinutes(
      this.currentMaxTime,
      sampleValue
    );

    const lower = startTime <= endTime ? startTime : endTime;
    const upper = startTime <= endTime ? endTime : startTime;

    const filter = {
      $schema: "http://powerbi.com/product/schema#advanced",
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
        FilterAction.merge
      );
    } catch (error) {
      console.error("Error applying time filter", error);
    }
  }

  private clearFilter(): void {
    try {
      this.selectionManager.clear();
      this.host.applyJsonFilter(null, "general", "filter", FilterAction.remove);
    } catch (error) {
      console.error("Error clearing filter:", error);
    }
  }

  private getFilterTarget(
    column: any
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
    reference: string
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
    values: PrimitiveValue[]
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
    sampleValue: PrimitiveValue | undefined
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
        preserveLeadingZero
      );
    }

    return minutes;
  }

  private formatMinutesAsString(
    minutes: number,
    includeSeconds: boolean,
    useTwelveHourClock: boolean,
    preserveLeadingZeroOnHour: boolean
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

  private clampMinutes(
    value: number | undefined,
    defaultValue: number
  ): number {
    const numeric =
      typeof value === "number" && Number.isFinite(value)
        ? value
        : defaultValue;
    const rounded = Math.round(numeric / 15) * 15;
    return Math.max(0, Math.min(1440, rounded));
  }

  private getCustomRange(): {
    start: number;
    end: number;
    isValid: boolean;
  } {
    const defaultStart = 540;
    const defaultEnd = 1020;
    const start = this.clampMinutes(
      this.settings?.customStartTime,
      defaultStart
    );
    const end = this.clampMinutes(this.settings?.customEndTime, defaultEnd);
    return {
      start,
      end,
      isValid: start < end,
    };
  }

  private updateCustomQuickSelectButton(): void {
    if (!this.customQuickSelectButton) {
      return;
    }

    const range = this.getCustomRange();

    if (range.isValid) {
      const label = `Custom (${this.formatMinutes(
        range.start
      )} - ${this.formatMinutes(range.end)})`;
      this.customQuickSelectButton.textContent = label;
      this.customQuickSelectButton.title = `Apply ${this.formatMinutes(
        range.start
      )} to ${this.formatMinutes(range.end)}`;
      this.customQuickSelectButton.disabled = false;
      this.customQuickSelectButton.setAttribute("aria-disabled", "false");
    } else {
      this.customQuickSelectButton.textContent = "Custom (set start/end)";
      this.customQuickSelectButton.title =
        "Set valid Custom Start and Custom End values in the Time Slicer settings.";
      this.customQuickSelectButton.disabled = true;
      this.customQuickSelectButton.setAttribute("aria-disabled", "true");
    }
  }

  private extractTableName(queryName: string): string {
    if (!queryName) return "Table";

    const parts = queryName.split(".");
    return parts.length > 1 ? parts[0] : "Table";
  }

  public update(options: VisualUpdateOptions) {
    this.settings = Visual.parseSettings(
      options && options.dataViews && options.dataViews[0]
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
          sampleValues: column.values.slice(0, 5), // First 5 values for debugging
        });

        // For time slicer, we don't need to process the data values
        // The slider ranges are fixed from 0-1440 minutes (00:00-24:00)

        // Initialize time values if not set
        if (this.currentMaxTime === 0) {
          this.currentMinTime = 0; // 00:00
          this.currentMaxTime = 1440; // 24:00
          this.minSlider.value = this.currentMinTime.toString();
          this.maxSlider.value = this.currentMaxTime.toString();
        }

        this.updateLabels();
        this.updateRangeTrack();
      }
    }
  }

  private applySettings(): void {
    if (!this.settings) return;

    const compactMode = this.settings.compactMode === true;

    this.container.classList.toggle("compact", compactMode);

    const sliderColor = this.settings.sliderColor || "#007acc";
    const textColor = this.settings.textColor || "#333333";

    this.container.style.setProperty("--time-slicer-slider-color", sliderColor);
    this.container.style.setProperty("--time-slicer-text-color", textColor);
    this.container.style.color = textColor;

    // Show/hide labels
    if (this.labelsContainer) {
      if (compactMode) {
        this.labelsContainer.style.display = "contents";
      } else {
        this.labelsContainer.style.display =
          this.settings.showLabels !== false ? "flex" : "none";
      }
    }

    if (this.currentLabel) {
      this.currentLabel.style.display = compactMode ? "none" : "";
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

    // Apply slider color
    const sliders = this.container.querySelectorAll(".range-slider");
    sliders.forEach((slider: HTMLInputElement) => {
      slider.style.accentColor = sliderColor;
    });

    if (this.sliderContainer) {
      this.sliderContainer.style.margin = compactMode ? "0" : "20px 0";
      this.sliderContainer.style.height = compactMode ? "32px" : "50px";
    }

    this.updateCustomQuickSelectButton();

    this.updateRangeTrack();
  }

  private static parseSettings(dataView: DataView): TimeSlicerSettings {
    const objects = dataView?.metadata?.objects;

    return {
      sliderColor: Visual.getColorValue(
        objects,
        "timeSlicerSettings",
        "sliderColor",
        "#007acc"
      ),
      textColor: Visual.getColorValue(
        objects,
        "timeSlicerSettings",
        "textColor",
        "#333333"
      ),
      showLabels: Visual.getValue(
        objects,
        "timeSlicerSettings",
        "showLabels",
        true
      ),
      timeFormat: Visual.getValue(
        objects,
        "timeSlicerSettings",
        "timeFormat",
        "HH:MM"
      ),
      compactMode: Visual.getValue(
        objects,
        "timeSlicerSettings",
        "compactMode",
        false
      ),
      customStartTime: Visual.getNumberValue(
        objects,
        "timeSlicerSettings",
        "customStartTime",
        540
      ),
      customEndTime: Visual.getNumberValue(
        objects,
        "timeSlicerSettings",
        "customEndTime",
        1020
      ),
    };
  }

  private static getValue(
    objects: any,
    objectName: string,
    propertyName: string,
    defaultValue: any
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

  private static getNumberValue(
    objects: any,
    objectName: string,
    propertyName: string,
    defaultValue: number
  ): number {
    const value = Visual.getValue(
      objects,
      objectName,
      propertyName,
      defaultValue
    );
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : defaultValue;
  }

  private static getColorValue(
    objects: any,
    objectName: string,
    propertyName: string,
    defaultColor: string
  ): string {
    const value = Visual.getValue(
      objects,
      objectName,
      propertyName,
      defaultColor
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

  private setInputValidity(
    input: HTMLInputElement | undefined,
    isValid: boolean,
    message: string = ""
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
    options: EnumerateVisualObjectInstancesOptions
  ): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
    const settings: VisualObjectInstance[] = [];

    if (options.objectName === "timeSlicerSettings") {
      settings.push({
        objectName: "timeSlicerSettings",
        properties: {
          sliderColor: Visual.createColorFill(
            this.settings?.sliderColor || "#007acc"
          ),
          textColor: Visual.createColorFill(
            this.settings?.textColor || "#333333"
          ),
          showLabels: this.settings?.showLabels !== false,
          timeFormat: this.settings?.timeFormat || "HH:MM",
          compactMode: this.settings?.compactMode === true,
          customStartTime:
            typeof this.settings?.customStartTime === "number"
              ? this.settings.customStartTime
              : 540,
          customEndTime:
            typeof this.settings?.customEndTime === "number"
              ? this.settings.customEndTime
              : 1020,
        },
        selector: null,
      });
    }

    return settings;
  }
}
