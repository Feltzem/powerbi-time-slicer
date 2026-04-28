// Mock implementation of dataViewObjects utility
export var dataViewObjects = {
  getValue: function (
    objects: any,
    propertyIdentifier: any,
    defaultValue?: any
  ): any {
    if (!objects || !propertyIdentifier) {
      return defaultValue;
    }

    var objectName = propertyIdentifier.objectName;
    var propertyName = propertyIdentifier.propertyName;

    if (
      objects[objectName] &&
      objects[objectName][propertyName] !== undefined
    ) {
      return objects[objectName][propertyName];
    }

    return defaultValue;
  },
};
