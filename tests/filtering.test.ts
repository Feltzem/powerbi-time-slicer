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

(visual as any).selectTimeRange(360, 720);

assert.equal(
  ((visual as any).currentLabel as HTMLDivElement).textContent,
  "6h 0m selected",
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
  "6h 0m selected",
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
