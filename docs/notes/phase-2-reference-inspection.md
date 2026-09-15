# Phase 2 reference inspection

Inspection date: 2026-09-15
Phase: 2 — Model Tool Surface
Classification: `EXTEND`
Inspected revision: locally imported DeepSeek Harness at `origin/main`
`dc5c825070` (Phase 1 merge), whose upstream ancestry includes
`deepseek-ai/deepseek-harness` `c291e7961a515f6d7af9304e7fd1d257929aef26`
(see `docs/upstream-sync.md`).

This record satisfies Section 2.4 of
`docs/plans/general-agent-harness.md` for Phase 2. It was written against the
imported source in this checkout before `ModelToolSurface` existed. The
planning audit is not a substitute for this re-inspection.

## 1. Existing DeepSeek seams inspected

| Path | What was confirmed |
|---|---|
| `packages/core/tools/src/index.ts` | `ToolRuntime` is the sole tool registry on `ctx.tools`. `static inject = ['systemPrompt']`. Config is `mode` (`native` default) and `maxParallelSubCalls`. Visibility is one `view(scope)` over `ScopedLayers<ToolLayer>`: inherited globals plus ancestor shadows, intersected restrictions, own-layer registrations last, reserved `run_code` appended when the effective mode is not `native`. `register` / `restrict` / `guard` / `presentAs` are Cordis effects on the calling context (`layers.effect`). There is no second registry, no alias map, and no `registerSurface`. |
| `packages/core/tools/src/index.ts` `wireSchemas` | Feeds `ctx.systemPrompt.tools`. Native mode returns every visible schema plus pre-restriction `knownNames`. `ptc` returns only `run_code` as schemas and known names. `both` returns every visible schema and `knownNames` plus `run_code`. `schemaOf` allowlists `name` / `description` / `parameters` only. |
| `packages/core/tools/src/index.ts` `schemas` / `sdkSchemas` | `schemas(scope)` is the public and PTC SDK enumeration of visible tools (parameters detached). `sdkSchemas` drops `run_code` and adds `output`. Binding names today are the registered names. |
| `packages/core/tools/src/index.ts` `resolveExecution` / `executionMode` / `execute` | `resolveExecution(name, scope, nested)` looks up `get(name)` then applies `collapses` for model-direct `ptc` calls. `executionMode` and the four dispatch lookups (`dispatchToolBody`, `postExecute`, `normalizeDispatchResult`, plus `resolveExecution` itself) share that resolver. `createExecution` copies `exec.name` onto `ToolExecution.name` unchanged. `ToolExecutionInput.name` is the caller-supplied name; today that is the registered name because nothing rewrites it. |
| `packages/core/tools/src/index.ts` `ToolLayer` | Per-scope tables: `tools`, `restrictions`, `guards`, and one `mode` cell. `isEmpty()` treats an unset `mode` as empty. Nearest `presentAs` wins along `chainLayers`. One declaration per scope; a second `presentAs` throws. Global `presentAs` is rejected (the config `mode` field is the process default). |
| `packages/core/tools/src/ptc.ts` | SDK bindings are `registry.schemas(exec.agent)` minus `run_code`. Each binding closes over that enumerated `name` and passes it to `scheduler.prepare` / `executionMode`. Nested calls set `parent: exec.token`, so they bypass `collapses`. Start/settle events log that same `name` and the JSON-normalized arguments. |
| `packages/core/tools/src/types.ts` | Durable `tool/ptc-dispatch-start` / `tool/ptc-dispatch` payloads carry `name` and `arguments` only. No requested/exposed field. |
| `packages/core/system-prompt/src/index.ts` | `orderTools` validates `toolOrder` against provider `knownNames` (canonical registered names, including restricted-away names) and matches listed entries to `schema.name`. `assemble()` clones `{ name, description, parameters }` from each provider, orders, then runs the `system-prompt/assemble` waterfall. A listener must call `next()`; the returned assembly is authoritative. Complete sections are restored after the waterfall and cannot be replaced by it. |
| `packages/core/agent-loop/src/tool-calls.ts` | The loop copies `block.name` from the assistant tool-call into `ToolExecutionInput.name` and into the durable `tool/call` event. Concurrency classification is `ctx.tools.executionMode(first.exec)` immediately before start. |
| `packages/core/agent-loop/src/agent.ts` | Request construction uses `assembly.tools` after assemble. `request/header` snapshots those schemas. Reconstruction compares `request.tools` to `header.tools` by JSON equality. Identity snapshots therefore require the default mapping to leave `assembly.tools` byte-identical. |
| `packages/llm/llm/src/types.ts` | `ToolSchema` is `{ name, description, parameters }`. Adapters convert only inside the provider package. |
| `packages/llm/llm-deepseek/src/serialize.ts` | `serializeRequest` maps `options.tools` to `{ type: 'function', function: { name, description, parameters } }`. It does not rename tools or rewrite parameters. |
| `packages/llm/llm-pi-ai/src/context.ts` | `toolsOf` maps the same three fields onto pi-ai's OpenAI-compatible tool list. No renaming or argument rewriting. |
| `packages/core/agent-tool-presentation/src/index.ts` | Preset row that calls `ctx.tools.presentAs(mode)` on the standing mount. Presentation mode is already a scoped ToolRuntime effect. A surface can use the same scope cell pattern; this row does not need to change in Phase 2. |
| `packages/core/scope/src/store.ts` | `ScopedLayers.effect` attaches one synchronous layer mutation to the calling context's fiber, notifies `tools/change` by default, and deletes an empty scoped layer on undo. |
| `docs/notes/phase-1-reference-inspection.md` | Phase 1 extended `AgentPresets.registerRoot` as a reversible effect. Phase 2 must not add a parallel tool registry the way Phase 1 refused `DomainRegistry`. |
| `docs/upstream-sync.md` | Pin and merge parents for the imported revision. |

`standard` remains the shipped general/coding preset. Phase 2 must not edit that composition.

## 2. What those seams already provide

One registry, one visibility resolver, one execution pipeline.

What exists today:

- A single `ToolRuntime`. Registration, restriction, guards, PTC collapse, and concurrency classification already share `view` / `resolveExecution`.
- Native / `ptc` / `both` change *how* visible tools are presented (`wireSchemas` vs SDK vs executor collapse), not *which registered name* the model must use.
- `restrict` hides inherited globals from both announcement and execution. Own-layer registrations stay visible.
- `presentAs` is the existing scoped, one-per-scope, reversible presentation declaration. Nearest scope wins. Global override is rejected.
- Prompt assembly orders by canonical `schema.name` against `toolOrder` / `knownNames`, then freezes the result on `request/header`.
- Provider adapters copy `ToolSchema.name` and `parameters` onto the wire. They are not a renaming layer.
- Durable `tool/call` already records the model-requested name. Logged arguments are the parsed JSON the executor receives.
- Cancellation is cooperative on `exec.signal`. Unknown names are `UNKNOWN_TOOL` without ending the turn.

What is missing, and only that:

There is no scoped function that can change the model-facing name or description of a visible tool, or hide a visible tool from the model, while keeping the registered name as the execution, policy, restriction, and concurrency key. A prompt-only rename would reach `UNKNOWN_TOOL` because `execute` looks up `exec.name` in `view().visible`.

## 3. Sentinel

Sentinel was **not** opened as source.

The roadmap marks Sentinel as optional here, and only for a comparison of model-facing tool vocabulary. The imported `ToolRuntime` already owns announcement (`wireSchemas` / `schemas` / SDK) and execution (`resolveExecution`). A separate Sentinel-style tool registry, or rewriting model arguments to match a foreign schema, is exactly the second registry / argument-rewrite this phase forbids.

No Sentinel source, prompts, or schemas were copied.

The architectural pattern compared: a model-facing name can differ from the executable name only when the same object that enumerates tools also reverse-resolves calls. That object is `ToolRuntime`.

## 4. Why `EXTEND` is sufficient

`REUSE` of `view`, `restrict`, PTC collapse, `executionMode`, the execute pipeline, prompt assembly, request-header snapshots, and adapter field copies is the whole path from registration to wire to result.

`EXTEND` is one scoped cell on `ToolLayer`, parallel to `presentAs`'s `mode` cell:

- `registerSurface(surface)` is a `layers.effect` on the calling agent/preset scope.
- Zero surfaces leave every public method on the identity mapping: `schemas()`, `wireSchemas` names, `execute({ name })`, and `executionMode` behave as they do today.
- `ToolRuntime` owns forward projection (`schemas`, SDK, assemble waterfall over `assembly.tools`) and reverse resolution (`resolveExecution` / `createExecution`). One assemble captures the mapping those paths share for that request.
- `project()` may replace `name` and optionally `description`. It must not rewrite `parameters`. A different argument vocabulary is a typed adapter tool registered under its own canonical name.
- Duplicate exposed names, an empty exposed name, and exposing a non-transport tool as `run_code` fail closed at projection time.
- `run_code` stays identity whenever it is visible. The reserved transport is not a surface target.
- Hidden (`project` returns `undefined`) and restricted tools are absent from the reverse map, so aliases cannot reach them.
- `ToolExecution.name` remains the canonical registered name. `requestedName` is set only when it differs, so identity executions stay snapshot-identical.
- `toolOrder` continues to match canonical names because `wireSchemas` still contributes those names and `knownNames`; the assemble waterfall rewrites owned tools after ordering.

`NEW` is not required: there is no second registry to introduce.

`REPLACE` is not required: `mode` / `presentAs` / `restrict` / PTC collapse stay. The surface is an additive mapping over the existing visible set.

## 5. Request-bound snapshot

`assemble()` collects tool providers first (`wireSchemas`), then renders section text (including PTC SDK `sdkSchemas`), then runs the `system-prompt/assemble` waterfall (`projectAssembledTools`). The loop logs `request/header` from that assembly's `tools` and later copies `block.name` into `createExecution` / `executionMode`.

Those steps do not share a live `project()` call. A surface dispose or replace, a restriction or visibility change, or a stateful `project()` after the LLM request is built can make the advertised alias map disagree with reverse resolution, concurrency classification, nested SDK bindings, and execution.

`ToolRuntime` captures the live projection inside `wireSchemas` for `context.scope` — the first tool-related assemble step, before SDK text and the waterfall rewrite. The snapshot is keyed by that assemble scope (the agent object, or a process-local key for the global view). The next assemble for the same scope replaces it. Disposing or replacing the surface does not clear it. Direct `execute` / `schemas` / `executionMode` without a prior assemble still project the live visible set, so unit tests that never assemble keep current behavior.

`canonicalNameFor`, `schemas`, `sdkSchemas`, `executionMode`, and `createExecution` read that snapshot when it exists. Identity assemble still returns the same assembly object from the waterfall (no rewrite) and still captures an identity snapshot, so a surface registered after that assemble cannot rename in-flight calls. The reverse map is not stored on `request/header`; replay compares exposed schemas, and identity snapshots stay byte-identical.

Purity of `project()` is not the divergence control. `project` must not rewrite `parameters`. The registry snapshots whatever mapping `project` returned at assemble time and uses that map for the rest of the request.

This remains one `ToolRuntime`. There is no second registry.

## 6. Final API and lifecycle semantics

```ts
interface ModelToolSurfaceProjection {
  exposedName: string
  description?: string
}

interface ModelToolSurface {
  readonly id: string
  project(schema: Readonly<ToolSchema>): ModelToolSurfaceProjection | undefined
}

registerSurface(surface: ModelToolSurface): () => void
```

Semantics:

- Dynamic: a loaded plugin may call it from `apply` on an agent or preset scope.
- Reversible: the returned disposer clears only that scope's cell; a second call on the same disposer is a no-op. Disposing the calling fiber does the same.
- Scoped only, one per scope, nearest scope wins — the `presentAs` lifecycle.
- Unscoped `registerSurface` throws. Identity (no cell) is the process default, not a global override.
- `project` is host-only. Parameters on the returned schema are the registered object, never a rewritten copy. `ToolRuntime` snapshots the mapping during `assemble` for that scope; reverse resolution, `schemas`, SDK bindings, and concurrency classification use that snapshot until the next assemble. Direct execute without assemble projects the live visible set.
- Reverse resolution accepts only exposed names from that snapshot. Canonical names of renamed or hidden tools do not execute for that request. Hidden and restricted tools absent from the snapshot cannot be reached through an alias.
- Host lookup `get(name)` stays canonical. Restrictions and `toolOrder` stay canonical.
- Durable `tool/call` continues to record the model-requested name. Executed arguments stay the snapshotted input.

## 7. `NEW` / `REPLACE`

None. Phase 2 is `EXTEND` of `ToolRuntime` plus `REUSE` of prompt assembly, the loop, PTC, and provider serializers.

## 8. Out of scope (confirmed by inspection, not started)

Phase 3 effect descriptors and effect policy, Cybersecurity roles, Bash/PTY changes, execution environments, network isolation, `packages/domain/`, and a shipped preset plugin that selects a non-identity surface. Identity remains the default for `standard` and every profile that does not call `registerSurface`.
