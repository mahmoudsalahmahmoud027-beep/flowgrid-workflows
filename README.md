# FlowGrid

FlowGrid is a visual workflow automation engine for designing, validating, executing, and inspecting multi-step operational workflows.

It focuses on the engineering problems behind automation platforms: typed nodes, graph validation, deterministic execution, branch routing, failure propagation, persistence, and traceable run history.

## Highlights

- Visual node editor with pan, zoom, minimap, selection, drag, connections, copy/paste, undo, and redo
- Strongly typed workflow, node, edge, validation, version, and execution models
- DAG execution with dependency ordering and branch-aware routing
- Failure propagation that skips dependent work without cancelling independent branches
- Node-specific configuration for trigger, HTTP, condition, transform, intelligence, database, delay, and output steps
- Validation for cycles, broken edges, unreachable nodes, invalid configuration, missing triggers, and missing outputs
- Workflow import/export with runtime schema validation
- Versioned local persistence, execution history, reusable templates, and inspectable traces
- Responsive workflow library and run inspection experience

## Execution Model

Each workflow is validated before execution. FlowGrid creates a topological execution order, passes upstream output into downstream nodes, records branch decisions, and persists the complete run trace.

Run states include:

`IDLE` · `WAITING` · `RUNNING` · `SUCCESS` · `FAILED` · `SKIPPED`

Every node run records input, output, duration, status, and error information so failures can be understood rather than treated as opaque black boxes.

## Node Types

| Node | Purpose |
| --- | --- |
| Manual Trigger | Starts a workflow with structured input |
| HTTP Request | Calls external services with configurable methods, headers, query values, and request bodies |
| Condition | Routes execution through true/false branches |
| Transform | Selects, renames, sets, and removes fields without `eval` |
| Intelligence | Uses a provider abstraction for generated or derived output |
| Database | Reads and mutates records through an adapter boundary |
| Delay | Suspends execution for a bounded interval |
| Output | Produces the final workflow result |

## Architecture

```text
src/types        domain and execution models
src/validation   graph rules and topological ordering
src/execution    node execution and provider boundaries
src/canvas       XYFlow integration and node rendering
src/workflows    templates and serialization
src/storage      versioned persistence and record adapter
src/history      bounded undo/redo state
src/components   product UI, inspectors, traces, and settings
tests            engine, graph, branch, persistence, and schema tests
```

## Tech Stack

- Next.js
- React 19
- TypeScript
- XYFlow
- Vitest
- ESLint

## Local Development

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

## Engineering Focus

FlowGrid is built around explicit state transitions, inspectable execution, provider boundaries, and predictable failure behavior. The goal is to make automation workflows understandable enough to debug, extend, and integrate with real business systems.
