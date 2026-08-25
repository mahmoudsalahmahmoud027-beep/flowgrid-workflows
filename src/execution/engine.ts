import type { JSONValue, NodeRun, Workflow, WorkflowNode, WorkflowRun } from "../types/workflow";
import { createId, nowIso } from "../utils/ids";
import { getPath, isJSONValue } from "../utils/json";
import { topologicalSort } from "../validation/graph";
import { applyTransform } from "./transform";
import { evaluateCondition, LocalDemoAIProvider, MemoryDatabaseAdapter, type AIProvider, type DatabaseAdapter, withOutputField } from "./providers";

export type ExecutionContext = {
  triggerData?: JSONValue;
  fetchFn?: typeof fetch;
  aiProvider?: AIProvider;
  database?: DatabaseAdapter;
  onNodeRun?: (nodeRun: NodeRun) => void;
  onRun?: (run: WorkflowRun) => void;
};

type NodeExecution = { output: JSONValue; branch?: boolean };

async function executeHttp(node: WorkflowNode, input: JSONValue, fetchFn: typeof fetch): Promise<JSONValue> {
  if (node.config.type !== "HTTP_REQUEST") throw new Error("Invalid HTTP configuration");
  const url = new URL(node.config.url);
  for (const pair of node.config.query) if (pair.key.trim()) url.searchParams.set(pair.key, pair.value);
  const headers = Object.fromEntries(node.config.headers.filter((pair) => pair.key.trim()).map((pair) => [pair.key, pair.value]));
  const init: RequestInit = { method: node.config.method, headers };
  if (node.config.method !== "GET" && node.config.method !== "DELETE" && node.config.body.trim()) {
    init.body = node.config.body.replace("{{input}}", JSON.stringify(input));
  }
  const response = await fetchFn(url.toString(), init);
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP request returned ${response.status}${text ? `: ${text.slice(0, 180)}` : ""}`);
  if (!text) return { status: response.status };
  try {
    const parsed: unknown = JSON.parse(text);
    return isJSONValue(parsed) ? parsed : text;
  } catch {
    return text;
  }
}

async function executeNode(node: WorkflowNode, input: JSONValue, context: Required<Pick<ExecutionContext, "fetchFn" | "aiProvider" | "database">> & Pick<ExecutionContext, "triggerData">): Promise<NodeExecution> {
  switch (node.config.type) {
    case "TRIGGER":
      return { output: context.triggerData ?? node.config.sampleData };
    case "HTTP_REQUEST":
      return { output: await executeHttp(node, input, context.fetchFn) };
    case "CONDITION": {
      const branch = evaluateCondition(input, node.config.field, node.config.operator, node.config.value);
      return { output: input, branch };
    }
    case "TRANSFORM":
      return { output: applyTransform(input, node.config.operations) };
    case "AI": {
      const mapped = node.config.inputField ? getPath(input, node.config.inputField) ?? null : input;
      const generated = await context.aiProvider.generate(node.config.prompt, mapped);
      return { output: withOutputField(input, node.config.outputName || "result", generated) };
    }
    case "DATABASE": {
      const value = node.config.value === null ? input : node.config.value;
      switch (node.config.action) {
        case "INSERT": return { output: await context.database.insert(node.config.key, value) };
        case "READ": return { output: await context.database.read(node.config.key) };
        case "UPDATE": return { output: await context.database.update(node.config.key, value) };
        case "DELETE": return { output: await context.database.delete(node.config.key) };
      }
      throw new Error("Unsupported database action");
    }
    case "DELAY": {
      const durationMs = node.config.durationMs;
      await new Promise<void>((resolve) => setTimeout(resolve, durationMs));
      return { output: input };
    }
    case "OUTPUT":
      if (node.config.format === "TEXT") return { output: typeof input === "string" ? input : JSON.stringify(input) };
      return { output: input };
  }
}

export async function runWorkflow(workflow: Workflow, context: ExecutionContext = {}): Promise<WorkflowRun> {
  const started = performance.now();
  const nodeRuns = new Map<string, NodeRun>(workflow.nodes.map((node) => [node.id, { nodeId: node.id, nodeLabel: node.label, status: "WAITING" }]));
  const run: WorkflowRun = {
    id: createId("run"), workflowId: workflow.id, workflowName: workflow.name,
    startedAt: nowIso(), status: "RUNNING", nodeRuns: workflow.nodes.map((node) => nodeRuns.get(node.id) as NodeRun),
  };
  const emitRun = () => context.onRun?.({ ...run, nodeRuns: run.nodeRuns.map((item) => ({ ...item })) });
  const setNode = (nodeId: string, patch: Partial<NodeRun>) => {
    const current = nodeRuns.get(nodeId);
    if (!current) return;
    Object.assign(current, patch);
    context.onNodeRun?.({ ...current });
    emitRun();
  };
  emitRun();

  const order = topologicalSort(workflow);
  const outputs = new Map<string, JSONValue>();
  const branches = new Map<string, boolean>();
  const resolvedContext = {
    triggerData: context.triggerData,
    fetchFn: context.fetchFn ?? fetch,
    aiProvider: context.aiProvider ?? new LocalDemoAIProvider(),
    database: context.database ?? new MemoryDatabaseAdapter(),
  };

  for (const nodeId of order) {
    const node = workflow.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) continue;
    const incoming = workflow.edges.find((edge) => edge.target === node.id);
    let shouldRun = node.type === "TRIGGER";
    let input: JSONValue = null;
    if (incoming) {
      const sourceRun = nodeRuns.get(incoming.source);
      const sourceBranch = branches.get(incoming.source);
      const matchesBranch = sourceBranch === undefined || incoming.sourceHandle === (sourceBranch ? "true" : "false");
      shouldRun = sourceRun?.status === "SUCCESS" && matchesBranch;
      input = outputs.get(incoming.source) ?? null;
    }
    if (!shouldRun) {
      setNode(node.id, { status: "SKIPPED", input });
      continue;
    }

    const nodeStart = performance.now();
    const startedAt = nowIso();
    setNode(node.id, { status: node.config.type === "DELAY" ? "WAITING" : "RUNNING", startedAt, input });
    try {
      const result = await executeNode(node, input, resolvedContext);
      outputs.set(node.id, result.output);
      if (result.branch !== undefined) branches.set(node.id, result.branch);
      const duration = Math.max(0, Math.round((performance.now() - nodeStart) * 100) / 100);
      setNode(node.id, { status: "SUCCESS", completedAt: nowIso(), duration, output: result.output });
    } catch (error) {
      const duration = Math.max(0, Math.round((performance.now() - nodeStart) * 100) / 100);
      setNode(node.id, { status: "FAILED", completedAt: nowIso(), duration, error: error instanceof Error ? error.message : "Unknown execution error" });
      run.failedNodeId ??= node.id;
    }
  }

  run.status = run.failedNodeId ? "FAILED" : "SUCCESS";
  run.completedAt = nowIso();
  run.duration = Math.max(0, Math.round((performance.now() - started) * 100) / 100);
  emitRun();
  return { ...run, nodeRuns: run.nodeRuns.map((item) => ({ ...item })) };
}
