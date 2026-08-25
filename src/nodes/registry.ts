import type { NodeConfig, NodeType, WorkflowNode } from "../types/workflow";
import { createId } from "../utils/ids";

export type NodeDefinition = {
  type: NodeType;
  label: string;
  group: "Triggers" | "Logic" | "Data" | "Integrations" | "AI" | "Outputs";
  description: string;
  accent: "violet" | "amber" | "blue" | "cyan" | "indigo" | "emerald" | "neutral";
  symbol: string;
};

export const NODE_DEFINITIONS: NodeDefinition[] = [
  { type: "TRIGGER", label: "Manual Trigger", group: "Triggers", description: "Start a run with sample JSON", accent: "violet", symbol: "M" },
  { type: "CONDITION", label: "Condition", group: "Logic", description: "Route data through true or false", accent: "amber", symbol: "?" },
  { type: "DELAY", label: "Delay", group: "Logic", description: "Wait without blocking the UI", accent: "amber", symbol: "D" },
  { type: "TRANSFORM", label: "Transform", group: "Data", description: "Rename, set, select, or remove fields", accent: "cyan", symbol: "T" },
  { type: "DATABASE", label: "Local Database", group: "Data", description: "Read and write local records", accent: "emerald", symbol: "DB" },
  { type: "HTTP_REQUEST", label: "HTTP Request", group: "Integrations", description: "Call a REST endpoint with fetch", accent: "blue", symbol: "H" },
  { type: "AI", label: "AI", group: "AI", description: "Deterministic local demo provider", accent: "indigo", symbol: "AI" },
  { type: "OUTPUT", label: "Output", group: "Outputs", description: "Return actual upstream data", accent: "neutral", symbol: "{}" },
];

export function definitionFor(type: NodeType): NodeDefinition {
  const definition = NODE_DEFINITIONS.find((candidate) => candidate.type === type);
  if (!definition) throw new Error(`Unknown node type: ${type}`);
  return definition;
}

export function defaultConfig(type: NodeType): NodeConfig {
  switch (type) {
    case "TRIGGER":
      return { type, mode: "MANUAL", sampleData: { id: 1042, full_name: "Ada Lovelace", email: "ada@example.com", score: 82 } };
    case "HTTP_REQUEST":
      return { type, url: "https://jsonplaceholder.typicode.com/todos/1", method: "GET", headers: [], query: [], body: "" };
    case "CONDITION":
      return { type, field: "score", operator: "GREATER_THAN", value: 70 };
    case "TRANSFORM":
      return { type, operations: [{ id: createId("op"), kind: "SET", field: "processed", value: true }] };
    case "AI":
      return { type, provider: "LOCAL_DEMO", prompt: "Summarize this record", inputField: "", outputName: "summary" };
    case "DATABASE":
      return { type, action: "INSERT", key: "latest-record", value: null };
    case "DELAY":
      return { type, durationMs: 500 };
    case "OUTPUT":
      return { type, format: "JSON" };
  }
}

export function createNode(type: NodeType, position: { x: number; y: number }): WorkflowNode {
  const definition = definitionFor(type);
  return { id: createId("node"), type, label: definition.label, position, config: defaultConfig(type) };
}
