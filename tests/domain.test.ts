import { describe, expect, it } from "vitest";
import { runWorkflow } from "../src/execution/engine";
import { applyTransform } from "../src/execution/transform";
import { createHistory, pushHistory, redoHistory, undoHistory } from "../src/history/history";
import { FlowGridRepository } from "../src/storage/repository";
import { hasCycle, topologicalSort, validateWorkflow } from "../src/validation/graph";
import { exportWorkflow, importWorkflow, replaceWorkflowState } from "../src/workflows/serialization";
import { createApiHealthWorkflow, createBlankWorkflow, createDataCleanupWorkflow } from "../src/workflows/templates";

describe("graph algorithms", () => {
  it("calculates a topological execution order", () => {
    const workflow = createDataCleanupWorkflow("topo");
    const order = topologicalSort(workflow);
    expect(order.indexOf("topo_trigger")).toBeLessThan(order.indexOf("topo_transform"));
    expect(order.indexOf("topo_transform")).toBeLessThan(order.indexOf("topo_condition"));
  });

  it("detects a cycle", () => {
    const workflow = createDataCleanupWorkflow("cycle");
    workflow.edges.push({ id: "back", source: "cycle_yes", target: "cycle_trigger" });
    expect(hasCycle(workflow)).toBe(true);
    expect(() => topologicalSort(workflow)).toThrow("cycle");
  });

  it("reports missing trigger, output, and configuration", () => {
    const workflow = createBlankWorkflow("invalid");
    workflow.nodes.push({ id: "http", type: "HTTP_REQUEST", label: "Broken request", position: { x: 0, y: 0 }, config: { type: "HTTP_REQUEST", url: "", method: "GET", headers: [], query: [], body: "" } });
    const codes = validateWorkflow(workflow).map((issue) => issue.code);
    expect(codes).toContain("MISSING_TRIGGER");
    expect(codes).toContain("MISSING_OUTPUT");
    expect(codes).toContain("MISSING_URL");
  });
});

describe("execution engine", () => {
  it("runs trigger → transform → output with real data", async () => {
    const workflow = createDataCleanupWorkflow("basic");
    workflow.nodes = workflow.nodes.filter((node) => !["basic_condition", "basic_no"].includes(node.id));
    workflow.edges = [
      { id: "e1", source: "basic_trigger", target: "basic_transform" },
      { id: "e2", source: "basic_transform", target: "basic_yes" },
    ];
    const run = await runWorkflow(workflow);
    expect(run.status).toBe("SUCCESS");
    expect(run.nodeRuns).toHaveLength(3);
    expect(run.nodeRuns.every((node) => node.status === "SUCCESS")).toBe(true);
    expect(run.nodeRuns.find((node) => node.nodeId === "basic_yes")?.output).toMatchObject({ name: "Ada Lovelace", status: "ready" });
  });

  it("routes the condition true branch and skips false", async () => {
    const run = await runWorkflow(createDataCleanupWorkflow("truebranch"));
    expect(run.nodeRuns.find((node) => node.nodeId === "truebranch_yes")?.status).toBe("SUCCESS");
    expect(run.nodeRuns.find((node) => node.nodeId === "truebranch_no")?.status).toBe("SKIPPED");
  });

  it("routes the condition false branch and skips true", async () => {
    const workflow = createDataCleanupWorkflow("falsebranch");
    const trigger = workflow.nodes.find((node) => node.id === "falsebranch_trigger");
    if (trigger?.config.type === "TRIGGER") trigger.config.sampleData = { full_name: "Grace", score: 20 };
    const run = await runWorkflow(workflow);
    expect(run.nodeRuns.find((node) => node.nodeId === "falsebranch_yes")?.status).toBe("SKIPPED");
    expect(run.nodeRuns.find((node) => node.nodeId === "falsebranch_no")?.status).toBe("SUCCESS");
  });

  it("passes a mocked HTTP response downstream", async () => {
    const workflow = createApiHealthWorkflow("httpok");
    const fetchFn: typeof fetch = async () => new Response(JSON.stringify({ id: 7, ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    const run = await runWorkflow(workflow, { fetchFn });
    expect(run.status).toBe("SUCCESS");
    expect(run.nodeRuns.find((node) => node.nodeId === "httpok_yes")?.output).toEqual({ id: 7, ok: true });
  });

  it("marks a failed node and every dependent node skipped", async () => {
    const workflow = createApiHealthWorkflow("httpfail");
    const fetchFn: typeof fetch = async () => { throw new Error("Network is offline"); };
    const run = await runWorkflow(workflow, { fetchFn });
    expect(run.status).toBe("FAILED");
    expect(run.nodeRuns.find((node) => node.nodeId === "httpfail_http")).toMatchObject({ status: "FAILED", error: "Network is offline" });
    expect(run.nodeRuns.find((node) => node.nodeId === "httpfail_condition")?.status).toBe("SKIPPED");
    expect(run.nodeRuns.find((node) => node.nodeId === "httpfail_yes")?.status).toBe("SKIPPED");
  });
});

describe("transform system", () => {
  it("applies deterministic rename, set, select, and remove operations", () => {
    const output = applyTransform({ old: "value", keep: 3, remove: true }, [
      { id: "1", kind: "RENAME", from: "old", to: "renamed" },
      { id: "2", kind: "SET", field: "status", value: "ready" },
      { id: "3", kind: "REMOVE", field: "remove" },
      { id: "4", kind: "SELECT", fields: ["renamed", "status"] },
    ]);
    expect(output).toEqual({ renamed: "value", status: "ready" });
  });
});

describe("workflow state", () => {
  it("roundtrips workflow JSON", () => {
    const workflow = createDataCleanupWorkflow("roundtrip");
    const result = importWorkflow(exportWorkflow(workflow));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.workflow).toEqual(workflow);
  });

  it("rejects invalid imports with useful errors", () => {
    const result = importWorkflow('{"schemaVersion":1,"id":"bad","name":"Bad","nodes":[],"edges":[{"id":"e","source":"missing","target":"also-missing"}]}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("missing source");
  });

  it("restores a version snapshot while preserving identity", () => {
    const current = createDataCleanupWorkflow("restore");
    const snapshot = createDataCleanupWorkflow("snapshot");
    snapshot.name = "Old name";
    snapshot.nodes = snapshot.nodes.slice(0, 3);
    const restored = replaceWorkflowState(current, snapshot);
    expect(restored.id).toBe("restore");
    expect(restored.name).toBe(current.name);
    expect(restored.nodes).toHaveLength(3);
    expect(restored.version).toBe(current.version + 1);
  });

  it("supports bounded undo and redo state", () => {
    let history = createHistory({ value: 1 });
    history = pushHistory(history, { value: 2 });
    history = pushHistory(history, { value: 3 });
    history = undoHistory(history);
    expect(history.present.value).toBe(2);
    history = redoHistory(history);
    expect(history.present.value).toBe(3);
  });

  it("persists workflows, positions, edges, and configs across repository reload", () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } } });
    const repository = new FlowGridRepository();
    const data = repository.load().data;
    data.workflows[0].nodes[0].position = { x: 777, y: 333 };
    repository.save(data);
    const reloaded = new FlowGridRepository().load().data;
    expect(reloaded.workflows[0].nodes[0].position).toEqual({ x: 777, y: 333 });
    expect(reloaded.workflows[0].edges.length).toBeGreaterThan(0);
    expect(reloaded.workflows[0].nodes[0].config.type).toBe("TRIGGER");
  });
});
