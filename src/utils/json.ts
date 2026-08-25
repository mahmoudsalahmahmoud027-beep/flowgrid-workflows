import type { JSONValue } from "../types/workflow";

export function isJSONValue(value: unknown): value is JSONValue {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.every(isJSONValue);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every(isJSONValue);
  return false;
}

export function cloneJSON<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function getPath(value: JSONValue, path: string): JSONValue | undefined {
  if (!path.trim()) return value;
  return path.split(".").reduce<JSONValue | undefined>((current, segment) => {
    if (current && !Array.isArray(current) && typeof current === "object") return current[segment];
    return undefined;
  }, value);
}

export function parseConfigValue(raw: string): JSONValue {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isJSONValue(parsed) ? parsed : raw;
  } catch {
    return raw;
  }
}
