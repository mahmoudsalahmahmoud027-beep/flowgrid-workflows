"use client";

import { Archive, Bot, Braces, ChevronRight, Copy, FilePlus2, History, LayoutTemplate, Moon, Plus, RotateCcw, Search, Settings, Sun, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FlowGridSettings, NodeRun, Workflow, WorkflowRun } from "../types/workflow";
import { WorkflowEditor } from "../canvas/WorkflowEditor";
import { runWorkflow } from "../execution/engine";
import { addRun, addVersion, demoWorkspace, FlowGridRepository, LocalStorageDatabaseAdapter, storageSize, type WorkspaceData } from "../storage/repository";
import { cloneJSON } from "../utils/json";
import { createId, nowIso } from "../utils/ids";
import { replaceWorkflowState } from "../workflows/serialization";
import { createBlankWorkflow, createDataCleanupWorkflow, WORKFLOW_TEMPLATES } from "../workflows/templates";

type View = "WORKFLOWS" | "TEMPLATES" | "EXECUTIONS" | "SETTINGS" | "EDITOR";

function formatAgo(date: string): string {
  const delta = Date.now() - new Date(date).getTime();
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function WorkflowDiagram({ workflow }: { workflow: Workflow }) {
  return <div className="workflow-thumbnail" aria-hidden="true">{workflow.nodes.slice(0, 5).map((node, index) => <span key={node.id} className={`thumb-node thumb-${node.type.toLowerCase()}`} style={{ left: `${12 + index * 18}%`, top: `${34 + (index % 2) * 22}%` }} />)}<i /></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="empty-state"><span><Archive size={18} /></span><strong>{title}</strong><p>{body}</p></div>;
}

export function FlowGridApp() {
  const repository = useMemo(() => new FlowGridRepository(), []);
  const [workspace, setWorkspace] = useState<WorkspaceData>(() => demoWorkspace());
  const workspaceRef = useRef(workspace);
  const [view, setView] = useState<View>("EDITOR");
  const [activeWorkflowId, setActiveWorkflowId] = useState(workspace.workflows[0]?.id ?? "");
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | undefined>();
  const [saveStatus, setSaveStatus] = useState<"SAVING" | "SAVED">("SAVED");
  const [recovered, setRecovered] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loaded = repository.load(); workspaceRef.current = loaded.data; setWorkspace(loaded.data); setRecovered(loaded.recovered);
    setActiveWorkflowId(loaded.data.workflows[0]?.id ?? "");
    document.documentElement.dataset.theme = loaded.data.settings.theme.toLowerCase();
  }, [repository]);

  useEffect(() => {
    workspaceRef.current = workspace; setSaveStatus("SAVING");
    const timer = window.setTimeout(() => { repository.save(workspace); setSaveStatus("SAVED"); }, 320);
    return () => window.clearTimeout(timer);
  }, [repository, workspace]);

  const activeWorkflow = workspace.workflows.find((item) => item.id === activeWorkflowId);
  const activeRun = workspace.runs.find((item) => item.workflowId === activeWorkflowId);
  const activeVersions = workspace.versions.filter((item) => item.workflowId === activeWorkflowId);
  const filteredWorkflows = workspace.workflows.filter((item) => !item.archived && `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase()));

  const updateWorkspace = (next: WorkspaceData) => { workspaceRef.current = next; setWorkspace(next); };
  const updateWorkflow = (next: Workflow) => updateWorkspace({ ...workspaceRef.current, workflows: workspaceRef.current.workflows.map((item) => item.id === next.id ? next : item) });
  const openWorkflow = (id: string) => { setActiveWorkflowId(id); setView("EDITOR"); };
  const createWorkflow = (kind: "BLANK" | "SAMPLE" = workspace.settings.newWorkflowBehavior) => {
    const id = createId("workflow"); const workflow = kind === "BLANK" ? createBlankWorkflow(id) : createDataCleanupWorkflow(id);
    updateWorkspace({ ...workspaceRef.current, workflows: [workflow, ...workspaceRef.current.workflows] }); openWorkflow(id);
  };
  const createFromTemplate = (template: typeof WORKFLOW_TEMPLATES[number]) => {
    const workflow = template.create(createId("workflow"));
    updateWorkspace({ ...workspaceRef.current, workflows: [workflow, ...workspaceRef.current.workflows] }); openWorkflow(workflow.id);
  };
  const duplicateWorkflow = (workflow: Workflow) => {
    const copy = { ...cloneJSON(workflow), id: createId("workflow"), name: `${workflow.name} copy`, createdAt: nowIso(), updatedAt: nowIso(), version: 1 };
    updateWorkspace({ ...workspaceRef.current, workflows: [copy, ...workspaceRef.current.workflows] });
  };
  const deleteWorkflow = (workflow: Workflow) => {
    if (!window.confirm(`Delete “${workflow.name}”? Versions and execution history will remain available.`)) return;
    const next = { ...workspaceRef.current, workflows: workspaceRef.current.workflows.filter((item) => item.id !== workflow.id) };
    updateWorkspace(next); if (activeWorkflowId === workflow.id) setActiveWorkflowId(next.workflows[0]?.id ?? "");
  };
  const updateSettings = (settings: FlowGridSettings) => { updateWorkspace({ ...workspaceRef.current, settings }); document.documentElement.dataset.theme = settings.theme.toLowerCase(); };
  const toggleTheme = () => updateSettings({ ...workspaceRef.current.settings, theme: workspaceRef.current.settings.theme === "DARK" ? "LIGHT" : "DARK" });

  const executeWorkflow = async (workflow: Workflow, onNodeRun: (nodeRun: NodeRun) => void, onRunUpdate: (run: WorkflowRun) => void) => {
    const database = new LocalStorageDatabaseAdapter(() => workspaceRef.current, updateWorkspace);
    const completed = await runWorkflow(workflow, { database, onNodeRun, onRun: onRunUpdate });
    const next = addRun(workspaceRef.current, completed); updateWorkspace(next); setSelectedRun(completed);
  };

  const navigation = [
    { id: "WORKFLOWS" as const, label: "Workflows", icon: WorkflowIcon },
    { id: "EXECUTIONS" as const, label: "Executions", icon: History },
    { id: "TEMPLATES" as const, label: "Templates", icon: LayoutTemplate },
  ];

  if (view === "EDITOR" && activeWorkflow) return <div className="app-frame editor-frame"><AppRail view="WORKFLOWS" onNavigate={setView} theme={workspace.settings.theme} onToggleTheme={toggleTheme} /><WorkflowEditor key={activeWorkflow.id}
    workflow={activeWorkflow} run={activeRun} versions={activeVersions} saveStatus={saveStatus}
    onChange={updateWorkflow} onRun={executeWorkflow} onBack={() => setView("WORKFLOWS")}
    onImport={(workflow) => { updateWorkspace({ ...workspaceRef.current, workflows: [workflow, ...workspaceRef.current.workflows] }); openWorkflow(workflow.id); }}
    onSaveVersion={(label) => updateWorkspace(addVersion(workspaceRef.current, activeWorkflow, label))}
    onRestoreVersion={(version) => updateWorkflow(replaceWorkflowState(activeWorkflow, version.workflow))}
    onOpenExecutions={() => setView("EXECUTIONS")} onToggleTheme={toggleTheme}
  /></div>;

  return <div className="app-frame"><AppRail view={view} onNavigate={setView} theme={workspace.settings.theme} onToggleTheme={toggleTheme} />
    <main className="library-shell">
      <header className="library-topbar"><div className="mobile-brand"><span>FG</span><strong>FlowGrid</strong></div><label className="global-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workflows" /><kbd>⌘K</kbd></label><div><span className={`save-indicator save-${saveStatus.toLowerCase()}`}>{saveStatus === "SAVING" ? "Saving…" : "Saved locally"}</span><button className="avatar-button" aria-label="Local workspace">MK</button></div></header>
      <div className="library-content">
        {recovered && <div className="recovery-banner"><CircleAlertIcon /><span>Saved data was malformed, so FlowGrid opened the recoverable demo workspace.</span><button onClick={() => setRecovered(false)}>Dismiss</button></div>}
        {view === "WORKFLOWS" && <>
          <section className="page-heading"><div><p className="overline">LOCAL WORKSPACE</p><h1>Workflows</h1><p>Build, run, and inspect automation graphs stored on this device.</p></div><div><button className="secondary-button" onClick={() => createWorkflow("BLANK")}><FilePlus2 size={14} /> Blank workflow</button><button className="primary-button" onClick={() => createWorkflow("SAMPLE")}><Plus size={14} /> New workflow</button></div></section>
          <section className="library-section"><div className="section-heading"><div><h2>Recent workflows</h2><span>{filteredWorkflows.length} local workflow{filteredWorkflows.length === 1 ? "" : "s"}</span></div></div>{filteredWorkflows.length ? <div className="workflow-card-grid">{filteredWorkflows.slice(0, 4).map((workflow) => <article className="workflow-card" key={workflow.id}><button className="workflow-card-main" onClick={() => openWorkflow(workflow.id)}><WorkflowDiagram workflow={workflow} /><div className="workflow-card-copy"><div><span className="workflow-type"><WorkflowIcon size={11} /> WORKFLOW</span><span>{formatAgo(workflow.updatedAt)}</span></div><h3>{workflow.name}</h3><p>{workflow.description || "No description"}</p><footer><span>{workflow.nodes.length} nodes</span><span>{workflow.edges.length} connections</span></footer></div></button><div className="card-actions"><button aria-label="Duplicate workflow" onClick={() => duplicateWorkflow(workflow)}><Copy size={13} /></button><button aria-label="Delete workflow" onClick={() => deleteWorkflow(workflow)}><Trash2 size={13} /></button></div></article>)}</div> : <EmptyState title="No workflows found" body="Create a blank workflow or start from a template." />}</section>
          <div className="library-columns"><section className="library-section"><div className="section-heading"><div><h2>Templates</h2><span>Working starting points</span></div><button onClick={() => setView("TEMPLATES")}>Browse all <ChevronRight size={13} /></button></div><div className="compact-list">{WORKFLOW_TEMPLATES.slice(0, 3).map((template) => <button key={template.key} onClick={() => createFromTemplate(template)}><span className="compact-icon"><LayoutTemplate size={15} /></span><span><strong>{template.title}</strong><small>{template.description}</small></span><Plus size={14} /></button>)}</div></section>
          <section className="library-section"><div className="section-heading"><div><h2>Recent runs</h2><span>Actual execution history</span></div><button onClick={() => setView("EXECUTIONS")}>View all <ChevronRight size={13} /></button></div>{workspace.runs.length ? <div className="run-list compact">{workspace.runs.slice(0, 4).map((run) => <RunRow key={run.id} run={run} onClick={() => { setSelectedRun(run); setView("EXECUTIONS"); }} />)}</div> : <EmptyState title="No executions yet" body="Run a workflow to see its trace here." />}</section></div>
        </>}

        {view === "TEMPLATES" && <><section className="page-heading"><div><p className="overline">WORKING EXAMPLES</p><h1>Templates</h1><p>Each template contains executable nodes and real routing logic.</p></div></section><div className="template-grid">{WORKFLOW_TEMPLATES.map((template, index) => { const preview = template.create(`preview_${template.key}`); return <article className="template-card" key={template.key}><div className="template-index">0{index + 1}</div><WorkflowDiagram workflow={preview} /><div><span className="template-tag">{preview.nodes.length} NODES</span><h2>{template.title}</h2><p>{template.description}</p><button className="primary-button" onClick={() => createFromTemplate(template)}><Plus size={13} /> Use template</button></div></article>; })}</div></>}

        {view === "EXECUTIONS" && <><section className="page-heading"><div><p className="overline">RUN HISTORY</p><h1>Executions</h1><p>Inspect real timings, inputs, outputs, and failure messages.</p></div><button className="secondary-button" disabled={!workspace.runs.length} onClick={() => updateWorkspace({ ...workspaceRef.current, runs: [] })}><Trash2 size={13} /> Clear history</button></section><div className="executions-layout"><section className="run-table">{workspace.runs.length ? workspace.runs.map((run) => <RunRow key={run.id} run={run} selected={selectedRun?.id === run.id} onClick={() => setSelectedRun(run)} />) : <EmptyState title="No runs recorded" body="Open a workflow and run it to capture an execution trace." />}</section><RunDetail run={selectedRun ?? workspace.runs[0]} onOpenWorkflow={openWorkflow} /></div></>}

        {view === "SETTINGS" && <><section className="page-heading"><div><p className="overline">WORKSPACE</p><h1>Settings</h1><p>Control local storage, appearance, and run retention.</p></div></section><div className="settings-grid"><section className="settings-panel"><h2>Appearance</h2><SettingRow title="Theme" body="Choose the editor color scheme."><div className="segmented"><button className={workspace.settings.theme === "DARK" ? "active" : ""} onClick={() => updateSettings({ ...workspace.settings, theme: "DARK" })}><Moon size={13} /> Dark</button><button className={workspace.settings.theme === "LIGHT" ? "active" : ""} onClick={() => updateSettings({ ...workspace.settings, theme: "LIGHT" })}><Sun size={13} /> Light</button></div></SettingRow><SettingRow title="New workflow" body="Choose the default starting graph."><select value={workspace.settings.newWorkflowBehavior} onChange={(event) => updateSettings({ ...workspace.settings, newWorkflowBehavior: event.target.value as "SAMPLE" | "BLANK" })}><option value="SAMPLE">Useful sample</option><option value="BLANK">Blank canvas</option></select></SettingRow></section><section className="settings-panel"><h2>Execution</h2><SettingRow title="History retention" body="Maximum recent runs stored on this device."><input type="number" min={5} max={100} value={workspace.settings.runRetention} onChange={(event) => updateSettings({ ...workspace.settings, runRetention: Math.min(100, Math.max(5, Number(event.target.value))) })} /></SettingRow><SettingRow title="AI provider" body="Remote providers require a server boundary."><span className="local-ai-badge"><Bot size={12} /> LOCAL DEMO AI</span></SettingRow></section><section className="settings-panel settings-danger"><h2>Storage</h2><SettingRow title="Device-local workspace" body={`${workspace.workflows.length} workflows · ${workspace.versions.length} versions · ${(storageSize(workspace) / 1024).toFixed(1)} KB`}><span className="storage-status">Available</span></SettingRow><SettingRow title="Clear execution history" body="Keep workflows and versions."><button className="secondary-button" onClick={() => updateWorkspace({ ...workspaceRef.current, runs: [] })}>Clear runs</button></SettingRow><SettingRow title="Reset demo workspace" body="Replace all local FlowGrid data with the original sample."><button className="danger-button" onClick={() => { if (window.confirm("Reset all local FlowGrid data? This cannot be undone.")) { const next = repository.reset(); updateWorkspace(next); setActiveWorkflowId(next.workflows[0]?.id ?? ""); } }}><RotateCcw size={13} /> Reset workspace</button></SettingRow></section></div></>}
      </div>
      <nav className="mobile-nav">{navigation.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><item.icon size={17} /><span>{item.label}</span></button>)}<button className={view === "SETTINGS" ? "active" : ""} onClick={() => setView("SETTINGS")}><Settings size={17} /><span>Settings</span></button></nav>
    </main>
  </div>;
}

function CircleAlertIcon() { return <span className="recovery-icon">!</span>; }

function AppRail({ view, onNavigate, theme, onToggleTheme }: { view: View; onNavigate: (view: View) => void; theme: FlowGridSettings["theme"]; onToggleTheme: () => void }) {
  const items = [{ id: "WORKFLOWS" as const, label: "Workflows", icon: WorkflowIcon }, { id: "EXECUTIONS" as const, label: "Executions", icon: History }, { id: "TEMPLATES" as const, label: "Templates", icon: LayoutTemplate }];
  return <aside className="app-rail" aria-label="Primary navigation"><button className="brand-button" onClick={() => onNavigate("WORKFLOWS")} aria-label="FlowGrid home"><Braces size={18} /></button><nav>{items.map((item) => <button key={item.id} className={view === item.id || (view === "EDITOR" && item.id === "WORKFLOWS") ? "active" : ""} onClick={() => onNavigate(item.id)} aria-label={item.label} title={item.label}><item.icon size={17} /><span>{item.label}</span></button>)}</nav><div className="rail-spacer" /><button onClick={onToggleTheme} aria-label="Toggle theme" title="Toggle theme">{theme === "DARK" ? <Sun size={17} /> : <Moon size={17} />}</button><button className={view === "SETTINGS" ? "active" : ""} onClick={() => onNavigate("SETTINGS")} aria-label="Settings" title="Settings"><Settings size={17} /></button></aside>;
}

function RunRow({ run, selected, onClick }: { run: WorkflowRun; selected?: boolean; onClick: () => void }) {
  const failed = run.nodeRuns.find((item) => item.status === "FAILED");
  return <button className={`run-row ${selected ? "selected" : ""}`} onClick={onClick}><span className={`run-status run-${run.status.toLowerCase()}`}>{run.status === "SUCCESS" ? "✓" : "!"}</span><span className="run-row-copy"><strong>{run.workflowName}</strong><small>{failed ? `Failed at ${failed.nodeLabel}` : `${run.nodeRuns.filter((item) => item.status === "SUCCESS").length} nodes completed`}</small></span><span className="run-row-meta"><strong>{run.duration !== undefined ? `${run.duration} ms` : "—"}</strong><small>{formatAgo(run.startedAt)}</small></span><ChevronRight size={14} /></button>;
}

function RunDetail({ run, onOpenWorkflow }: { run?: WorkflowRun; onOpenWorkflow: (id: string) => void }) {
  const [openNode, setOpenNode] = useState<string | null>(null);
  if (!run) return <aside className="run-detail"><EmptyState title="Select an execution" body="Trace details will appear here." /></aside>;
  return <aside className="run-detail"><header><div><p className="overline">TRACE</p><h2>{run.workflowName}</h2><span>{new Date(run.startedAt).toLocaleString()}</span></div><button className="secondary-button" onClick={() => onOpenWorkflow(run.workflowId)}>Open workflow</button></header><div className="run-detail-summary"><span className={`run-status run-${run.status.toLowerCase()}`}>{run.status === "SUCCESS" ? "✓" : "!"}</span><div><strong>{run.status}</strong><small>{run.duration} ms total</small></div></div><div className="run-node-list">{run.nodeRuns.map((node) => <article key={node.nodeId} className={`run-node run-${node.status.toLowerCase()}`}><button onClick={() => setOpenNode(openNode === node.nodeId ? null : node.nodeId)}><i /><strong>{node.nodeLabel}</strong><span>{node.duration !== undefined ? `${node.duration} ms` : node.status}</span></button>{openNode === node.nodeId && <div><small>INPUT</small><pre>{JSON.stringify(node.input, null, 2)}</pre><small>OUTPUT</small><pre>{JSON.stringify(node.output, null, 2)}</pre>{node.error && <p className="node-error">{node.error}</p>}</div>}</article>)}</div></aside>;
}

function SettingRow({ title, body, children }: { title: string; body: string; children: React.ReactNode }) { return <div className="setting-row"><div><strong>{title}</strong><p>{body}</p></div><div>{children}</div></div>; }
