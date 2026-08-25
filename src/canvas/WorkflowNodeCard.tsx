"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { Bot, Braces, Clock3, Database, GitBranch, Globe2, Play, Shuffle } from "lucide-react";
import type { RunStatus, WorkflowNode } from "../types/workflow";
import { definitionFor } from "../nodes/registry";

export type WorkflowNodeData = Record<string, unknown> & { workflowNode: WorkflowNode; runStatus: RunStatus };
export type CanvasNode = Node<WorkflowNodeData, "workflow">;

const icons = {
  TRIGGER: Play,
  HTTP_REQUEST: Globe2,
  CONDITION: GitBranch,
  TRANSFORM: Shuffle,
  AI: Bot,
  DATABASE: Database,
  DELAY: Clock3,
  OUTPUT: Braces,
};

function detailFor(node: WorkflowNode): string {
  switch (node.config.type) {
    case "TRIGGER": return "Manual · sample JSON";
    case "HTTP_REQUEST": return `${node.config.method} ${node.config.url || "URL required"}`;
    case "CONDITION": return node.config.field ? `${node.config.field} · ${node.config.operator.toLowerCase().replaceAll("_", " ")}` : "Condition required";
    case "TRANSFORM": return `${node.config.operations.length} operation${node.config.operations.length === 1 ? "" : "s"}`;
    case "AI": return "Local demo provider";
    case "DATABASE": return `${node.config.action} · ${node.config.key || "key required"}`;
    case "DELAY": return `${node.config.durationMs} ms`;
    case "OUTPUT": return `${node.config.format} result`;
  }
}

function StatusMark({ status }: { status: RunStatus }) {
  if (status === "IDLE") return <span className="node-idle-mark">•••</span>;
  if (status === "RUNNING") return <span className="node-running-mark" aria-label="Running" />;
  if (status === "WAITING") return <span className="node-waiting-mark">WAIT</span>;
  return <span className={`node-status-mark status-${status.toLowerCase()}`}>{status === "SUCCESS" ? "✓" : status === "FAILED" ? "!" : "—"}</span>;
}

export const WorkflowNodeCard = memo(function WorkflowNodeCard({ data, selected }: NodeProps<CanvasNode>) {
  const node = data.workflowNode;
  const definition = definitionFor(node.type);
  const Icon = icons[node.type];
  const isCondition = node.type === "CONDITION";
  return (
    <article className={`flow-node accent-${definition.accent} run-${data.runStatus.toLowerCase()} ${selected ? "is-selected" : ""}`} aria-label={`${node.label}, ${definition.label}`}>
      {node.type !== "TRIGGER" && <Handle type="target" position={Position.Left} className="flow-handle target-handle" />}
      <div className="flow-node-kicker">
        <span className="flow-node-icon"><Icon size={13} strokeWidth={1.8} /></span>
        <span>{definition.group === "AI" ? "LOCAL AI" : definition.group.toUpperCase()}</span>
        <StatusMark status={data.runStatus} />
      </div>
      <h3>{node.label}</h3>
      <p>{detailFor(node)}</p>
      {node.type !== "OUTPUT" && !isCondition && <Handle type="source" position={Position.Right} className="flow-handle source-handle" />}
      {isCondition && (
        <>
          <Handle id="true" type="source" position={Position.Right} className="flow-handle condition-handle true-handle" />
          <Handle id="false" type="source" position={Position.Right} className="flow-handle condition-handle false-handle" />
          <span className="condition-label label-true">TRUE</span><span className="condition-label label-false">FALSE</span>
        </>
      )}
    </article>
  );
});
