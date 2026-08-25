import type { JSONObject, JSONValue } from "../types/workflow";
import { getPath } from "../utils/json";

export interface AIProvider {
  readonly id: string;
  generate(prompt: string, input: JSONValue): Promise<string>;
}

export class LocalDemoAIProvider implements AIProvider {
  readonly id = "LOCAL_DEMO";
  async generate(prompt: string, input: JSONValue): Promise<string> {
    const text = typeof input === "string" ? input : JSON.stringify(input);
    const compact = text.replace(/\s+/g, " ").slice(0, 180);
    return `${prompt.trim()}: ${compact}${text.length > 180 ? "…" : ""}`;
  }
}

export interface DatabaseAdapter {
  insert(key: string, value: JSONValue): Promise<JSONValue>;
  read(key: string): Promise<JSONValue>;
  update(key: string, value: JSONValue): Promise<JSONValue>;
  delete(key: string): Promise<JSONValue>;
}

export class MemoryDatabaseAdapter implements DatabaseAdapter {
  constructor(private readonly records = new Map<string, JSONValue>()) {}
  async insert(key: string, value: JSONValue): Promise<JSONValue> {
    if (this.records.has(key)) throw new Error(`Record "${key}" already exists`);
    this.records.set(key, value);
    return { key, value };
  }
  async read(key: string): Promise<JSONValue> {
    if (!this.records.has(key)) throw new Error(`Record "${key}" was not found`);
    return this.records.get(key) ?? null;
  }
  async update(key: string, value: JSONValue): Promise<JSONValue> {
    if (!this.records.has(key)) throw new Error(`Record "${key}" was not found`);
    this.records.set(key, value);
    return { key, value };
  }
  async delete(key: string): Promise<JSONValue> {
    const existed = this.records.delete(key);
    return { key, deleted: existed };
  }
}

export function evaluateCondition(input: JSONValue, field: string, operator: string, comparison: JSONValue): boolean {
  const actual = getPath(input, field);
  switch (operator) {
    case "EQUALS": return JSON.stringify(actual) === JSON.stringify(comparison);
    case "NOT_EQUALS": return JSON.stringify(actual) !== JSON.stringify(comparison);
    case "GREATER_THAN": return typeof actual === "number" && typeof comparison === "number" && actual > comparison;
    case "LESS_THAN": return typeof actual === "number" && typeof comparison === "number" && actual < comparison;
    case "CONTAINS": return typeof actual === "string" ? actual.includes(String(comparison)) : Array.isArray(actual) ? actual.some((item) => JSON.stringify(item) === JSON.stringify(comparison)) : false;
    case "EXISTS": return actual !== undefined && actual !== null;
    default: return false;
  }
}

export function withOutputField(input: JSONValue, name: string, value: JSONValue): JSONObject {
  const base: JSONObject = input && typeof input === "object" && !Array.isArray(input) ? { ...input } : { input };
  base[name] = value;
  return base;
}
