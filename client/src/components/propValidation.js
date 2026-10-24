export const stringProp = (props, key, component) =>
  props[key] == null || typeof props[key] === "string"
    ? null
    : new Error(`${component}: ${key} debe ser texto`);
export const functionProp = (props, key, component) =>
  props[key] == null || typeof props[key] === "function"
    ? null
    : new Error(`${component}: ${key} debe ser una función`);
export const objectProp = (props, key, component) =>
  props[key] == null || typeof props[key] === "object"
    ? null
    : new Error(`${component}: ${key} debe ser un objeto`);
export const boolProp = (props, key) =>
  props[key] == null || typeof props[key] === "boolean"
    ? null
    : new Error(`${key} debe ser booleano`);
