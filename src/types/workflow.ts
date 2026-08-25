export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONValue[];
export type JSONObject = { [key: string]: JSONValue };

export type NodeType =
  | "TRIGGER"
  | "HTTP_REQUEST"
  | "CONDITION"
  | "TRANSFORM"
  | "AI"
  | "DATABASE"
  | "DELAY"
  | "OUTPUT";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ConditionOperator = "EQUALS" | "NOT_EQUALS" | "GREATER_THAN" | "LESS_THAN" | "CONTAINS" | "EXISTS";
export type DatabaseAction = "INSERT" | "READ" | "UPDATE" | "DELETE";
export type OutputFormat = "JSON" | "TEXT" | "OBJECT";

export type TransformOperation =
  | { id: string; kind: "RENAME"; from: string; to: string }
  | { id: string; kind: "SELECT"; fields: string[] }
  | { id: string; kind: "SET"; field: string; value: JSONValue }
  | { id: string; kind: "REMOVE"; field: string };

export type TriggerConfig = { type: "TRIGGER"; mode: "MANUAL"; sampleData: JSONValue };
export type HttpRequestConfig = {
  type: "HTTP_REQUEST";
  url: string;
  method: HttpMethod;
  headers: Array<{ key: string; value: string }>;
  query: Array<{ key: string; value: string }>;
  body: string;
};
export type ConditionConfig = { type: "CONDITION"; field: string; operator: ConditionOperator; value: JSONValue };
export type TransformConfig = { type: "TRANSFORM"; operations: TransformOperation[] };
export type AIConfig = { type: "AI"; provider: "LOCAL_DEMO"; prompt: string; inputField: string; outputName: string };
export type DatabaseConfig = { type: "DATABASE"; action: DatabaseAction; key: string; value: JSONValue };
export type DelayConfig = { type: "DELAY"; durationMs: number };
export type OutputConfig = { type: "OUTPUT"; format: OutputFormat };

export type NodeConfig =
  | TriggerConfig
  | HttpRequestConfig
  | ConditionConfig
  | TransformConfig
  | AIConfig
  | DatabaseConfig
  | DelayConfig
  | OutputConfig;

export type WorkflowNode = {
  id: string;
  type: NodeType;
  label: string;
  position: { x: number; y: number };
  config: NodeConfig;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: "true" | "false" | null;
  targetHandle?: string | null;
};

export type Workflow = {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
  version: number;
  archived?: boolean;
};

export type RunStatus = "IDLE" | "WAITING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

export type NodeRun = {
  nodeId: string;
  nodeLabel: string;
  status: RunStatus;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  input?: JSONValue;
  output?: JSONValue;
  error?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  status: RunStatus;
  failedNodeId?: string;
  nodeRuns: NodeRun[];
};

export type ValidationIssue = {
  id: string;
  severity: "ERROR" | "WARNING";
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
};

export type WorkflowVersion = {
  id: string;
  workflowId: string;
  label: string;
  createdAt: string;
  workflow: Workflow;
};

export type FlowGridSettings = {
  theme: "DARK" | "LIGHT";
  newWorkflowBehavior: "SAMPLE" | "BLANK";
  runRetention: number;
};
