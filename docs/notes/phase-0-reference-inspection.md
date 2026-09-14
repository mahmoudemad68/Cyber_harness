# Phase 0 reference inspection

Inspection date: 2026-09-14
Phase: 0 — Upstream foundation
Classification: `REUSE`
Inspected revision: `deepseek-ai/deepseek-harness` `master` at
`c291e7961a515f6d7af9304e7fd1d257929aef26`
Local source at inspection time: this repository did not yet contain DeepSeek
Harness source. Inspection was performed against the live GitHub repository
and the GitHub Contents/Git APIs at the pinned commit.

This record satisfies Section 2.4 of
`docs/plans/general-agent-harness.md` for Phase 0. It was written before the
upstream import merge. The planning audit is not a substitute for this
re-inspection.

## 1. Existing DeepSeek seams inspected

Phase 0 has no runtime seam. The inspected surface is repository lineage,
toolchain, license, safety, and imported workflow/config files.

| Path / object | What was confirmed |
|---|---|
| `https://github.com/deepseek-ai/deepseek-harness` | Canonical upstream identity. `full_name` is `deepseek-ai/deepseek-harness`. Default branch is `master`. Clone URL is `https://github.com/deepseek-ai/deepseek-harness.git`. Public MIT-licensed repository. |
| `c291e7961a515f6d7af9304e7fd1d257929aef26` | Pinned `master` commit from the roadmap. Re-inspection found this SHA still at `master` HEAD. Message: merge of PR #3977, "feat(web): sync feedback and file refinements from release". Author date 2026-09-10T14:17:09Z. Parents `e570e747059e152a550282bbf8a280f47ba2f0fe` and `59f2e3be330e37bc2ab91c92da4a081bc3281988`. |
| `LICENSE` | MIT License, Copyright (c) 2026 DeepSeek. GitHub license metadata `spdx_id: MIT`. Blob size 1065 bytes. |
| `package.json` | Package name `@deepseek-ai/dsh-root`, version `0.1.5-rc.2`. `packageManager` is `pnpm@11.7.0`. `engines.node` is `^22.19.0 \|\| >=24.0.0`. |
| `pnpm-lock.yaml` | Present. Git blob SHA `a2773904c82e01371987b023034fbbc3b9cc40b2`, size 865785 bytes. `lockfileVersion: '9.0'`. No `package-lock.json`, `yarn.lock`, or `bun.lockb`. |
| `pnpm-workspace.yaml` | Workspace packages under `vendor/*`, `packages/*/*`, `native/system`, `apps/*`, `benchmarks`, `website`, and `python/sdk-runtime`. `linkWorkspacePackages: true`. Reviewed `allowBuilds` for upstream lifecycle scripts. |
| `README.md` | DeepSeek Harness developer-preview README. Install/run from npm via `npx @deepseek-ai/dsh web`. Source checkout: `pnpm install`, `pnpm run build`, `pnpm dsh web`. Points at `SAFETY.md`, `CONTRIBUTING.md`, and MIT. |
| `SAFETY.md` | Experimental, unaudited, must not be the sole security boundary for untrusted workloads. |
| `.github/workflows/` | 21 workflow files imported with upstream CI/release automation. |
| `AGENTS.md`, `docs/development.md`, `docs/testing.md`, `apps/cli/README.md` | Source of upstream-supported install, typecheck, test, lint, config-dump, and profile commands. |
| `.gitattributes`, `.gitignore`, `.editorconfig`, `lefthook.yml`, `tsconfig*.json`, `vitest*.ts` | Imported repository config. No root `.npmrc`, `.nvmrc`, or `.node-version`. |

No discrepancy: the roadmap-pinned revision is still `master` HEAD. Phase 0
will import that exact SHA and will not substitute another revision.

## 2. What those seams already provide

DeepSeek Harness is a complete Cordis monorepo at this revision. Phase 0
reuses it as-is.

Repository and toolchain:

- Full Git history on `master` ending at the pinned commit.
- MIT license grant for the upstream source.
- Reproducible pnpm 11.7.0 lockfile (`lockfileVersion` 9.0).
- Node engine floor `^22.19.0 \|\| >=24.0.0`. Development guide states CI
  covers 22.19, 24, and 26. Primary CI node is 24.
- Install: `pnpm install` from the repository root, using
  `pnpm install --frozen-lockfile` in upstream CI.
- Source launcher: `pnpm dsh` → `node --import tsx/esm apps/cli/src/bin.ts`.

Upstream-supported verification commands confirmed from `package.json` and
`AGENTS.md`:

- `pnpm run typecheck`
- `pnpm run test` (unit suite; builds native-system first)
- `pnpm run lint`
- `pnpm dsh --profile <name> --dump-config` and
  `pnpm dsh --dump-default-config` (compose config without booting)
- `pnpm run test:snapshot` (keyless recorded-session replay through shipped
  profiles)
- `pnpm dsh --profile headless "task"` (real profile run; needs
  `DEEPSEEK_API_KEY`)

Shipped profiles named by upstream CLI: `web`, `headless`, `sdk`,
`sdk-minimal`, `acp`. `desktop` is reserved and rejected by the CLI.

Runtime that Phase 0 must not modify, only import:

- Cordis plugin kernel, profiles, bundles, and agent presets.
- Agent loop, sessions/events, prompt assembly, typed `ToolRuntime`.
- Provider adapters, MCP, jobs, workflows, subagents.
- Filesystem, subprocess, shell, sandbox, terminal, Web, and code-runtime
  capabilities.

## 3. Sentinel

Sentinel was not inspected for Phase 0. The roadmap marks Sentinel as not
required here. This phase must not import, vendor, or copy
`Glyph-Software/sentinel`.

## 4. `NEW` / `REPLACE`

None. Phase 0 is `REUSE` of upstream Git history and source. No new runtime
abstraction is proposed. `REUSE` is sufficient.

## 5. License

MIT License, Copyright (c) 2026 DeepSeek, confirmed from `LICENSE` at the
pinned commit and from GitHub repository license metadata (`spdx_id: MIT`).

The software is provided without warranty. `SAFETY.md` and `LICENSE` both
disclaim liability.

## 6. SAFETY.md warnings (verbatim facts, not a security audit)

Confirmed from
`https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/c291e7961a515f6d7af9304e7fd1d257929aef26/SAFETY.md`:

- DeepSeek Harness is experimental developer-preview software.
- It has not undergone a security audit and must not be treated as secure or
  production-ready.
- It can execute model-generated code and commands, load third-party plugins,
  and access network, processes, credentials, and files made available to it.
- Incorrect model output, defects, misconfiguration, malicious input, or
  untrusted plugins may damage the host, modify or delete files, or disclose
  data or credentials.
- Sandboxing, approval prompts, and permission controls reduce risk but do
  not guarantee isolation or prevent damage.
- Do not rely on DeepSeek Harness as the sole security control for untrusted
  workloads.
- Recommended: least privilege, disposable VM/container, backups, no
  unnecessary credentials, review plugins/config/commands before allowing
  them.

These warnings remain in force after import. Phase 0 does not claim any
additional security boundary.

## 7. Workflow and config file inspection

### 7.1 Root config

| File | Notes |
|---|---|
| `package.json` | Root scripts, engines, `packageManager`. `postinstall` runs `node scripts/install-lefthook.mjs`. |
| `pnpm-workspace.yaml` | Workspace globs and `allowBuilds` (esbuild, lefthook, node-pty, koffi allowed; several other lifecycle scripts denied). |
| `pnpm-lock.yaml` | Frozen upstream lockfile. Must be preserved. Contains upstream `overrides` and `patchedDependencies` hashes. |
| `lefthook.yml` | Local `pre-commit`, `pre-merge-commit`, `pre-push` (pre-push runs `pnpm run typecheck`). |
| `tsconfig.json`, `tsconfig.host.json`, `tsconfig.client.json`, `tsconfig.base.json` | Host/Client aggregate TypeScript layout. |
| `vitest.config.ts` and sibling vitest configs | Unit, e2e, snapshot, web, bench suites. |
| `.gitattributes` | LF canonical text; `*.i18n.yaml merge=dsh-translation-pairing`. |
| `.gitignore` | Ignores `node_modules/`, `.env`, build outputs, `.sessions/`. No committed `.env`. |
| `.editorconfig` | Present. |
| `.github/dependabot.yml` | Present. |
| `.github/pull_request_template.md` | Present. |

No root `.npmrc`. pnpm configuration lives in `package.json` /
`pnpm-workspace.yaml`.

### 7.2 GitHub workflows at the pinned commit

Inspected listing of `.github/workflows/`:

- `build-exe-for-python-sdk.yml`
- `build-preview-cloudflare.yml`
- `ci-master.yml`
- `ci.yml`
- `docs-pages.yml`
- `e2b-e2e.yml`
- `e2e.yml`
- `expected-filenames.yml`
- `issue-lifecycle.yml`
- `issue-policy.yml`
- `node-addon-system-release.yml`
- `node-addon-system.yml`
- `pi-ai-provider-e2e.yml`
- `python-release.yml`
- `release-publish.yml`
- `release-vendor-publish.yml`
- `release-vendor.yml`
- `release.yml`
- `sandbox.yml`
- `weighted-approval-review-event.yml`
- `weighted-approval.yml`

Sampled workflow security facts:

- `ci.yml` and `ci-master.yml` set `permissions: contents: read` and
  `DSH_TELEMETRY_DISABLED: '1'`. They reference upstream secret name
  `DEEPSEEK_API_KEY_EXTERNAL` (name only; no secret value in the file).
  Install uses `pnpm install --frozen-lockfile`. Primary node is 24.
  Jobs include static, coverage, bench, consumers, node-compat, Python SDK
  and runtime, and Windows lanes.
- `e2e.yml` documents that `pull_request_target` must never be used, because
  it would expose secrets to untrusted fork code. It maps
  `secrets.DEEPSEEK_API_KEY_EXTERNAL` to `DEEPSEEK_API_KEY`.
- `release-publish.yml` is `workflow_dispatch` only and references
  `secrets.NPM_TOKEN`. Checkout uses `persist-credentials: false`.
- `sandbox.yml` is keyless, `contents: read`, upstream-master-oriented.
- Several jobs key upstream self-hosted pools on
  `github.repository == 'deepseek-harness/deepseek-harness'`. On this fork
  they should fall back to hosted runners rather than upstream internal
  pools.

No workflow file sampled contained embedded credentials. Secret *names* are
present, which is expected GitHub Actions usage. Phase 0 will not rewrite
these workflows. After import they may fail on this fork (missing upstream
secrets, upstream runner labels, bilingual doc gates versus this project's
planning docs). That is a baseline/fork-operations issue, not a reason to
edit upstream CI in this phase.

### 7.3 Credentials in Git history

Inspection of upstream tracked files found:

- `.gitignore` excludes `.env`.
- Real-API tests read `DEEPSEEK_API_KEY` from the environment or a gitignored
  `.env`.
- Workflows reference GitHub secret names, not values.

A full historical secret scan of upstream Git objects is deferred until after
the fetch, when the objects are local. If a leaked secret is found in
upstream history, Phase 0 will record it and will not rewrite upstream
history.

## 8. README.md (upstream)

Upstream `README.md` at the pinned commit identifies the project as DeepSeek
Harness (`dsh`), developer preview, compatibility-breaking changes expected,
and MIT licensed. Run-from-source requires `pnpm install`, `pnpm run build`,
and `pnpm dsh web`.

Phase 0 merge policy from the roadmap: use the upstream README. Retain this
project's intent in project docs (`docs/plans/general-agent-harness.md` and
the upstream-sync note). Do not rewrite upstream README content during the
import.

## 9. Local repository state at inspection time

This repository (`mahmoudemad68/Cyber_harness`) on `main` at
`c36607b22e95414bd34ccc37d96d1018eb6feff4` contained:

- `README.md` (`# Cyber_harness`)
- `docs/plans/general-agent-harness.md`
- `.cursor/rules/general-agent-harness.mdc`

Those paths must survive the unrelated-histories merge. `docs/plans/` and
`.cursor/` do not exist in upstream at the pinned commit, so they should
apply cleanly. `README.md` will conflict; take upstream's file.

## 10. Import execution

Recorded after the merge on `cursor/phase-0-upstream-foundation-b38e`:

1. Feature branch `cursor/phase-0-upstream-foundation-b38e` from `main`
   `c36607b22e95414bd34ccc37d96d1018eb6feff4`.
2. Remote `upstream` → `https://github.com/deepseek-ai/deepseek-harness.git`.
3. `git fetch --tags upstream master` retrieved 417,482 objects and 16,511
   commits ending at the pinned SHA.
4. `git merge --allow-unrelated-histories --no-commit c291e7961a515f6d7af9304e7fd1d257929aef26`.
5. The only conflict was `README.md` (add/add). Resolved by keeping the
   upstream README.
6. Preserved `docs/plans/general-agent-harness.md`,
   `.cursor/rules/general-agent-harness.mdc`, and this inspection record.
7. Merge commit `5d009a3027724cdca0e8e11fdce4fea503f4aae7` has parents
   `e815acddc8b5226bd5155a93b0f5aee3f9116d53` (this project) and
   `c291e7961a515f6d7af9304e7fd1d257929aef26` (upstream).

Install results and baseline test results belong in `docs/upstream-sync.md`.

## 11. Phase 0 custom-runtime prohibition

This phase must not implement Cybersecurity domain code, Bash/PTY changes,
model tool surfaces, effect policy, new providers, security binaries,
network isolation, new domain abstractions, or Phase 1 work. It must not
refactor upstream source.
