import type { NodeType, Workflow, WorkflowNode } from "../types/workflow";
import { cloneJSON } from "../utils/json";

const NODE_TYPES = new Set<NodeType>(["TRIGGER", "HTTP_REQUEST", "CONDITION", "TRANSFORM", "AI", "DATABASE", "DELAY", "OUTPUT"]);

export type ImportResult = { ok: true; workflow: Workflow } | { ok: false; errors: string[] };

export function exportWorkflow(workflow: Workflow): string {
  return JSON.stringify(cloneJSON(workflow), null, 2);
}

export function importWorkflow(raw: string): ImportResult {
  let candidate: unknown;
  try { candidate = JSON.parse(raw); } catch { return { ok: false, errors: ["The file is not valid JSON."] }; }
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { ok: false, errors: ["Workflow must be a JSON object."] };
  const value = candidate as Record<string, unknown>;
  const errors: string[] = [];
  if (value.schemaVersion !== 1) errors.push("Unsupported or missing schemaVersion. Expected 1.");
  if (typeof value.id !== "string" || !value.id) errors.push("Workflow id is required.");
  if (typeof value.name !== "string" || !value.name) errors.push("Workflow name is required.");
  if (!Array.isArray(value.nodes)) errors.push("Workflow nodes must be an array.");
  if (!Array.isArray(value.edges)) errors.push("Workflow edges must be an array.");
  if (errors.length) return { ok: false, errors };

  const nodes = value.nodes as Array<Record<string, unknown>>;
  const edges = value.edges as Array<Record<string, unknown>>;
  const ids = new Set<string>();
  for (const [index, node] of nodes.entries()) {
    if (!node || typeof node !== "object") { errors.push(`Node ${index + 1} is invalid.`); continue; }
    if (typeof node.id !== "string" || !node.id) errors.push(`Node ${index + 1} needs an id.`);
    else if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}.`);
    else ids.add(node.id);
    if (typeof node.type !== "string" || !NODE_TYPES.has(node.type as NodeType)) errors.push(`Node ${index + 1} has an unsupported type.`);
    if (typeof node.label !== "string") errors.push(`Node ${index + 1} needs a label.`);
    if (!node.position || typeof node.position !== "object") errors.push(`Node ${index + 1} needs a position.`);
    if (!node.config || typeof node.config !== "object" || (node.config as Record<string, unknown>).type !== node.type) errors.push(`Node ${index + 1} has invalid configuration.`);
  }
  for (const [index, edge] of edges.entries()) {
    if (typeof edge.id !== "string" || !edge.id) errors.push(`Edge ${index + 1} needs an id.`);
    if (typeof edge.source !== "string" || !ids.has(edge.source)) errors.push(`Edge ${index + 1} references a missing source node.`);
    if (typeof edge.target !== "string" || !ids.has(edge.target)) errors.push(`Edge ${index + 1} references a missing target node.`);
    if (edge.sourceHandle !== undefined && edge.sourceHandle !== null && edge.sourceHandle !== "true" && edge.sourceHandle !== "false") errors.push(`Edge ${index + 1} has an invalid source handle.`);
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, workflow: cloneJSON(candidate as Workflow) };
}

export function replaceWorkflowState(target: Workflow, snapshot: Workflow): Workflow {
  return { ...cloneJSON(snapshot), id: target.id, name: target.name, createdAt: target.createdAt, updatedAt: new Date().toISOString(), version: target.version + 1 };
}

export function isWorkflowNode(value: unknown): value is WorkflowNode {
  return Boolean(value && typeof value === "object" && "id" in value && "type" in value && "config" in value);
}
