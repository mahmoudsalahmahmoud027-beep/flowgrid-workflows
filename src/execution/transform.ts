import type { JSONObject, JSONValue, TransformOperation } from "../types/workflow";
import { cloneJSON } from "../utils/json";

function asObject(value: JSONValue): JSONObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return cloneJSON(value);
  return { value: cloneJSON(value) };
}

export function applyTransform(input: JSONValue, operations: TransformOperation[]): JSONValue {
  let output = asObject(input);
  for (const operation of operations) {
    switch (operation.kind) {
      case "RENAME": {
        if (operation.from in output) {
          output[operation.to] = output[operation.from];
          delete output[operation.from];
        }
        break;
      }
      case "SELECT": {
        const selected: JSONObject = {};
        for (const field of operation.fields) if (field in output) selected[field] = output[field];
        output = selected;
        break;
      }
      case "SET":
        output[operation.field] = cloneJSON(operation.value);
        break;
      case "REMOVE":
        delete output[operation.field];
        break;
    }
  }
  return output;
}
