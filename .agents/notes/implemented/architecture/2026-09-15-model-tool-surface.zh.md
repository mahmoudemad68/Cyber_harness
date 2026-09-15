# Agent Note: 面向模型的工具名称

Status: implemented

[English](2026-09-15-model-tool-surface.md) | 中文

## Problem

原生与 PTC 呈现只选择如何通告可见工具，而不选择模型必须使用哪一个注册名称。仅在提示词中改名会落到 `UNKNOWN_TOOL`，因为 `execute` 用调用方提供的名称在注册表中查找。

## Decision

`ToolRuntime.registerSurface(surface)` 在调用方 agent 或 preset 的 `ToolLayer` 上存放一个 `ModelToolSurface`，与 `presentAs` 的 mode 字段并列。最近的作用域胜出。每个作用域只能声明一次。未限定作用域的调用会抛错。默认是恒等（无声明）：对外名称等于注册名称，且 `system-prompt/assemble` 返回既有的 assembly 对象。

`project` 可以隐藏工具（`undefined`），或替换 `name` 以及可选的 `description`。parameters 保持为注册 schema。重复的对外名称、空对外名称、把非传输工具公开为 `run_code`、以及与另一工具提供方的名称冲突，都在注册表投影时失败。只要 `run_code` 可见，它就保持恒等。

`wireSchemas` 仍贡献注册名称，以便 `toolOrder` 与之匹配。随后 `system-prompt/assemble` 监听器把 ToolRuntime 拥有的工具改写为对外名称。`wireSchemas` 还会为该 assemble 作用域快照这次映射；反向解析、`schemas`、SDK 绑定与并发分类使用该快照，直到同作用域的下一次 assemble。未经 assemble 的直接 execute 按当时的可见集合投影。

反向解析只接受该快照中的对外名称。`ToolExecution.name` 是注册名称。仅当两者不同时才设置 `requestedName`。`createExecution` 之后，分派对 `requestedName ?? name` 做反向解析，因为工具被改名时，注册名称不在对外集合中。策略、guard、并发分类、限制与工具函数体继续使用注册名称。适配器复制已组装的 `ToolSchema` 字段；它们不负责改名。

已检查的接缝、为何 `EXTEND` 足够、以及为何不需要第二套注册表，见 [Phase 2 参考检查](../../../../docs/notes/phase-2-reference-inspection.md)。

这是对 [PTC 执行器塌缩](../bug-fix/2026-08-07-ptc-executor-collapse.zh.md) 的部分取代：该笔记仍拥有 `ptc` 模式下的模型直呼塌缩；本笔记拥有塌缩之前的名称映射。

## Alternatives considered

**第二套工具注册表或别名表。** 正向与反向映射会与 `view()`、限制和 PTC 塌缩脱节。

**仅在提示词中改名。** 循环把模型发出的名称复制进 `execute`，查找会落空。

**改写参数以匹配外来 schema。** 已记录的参数会与实际执行的参数不一致。不同的参数 schema 应做成类型化适配工具。

**进程全局映射。** 那会给 `standard` 和每个 agent 改名。恒等是进程默认；映射是作用域内的。

**要求 `project()` 纯净而不做快照。** 反向解析仍会在 assemble 之后再次调用 `project()`，因此 dispose、替换或有状态的 `project()` 会与已通告的映射不一致。assemble 快照才是这次请求的冻结。

## Consequences

agent 或 preset 作用域上的插件可在 `apply` 中调用 `registerSurface`。释放 fiber 会为后续组装恢复恒等。进行中的请求继续使用其 assemble 时捕获的映射。隐藏或被限制的工具不能通过别名到达。`standard` 保持不变。

## Testing

`packages/core/tools/tests/model-tool-surface.spec.ts` 钉住恒等、投影、反向解析、释放、最近作用域、`toolOrder`、冲突、隐藏与被限制的工具、并发、取消，以及请求绑定的冻结（assemble 之后 dispose、有状态的 `project()`、隐藏/被限制名称、下一次 assemble）。`packages/core/tools/tests/ptc.spec.ts` 钉住带别名的 native/ptc/both，包括 dispose 之后仍冻结的 SDK 绑定。`packages/core/agent-loop/tests/model-tool-surface.spec.ts` 是脚本化循环证明：模型调用对外名称，一个注册工具运行，`request/header` 记录对外 schema，且后续请求看到 dispose 之后的映射。DeepSeek 与 OpenAI 兼容序列化器原样复制对外名称和 parameters。
