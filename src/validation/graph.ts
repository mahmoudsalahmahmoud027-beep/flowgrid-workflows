import type { Workflow, WorkflowEdge, ValidationIssue } from "../types/workflow";

export function topologicalSort(workflow: Pick<Workflow, "nodes" | "edges">): string[] {
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  const indegree = new Map(workflow.nodes.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>();
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }
  const queue = workflow.nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const order: string[] = [];
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    order.push(current);
    for (const target of outgoing.get(current) ?? []) {
      const next = (indegree.get(target) ?? 1) - 1;
      indegree.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  if (order.length !== workflow.nodes.length) throw new Error("Workflow contains a cycle");
  return order;
}

export function hasCycle(workflow: Pick<Workflow, "nodes" | "edges">): boolean {
  try {
    topologicalSort(workflow);
    return false;
  } catch {
    return true;
  }
}

function reachableFromTriggers(workflow: Pick<Workflow, "nodes" | "edges">): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const edge of workflow.edges) outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  const queue = workflow.nodes.filter((node) => node.type === "TRIGGER").map((node) => node.id);
  const reached = new Set(queue);
  while (queue.length) {
    const current = queue.shift();
    if (!current) break;
    for (const target of outgoing.get(current) ?? []) {
      if (!reached.has(target)) { reached.add(target); queue.push(target); }
    }
  }
  return reached;
}

export function isValidConnection(edges: WorkflowEdge[], source: string, target: string, sourceHandle?: string | null): boolean {
  if (source === target) return false;
  if (edges.some((edge) => edge.source === source && edge.target === target && (edge.sourceHandle ?? null) === (sourceHandle ?? null))) return false;
  if (edges.some((edge) => edge.target === target)) return false;
  return true;
}

export function validateWorkflow(workflow: Workflow): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(workflow.nodes.map((node) => node.id));
  const triggers = workflow.nodes.filter((node) => node.type === "TRIGGER");
  const outputs = workflow.nodes.filter((node) => node.type === "OUTPUT");

  if (triggers.length === 0) issues.push({ id: "missing-trigger", severity: "ERROR", code: "MISSING_TRIGGER", message: "Add a trigger before running this workflow." });
  if (triggers.length > 1) issues.push({ id: "multiple-trigger", severity: "WARNING", code: "MULTIPLE_TRIGGERS", message: "This workflow has multiple triggers; all will start in the same run." });
  if (outputs.length === 0) issues.push({ id: "missing-output", severity: "ERROR", code: "MISSING_OUTPUT", message: "Add at least one output node." });

  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({ id: `broken-${edge.id}`, severity: "ERROR", code: "BROKEN_EDGE", message: "An edge references a missing node.", edgeId: edge.id });
    }
    if (edge.source === edge.target) issues.push({ id: `self-${edge.id}`, severity: "ERROR", code: "SELF_EDGE", message: "A node cannot connect to itself.", edgeId: edge.id, nodeId: edge.source });
  }

  const edgeKeys = new Set<string>();
  for (const edge of workflow.edges) {
    const key = `${edge.source}:${edge.sourceHandle ?? "default"}:${edge.target}`;
    if (edgeKeys.has(key)) issues.push({ id: `duplicate-${edge.id}`, severity: "ERROR", code: "DUPLICATE_EDGE", message: "Duplicate connection detected.", edgeId: edge.id });
    edgeKeys.add(key);
  }

  const incoming = new Map<string, number>();
  for (const edge of workflow.edges) incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  for (const [nodeId, count] of incoming) {
    if (count > 1) issues.push({ id: `multi-in-${nodeId}`, severity: "ERROR", code: "MULTIPLE_INPUTS", message: "This node accepts only one incoming connection.", nodeId });
  }

  for (const node of workflow.nodes) {
    if (node.config.type === "HTTP_REQUEST" && !node.config.url.trim()) issues.push({ id: `url-${node.id}`, severity: "ERROR", code: "MISSING_URL", message: "HTTP Request needs a URL.", nodeId: node.id });
    if (node.config.type === "CONDITION" && !node.config.field.trim()) issues.push({ id: `condition-${node.id}`, severity: "ERROR", code: "MISSING_CONDITION", message: "Condition needs a field or path.", nodeId: node.id });
    if (node.config.type === "AI" && !node.config.prompt.trim()) issues.push({ id: `prompt-${node.id}`, severity: "ERROR", code: "MISSING_PROMPT", message: "AI node needs a prompt.", nodeId: node.id });
    if (node.config.type === "DATABASE" && !node.config.key.trim()) issues.push({ id: `db-key-${node.id}`, severity: "ERROR", code: "MISSING_DATABASE_KEY", message: "Database node needs a record key.", nodeId: node.id });
    if (node.config.type === "DELAY" && (node.config.durationMs < 0 || node.config.durationMs > 10000)) issues.push({ id: `delay-${node.id}`, severity: "ERROR", code: "INVALID_DELAY", message: "Delay must be between 0 and 10,000 ms.", nodeId: node.id });
  }

  if (hasCycle(workflow)) issues.push({ id: "cycle", severity: "ERROR", code: "CYCLE", message: "Cycles are not supported. Remove the loop before running." });

  const reached = reachableFromTriggers(workflow);
  for (const node of workflow.nodes) {
    if (triggers.length > 0 && !reached.has(node.id)) issues.push({ id: `unreachable-${node.id}`, severity: "WARNING", code: "UNREACHABLE", message: `${node.label} is not reachable from a trigger.`, nodeId: node.id });
  }

  return issues;
}
