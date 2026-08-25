"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { NodeType } from "../types/workflow";
import { NODE_DEFINITIONS } from "../nodes/registry";

type Props = { onAdd: (type: NodeType) => void; onClose?: () => void };

export function NodeLibrary({ onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const definitions = useMemo(() => NODE_DEFINITIONS.filter((item) => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const groups = [...new Set(definitions.map((item) => item.group))];
  return <aside className="node-library-panel" aria-label="Node library">
    <div className="panel-header"><div><p className="overline">BUILD</p><h2>Node library</h2></div>{onClose && <button className="icon-control" onClick={onClose} aria-label="Close node library"><X size={15} /></button>}</div>
    <label className="search-field"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nodes" aria-label="Search nodes" /></label>
    <div className="node-library-scroll">
      {groups.map((group) => <section className="node-group" key={group}><h3>{group}</h3>{definitions.filter((item) => item.group === group).map((item) => <button
        key={item.type}
        className="library-item"
        onClick={() => onAdd(item.type)}
        draggable
        onDragStart={(event) => { event.dataTransfer.setData("application/flowgrid-node", item.type); event.dataTransfer.effectAllowed = "move"; }}
      >
        <span className={`library-symbol accent-${item.accent}`}>{item.symbol}</span>
        <span><strong>{item.label}</strong><small>{item.description}</small></span><b>＋</b>
      </button>)}</section>)}
      {definitions.length === 0 && <p className="empty-small">No nodes match “{query}”.</p>}
    </div>
  </aside>;
}
