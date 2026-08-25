"use client";

import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, addEdge, type Connection, type Edge, type NodeChange, type OnSelectionChangeParams, type ReactFlowInstance } from "@xyflow/react";
import { Braces, CheckCircle2, ChevronLeft, CircleAlert, Clock3, Download, History, Play, Redo2, Save, Search, Undo2, Upload, X, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeRun, NodeType, ValidationIssue, Workflow, WorkflowEdge, WorkflowNode, WorkflowRun, WorkflowVersion } from "../types/workflow";
import { cloneJSON } from "../utils/json";
import { createId, nowIso } from "../utils/ids";
import { createNode } from "../nodes/registry";
import { exportWorkflow, importWorkflow } from "../workflows/serialization";
import { isValidConnection, validateWorkflow } from "../validation/graph";
import { NodeLibrary } from "../components/NodeLibrary";
import { NodeInspector } from "../components/NodeInspector";
import { ExecutionTrace } from "../components/ExecutionTrace";
import { WorkflowNodeCard, type CanvasNode } from "./WorkflowNodeCard";

type Props = {
  workflow: Workflow;
  run?: WorkflowRun;
  versions: WorkflowVersion[];
  saveStatus: "SAVING" | "SAVED";
  onChange: (workflow: Workflow) => void;
  onRun: (workflow: Workflow, onNodeRun: (nodeRun: NodeRun) => void, onRunUpdate: (run: WorkflowRun) => void) => Promise<void>;
  onBack: () => void;
  onImport: (workflow: Workflow) => void;
  onSaveVersion: (label: string) => void;
  onRestoreVersion: (version: WorkflowVersion) => void;
  onOpenExecutions: () => void;
  onToggleTheme: () => void;
};

const nodeTypes = { workflow: WorkflowNodeCard };

function toCanvasNodes(workflow: Workflow, run?: WorkflowRun): CanvasNode[] {
  return workflow.nodes.map((node) => ({ id: node.id, type: "workflow", position: node.position, data: { workflowNode: node, runStatus: run?.nodeRuns.find((item) => item.nodeId === node.id)?.status ?? "IDLE" } }));
}

function toCanvasEdges(edges: WorkflowEdge[]): Edge[] {
  return edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? undefined, targetHandle: edge.targetHandle ?? undefined, type: "smoothstep", animated: false, style: { stroke: edge.sourceHandle === "false" ? "#a87548" : edge.sourceHandle === "true" ? "#338b67" : "#4c7fc5", strokeWidth: 1.6 } }));
}

function WorkflowEditorInner(props: Props) {
  const { workflow, run, versions, saveStatus, onChange, onRun, onBack, onImport, onSaveVersion, onRestoreVersion, onOpenExecutions, onToggleTheme } = props;
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [rf, setRf] = useState<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const [traceOpen, setTraceOpen] = useState(Boolean(run));
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [modal, setModal] = useState<"IMPORT" | "VERSIONS" | "COMMAND" | null>(null);
  const [importText, setImportText] = useState("");
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [versionLabel, setVersionLabel] = useState("");
  const [nodeLibraryOpen, setNodeLibraryOpen] = useState(true);
  const [runState, setRunState] = useState<WorkflowRun | undefined>(run);
  const [clipboard, setClipboard] = useState<WorkflowNode[]>([]);
  const presentRef = useRef<Workflow>(workflow);
  const pastRef = useRef<Workflow[]>([]);
  const futureRef = useRef<Workflow[]>([]);
  const [historyAvailability, setHistoryAvailability] = useState({ undo: false, redo: false });
  const dragStartRef = useRef<Workflow | null>(null);

  useEffect(() => {
    if (!pastRef.current.length && !futureRef.current.length && presentRef.current.updatedAt !== workflow.updatedAt) presentRef.current = workflow;
  }, [workflow]);

  const canvasNodes = useMemo(() => toCanvasNodes(workflow, runState), [workflow, runState]);
  const canvasEdges = useMemo(() => toCanvasEdges(workflow.edges), [workflow.edges]);
  const selectedNode = workflow.nodes.find((node) => node.id === selectedNodeIds[0]);

  const stamp = useCallback((next: Workflow): Workflow => ({ ...next, updatedAt: nowIso(), version: next.version + 1 }), []);
  const commit = useCallback((next: Workflow) => {
    const stamped = stamp(next);
    pastRef.current = [...pastRef.current, cloneJSON(presentRef.current)].slice(-50);
    presentRef.current = cloneJSON(stamped);
    futureRef.current = [];
    setHistoryAvailability({ undo: true, redo: false });
    onChange(stamped);
  }, [onChange, stamp]);
  const replaceWithoutHistory = useCallback((next: Workflow) => {
    const stamped = stamp(next); presentRef.current = cloneJSON(stamped); onChange(stamped);
  }, [onChange, stamp]);

  const undo = useCallback(() => {
    const previous = pastRef.current.at(-1); if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1); futureRef.current = [cloneJSON(presentRef.current), ...futureRef.current]; presentRef.current = cloneJSON(previous); setHistoryAvailability({ undo: pastRef.current.length > 0, redo: true }); onChange(cloneJSON(previous));
  }, [onChange]);
  const redo = useCallback(() => {
    const next = futureRef.current[0]; if (!next) return;
    pastRef.current = [...pastRef.current, cloneJSON(presentRef.current)].slice(-50); futureRef.current = futureRef.current.slice(1); presentRef.current = cloneJSON(next); setHistoryAvailability({ undo: true, redo: futureRef.current.length > 0 }); onChange(cloneJSON(next));
  }, [onChange]);

  const addNodeAt = useCallback((type: NodeType, position?: { x: number; y: number }) => {
    const fallback = { x: 220 + workflow.nodes.length * 26, y: 180 + workflow.nodes.length * 18 };
    const node = createNode(type, position ?? fallback);
    commit({ ...workflow, nodes: [...workflow.nodes, node] });
    setSelectedNodeIds([node.id]);
  }, [commit, workflow]);

  const updateNode = useCallback((updated: WorkflowNode) => commit({ ...workflow, nodes: workflow.nodes.map((node) => node.id === updated.id ? updated : node) }), [commit, workflow]);
  const deleteNodes = useCallback((ids: string[]) => {
    if (!ids.length) return;
    commit({ ...workflow, nodes: workflow.nodes.filter((node) => !ids.includes(node.id)), edges: workflow.edges.filter((edge) => !ids.includes(edge.source) && !ids.includes(edge.target)) });
    setSelectedNodeIds([]);
  }, [commit, workflow]);
  const deleteEdges = useCallback((ids: string[]) => ids.length && commit({ ...workflow, edges: workflow.edges.filter((edge) => !ids.includes(edge.id)) }), [commit, workflow]);
  const duplicateNode = useCallback((node: WorkflowNode) => {
    const duplicate = { ...cloneJSON(node), id: createId("node"), label: `${node.label} copy`, position: { x: node.position.x + 42, y: node.position.y + 42 } };
    commit({ ...workflow, nodes: [...workflow.nodes, duplicate] }); setSelectedNodeIds([duplicate.id]);
  }, [commit, workflow]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || !isValidConnection(workflow.edges, connection.source, connection.target, connection.sourceHandle)) return;
    const nextEdges = addEdge({ ...connection, id: createId("edge") }, canvasEdges);
    commit({ ...workflow, edges: nextEdges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle === "true" || edge.sourceHandle === "false" ? edge.sourceHandle : null, targetHandle: edge.targetHandle })) });
  }, [canvasEdges, commit, workflow]);

  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    const positions = new Map<string, { x: number; y: number }>();
    for (const change of changes) if (change.type === "position" && change.position) positions.set(change.id, change.position);
    if (positions.size) replaceWithoutHistory({ ...workflow, nodes: workflow.nodes.map((node) => positions.has(node.id) ? { ...node, position: positions.get(node.id) as { x: number; y: number } } : node) });
  }, [replaceWithoutHistory, workflow]);

  const onSelectionChange = useCallback(({ nodes, edges }: OnSelectionChangeParams<CanvasNode, Edge>) => { setSelectedNodeIds(nodes.map((node) => node.id)); setSelectedEdgeIds(edges.map((edge) => edge.id)); }, []);

  const validate = useCallback(() => { const next = validateWorkflow(workflow); setIssues(next); return next; }, [workflow]);
  const execute = useCallback(async () => {
    const nextIssues = validate();
    if (nextIssues.some((issue) => issue.severity === "ERROR")) return;
    setIssues(null); setTraceOpen(true);
    const initial: WorkflowRun = { id: "active", workflowId: workflow.id, workflowName: workflow.name, startedAt: nowIso(), status: "RUNNING", nodeRuns: workflow.nodes.map((node) => ({ nodeId: node.id, nodeLabel: node.label, status: "WAITING" })) };
    setRunState(initial);
    await onRun(workflow, (nodeRun) => setRunState((current) => current ? { ...current, nodeRuns: current.nodeRuns.map((item) => item.nodeId === nodeRun.nodeId ? nodeRun : item) } : current), setRunState);
  }, [onRun, validate, workflow]);

  const exportJson = useCallback(() => {
    const blob = new Blob([exportWorkflow(workflow)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.flowgrid.json`; anchor.click(); URL.revokeObjectURL(url);
  }, [workflow]);

  const copySelection = useCallback(() => setClipboard(workflow.nodes.filter((node) => selectedNodeIds.includes(node.id)).map(cloneJSON)), [selectedNodeIds, workflow.nodes]);
  const pasteSelection = useCallback(() => {
    if (!clipboard.length) return;
    const idMap = new Map(clipboard.map((node) => [node.id, createId("node")]));
    const pasted = clipboard.map((node) => ({ ...cloneJSON(node), id: idMap.get(node.id) as string, position: { x: node.position.x + 48, y: node.position.y + 48 } }));
    commit({ ...workflow, nodes: [...workflow.nodes, ...pasted] }); setSelectedNodeIds(pasted.map((node) => node.id));
  }, [clipboard, commit, workflow]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") { event.preventDefault(); setModal("COMMAND"); }
      if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) redo(); else undo(); }
      if (mod && event.key.toLowerCase() === "c") { event.preventDefault(); copySelection(); }
      if (mod && event.key.toLowerCase() === "v") { event.preventDefault(); pasteSelection(); }
      if ((event.key === "Delete" || event.key === "Backspace") && (selectedNodeIds.length || selectedEdgeIds.length)) { event.preventDefault(); deleteNodes(selectedNodeIds); deleteEdges(selectedEdgeIds); }
      if (event.key === "Escape") { setModal(null); setIssues(null); setSelectedNodeIds([]); }
    };
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, [copySelection, deleteEdges, deleteNodes, pasteSelection, redo, selectedEdgeIds, selectedNodeIds, undo]);

  const commands = [
    { label: "Run workflow", hint: "⌘ ↵", icon: Play, action: execute },
    { label: "Validate workflow", hint: "", icon: CheckCircle2, action: validate },
    { label: "Save version", hint: "", icon: Save, action: () => setModal("VERSIONS") },
    { label: "Fit view", hint: "", icon: ZoomIn, action: () => rf?.fitView({ padding: 0.18 }) },
    { label: "Export JSON", hint: "", icon: Download, action: exportJson },
    { label: "Import JSON", hint: "", icon: Upload, action: () => setModal("IMPORT") },
    { label: "Open executions", hint: "", icon: History, action: onOpenExecutions },
    { label: "Toggle theme", hint: "", icon: Braces, action: onToggleTheme },
  ];

  return <main className={`workflow-editor ${nodeLibraryOpen ? "library-open" : ""} ${selectedNode ? "inspector-open" : ""} ${traceOpen ? "trace-open" : ""}`}>
    <header className="editor-topbar">
      <div className="editor-title"><button className="icon-control" onClick={onBack} aria-label="Back to workflows"><ChevronLeft size={16} /></button><div><small>WORKFLOWS / {workflow.version.toString().padStart(2, "0")}</small><input value={workflow.name} onChange={(event) => commit({ ...workflow, name: event.target.value })} aria-label="Workflow name" /></div></div>
      <div className="editor-actions"><span className={`save-indicator save-${saveStatus.toLowerCase()}`}>{saveStatus === "SAVING" ? "Saving…" : "Saved"}</span><button className="secondary-button desktop-action" onClick={() => setModal("VERSIONS")}><Clock3 size={13} /> Versions</button><button className="secondary-button" onClick={validate}><CheckCircle2 size={13} /> Validate</button><button className="primary-button" onClick={execute} disabled={runState?.status === "RUNNING"}><Play size={13} fill="currentColor" /> {runState?.status === "RUNNING" ? "Running…" : "Run workflow"}</button></div>
    </header>
    <div className="editor-body">
      {nodeLibraryOpen ? <NodeLibrary onAdd={addNodeAt} onClose={() => setNodeLibraryOpen(false)} /> : <button className="open-library-button" onClick={() => setNodeLibraryOpen(true)}>＋<span>Add node</span></button>}
      <section className="flow-canvas" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={(event) => { event.preventDefault(); const type = event.dataTransfer.getData("application/flowgrid-node") as NodeType; if (type && rf) addNodeAt(type, rf.screenToFlowPosition({ x: event.clientX, y: event.clientY })); }}>
        <ReactFlow<CanvasNode, Edge>
          nodes={canvasNodes} edges={canvasEdges} nodeTypes={nodeTypes} onInit={setRf}
          onNodesChange={onNodesChange} onNodesDelete={(nodes) => deleteNodes(nodes.map((node) => node.id))}
          onEdgesDelete={(edges) => deleteEdges(edges.map((edge) => edge.id))} onConnect={onConnect}
          onSelectionChange={onSelectionChange} fitView fitViewOptions={{ padding: .18 }} minZoom={.25} maxZoom={1.8}
          onNodeDragStart={() => { dragStartRef.current = cloneJSON(workflow); }}
          onNodeDragStop={(_, dragged) => { if (!dragStartRef.current) return; const current = stamp({ ...workflow, nodes: workflow.nodes.map((node) => node.id === dragged.id ? { ...node, position: dragged.position } : node) }); pastRef.current = [...pastRef.current, cloneJSON(dragStartRef.current)].slice(-50); presentRef.current = cloneJSON(current); futureRef.current = []; dragStartRef.current = null; setHistoryAvailability({ undo: true, redo: false }); onChange(current); }}
          isValidConnection={(connection) => Boolean(connection.source && connection.target && isValidConnection(workflow.edges, connection.source, connection.target, connection.sourceHandle))}
          deleteKeyCode={null} multiSelectionKeyCode={["Meta", "Control"]} selectionOnDrag panOnScroll
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--canvas-dot)" />
          <Controls position="bottom-center" showInteractive={false} />
          <MiniMap position="bottom-right" pannable zoomable nodeColor="#303741" maskColor="rgba(9,11,13,.72)" />
        </ReactFlow>
        <div className="canvas-edit-toolbar"><button onClick={undo} disabled={!historyAvailability.undo} aria-label="Undo"><Undo2 size={14} /></button><button onClick={redo} disabled={!historyAvailability.redo} aria-label="Redo"><Redo2 size={14} /></button><span /><button onClick={() => rf?.fitView({ padding: .18 })}>Fit view</button></div>
        {issues && <aside className="validation-popover"><header><div><p className="overline">VALIDATION</p><h3>{issues.some((issue) => issue.severity === "ERROR") ? "Workflow needs attention" : "Ready to run"}</h3></div><button className="icon-control" onClick={() => setIssues(null)} aria-label="Close validation"><X size={14} /></button></header>{issues.length ? issues.map((issue) => <button key={issue.id} className={`validation-item issue-${issue.severity.toLowerCase()}`} onClick={() => { if (issue.nodeId) { setSelectedNodeIds([issue.nodeId]); const node = workflow.nodes.find((item) => item.id === issue.nodeId); if (node) rf?.setCenter(node.position.x + 100, node.position.y + 55, { zoom: 1 }); } }}><span>{issue.severity === "ERROR" ? <CircleAlert size={13} /> : <Clock3 size={13} />}</span><div><strong>{issue.code.replaceAll("_", " ")}</strong><p>{issue.message}</p></div></button>) : <div className="validation-ready"><CheckCircle2 size={18} /><span>No errors or warnings found.</span></div>}</aside>}
      </section>
      {selectedNode && <NodeInspector node={selectedNode} onUpdate={updateNode} onDelete={() => deleteNodes([selectedNode.id])} onDuplicate={() => duplicateNode(selectedNode)} onClose={() => setSelectedNodeIds([])} />}
    </div>
    <ExecutionTrace run={runState} expanded={traceOpen} onToggle={() => setTraceOpen((value) => !value)} />

    {modal === "IMPORT" && <div className="modal-backdrop"><section className="modal-panel"><header><div><p className="overline">WORKFLOW JSON</p><h2>Import workflow</h2></div><button className="icon-control" onClick={() => setModal(null)} aria-label="Close import"><X size={15} /></button></header><p>Paste a FlowGrid schema v1 document. Existing workflows will not be overwritten.</p><textarea className="import-area" rows={14} value={importText} onChange={(event) => setImportText(event.target.value)} placeholder={'{\n  "schemaVersion": 1,\n  ...\n}'} />{importErrors.length > 0 && <div className="import-errors">{importErrors.map((error) => <span key={error}>{error}</span>)}</div>}<footer><button className="secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="primary-button" onClick={() => { const result = importWorkflow(importText); if (!result.ok) setImportErrors(result.errors); else { onImport({ ...result.workflow, id: createId("workflow"), createdAt: nowIso(), updatedAt: nowIso() }); setModal(null); } }}>Import workflow</button></footer></section></div>}

    {modal === "VERSIONS" && <div className="modal-backdrop"><section className="modal-panel versions-panel"><header><div><p className="overline">LOCAL HISTORY</p><h2>Workflow versions</h2></div><button className="icon-control" onClick={() => setModal(null)} aria-label="Close versions"><X size={15} /></button></header><div className="save-version-row"><input value={versionLabel} onChange={(event) => setVersionLabel(event.target.value)} placeholder="Version label (optional)" /><button className="primary-button" onClick={() => { onSaveVersion(versionLabel); setVersionLabel(""); }}>Save version</button></div><div className="version-list">{versions.length ? versions.map((version) => <article key={version.id}><div><strong>{version.label}</strong><span>{new Date(version.createdAt).toLocaleString()} · {version.workflow.nodes.length} nodes</span></div><button className="secondary-button" onClick={() => { if (window.confirm(`Restore “${version.label}”? Current unsaved graph changes will be replaced.`)) { onRestoreVersion(version); setModal(null); } }}>Restore</button></article>) : <p className="empty-small">No saved versions yet.</p>}</div></section></div>}

    {modal === "COMMAND" && <div className="command-backdrop"><section className="command-palette"><label><Search size={15} /><input placeholder="Type a command" /></label><div>{commands.map((command) => <button key={command.label} onClick={() => { setModal(null); command.action(); }}><command.icon size={14} /><span>{command.label}</span><kbd>{command.hint}</kbd></button>)}</div></section></div>}
  </main>;
}

export function WorkflowEditor(props: Props) {
  return <ReactFlowProvider><WorkflowEditorInner {...props} /></ReactFlowProvider>;
}
