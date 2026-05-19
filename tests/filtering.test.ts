import { strict as assert } from "assert";
import { JSDOM } from "jsdom";
import powerbi from "powerbi-visuals-api";

(require as NodeRequire).extensions[".less"] = () => undefined;
const { Visual } = require("../src/visual") as { Visual: any };

type PrimitiveValue = powerbi.PrimitiveValue;

const dom = new JSDOM("<div id='root'></div>", { pretendToBeVisual: true });
const { window } = dom;

const globalAny = globalThis as typeof globalThis & Record<string, unknown>;
globalAny.window = window as unknown as Window & typeof globalThis;
globalAny.document = window.document;
globalAny.HTMLElement = window.HTMLElement;
globalAny.HTMLInputElement = window.HTMLInputElement;
globalAny.HTMLDivElement = window.HTMLDivElement;
globalAny.HTMLButtonElement = window.HTMLButtonElement;
globalAny.setInterval = window.setInterval.bind(window) as any;
globalAny.clearInterval = window.clearInterval.bind(window) as any;

class MockSelectionManager {
  public clearCalls = 0;

  public select(): Promise<any> {
    return Promise.resolve([]);
  }

  public hasSelection(): boolean {
    return false;
  }

  public clear(): Promise<void> {
    this.clearCalls += 1;
    return Promise.resolve();
  }

  public applySelectionFilter(): void {
    // no-op for tests
  }

  public getSelectionIds(): any[] {
    return [];
  }

  public containsSelection(): boolean {
    return false;
  }

  public registerOnSelectCallback(): void {
    // no-op for tests
  }
}

interface ApplyJsonFilterCall {
  filter: any;
  objectName: string;
  propertyName: string;
  action: powerbi.FilterAction;
}

const selectionManager = new MockSelectionManager();
const applyJsonFilterCalls: ApplyJsonFilterCall[] = [];
const persistPropertiesCalls: powerbi.VisualObjectInstancesToPersist[] = [];

const builderPrototype: any = {
  withCategory: () => builderPrototype,
  withSeries: () => builderPrototype,
  withMeasure: () => builderPrototype,
  withMatrixNode: () => builderPrototype,
  withTable: () => builderPrototype,
  createSelectionId: () => ({}),
};

const host: powerbi.extensibility.visual.IVisualHost = {
  applyJsonFilter: (
    filter: any,
    objectName: string,
    propertyName: string,
    action: powerbi.FilterAction,
  ) => {
    applyJsonFilterCalls.push({ filter, objectName, propertyName, action });
  },
  createSelectionManager: () =>
    selectionManager as unknown as powerbi.extensibility.ISelectionManager,
  createSelectionIdBuilder: () => builderPrototype as any,
  createLocalizationManager: () =>
    ({
      getDisplayName: () => "",
    }) as any,
  instanceId: "mockInstance",
  locale: "en-US",
  telemetry: {
    trace: () => undefined,
  } as any,
  allowInteractions: () => true,
  eventService: {
    renderStarted: () => undefined,
    renderFinished: () => undefined,
  } as any,
  persistProperties: (changes: powerbi.VisualObjectInstancesToPersist) => {
    persistPropertiesCalls.push(changes);
  },
} as unknown as powerbi.extensibility.visual.IVisualHost;

const element = document.getElementById("root") as HTMLElement;

const visual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const getPresetButtons = (targetVisual: any): HTMLButtonElement[] =>
  Array.from(
    (targetVisual.quickSelectContainer as HTMLDivElement).querySelectorAll(
      ".preset-btn",
    ),
  ) as HTMLButtonElement[];

const baseDate = new Date(1899, 11, 30);
const timeValues: PrimitiveValue[] = [
  new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    5,
    0,
    0,
  ),
  new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    8,
    30,
    0,
  ),
  new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    12,
    0,
    0,
  ),
  new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    15,
    45,
    0,
  ),
];

const dataView = {
  metadata: {
    columns: [
      {
        displayName: "Time",
        queryName: "TimeTable.Time",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time",
          queryName: "TimeTable.Time",
          roles: { timeField: true },
        },
        values: timeValues,
      },
    ],
  },
} as unknown as powerbi.DataView;

visual.update({
  dataViews: [dataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

assert(
  ((visual as any).container as HTMLDivElement).classList.contains(
    "timeSlicerVisual",
  ),
  "Expected redesigned container class to be applied",
);
assert(
  ((visual as any).playButton as HTMLButtonElement).classList.contains(
    "btn-play",
  ),
  "Expected redesigned play button class to be applied",
);
assert(
  ((visual as any).playButton as HTMLButtonElement).innerHTML.includes("<svg"),
  "Expected redesigned play button to render an inline SVG icon",
);
assert.equal(
  (visual as any).settings.snapInterval,
  15,
  "Expected default playback snap interval to remain 15 minutes",
);
assert.equal(
  ((visual as any).minSlider as HTMLInputElement).step,
  "15",
  "Expected min slider step to use the default playback snap interval",
);
assert.equal(
  ((visual as any).maxSlider as HTMLInputElement).step,
  "15",
  "Expected max slider step to use the default playback snap interval",
);
assert.equal(
  ((visual as any).currentLabel as HTMLDivElement).textContent,
  "24h selected",
  "Expected full-range selected badge to use compact duration text",
);
assert.deepEqual(
  getPresetButtons(visual).map((button) => button.textContent),
  [
    "AM Peak (7-9)",
    "Inter-Peak (10-12)",
    "PM Peak (16-18)",
    "Custom (09:00-17:00)",
  ],
  "Expected default preset labels and generated ranges to render",
);

(visual as any).selectTimeRange(360, 720);

assert.equal(
  ((visual as any).currentLabel as HTMLDivElement).textContent,
  "6h selected",
  "Expected redesigned selected-range badge text to update",
);

assert.equal(
  applyJsonFilterCalls.length,
  1,
  "Expected filter to be applied once",
);
assert.equal(
  persistPropertiesCalls.length,
  1,
  "Expected selected range to be persisted for navigation restore",
);
assert.deepEqual(
  persistPropertiesCalls[0].merge?.[0].properties,
  {
    selectedStartTime: 360,
    selectedEndTime: 720,
  },
  "Expected persisted state to store the selected minute bounds",
);

const filterCall = applyJsonFilterCalls[0];
assert.equal(filterCall.objectName, "general");
assert.equal(filterCall.propertyName, "filter");
assert.equal(filterCall.action, powerbi.FilterAction.merge);
assert(filterCall.filter, "Expected filter payload");
assert.equal(
  filterCall.filter.$schema,
  "http://powerbi.com/product/schema#advanced",
);
assert.equal(filterCall.filter.filterType, 0);
assert.equal(filterCall.filter.logicalOperator, "And");
assert(
  Array.isArray(filterCall.filter.conditions),
  "Expected conditions array",
);
assert.equal(
  filterCall.filter.conditions.length,
  2,
  "Expected two boundary conditions",
);
assert.deepEqual(filterCall.filter.target, {
  table: "TimeTable",
  column: "Time",
});

const [lowerCondition, upperCondition] = filterCall.filter.conditions;
assert.equal(lowerCondition.operator, "GreaterThanOrEqual");
assert.equal(upperCondition.operator, "LessThanOrEqual");

const startBoundary = lowerCondition.value as PrimitiveValue;
const endBoundary = upperCondition.value as PrimitiveValue;
assert(startBoundary instanceof Date, "Start boundary should be a Date");
assert(endBoundary instanceof Date, "End boundary should be a Date");
assert.equal((startBoundary as Date).getHours(), 6, "Start boundary hour");
assert.equal((startBoundary as Date).getMinutes(), 0, "Start boundary minutes");
assert.equal((endBoundary as Date).getHours(), 12, "End boundary hour");
assert.equal((endBoundary as Date).getMinutes(), 0, "End boundary minutes");

const restoredVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

restoredVisual.update({
  dataViews: [dataView],
  viewport: {
    width: 400,
    height: 300,
  },
  jsonFilters: [filterCall.filter],
} as powerbi.extensibility.visual.VisualUpdateOptions);

assert.equal(
  (restoredVisual as any).currentMinTime,
  360,
  "Expected incoming filter to restore lower slider bound",
);
assert.equal(
  (restoredVisual as any).currentMaxTime,
  720,
  "Expected incoming filter to restore upper slider bound",
);
assert.equal(
  ((restoredVisual as any).minSlider as HTMLInputElement).value,
  "360",
  "Expected incoming filter to restore min slider value",
);
assert.equal(
  ((restoredVisual as any).maxSlider as HTMLInputElement).value,
  "720",
  "Expected incoming filter to restore max slider value",
);
assert.equal(
  ((restoredVisual as any).currentLabel as HTMLDivElement).textContent,
  "6h selected",
  "Expected restored filter to update redesigned selected badge text",
);

applyJsonFilterCalls.length = 0;
persistPropertiesCalls.length = 0;

const persistedVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const persistedDataView = {
  metadata: {
    objects: {
      timeSlicerSettings: {
        selectedStartTime: 360,
        selectedEndTime: 720,
      },
    },
    columns: [
      {
        displayName: "Time",
        queryName: "TimeTable.Time",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time",
          queryName: "TimeTable.Time",
          roles: { timeField: true },
        },
        values: timeValues,
      },
    ],
  },
} as unknown as powerbi.DataView;

persistedVisual.update({
  dataViews: [persistedDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

assert.equal(
  (persistedVisual as any).currentMinTime,
  360,
  "Expected persisted lower bound to restore when jsonFilters are missing",
);
assert.equal(
  (persistedVisual as any).currentMaxTime,
  720,
  "Expected persisted upper bound to restore when jsonFilters are missing",
);
assert.equal(
  applyJsonFilterCalls.length,
  1,
  "Expected persisted range to be reapplied after visual navigation",
);

applyJsonFilterCalls.length = 0;
persistPropertiesCalls.length = 0;

const persistedMinSlider = (persistedVisual as any)
  .minSlider as HTMLInputElement;
persistedMinSlider.value = "480";
persistedMinSlider.dispatchEvent(new window.Event("input", { bubbles: true }));

assert.equal(
  (persistedVisual as any).currentMinTime,
  480,
  "Expected slider input to update the active drag position immediately",
);
assert.equal(
  persistPropertiesCalls.length,
  0,
  "Expected active slider drag not to persist on every input tick",
);

persistedVisual.update({
  dataViews: [persistedDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

assert.equal(
  (persistedVisual as any).currentMinTime,
  480,
  "Expected stale persisted state not to override an active slider drag",
);

persistedMinSlider.dispatchEvent(
  new window.Event("change", { bubbles: true }),
);

assert.equal(
  applyJsonFilterCalls.length,
  1,
  "Expected slider commit to apply the filter once",
);
assert.deepEqual(
  persistPropertiesCalls[0].merge?.[0].properties,
  {
    selectedStartTime: 480,
    selectedEndTime: 720,
  },
  "Expected slider commit to persist the final range once",
);

const themedVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const themedDataView = {
  metadata: {
    objects: {
      timeSlicerSettings: {
        accentColor: { solid: { color: "#123456" } },
        backgroundColor: { solid: { color: "#111827" } },
        textColor: { solid: { color: "#F8FAFC" } },
      },
    },
    columns: [
      {
        displayName: "Time",
        queryName: "TimeTable.Time",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time",
          queryName: "TimeTable.Time",
          roles: { timeField: true },
        },
        values: timeValues,
      },
    ],
  },
} as unknown as powerbi.DataView;

themedVisual.update({
  dataViews: [themedDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

const themedContainer = (themedVisual as any).container as HTMLDivElement;
assert.equal(
  themedContainer.style.getPropertyValue("--color-accent"),
  "#123456",
  "Expected accent color formatting setting to flow into CSS variables",
);
assert.equal(
  themedContainer.style.getPropertyValue("--color-bg"),
  "#111827",
  "Expected background color formatting setting to flow into CSS variables",
);
assert.equal(
  themedContainer.style.getPropertyValue("--color-text-primary"),
  "#F8FAFC",
  "Expected text color formatting setting to flow into CSS variables",
);
assert(
  themedContainer.classList.contains("theme-dark"),
  "Expected dark backgrounds to enable the dark theme class",
);

(visual as any).resetSlider();

assert.equal(
  applyJsonFilterCalls.length,
  2,
  "Expected clear filter to be invoked",
);
const clearCall = applyJsonFilterCalls[1];
assert.equal(
  clearCall.filter,
  null,
  "Clear filter should send null filter payload",
);
assert.equal(clearCall.action, powerbi.FilterAction.remove);
assert.equal(
  selectionManager.clearCalls > 0,
  true,
  "Selection manager clear should be called",
);
assert.deepEqual(
  persistPropertiesCalls[persistPropertiesCalls.length - 1].merge?.[0]
    .properties,
  {
    selectedStartTime: 0,
    selectedEndTime: 1440,
  },
  "Expected reset to persist the full-range state",
);

applyJsonFilterCalls.length = 0;
selectionManager.clearCalls = 0;
persistPropertiesCalls.length = 0;

const editablePresetVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const editablePresetDataView = {
  metadata: {
    objects: {
      presetRanges: {
        preset1Label: "School Run",
        preset1Start: "7:30 AM",
        preset1End: "09:15",
        preset4Label: "Evening",
        preset4Start: "1730",
        preset4End: "19:00",
      },
    },
    columns: [
      {
        displayName: "Time",
        queryName: "TimeTable.Time",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time",
          queryName: "TimeTable.Time",
          roles: { timeField: true },
        },
        values: timeValues,
      },
    ],
  },
} as unknown as powerbi.DataView;

editablePresetVisual.update({
  dataViews: [editablePresetDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

const editablePresetButtons = getPresetButtons(editablePresetVisual);
assert.equal(
  editablePresetButtons[0].textContent,
  "School Run (07:30-09:15)",
  "Expected renamed AM preset to render with its edited time range",
);
assert.equal(
  editablePresetButtons[3].textContent,
  "Evening (17:30-19:00)",
  "Expected renamed custom preset to parse compact HHMM text",
);

editablePresetButtons[0].click();

assert.equal(
  (editablePresetVisual as any).currentMinTime,
  450,
  "Expected edited AM preset start to apply",
);
assert.equal(
  (editablePresetVisual as any).currentMaxTime,
  555,
  "Expected edited AM preset end to apply",
);

applyJsonFilterCalls.length = 0;
persistPropertiesCalls.length = 0;

const invalidPresetVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const invalidPresetDataView = {
  metadata: {
    objects: {
      presetRanges: {
        preset2Start: "13:00",
        preset2End: "12:00",
        preset3Start: "not a time",
        preset3End: "18:00",
      },
    },
    columns: [
      {
        displayName: "Time",
        queryName: "TimeTable.Time",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time",
          queryName: "TimeTable.Time",
          roles: { timeField: true },
        },
        values: timeValues,
      },
    ],
  },
} as unknown as powerbi.DataView;

invalidPresetVisual.update({
  dataViews: [invalidPresetDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

const invalidPresetButtons = getPresetButtons(invalidPresetVisual);
assert.equal(
  invalidPresetButtons[1].disabled,
  true,
  "Expected start-after-end preset to be disabled",
);
assert.equal(
  invalidPresetButtons[1].textContent,
  "Inter-Peak (Invalid range)",
  "Expected invalid range to show a clear disabled label",
);
assert.equal(
  invalidPresetButtons[2].disabled,
  true,
  "Expected unparseable time preset to be disabled",
);

invalidPresetButtons[1].click();

assert.equal(
  applyJsonFilterCalls.length,
  0,
  "Expected disabled invalid preset not to apply a filter",
);

applyJsonFilterCalls.length = 0;
selectionManager.clearCalls = 0;
persistPropertiesCalls.length = 0;

const snapVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const snapDataView = {
  metadata: {
    objects: {
      timeSlicerSettings: {
        snapInterval: 30,
        customStartTime: 553,
        customEndTime: 1031,
      },
    },
    columns: [
      {
        displayName: "Time",
        queryName: "TimeTable.Time",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time",
          queryName: "TimeTable.Time",
          roles: { timeField: true },
        },
        values: timeValues,
      },
    ],
  },
} as unknown as powerbi.DataView;

snapVisual.update({
  dataViews: [snapDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

assert.equal(
  ((snapVisual as any).minSlider as HTMLInputElement).step,
  "30",
  "Expected min slider step to use the configured playback snap interval",
);
assert.equal(
  ((snapVisual as any).maxSlider as HTMLInputElement).step,
  "30",
  "Expected max slider step to use the configured playback snap interval",
);
const customPresetButton = getPresetButtons(snapVisual)[3];
assert.equal(
  customPresetButton.textContent,
  "Custom (09:00-17:00)",
  "Expected custom quick-select label to reflect snapped legacy settings",
);

customPresetButton.click();

assert.equal(
  (snapVisual as any).currentMinTime,
  540,
  "Expected custom quick-select start to apply its snapped setting",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  1020,
  "Expected custom quick-select end to apply its snapped setting",
);

applyJsonFilterCalls.length = 0;
persistPropertiesCalls.length = 0;

(snapVisual as any).selectTimeRange(365, 720);

assert.equal(
  (snapVisual as any).currentMinTime,
  360,
  "Expected quick-select/programmatic range start to snap to 30 minutes",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  720,
  "Expected quick-select/programmatic range end to snap to 30 minutes",
);
assert.deepEqual(
  persistPropertiesCalls[persistPropertiesCalls.length - 1].merge?.[0]
    .properties,
  {
    selectedStartTime: 360,
    selectedEndTime: 720,
  },
  "Expected snapped programmatic range to be persisted",
);

applyJsonFilterCalls.length = 0;
persistPropertiesCalls.length = 0;

const snapMinSlider = (snapVisual as any).minSlider as HTMLInputElement;
snapMinSlider.value = "675";
snapMinSlider.dispatchEvent(new window.Event("input", { bubbles: true }));

assert.equal(
  (snapVisual as any).currentMinTime,
  690,
  "Expected slider input to snap live to the nearest configured interval",
);
assert.equal(
  ((snapVisual as any).currentLabel as HTMLDivElement).textContent,
  "30m selected",
  "Expected live duration badge to update with compact minute-only text",
);
assert.equal(
  persistPropertiesCalls.length,
  0,
  "Expected snapped slider input not to persist before commit",
);

snapMinSlider.dispatchEvent(new window.Event("change", { bubbles: true }));

assert.deepEqual(
  persistPropertiesCalls[0].merge?.[0].properties,
  {
    selectedStartTime: 690,
    selectedEndTime: 720,
  },
  "Expected snapped slider commit to persist final snapped bounds",
);

(snapVisual as any).selectTimeRange(600, 900);
applyJsonFilterCalls.length = 0;
persistPropertiesCalls.length = 0;

const snapMaxInput = (snapVisual as any).maxInput as HTMLInputElement;
snapMaxInput.value = "10:07";
snapMaxInput.dispatchEvent(new window.Event("blur", { bubbles: true }));

assert.equal(
  (snapVisual as any).currentMinTime,
  600,
  "Expected typed max value to preserve the current start when enforcing gap",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  630,
  "Expected typed max value to snap and keep one interval of range",
);
assert.equal(
  snapMaxInput.value,
  "10:30",
  "Expected typed max input to display its snapped time",
);

const originalSetInterval = window.setInterval;
const originalClearInterval = window.clearInterval;
let playTick: (() => void) | undefined;
(window as any).setInterval = (callback: () => void) => {
  playTick = callback;
  return 123;
};
(window as any).clearInterval = () => undefined;

(snapVisual as any).startPlay();
assert(playTick, "Expected autoplay to schedule an interval");
playTick?.();

assert.equal(
  (snapVisual as any).currentMinTime,
  630,
  "Expected autoplay to advance the start by the configured playback snap interval",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  660,
  "Expected autoplay to advance the end by the configured playback snap interval",
);

(snapVisual as any).setCurrentRange(1410, 1440);
playTick?.();

assert.equal(
  (snapVisual as any).currentMinTime,
  0,
  "Expected autoplay to loop the start back to the beginning of the day",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  30,
  "Expected autoplay to preserve the playback window when looping",
);
assert.equal(
  (snapVisual as any).isPlaying,
  true,
  "Expected autoplay to keep playing after looping",
);

(snapVisual as any).stopPlay();

(snapVisual as any).setCurrentRange(0, 1440);
applyJsonFilterCalls.length = 0;
playTick = undefined;
(snapVisual as any).startPlay();
assert(playTick, "Expected autoplay from full range to schedule an interval");

assert.equal(
  (snapVisual as any).currentMinTime,
  0,
  "Expected autoplay from full range to start at the beginning of the day",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  30,
  "Expected autoplay from full range to use one playback interval",
);
assert.equal(
  applyJsonFilterCalls.length,
  1,
  "Expected autoplay from full range to apply the first playback filter",
);

const playbackPersistedDataView = {
  ...snapDataView,
  metadata: {
    ...(snapDataView as any).metadata,
    objects: {
      timeSlicerSettings: {
        snapInterval: 30,
        selectedStartTime: 0,
        selectedEndTime: 1440,
      },
    },
  },
} as unknown as powerbi.DataView;

snapVisual.update({
  dataViews: [playbackPersistedDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

assert.equal(
  (snapVisual as any).currentMinTime,
  0,
  "Expected playback update not to restore a stale persisted start",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  30,
  "Expected playback update not to restore a stale persisted end",
);

playTick?.();

assert.equal(
  (snapVisual as any).currentMinTime,
  30,
  "Expected playback to keep advancing after an update during play",
);
assert.equal(
  (snapVisual as any).currentMaxTime,
  60,
  "Expected playback end to keep advancing after an update during play",
);

(snapVisual as any).stopPlay();
window.setInterval = originalSetInterval;
window.clearInterval = originalClearInterval;

applyJsonFilterCalls.length = 0;
selectionManager.clearCalls = 0;
persistPropertiesCalls.length = 0;

const numericVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const timeFractions: PrimitiveValue[] = [0.25, 0.5, 0.75, 0.8125];

const numericDataView = {
  metadata: {
    columns: [
      {
        displayName: "Time Fraction",
        queryName: "TimeTable.TimeFraction",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time Fraction",
          queryName: "TimeTable.TimeFraction",
          roles: { timeField: true },
        },
        values: timeFractions,
      },
    ],
  },
} as unknown as powerbi.DataView;

numericVisual.update({
  dataViews: [numericDataView],
  viewport: {
    width: 400,
    height: 300,
  },
} as powerbi.extensibility.visual.VisualUpdateOptions);

(numericVisual as any).selectTimeRange(360, 1095); // 6:00 to 18:15

assert.equal(
  applyJsonFilterCalls.length,
  1,
  "Expected numeric time filter to be applied once",
);

const numericFilterCall = applyJsonFilterCalls[0];
assert.equal(numericFilterCall.filter.filterType, 0);
const [numericLower, numericUpper] = numericFilterCall.filter.conditions;
assert.equal(numericLower.operator, "GreaterThanOrEqual");
assert.equal(numericUpper.operator, "LessThanOrEqual");
const numericStart = numericLower.value as PrimitiveValue;
const numericEnd = numericUpper.value as PrimitiveValue;
const withinTolerance = (a: number, b: number) => Math.abs(a - b) < 1e-6;

assert(withinTolerance(numericStart as number, 360 / 1440));
assert(withinTolerance(numericEnd as number, 1095 / 1440));

const arrayLikeValues = {
  0: timeValues[0],
  1: timeValues[1],
  2: timeValues[2],
  length: 3,
} as unknown as PrimitiveValue[];

const arrayLikeVisual = new Visual({
  element,
  host,
} as powerbi.extensibility.visual.VisualConstructorOptions);

const arrayLikeDataView = {
  metadata: {
    columns: [
      {
        displayName: "Time",
        queryName: "TimeTable.Time",
        roles: { timeField: true },
      },
    ],
  },
  categorical: {
    categories: [
      {
        source: {
          displayName: "Time",
          queryName: "TimeTable.Time",
          roles: { timeField: true },
        },
        values: arrayLikeValues,
      },
    ],
  },
} as unknown as powerbi.DataView;

assert.doesNotThrow(() => {
  arrayLikeVisual.update({
    dataViews: [arrayLikeDataView],
    viewport: {
      width: 400,
      height: 300,
    },
  } as powerbi.extensibility.visual.VisualUpdateOptions);
}, "Expected update to tolerate array-like category values without throwing");

console.log("✅ Filtering behaviour verified in unit test");
