# FlowGrid

> **Repository:** `mahmoudsalahmahmoud027-beep/flowgrid-workflows`  
> **Status:** Portfolio project · source release
> **Demo:** https://flowgrid-workflows.mahmoudsalahmahmoud0.chatgpt.site/ *(currently protected by ChatGPT sign-in)*

FlowGrid is a visual workflow automation environment built as a serious frontend systems project. Its canvas is an executable graph: nodes pass real data, conditions select branches, failures skip dependent work, and every run produces an inspectable trace.

## Core features

- Interactive node canvas with pan, zoom, minimap, selection, drag, connection validation, deletion, duplication, copy/paste, undo, and redo
- Strongly typed workflow, node, edge, validation, version, and execution models
- DAG execution with actual node timing, branch routing, failure propagation, and waiting states
- Node-specific inspector for trigger, HTTP, condition, transform, AI, database, delay, and output nodes
- Structured validation for cycles, broken edges, unreachable nodes, invalid configuration, missing trigger, and missing output
- Device-local workflow persistence, autosave status, versions, execution history, settings, and local record database
- Workflow JSON schema v1 import/export with runtime validation and useful errors
- Working templates for API checks, AI summaries, lead processing, and data cleanup
- Responsive workflow library, execution inspection, templates, settings, and limited mobile canvas editing
- Keyboard command palette and editing shortcuts

## Workflow engine

The engine in `src/execution` receives a `Workflow`, produces a topological order, and evaluates nodes in dependency order. A node receives its upstream output as input. Condition nodes record a boolean branch decision, so only the matching `true` or `false` edge activates. A failed node causes dependent nodes to become `SKIPPED`; independent branches can still complete.

Node and run status values are `IDLE`, `WAITING`, `RUNNING`, `SUCCESS`, `FAILED`, and `SKIPPED`. Timings come from `performance.now()` around actual execution.

## Node types

| Type | Behavior |
| --- | --- |
| Manual Trigger | Emits configured sample JSON or supplied trigger data |
| HTTP Request | Uses `fetch`, supports five methods, headers, query values, body, JSON/text responses, HTTP errors, and network errors |
| Condition | Compares a field path and routes through true or false |
| Transform | Safely renames, selects, sets, and removes fields without `eval` |
| AI | Uses a deterministic `LocalDemoAIProvider`; no credentials are required |
| Database | Inserts, reads, updates, and deletes device-local records through an adapter |
| Delay | Waits asynchronously for a bounded duration |
| Output | Returns actual upstream data as JSON, text, or an object |

## Execution model

`WorkflowRun` records workflow identity, timestamps, status, duration, the failed node, and all `NodeRun` entries. Each node entry contains its real input, output, timing, status, and exact error message. Runs are retained through the repository layer according to the workspace setting.

## Architecture

- `src/types` — discriminated workflow and execution types
- `src/validation` — topological ordering, cycle detection, graph and configuration rules
- `src/execution` — node execution, transformations, AI and database provider abstractions
- `src/canvas` — XYFlow canvas integration and custom node renderer
- `src/components` — workflow library, inspector, traces, history, templates, and settings UI
- `src/workflows` — working templates and schema v1 serialization
- `src/storage` — versioned device-local repository and database adapter
- `src/history` — bounded undo/redo state
- `tests` — graph, engine, branch, failure, transform, serialization, version, history, and persistence tests

## Tech stack

React 19, TypeScript, Vinext/Vite, XYFlow, Lucide icons, Vitest, and a Cloudflare-compatible runtime.

## Local development

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + K` | Open command palette |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Ctrl/Cmd + C` | Copy selected nodes |
| `Ctrl/Cmd + V` | Paste copied nodes |
| `Delete` / `Backspace` | Delete selected nodes or edges |
| `Escape` | Close transient UI and clear selection |

## JSON format

Exports use schema version 1 and include workflow metadata, positions, typed configuration, nodes, edges, condition handles, and version timestamps. Imports validate the schema version, unique node IDs, supported node types, configuration discriminators, and all edge references before modifying the workspace.

## Optional AI integration

The default AI provider is explicitly labeled **Local Demo AI**. It is deterministic and runs without an external service. A remote provider can implement the `AIProvider` interface, but API keys must stay behind a server boundary and are intentionally not part of the client application.

## Limitations

- The portfolio build uses device-local storage and has no accounts or multi-device synchronization.
- Graphs are directed acyclic graphs; cycles and multi-input nodes are rejected.
- HTTP requests are subject to browser CORS policy.
- The local database is a small record store for workflow demonstrations, not a relational database.
- Mobile prioritizes workflow browsing and run inspection; detailed graph authoring is best on desktop.