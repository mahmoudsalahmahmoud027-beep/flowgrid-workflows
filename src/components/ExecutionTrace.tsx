"use client";

import { ChevronDown, ChevronUp, CircleAlert, X } from "lucide-react";
import { useState } from "react";
import type { NodeRun, WorkflowRun } from "../types/workflow";

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  if (value === undefined) return null;
  return <div className="trace-json"><span>{label}</span><pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre></div>;
}

function TraceRow({ nodeRun, expanded, onToggle }: { nodeRun: NodeRun; expanded: boolean; onToggle: () => void }) {
  return <article className={`trace-row trace-${nodeRun.status.toLowerCase()}`}>
    <button className="trace-row-summary" onClick={onToggle} aria-expanded={expanded}>
      <span className="trace-status-dot" /><strong>{nodeRun.nodeLabel}</strong><small>{nodeRun.duration !== undefined ? `${nodeRun.duration} ms` : nodeRun.status}</small>{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
    </button>
    {expanded && <div className="trace-row-detail">
      <JsonBlock label="INPUT" value={nodeRun.input} /><JsonBlock label="OUTPUT" value={nodeRun.output} />
      {nodeRun.error && <div className="trace-error"><CircleAlert size={14} /><span>{nodeRun.error}</span></div>}
    </div>}
  </article>;
}

export function ExecutionTrace({ run, expanded, onToggle, onClose }: { run?: WorkflowRun; expanded: boolean; onToggle: () => void; onClose?: () => void }) {
  const [openNode, setOpenNode] = useState<string | null>(null);
  const completed = run?.nodeRuns.filter((item) => item.status === "SUCCESS").length ?? 0;
  return <section className={`execution-trace ${expanded ? "trace-expanded" : ""}`} aria-label="Execution trace">
    <header className="trace-header">
      <button className="trace-title" onClick={onToggle} aria-expanded={expanded}><span className={`run-pulse run-${(run?.status ?? "IDLE").toLowerCase()}`} /><span><small>EXECUTION TRACE</small><strong>{run ? `${run.status === "RUNNING" ? "Run in progress" : `Run ${run.status.toLowerCase()}`}` : "No run yet"}</strong></span></button>
      {run && <div className="trace-summary"><span>{completed}/{run.nodeRuns.length} completed</span><b>{run.duration !== undefined ? `${run.duration} ms` : "Running"}</b></div>}
      <button className="icon-control" onClick={onClose ?? onToggle} aria-label={expanded ? "Collapse trace" : "Expand trace"}>{expanded ? <X size={15} /> : <ChevronUp size={15} />}</button>
    </header>
    {expanded && <div className="trace-list">{run ? run.nodeRuns.map((nodeRun) => <TraceRow key={nodeRun.nodeId} nodeRun={nodeRun} expanded={openNode === nodeRun.nodeId} onToggle={() => setOpenNode(openNode === nodeRun.nodeId ? null : nodeRun.nodeId)} />) : <div className="empty-trace"><span>Run the workflow to inspect each node’s real input and output.</span></div>}</div>}
  </section>;
}
