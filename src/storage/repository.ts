import type { FlowGridSettings, JSONValue, Workflow, WorkflowRun, WorkflowVersion } from "../types/workflow";
import { cloneJSON, isJSONValue } from "../utils/json";
import { createId, nowIso } from "../utils/ids";
import { createDataCleanupWorkflow } from "../workflows/templates";

const STORAGE_KEY = "flowgrid.workspace.v1";

export type WorkspaceData = {
  storageVersion: 1;
  workflows: Workflow[];
  versions: WorkflowVersion[];
  runs: WorkflowRun[];
  database: Record<string, JSONValue>;
  settings: FlowGridSettings;
};

const defaults: FlowGridSettings = { theme: "DARK", newWorkflowBehavior: "SAMPLE", runRetention: 30 };

export function demoWorkspace(): WorkspaceData {
  return { storageVersion: 1, workflows: [createDataCleanupWorkflow()], versions: [], runs: [], database: {}, settings: defaults };
}

function safeWorkspace(value: unknown): WorkspaceData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<WorkspaceData>;
  if (candidate.storageVersion !== 1 || !Array.isArray(candidate.workflows)) return null;
  return {
    storageVersion: 1,
    workflows: candidate.workflows,
    versions: Array.isArray(candidate.versions) ? candidate.versions : [],
    runs: Array.isArray(candidate.runs) ? candidate.runs : [],
    database: candidate.database && typeof candidate.database === "object" ? candidate.database : {},
    settings: { ...defaults, ...(candidate.settings ?? {}) },
  };
}

export class FlowGridRepository {
  load(): { data: WorkspaceData; recovered: boolean } {
    if (typeof window === "undefined") return { data: demoWorkspace(), recovered: false };
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: demoWorkspace(), recovered: false };
    try {
      const data = safeWorkspace(JSON.parse(raw));
      return data ? { data, recovered: false } : { data: demoWorkspace(), recovered: true };
    } catch {
      return { data: demoWorkspace(), recovered: true };
    }
  }

  save(data: WorkspaceData): void {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  reset(): WorkspaceData {
    const data = demoWorkspace();
    this.save(data);
    return data;
  }

  clear(): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }
}

export class LocalStorageDatabaseAdapter {
  constructor(private readonly getWorkspace: () => WorkspaceData, private readonly saveWorkspace: (data: WorkspaceData) => void) {}
  async insert(key: string, value: JSONValue): Promise<JSONValue> {
    const data = cloneJSON(this.getWorkspace());
    if (key in data.database) throw new Error(`Record "${key}" already exists`);
    data.database[key] = value; this.saveWorkspace(data); return { key, value };
  }
  async read(key: string): Promise<JSONValue> {
    const value = this.getWorkspace().database[key];
    if (value === undefined) throw new Error(`Record "${key}" was not found`);
    return cloneJSON(value);
  }
  async update(key: string, value: JSONValue): Promise<JSONValue> {
    const data = cloneJSON(this.getWorkspace());
    if (!(key in data.database)) throw new Error(`Record "${key}" was not found`);
    data.database[key] = value; this.saveWorkspace(data); return { key, value };
  }
  async delete(key: string): Promise<JSONValue> {
    const data = cloneJSON(this.getWorkspace()); const existed = key in data.database;
    delete data.database[key]; this.saveWorkspace(data); return { key, deleted: existed };
  }
}

export function addVersion(data: WorkspaceData, workflow: Workflow, label: string): WorkspaceData {
  const version: WorkflowVersion = { id: createId("version"), workflowId: workflow.id, label: label.trim() || `Version ${workflow.version}`, createdAt: nowIso(), workflow: cloneJSON(workflow) };
  const versions: WorkflowVersion[] = [];
  const counts = new Map<string, number>();
  for (const item of [version, ...data.versions]) {
    const count = counts.get(item.workflowId) ?? 0;
    if (count >= 20 || versions.length >= 50) continue;
    versions.push(item);
    counts.set(item.workflowId, count + 1);
  }
  return { ...data, versions };
}

export function addRun(data: WorkspaceData, run: WorkflowRun): WorkspaceData {
  return { ...data, runs: [run, ...data.runs].slice(0, data.settings.runRetention) };
}

export function storageSize(data: WorkspaceData): number {
  const value = JSON.stringify(data);
  return new Blob([value]).size;
}

export function assertDatabaseValue(value: unknown): JSONValue {
  return isJSONValue(value) ? value : null;
}
