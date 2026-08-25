import type { NodeConfig, Workflow, WorkflowEdge, WorkflowNode } from "../types/workflow";
import { nowIso } from "../utils/ids";

type NodeSpec = { id: string; label: string; config: NodeConfig; x: number; y: number };

function buildWorkflow(id: string, name: string, description: string, specs: NodeSpec[], edges: Array<[string, string, ("true" | "false")?]>): Workflow {
  const timestamp = nowIso();
  const nodes: WorkflowNode[] = specs.map((spec) => ({ id: spec.id, type: spec.config.type, label: spec.label, position: { x: spec.x, y: spec.y }, config: spec.config }));
  const workflowEdges: WorkflowEdge[] = edges.map(([source, target, handle], index) => ({ id: `${id}_edge_${index + 1}`, source, target, sourceHandle: handle ?? null }));
  return { schemaVersion: 1, id, name, description, nodes, edges: workflowEdges, createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

export function createDataCleanupWorkflow(id = "workflow_data_cleanup"): Workflow {
  return buildWorkflow(id, "Customer data cleanup", "Normalize incoming customer data and route records by score.", [
    { id: `${id}_trigger`, label: "Manual customer", x: 40, y: 220, config: { type: "TRIGGER", mode: "MANUAL", sampleData: { id: 1042, full_name: "Ada Lovelace", email: "ada@example.com", score: 82 } } },
    { id: `${id}_transform`, label: "Normalize fields", x: 330, y: 220, config: { type: "TRANSFORM", operations: [
      { id: `${id}_op_1`, kind: "RENAME", from: "full_name", to: "name" },
      { id: `${id}_op_2`, kind: "SET", field: "status", value: "ready" },
    ] } },
    { id: `${id}_condition`, label: "Qualified score?", x: 620, y: 220, config: { type: "CONDITION", field: "score", operator: "GREATER_THAN", value: 70 } },
    { id: `${id}_yes`, label: "Qualified result", x: 920, y: 130, config: { type: "OUTPUT", format: "JSON" } },
    { id: `${id}_no`, label: "Review result", x: 920, y: 330, config: { type: "OUTPUT", format: "JSON" } },
  ], [
    [`${id}_trigger`, `${id}_transform`], [`${id}_transform`, `${id}_condition`],
    [`${id}_condition`, `${id}_yes`, "true"], [`${id}_condition`, `${id}_no`, "false"],
  ]);
}

export function createApiHealthWorkflow(id = "template_api_health"): Workflow {
  return buildWorkflow(id, "API health check", "Fetch a public endpoint and route a healthy response.", [
    { id: `${id}_trigger`, label: "Manual Trigger", x: 40, y: 220, config: { type: "TRIGGER", mode: "MANUAL", sampleData: { requestedBy: "FlowGrid" } } },
    { id: `${id}_http`, label: "Fetch endpoint", x: 320, y: 220, config: { type: "HTTP_REQUEST", url: "https://jsonplaceholder.typicode.com/todos/1", method: "GET", headers: [], query: [], body: "" } },
    { id: `${id}_condition`, label: "Response has ID?", x: 600, y: 220, config: { type: "CONDITION", field: "id", operator: "EXISTS", value: null } },
    { id: `${id}_yes`, label: "Healthy", x: 900, y: 130, config: { type: "OUTPUT", format: "JSON" } },
    { id: `${id}_no`, label: "Unexpected response", x: 900, y: 330, config: { type: "OUTPUT", format: "JSON" } },
  ], [[`${id}_trigger`, `${id}_http`], [`${id}_http`, `${id}_condition`], [`${id}_condition`, `${id}_yes`, "true"], [`${id}_condition`, `${id}_no`, "false"]]);
}

export function createAiSummaryWorkflow(id = "template_ai_summary"): Workflow {
  return buildWorkflow(id, "AI summary pipeline", "Prepare a support ticket and summarize it with local demo AI.", [
    { id: `${id}_trigger`, label: "Sample ticket", x: 40, y: 220, config: { type: "TRIGGER", mode: "MANUAL", sampleData: { ticket: "Customer cannot reset their password after changing devices.", priority: "high" } } },
    { id: `${id}_transform`, label: "Add source", x: 320, y: 220, config: { type: "TRANSFORM", operations: [{ id: `${id}_op`, kind: "SET", field: "source", value: "support" }] } },
    { id: `${id}_ai`, label: "Summarize ticket", x: 600, y: 220, config: { type: "AI", provider: "LOCAL_DEMO", prompt: "Support summary", inputField: "ticket", outputName: "summary" } },
    { id: `${id}_output`, label: "Summary result", x: 900, y: 220, config: { type: "OUTPUT", format: "JSON" } },
  ], [[`${id}_trigger`, `${id}_transform`], [`${id}_transform`, `${id}_ai`], [`${id}_ai`, `${id}_output`]]);
}

export function createLeadWorkflow(id = "template_lead_processing"): Workflow {
  return buildWorkflow(id, "Lead processing", "Store qualified leads in the local record database.", [
    { id: `${id}_trigger`, label: "Sample lead", x: 40, y: 220, config: { type: "TRIGGER", mode: "MANUAL", sampleData: { company: "Northstar", score: 91, owner: "Mina" } } },
    { id: `${id}_condition`, label: "Qualified?", x: 330, y: 220, config: { type: "CONDITION", field: "score", operator: "GREATER_THAN", value: 80 } },
    { id: `${id}_database`, label: "Store lead", x: 620, y: 130, config: { type: "DATABASE", action: "INSERT", key: "qualified-lead", value: null } },
    { id: `${id}_stored`, label: "Stored result", x: 910, y: 130, config: { type: "OUTPUT", format: "JSON" } },
    { id: `${id}_review`, label: "Needs review", x: 620, y: 340, config: { type: "OUTPUT", format: "JSON" } },
  ], [[`${id}_trigger`, `${id}_condition`], [`${id}_condition`, `${id}_database`, "true"], [`${id}_database`, `${id}_stored`], [`${id}_condition`, `${id}_review`, "false"]]);
}

export function createBlankWorkflow(id: string): Workflow {
  const timestamp = nowIso();
  return { schemaVersion: 1, id, name: "Untitled workflow", description: "", nodes: [], edges: [], createdAt: timestamp, updatedAt: timestamp, version: 1 };
}

export const WORKFLOW_TEMPLATES = [
  { key: "cleanup", title: "Data cleanup", description: "Transform and branch customer records", create: createDataCleanupWorkflow },
  { key: "api", title: "API health check", description: "Fetch and validate an API response", create: createApiHealthWorkflow },
  { key: "ai", title: "AI summary pipeline", description: "Use the deterministic local AI provider", create: createAiSummaryWorkflow },
  { key: "leads", title: "Lead processing", description: "Qualify and store a lead locally", create: createLeadWorkflow },
] as const;
