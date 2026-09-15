# Agent Note: Reversible preset-root contribution

Status: implemented

English | [中文](2026-09-15-reversible-preset-root-contribution.zh.md)

## Problem

Independently installed packages need to supply agent presets without replacing the host `AgentPresets` `config.roots` array. Constructor-only roots force every pack to overwrite the same field, so two packages cannot compose their directories.

## Decision

`AgentPresets.registerRoot(root)` appends one existing `PresetRoot` to a live list on the existing service. The scanned order is the shipped root when included, then `config.roots`, then contributed roots in registration order, then the derived user-authored root when included. `list()` and `resolve()` remain unmemoized filesystem reads of that live list.

Registration is a Cordis effect on the calling plugin's fiber (`this.ctx.effect`). The returned disposer splices only that slot; disposing the fiber does the same. Standing mounts and `composeFrom` are unchanged: a dropped root disappears from later discovery while agents already joined keep their generation.

The method is host-only. It is not a Remote endpoint. Zero contributions leave the constructor-derived list identical to a roster that never called `registerRoot`.

Package contributors use `trust: 'system'` unless they intend to become the writable root. `writableRoot` still picks the first `user` root in the live list.

Inspected seams, why `EXTEND` is enough, and why no second registry exists are in the [Phase 1 reference inspection](../../../../docs/notes/phase-1-reference-inspection.md).

This is a partial supersession of [per-session agent presets](2026-08-03-per-session-agent-presets.md): that note still owns mount, scope join, and authoring; this note owns how extra directories enter the roster.

## Alternatives considered

**A `DomainRegistry` or `RoleRegistry`.** Those names duplicate id collision, trust, health, and standing-mount coordination that `AgentPresets` already owns.

**Replacing `config.roots` from each domain bundle patch.** Bundle patches do not compose on the same array: the second pack overwrites the first, and the host would have to merge roots by hand.

**Memoizing discovery after a contribution.** The roster already promises that a file written while the process runs appears on the next `list()`. Caching as part of `registerRoot` would break that.

**Tearing down standing mounts when a root is disposed.** Sessions already joined would lose tools mid-conversation. Disposal only affects later discovery.

## Consequences

A domain package is an ordinary plugin that injects `agentPresets` and calls `registerRoot` from `apply`. Unloading the package removes its presets from the picker without a second registry. Authoring into a contributed `user` root is the first-user-root rule, not a special case.

`standard` remains the shipped general/coding preset. This method does not know Cybersecurity or any other domain.

## Testing

`packages/preset/agent-presets/tests/contributed-roots.spec.ts` pins ordering, disposal, Cordis plugin and Loader composition, unmemoized filesystem reads, authoring, standing-generation survival, and mount leak refusal through a contributed root. Existing shipped-root, user-root, discovery, and mount suites remain the no-contribution baseline.
