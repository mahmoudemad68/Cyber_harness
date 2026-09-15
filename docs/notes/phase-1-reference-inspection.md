# Phase 1 reference inspection

Inspection date: 2026-09-15
Phase: 1 — Installable domain composition
Classification: `EXTEND` + `REUSE`
Inspected revision: locally imported DeepSeek Harness at `origin/main`
`836dbdf1f7`, whose upstream ancestry includes
`deepseek-ai/deepseek-harness` `c291e7961a515f6d7af9304e7fd1d257929aef26`
(see `docs/upstream-sync.md`).

This record satisfies Section 2.4 of
`docs/plans/general-agent-harness.md` for Phase 1. It was written against the
imported source in this checkout before `AgentPresets.registerRoot` existed.
The planning audit is not a substitute for this re-inspection.

## 1. Existing DeepSeek seams inspected

| Path | What was confirmed |
|---|---|
| `packages/preset/agent-presets/src/index.ts` | `AgentPresets` is the roster service on `ctx.agentPresets`. `static inject = ['loader', 'sessionProjections']`. Config is `default`, `roots`, `includeShippedRoot` (default true), `includeUserRoot` (default true). Constructor derives a private `resolvedRoots` array once: shipped `SHIPPED_PRESET_ROOT` (`system`) if included, then `config.roots` in order, then `<dshHome>/.agent-presets` (`user`) if included. `list()` / `resolve()` call `discoverPresets(this.resolvedRoots, …)` on every invocation. `get roots()` returns that frozen array. `copy` / `remove` / `authorable` / the `agent/created` empty-roster check all read `resolvedRoots`. There is no `registerRoot`. Methods invoked through the traceable proxy see `this.ctx` rebound to the **caller**; standing mounts hang off `this.selfCtx`. Settings attach with `ctx.effect(() => cleanup, 'agentPresets.settings()')`. |
| `packages/preset/agent-presets/src/preset.ts` | `PresetTrust = 'system' \| 'user'`. `PresetRoot { path, trust }` already names one scanned directory. `Config.roots` is the deployment-configured list. No `PresetRootContribution` type and no second root kind. |
| `packages/preset/agent-presets/src/discovery.ts` | `scanRoot` / `discoverPresets` re-read the filesystem every call (module comment: unmemoized). Absent root → `[]` (`ENOENT`), not throw. First root in the scanned list wins a duplicate id. Health: missing or unloadable composition is a broken roster row, not a skip. `SHIPPED_PRESET_ROOT` is `../presets/` relative to the module. `USER_PRESET_DIR` is `.agent-presets`. |
| `packages/preset/agent-presets/src/authoring.ts` | `writableRoot(roots)` returns the first `trust: 'user'` root in the list it is given. A contributed `user` root that appears before the derived home root would become the authoring destination if that live list is passed through. |
| `packages/preset/agent-presets/src/mount.ts` (via exports used by `index.ts`) | Standing mount is per preset id, single-flight. `composeFrom` binds to the parent's live generation and does not re-read the roster. Disposing a root from discovery must not tear down an existing generation. |
| `packages/preset/agent-presets/src/invariant.ts` | Unjoined-agent failure uses `presets.roots.length > 0`. A live roots getter keeps this honest when contributions appear or disappear. |
| `packages/preset/agent-presets/tests/shipped-root.spec.ts` | Constructor-derived shipped-first ordering; `$DSH_HOME` isolated per test. |
| `packages/preset/agent-presets/tests/user-root.spec.ts` | Derived user root is last; configured `user` root wins authoring over the home root; `includeUserRoot: false` leaves the roster unauthorable. |
| `packages/preset/agent-presets/tests/discovery.spec.ts` | First-root-wins, health, absent roots, display order. |
| `packages/preset/agent-presets/tests/mount.spec.ts` | `harness()` boots Loader + registries + `AgentPresets` with `includeShippedRoot: false` and `includeUserRoot: false`. Standing mounts, `composeFrom`, mount rollback, and root-realm leak refusal already exist. |
| `packages/preset/agent-presets/tests/fixtures/plugins/contribute.js` | Function-plugin `name` / `inject` / `apply` pattern for Loader-resolved rows. |
| `packages/bundle/web-app/cordis.patch.yml` | Host inserts `@deepseek-ai/dsh-agent-presets` with `default: standard` only. Shipped and user roots are package-derived (`includeShippedRoot` / `includeUserRoot`); no package today calls a contribution method. |
| `packages/boot/app-boot/src/profile.ts` | Profiles compose ordered bundle patches over an empty entry list, then the profile patch, then launcher patches. A domain package that is a bundle/plugin in that list can `inject: ['agentPresets']` and register a root in `apply` if the service grows that method. Plugin YAML order is registration order. |
| `packages/core/tools/src/index.ts` | `tools.register` returns `this.layers.effect(this.ctx, …, { label: 'tools.register()' })` so the calling plugin's fiber owns the registration. |
| `packages/webhook/webhook/tests/loader-composition.spec.ts` | REAL Loader proof: write `cordis.yml`, `loader.internal.import` map, `loader.create({ name: 'cordis:include', … })`, `loader.await()`. |
| `docs/upstream-sync.md` | Pin and merge parents for the imported revision. |
| `docs/ci/fork-ci.md` | Fork merge gate is Fork CI / fork checks passed. Not a runtime seam for this phase. |

Shipped `standard` lives under `packages/preset/agent-presets/presets/standard/` and is prepended as a `system` root when `includeShippedRoot` is true. Phase 1 must not edit that composition.

## 2. What those seams already provide

The roster is already one service, one discovery function, and one first-root-wins scan.

What exists today:

- A single `AgentPresets` registry. No `DomainRegistry`, no `RoleRegistry`, no parallel loader.
- Deterministic constructor ordering: shipped, then `config.roots`, then user home.
- Unmemoized discovery. Filesystem changes are visible on the next `list()` / `resolve()` without restart.
- Trust recorded per root (`system` / `user`) and copied onto every discovered preset.
- Cordis effect disposal as the registration lifetime elsewhere (`tools.register`, settings attach in this same service).
- Standing mounts that outlive roster edits; `composeFrom` joins the live generation.
- Identity default for host composition: web-app names only `default: standard` and relies on package-derived shipped/user roots.

What is missing, and only that:

Constructor-only `resolvedRoots` cannot accept a directory from an independently installed plugin without replacing `config.roots`. Two domain packages cannot compose their preset directories through the existing config field.

## 3. Sentinel

Sentinel was **not** inspected for this phase.

The roadmap marks Sentinel as optional here, and only for a role/persona comparison. The imported `AgentPresets` roster is already the composition unit for a role: a directory of `agent.cordis.yml` plus trust. Sentinel-style `RoleRegistry` / `DomainRegistry` names are exactly the parallel registries this phase forbids.

No Sentinel source, prompts, or schemas were opened or copied.

## 4. Why `EXTEND` is sufficient

`REUSE` of discovery, first-root-wins, standing mounts, `composeFrom`, trust, and unmemoized `list()` / `resolve()` is the whole discovery and mount path.

`EXTEND` is the constructor root list: keep shipped and `config.roots` as a frozen prefix, keep the derived user root as a frozen suffix, and hold a live array of contributed `PresetRoot` values between them. `registerRoot` pushes one slot through `this.ctx.effect` (caller fiber) and the disposer splices that slot. `list()`, `resolve()`, `get roots()`, and the empty-roster warning read the concatenated live list. `copy()`, `remove()`, and `readDocument()` capture that list once at entry and use it for resolution, collision checks, writable-root selection, and mutation.

`NEW` is not required: there is no second registry to introduce.

`REPLACE` is not required: `config.roots` stays, constructor-derived shipped/user roots stay, and discovery is not converted into a cache.

## 5. Why no new registry is required

`discoverPresets(roots, harnessBase)` already accepts any `readonly PresetRoot[]`. The service is the only object that must remember which extra directories are currently live. An array plus an effect-scoped disposer is that memory.

A `DomainRegistry` or `RoleRegistry` would duplicate id collision, trust, health, and mount coordination that this package already owns.

## 6. Final API and lifecycle semantics

Reuse existing `PresetRoot`. Do not add `PresetRootContribution`.

```ts
registerRoot(root: PresetRoot): () => void
```

Semantics:

- Dynamic: a loaded plugin may call it from `apply`.
- Reversible: the returned disposer removes only that slot; a second call is a no-op.
- Caller-scoped: implementation uses `this.ctx.effect`, so disposing the calling plugin's fiber removes the slot without a manual disposer call.
- No global mutable registry outside this service.
- Scan order on every read: (1) shipped root if included; (2) `config.roots` in config order; (3) contributed roots in registration order; (4) derived user root if included.
- First scanned root still wins a duplicate id.
- Discovery stays unmemoized. Do not cache `list()` / `resolve()`.
- Standing generations are unchanged: dropping a root hides it from future discovery; agents already joined keep the generation they run; `composeFrom` still binds to that generation.
- Host-only: not a `@Remote` method. Browser/SDK roster shapes stay as they are.
- Identity default: zero contributions make `get roots()` equal to today's constructor-derived list.

Authoring keeps `writableRoot`'s first-`user`-root rule on the root list captured at the start of that `copy` or `remove`. Package contributors use `trust: 'system'` unless they intend to become the writable root. Public `list()` / `resolve()` stay unmemoized against the live concatenation; the service is not re-frozen globally.

## 7. `NEW` / `REPLACE`

None. Phase 1 is `EXTEND` of `AgentPresets` plus `REUSE` of discovery, mounts, profiles, and bundles.

## 8. Out of scope (confirmed by inspection, not started)

Cybersecurity roles, prompts, Bash/PTY, security binaries, model tool surfaces, effect policy, network isolation, `packages/domain/`, and Phase 2 contracts in Section 8.2–8.7 of the roadmap.
