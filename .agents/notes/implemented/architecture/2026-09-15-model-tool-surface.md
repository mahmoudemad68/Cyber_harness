# Agent Note: Model-facing tool names

Status: implemented

English | [中文](2026-09-15-model-tool-surface.zh.md)

## Problem

Native and PTC presentation choose how visible tools are announced, not which registered name the model must use. A prompt-only rename reaches `UNKNOWN_TOOL` because `execute` looks up the caller-supplied name in the registry.

## Decision

`ToolRuntime.registerSurface(surface)` stores one `ModelToolSurface` on the calling agent or preset `ToolLayer`, beside `presentAs`'s mode field. Nearest scope wins. One declaration per scope. Unscoped calls throw. Identity (no declaration) is the default: exposed names equal registered names, and `system-prompt/assemble` returns the existing assembly object.

`project` may hide a tool (`undefined`) or replace `name` and optionally `description`. Parameters stay the registered schema. Duplicate exposed names, an empty exposed name, exposing a non-transport tool as `run_code`, and colliding with another tool provider's name fail when the registry projects. `run_code` stays identity whenever it is visible.

`wireSchemas` still contributes registered names so `toolOrder` matches them. A `system-prompt/assemble` listener then rewrites ToolRuntime-owned tools to exposed names.

Reverse resolution accepts only current exposed names. `ToolExecution.name` is the registered name. `requestedName` is set only when it differs. After `createExecution`, dispatch reverse-resolves `requestedName ?? name` because the registered name is absent from the exposed set when a mapping renamed the tool. Policy, guards, concurrency classification, restrictions, and tool bodies keep the registered name. Adapters copy the assembled `ToolSchema` fields; they do not rename tools.

Inspected seams, why `EXTEND` is enough, and why no second registry exists are in the [Phase 2 reference inspection](../../../../docs/notes/phase-2-reference-inspection.md).

This is a partial supersession of [PTC executor collapse](../bug-fix/2026-08-07-ptc-executor-collapse.md): that note still owns the `ptc` model-direct collapse; this note owns name mapping before that collapse.

## Alternatives considered

**A second tool registry or alias table.** Forward and reverse maps would drift from `view()`, restrictions, and PTC collapse.

**Prompt-only renaming.** The loop copies the model-emitted name into `execute`, so the lookup misses.

**Rewriting arguments to match a foreign schema.** Logged arguments would disagree with executed arguments. A different argument schema is a typed adapter tool.

**A process-global mapping.** That would rename tools for `standard` and every agent. Identity is the process default; mapping is scoped.

## Consequences

A plugin on an agent or preset scope may call `registerSurface` from `apply`. Disposing the fiber restores identity for later assemblies. Hidden and restricted tools cannot be reached through an alias. `standard` is unchanged.

## Testing

`packages/core/tools/tests/model-tool-surface.spec.ts` pins identity, projection, reverse resolution, disposal, nearest-scope, `toolOrder`, collisions, hidden and restricted tools, concurrency, and cancellation. `packages/core/tools/tests/ptc.spec.ts` pins native/ptc/both with an alias. `packages/core/agent-loop/tests/model-tool-surface.spec.ts` is the scripted loop proof: the model calls the exposed name, one registered tool runs, and `request/header` records the exposed schemas. DeepSeek and OpenAI-compatible serializers copy the exposed name and parameters unchanged.
