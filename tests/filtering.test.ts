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
    action: powerbi.FilterAction
  ) => {
    applyJsonFilterCalls.push({ filter, objectName, propertyName, action });
  },
  createSelectionManager: () =>
    selectionManager as unknown as powerbi.extensibility.ISelectionManager,
  createSelectionIdBuilder: () => builderPrototype as any,
  createLocalizationManager: () =>
    ({
      getDisplayName: () => "",
    } as any),
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
  persistProperties: () => Promise.resolve(),
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
    0
  ),
  new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    8,
    30,
    0
  ),
  new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    12,
    0,
    0
  ),
  new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    15,
    45,
    0
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

(visual as any).selectTimeRange(360, 720);

assert.equal(
  applyJsonFilterCalls.length,
  1,
  "Expected filter to be applied once"
);

const filterCall = applyJsonFilterCalls[0];
assert.equal(filterCall.objectName, "general");
assert.equal(filterCall.propertyName, "filter");
assert.equal(filterCall.action, powerbi.FilterAction.merge);
assert(filterCall.filter, "Expected filter payload");
assert.equal(
  filterCall.filter.$schema,
  "http://powerbi.com/product/schema#advanced"
);
assert.equal(filterCall.filter.filterType, 0);
assert.equal(filterCall.filter.logicalOperator, "And");
assert(
  Array.isArray(filterCall.filter.conditions),
  "Expected conditions array"
);
assert.equal(
  filterCall.filter.conditions.length,
  2,
  "Expected two boundary conditions"
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

(visual as any).resetSlider();

assert.equal(
  applyJsonFilterCalls.length,
  2,
  "Expected clear filter to be invoked"
);
const clearCall = applyJsonFilterCalls[1];
assert.equal(
  clearCall.filter,
  null,
  "Clear filter should send null filter payload"
);
assert.equal(clearCall.action, powerbi.FilterAction.remove);
assert.equal(
  selectionManager.clearCalls > 0,
  true,
  "Selection manager clear should be called"
);

applyJsonFilterCalls.length = 0;
selectionManager.clearCalls = 0;

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
  "Expected numeric time filter to be applied once"
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

console.log("✅ Filtering behaviour verified in unit test");
