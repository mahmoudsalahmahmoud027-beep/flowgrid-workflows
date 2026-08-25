"use client";

import { Copy, Plus, Trash2, X } from "lucide-react";
import type { ConditionOperator, DatabaseAction, HttpMethod, JSONValue, NodeConfig, OutputFormat, TransformConfig, TransformOperation, WorkflowNode } from "../types/workflow";
import { createId } from "../utils/ids";
import { parseConfigValue } from "../utils/json";
import { definitionFor } from "../nodes/registry";

type Props = { node: WorkflowNode; onUpdate: (node: WorkflowNode) => void; onDelete: () => void; onDuplicate: () => void; onClose: () => void };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="inspector-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function JsonArea({ value, onChange, label }: { value: JSONValue; onChange: (value: JSONValue) => void; label: string }) {
  return <Field label={label}><textarea defaultValue={JSON.stringify(value, null, 2)} onBlur={(event) => onChange(parseConfigValue(event.target.value))} rows={5} /></Field>;
}

function TransformEditor({ config, onChange }: { config: TransformConfig; onChange: (config: TransformConfig) => void }) {
  const updateOperation = (id: string, next: TransformOperation) => onChange({ ...config, operations: config.operations.map((operation) => operation.id === id ? next : operation) });
  return <div className="transform-editor">
    <div className="section-row"><span>Operations</span><button onClick={() => onChange({ ...config, operations: [...config.operations, { id: createId("op"), kind: "SET", field: "field", value: "value" }] })}><Plus size={12} /> Add</button></div>
    {config.operations.map((operation, index) => <div className="operation-card" key={operation.id}>
      <div className="operation-title"><b>{String(index + 1).padStart(2, "0")}</b><select value={operation.kind} onChange={(event) => {
        const kind = event.target.value; const id = operation.id;
        const next: TransformOperation = kind === "RENAME" ? { id, kind, from: "source", to: "target" } : kind === "SELECT" ? { id, kind, fields: ["id"] } : kind === "REMOVE" ? { id, kind, field: "field" } : { id, kind: "SET", field: "field", value: "value" };
        updateOperation(id, next);
      }}>{["RENAME","SELECT","SET","REMOVE"].map((kind) => <option key={kind}>{kind}</option>)}</select><button onClick={() => onChange({ ...config, operations: config.operations.filter((item) => item.id !== operation.id) })}><Trash2 size={12} /></button></div>
      {operation.kind === "RENAME" && <div className="operation-fields"><input value={operation.from} onChange={(event) => updateOperation(operation.id, { ...operation, from: event.target.value })} /><span>→</span><input value={operation.to} onChange={(event) => updateOperation(operation.id, { ...operation, to: event.target.value })} /></div>}
      {operation.kind === "SELECT" && <input value={operation.fields.join(", ")} onChange={(event) => updateOperation(operation.id, { ...operation, fields: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} />}
      {operation.kind === "SET" && <div className="operation-fields"><input value={operation.field} onChange={(event) => updateOperation(operation.id, { ...operation, field: event.target.value })} /><span>=</span><input value={typeof operation.value === "string" ? operation.value : JSON.stringify(operation.value)} onChange={(event) => updateOperation(operation.id, { ...operation, value: parseConfigValue(event.target.value) })} /></div>}
      {operation.kind === "REMOVE" && <input value={operation.field} onChange={(event) => updateOperation(operation.id, { ...operation, field: event.target.value })} />}
    </div>)}
  </div>;
}

function ConfigFields({ config, onChange }: { config: NodeConfig; onChange: (config: NodeConfig) => void }) {
  switch (config.type) {
    case "TRIGGER": return <JsonArea label="Sample data" value={config.sampleData} onChange={(sampleData) => onChange({ ...config, sampleData })} />;
    case "HTTP_REQUEST": return <>
      <Field label="Method"><select value={config.method} onChange={(event) => onChange({ ...config, method: event.target.value as HttpMethod })}>{["GET","POST","PUT","PATCH","DELETE"].map((method) => <option key={method}>{method}</option>)}</select></Field>
      <Field label="URL"><input value={config.url} placeholder="https://api.example.com/data" onChange={(event) => onChange({ ...config, url: event.target.value })} /></Field>
      <Field label="Headers" hint="One key:value pair per line"><textarea rows={3} value={config.headers.map((item) => `${item.key}: ${item.value}`).join("\n")} onChange={(event) => onChange({ ...config, headers: event.target.value.split("\n").filter(Boolean).map((line) => { const [key, ...rest] = line.split(":"); return { key: key.trim(), value: rest.join(":").trim() }; }) })} /></Field>
      <Field label="Query parameters" hint="One key=value pair per line"><textarea rows={3} value={config.query.map((item) => `${item.key}=${item.value}`).join("\n")} onChange={(event) => onChange({ ...config, query: event.target.value.split("\n").filter(Boolean).map((line) => { const [key, ...rest] = line.split("="); return { key: key.trim(), value: rest.join("=").trim() }; }) })} /></Field>
      {config.method !== "GET" && <Field label="Request body" hint="Use {{input}} to inject upstream JSON"><textarea rows={5} value={config.body} onChange={(event) => onChange({ ...config, body: event.target.value })} /></Field>}
    </>;
    case "CONDITION": return <>
      <Field label="Field path"><input value={config.field} placeholder="customer.score" onChange={(event) => onChange({ ...config, field: event.target.value })} /></Field>
      <Field label="Operator"><select value={config.operator} onChange={(event) => onChange({ ...config, operator: event.target.value as ConditionOperator })}>{["EQUALS","NOT_EQUALS","GREATER_THAN","LESS_THAN","CONTAINS","EXISTS"].map((operator) => <option key={operator} value={operator}>{operator.toLowerCase().replaceAll("_", " ")}</option>)}</select></Field>
      {config.operator !== "EXISTS" && <Field label="Comparison value"><input value={typeof config.value === "string" ? config.value : JSON.stringify(config.value)} onChange={(event) => onChange({ ...config, value: parseConfigValue(event.target.value) })} /></Field>}
      <div className="branch-legend"><span><i className="true-dot" />True output</span><span><i className="false-dot" />False output</span></div>
    </>;
    case "TRANSFORM": return <TransformEditor config={config} onChange={onChange} />;
    case "AI": return <>
      <div className="provider-banner"><span>LOCAL DEMO AI</span><p>Deterministic mode · no API key required</p></div>
      <Field label="Prompt"><textarea rows={4} value={config.prompt} onChange={(event) => onChange({ ...config, prompt: event.target.value })} /></Field>
      <Field label="Input field" hint="Leave blank to send the full input"><input value={config.inputField} onChange={(event) => onChange({ ...config, inputField: event.target.value })} /></Field>
      <Field label="Output name"><input value={config.outputName} onChange={(event) => onChange({ ...config, outputName: event.target.value })} /></Field>
    </>;
    case "DATABASE": return <>
      <Field label="Action"><select value={config.action} onChange={(event) => onChange({ ...config, action: event.target.value as DatabaseAction })}>{["INSERT","READ","UPDATE","DELETE"].map((action) => <option key={action}>{action}</option>)}</select></Field>
      <Field label="Record key"><input value={config.key} onChange={(event) => onChange({ ...config, key: event.target.value })} /></Field>
      {(config.action === "INSERT" || config.action === "UPDATE") && <JsonArea label="Value" value={config.value} onChange={(value) => onChange({ ...config, value })} />}
      <p className="field-note">Set value to <code>null</code> to store upstream input.</p>
    </>;
    case "DELAY": return <Field label="Duration (ms)" hint="0–10,000 ms"><input type="number" min={0} max={10000} value={config.durationMs} onChange={(event) => onChange({ ...config, durationMs: Number(event.target.value) })} /></Field>;
    case "OUTPUT": return <Field label="Output format"><select value={config.format} onChange={(event) => onChange({ ...config, format: event.target.value as OutputFormat })}>{["JSON","TEXT","OBJECT"].map((format) => <option key={format}>{format}</option>)}</select></Field>;
  }
}

export function NodeInspector({ node, onUpdate, onDelete, onDuplicate, onClose }: Props) {
  const definition = definitionFor(node.type);
  const updateConfig = (config: NodeConfig) => onUpdate({ ...node, type: config.type, config });
  return <aside className="node-inspector" aria-label="Node inspector">
    <div className="inspector-header"><div><p className="overline">INSPECTOR</p><h2>{node.label}</h2><span>{definition.label}</span></div><button className="icon-control" onClick={onClose} aria-label="Close inspector"><X size={15} /></button></div>
    <div className="inspector-scroll"><Field label="Node label"><input value={node.label} onChange={(event) => onUpdate({ ...node, label: event.target.value })} /></Field><ConfigFields config={node.config} onChange={updateConfig} /></div>
    <footer className="inspector-actions"><button className="danger-text" onClick={onDelete}><Trash2 size={13} /> Delete</button><button className="secondary-button" onClick={onDuplicate}><Copy size={13} /> Duplicate</button></footer>
  </aside>;
}
