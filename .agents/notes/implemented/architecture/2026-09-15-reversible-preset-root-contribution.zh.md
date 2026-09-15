# Agent Note: Reversible preset-root contribution

Status: implemented

[English](2026-09-15-reversible-preset-root-contribution.md) | 中文

## Problem

独立安装的包需要在不替换宿主 `AgentPresets` 的 `config.roots` 数组的前提下提供 agent preset。仅在构造时推导根目录会迫使每个包覆盖同一字段，两个包因此无法组合各自的目录。

## Decision

`AgentPresets.registerRoot(root)` 把一条既有的 `PresetRoot` 追加到现有服务上的实时列表。扫描顺序是：若启用则先随附根目录，然后是 `config.roots`，然后是按注册顺序的贡献根目录，最后是启用时推导出的用户根目录。`list()` 与 `resolve()` 仍对该实时列表做无缓存的文件系统读取。`copy()`、`remove()` 与 `readDocument()` 在入口捕获该列表一次，并把它用于解析、冲突检查、可写根目录选择与变更，因此该次调用进行期间注册或释放的贡献不能改写它的目标。

注册是调用方插件 fiber 上的 Cordis effect（`this.ctx.effect`）。返回的 disposer 只移除这一槽位；释放 fiber 也一样。常驻挂载与 `composeFrom` 不变：被移除的根目录从后续发现中消失，但已加入的 agent 继续使用其代际。

该方法仅限宿主进程。它不是 Remote 端点。零贡献时，构造推导出的列表与从未调用 `registerRoot` 的 roster 相同。

包贡献方使用 `trust: 'system'`，除非有意成为可写根目录。`writableRoot` 仍选取该次创作调用开始时捕获的列表中第一个 `user` 根目录。

已检查的接缝、为何 `EXTEND` 足够、以及为何不需要第二套注册表，见 [Phase 1 参考检查](../../../../docs/notes/phase-1-reference-inspection.md)。

这是对[按会话组装 agent preset](2026-08-03-per-session-agent-presets.zh.md) 的部分取代：该笔记仍拥有挂载、scope 接入与创作；本笔记拥有额外目录如何进入名单。

## Alternatives considered

**`DomainRegistry` 或 `RoleRegistry`。** 那些名字会重复 `AgentPresets` 已经拥有的 id 冲突、trust、健康检查与常驻挂载协调。

**由每个域 bundle 补丁替换 `config.roots`。** bundle 补丁不会在同一数组上组合：后一个包会覆盖前一个，宿主只能手工合并根目录。

**在贡献之后缓存发现。** roster 已保证进程运行期间写入的文件会在下一次 `list()` 出现。作为 `registerRoot` 的一部分做缓存会破坏这一点。

**在根目录被释放时拆掉常驻挂载。** 已加入的会话会在对话中途失去工具。释放只影响后续发现。

## Consequences

域包就是普通插件：注入 `agentPresets` 并在 `apply` 中调用 `registerRoot`。卸载该包会把它的 preset 从选择器中移除，无需第二套注册表。向贡献的 `user` 根目录创作，遵循的是第一个 `user` 根目录规则，而不是特例。

`standard` 仍是随附的通用/编码 preset。该方法不知道 Cybersecurity 或任何其他域。

## Testing

`packages/preset/agent-presets/tests/contributed-roots.spec.ts` 钉住排序、释放、Cordis 插件与 Loader 组装、无缓存文件系统读取、创作、常驻代际存活，以及经贡献根目录的挂载泄漏拒绝。`packages/preset/agent-presets/tests/authoring-root-snapshot.spec.ts` 钉住：在进行中的 `copy` / `remove` / `readDocument` 期间注册或释放贡献，不能改变该次调用的来源视图、重复检查、可写目标或删除目标，而随后的 `list()` / `resolve()` 仍看到实时列表。既有的 shipped-root、user-root、discovery 与 mount 套件仍是无贡献时的基线。
