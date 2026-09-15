# Upstream synchronization

This note records Phase 0 of `docs/plans/general-agent-harness.md`: importing
DeepSeek Harness with full Git history, documenting the `upstream` remote, and
recording a reproducible baseline before any custom runtime work.

Project intent for this repository remains in
`docs/plans/general-agent-harness.md`. The root `README.md` is the upstream
DeepSeek Harness README.

## Imported revision

| Field | Value |
|---|---|
| Upstream repository | `deepseek-ai/deepseek-harness` |
| Upstream URL | `https://github.com/deepseek-ai/deepseek-harness.git` |
| Default branch | `master` |
| Imported commit | `c291e7961a515f6d7af9304e7fd1d257929aef26` |
| Upstream package | `@deepseek-ai/dsh-root` `0.1.5-rc.2` |
| Import date | 2026-09-14 |
| Feature branch | `cursor/phase-0-upstream-foundation-b38e` |
| Merge commit | `5d009a3027724cdca0e8e11fdce4fea503f4aae7` |
| Merge parents | `e815acddc8b5226bd5155a93b0f5aee3f9116d53` (this project), `c291e7961a515f6d7af9304e7fd1d257929aef26` (upstream) |
| Upstream commits in ancestry | 16511 |
| License | MIT (Copyright (c) 2026 DeepSeek) |

Re-inspection on 2026-09-14 found `master` HEAD still equal to the
roadmap-pinned SHA. No substitute revision was used.

## Remote configuration

Documented remote (public HTTPS, no credentials):

```sh
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
```

After add:

```text
upstream  https://github.com/deepseek-ai/deepseek-harness.git (fetch)
upstream  https://github.com/deepseek-ai/deepseek-harness.git (push)
```

The remote lives in local Git config and is not a committed file. Recreate it
in any fresh clone with the command above. Do not store access tokens in the
remote URL.

Fetch used:

```sh
git fetch --tags upstream master
```

That retrieved the full `master` history (417,482 objects) plus upstream tags
such as `dsh-v0.1.5-rc.2`.

## Merge strategy

1. Keep this project's commits. Do not rewrite `main`. Do not force-push
   `main`.
2. Fetch upstream by Git remote. Do not copy a source snapshot, paste the
   tree, submodule the upstream repository, or squash/flatten its history.
3. Merge on a feature branch with unrelated histories, because this repository
   and DeepSeek Harness began independently:

   ```sh
   git checkout -b cursor/phase-0-upstream-foundation-b38e
   git merge --allow-unrelated-histories --no-commit \
     c291e7961a515f6d7af9304e7fd1d257929aef26
   ```

4. Resolve repository-level conflicts conservatively. The only conflict was
   `README.md` (add/add). The upstream README was kept. This project's
   `docs/plans/general-agent-harness.md` and
   `.cursor/rules/general-agent-harness.mdc` had no upstream counterpart and
   were kept as-is.
5. Do not mix custom runtime changes into an upstream merge.

Both ancestries are visible:

```sh
git merge-base --is-ancestor c291e7961a515f6d7af9304e7fd1d257929aef26 HEAD
git merge-base --is-ancestor c36607b22e95414bd34ccc37d96d1018eb6feff4 HEAD
git log --oneline --first-parent
```

## Future upstream synchronization

Use merge commits, not rebase onto upstream and not snapshot replacement.

```sh
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
# or, if the remote already exists:
git fetch --tags upstream master
git merge --no-ff upstream/master
```

Then:

1. Resolve conflicts conservatively. Prefer keeping upstream files unless a
   documented local overlay must remain (`docs/plans/`, `.cursor/rules/`,
   `docs/notes/`, this file).
2. Do not move or rename upstream files to make the merge easier.
3. Do not put Cybersecurity code in core. Keep it under `packages/domain/`
   when it exists.
4. Re-run the baseline commands in this note.
5. Record the newly imported upstream SHA, merge commit, and any new baseline
   failures here.
6. Re-inspect local imported DeepSeek seams before the next implementation
   phase. Do not treat the planning audit as the implementation source of
   truth.

If upstream `master` has moved past a SHA this project intended to pin, record
the discrepancy before merging a different revision. Do not silently
substitute.

## Node and pnpm requirements

Confirmed from upstream `package.json` at the imported commit:

- Node.js: `^22.19.0 || >=24.0.0`
- pnpm: `11.7.0` (`packageManager`: `pnpm@11.7.0`)
- Lockfile: `pnpm-lock.yaml`, `lockfileVersion: '9.0'`
- Upstream CI primary node: 24. Development guide also cites CI coverage of
  22.19, 24, and 26.

Enable the pinned pnpm through Corepack:

```sh
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

## Installation command

From the repository root, with a supported Node and pnpm 11.7.0:

```sh
pnpm install --frozen-lockfile
```

`pnpm install` is the contributor command from `docs/development.md`. Upstream
CI uses `--frozen-lockfile`. Phase 0 baseline install should use the frozen
lockfile so the result is reproducible.

Do not commit lockfile edits in this phase unless install proves the upstream
lockfile cannot be used, and then record that as a baseline blocker rather
than "fixing" upstream.

## Verification commands

Upstream-supported commands confirmed from `AGENTS.md` / `package.json` before
running them:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run lint
pnpm dsh --dump-default-config
pnpm dsh --profile web --dump-config
pnpm dsh --profile headless --dump-config
pnpm run test:snapshot
```

`pnpm dsh --profile headless "task"` is the real shipped-profile run. It
requires `DEEPSEEK_API_KEY` and is not a keyless baseline. Keyless shipped
profile evidence is config dump plus `test:snapshot` (recorded-session replay
through shipped profiles).

`pnpm run test:e2e` self-skips without a key and is not required to prove
Phase 0.

## Baseline verification results

Recorded 2026-09-14 on Ubuntu 24.04.4 (linux x64), Node `v22.22.2` (nvm;
satisfies `^22.19.0`), pnpm `11.7.0`. The environment's default PATH `node`
was `v22.14.0` (`/exec-daemon/node`), which is below the upstream engine
floor; verification used nvm `v22.22.2` first on `PATH`.

Working tree remained clean of tracked source after these commands. No
upstream runtime file was edited to make a check pass.

| Check | Command | Result |
|---|---|---|
| Frozen lockfile install | `pnpm install --frozen-lockfile` | Packages resolved (1260 added; lockfile up to date; supply-chain policy passed). Root `postinstall` then failed; see known failures. |
| Frozen lockfile without lefthook installer | `pnpm install --frozen-lockfile --ignore-scripts` | Exit 0. Lockfile reproducible. Native lifecycle scripts from the first install (esbuild, node-pty, koffi) remained. |
| Typecheck | `pnpm run typecheck` | Exit 0. ~2m 52s (`2026-09-14T18:04:28Z`–`18:07:20Z`). Host `tsc` + tsdown, then `tsc -b tsconfig.client.json`. |
| Lint | `pnpm run lint` | Exit 0. ~1m 02s (`18:07:33Z`–`18:08:35Z`). |
| Unit tests | `pnpm run test` | Exit 1. Native addon built (`linux-x64/bin/glibc/system.node`). **1264 files passed**, 13 skipped, **1 file failed**. **22508 tests passed**, 129 skipped, 1 expected fail, **2 failed**. ~9m 57s. See known failures. |
| CLI help | `pnpm dsh --help` | Exit 0. |
| Default config dump without profile | `pnpm dsh --dump-default-config` | Exit 1. Upstream CLI: `error: --profile <name> is required`. Not a merge defect. |
| Web default-config dump | `pnpm dsh --profile web --dump-default-config` | Exit 0. 539-line YAML. |
| Web profile config dump | `pnpm dsh --profile web --dump-config` | Exit 0. 539-line YAML. Includes `@deepseek-ai/dsh-web-app` and `agent-presets` with `default: standard`. |
| Headless profile config dump | `pnpm dsh --profile headless --dump-config` | Exit 0. 348-line YAML. Includes `@deepseek-ai/dsh-headless`. |
| SDK profile config dump | `pnpm dsh --profile sdk --dump-config` | Exit 0. 352-line YAML. Includes `sdk-jsonrpc-server`. |
| Shipped profile smoke | `vitest run --config vitest.snapshot.config.ts snapshots/session/headless.snapshot.ts -t "replays text-turn through dsh --profile headless"` | Exit 0. `✓ ... replays text-turn through dsh --profile headless 1843ms`. Keyless recorded-session replay through the shipped headless `dsh` profile. |

`pnpm dsh --profile headless "task"` against a live model was not run:
`DEEPSEEK_API_KEY` is not available in this environment. The keyless snapshot
replay is the upstream-supported shipped-profile smoke.

### Clean checkout outside `/workspace` (2026-09-15)

Clone: `git clone /workspace /home/ubuntu/phase0-clean` then checkout
`cursor/phase-0-upstream-foundation-b38e` at `5c6d1c25588d71d3fa9b1480cd8063daa48b66b3`.
Path is not `/workspace`. Local and global `core.hooksPath` were empty.
Node `v22.22.2`, pnpm `11.7.0`. The pnpm store was warm from the earlier
`/workspace` install; lefthook still executed and succeeded.

| Check | Command | Result |
|---|---|---|
| Frozen lockfile install | `pnpm install --frozen-lockfile` | Exit 0. 1260 packages. lefthook `scripts/install-lefthook.mjs` succeeded (`2026-09-15T06:40:57Z`–`06:41:02Z`). |
| Typecheck | `pnpm run typecheck` | Exit 0 (`06:41:02Z`–`06:42:50Z`). |
| Lint | `pnpm run lint` | Exit 0 (`06:42:50Z`–`06:43:39Z`). |
| Unit tests | `pnpm run test` | Exit 1. **1264 files passed**, 13 skipped, **1 file failed**. **22508 tests passed**, 129 skipped, 1 expected fail, **2 failed** (`06:43:42Z`–`06:50:49Z`). Same two `tool-skill.spec.ts` failures as `/workspace`. |
| Shipped profile smoke | `pnpm exec vitest run --config vitest.snapshot.config.ts snapshots/session/headless.snapshot.ts -t "replays text-turn through dsh --profile headless"` | Exit 0. 1 passed, 96 skipped (`06:50:49Z`–`06:50:53Z`). |
| tool-skill with empty `/workspace` | `unshare --user --map-root-user --mount` bind-mount empty dir over `/workspace`, then `pnpm exec vitest run packages/skill/tool-skill/tests/tool-skill.spec.ts` from `/home/ubuntu/phase0-clean` | Exit 0. **32 passed / 32**. |

No upstream test file was modified to make a check pass.

### Known baseline failures

1. **Root lefthook installer in this Cloud Agent environment (install).**
   `pnpm install --frozen-lockfile` fetches the lockfile closure, then
   `node scripts/install-lefthook.mjs` exits 1:

   ```text
   [install-lefthook] refusing to replace user-owned core.hooksPath
   (file:.git/config: "/home/ubuntu/.cursor/agent-hooks/L3dvcmtzcGFjZQ")
   ```

   This is lefthook installer fail-closed behavior when `core.hooksPath` is
   already owned (here, by Cursor agent hooks). It is not a lockfile defect
   and is not caused by the unrelated-histories merge. Phase 0 did not set
   `DSH_LEFTHOOK_ALLOW_HOOKS_PATH_OVERRIDE=1` (that would replace agent
   hooks). Workaround used for the rest of baseline: keep the first install's
   native postinstall artifacts and use `--ignore-scripts` for a 0-exit
   lockfile verification. On a clone without a custom `core.hooksPath`,
   lefthook installer is expected to succeed.

   Confirmed 2026-09-15 in `/home/ubuntu/phase0-clean` (empty
   `core.hooksPath`): `pnpm install --frozen-lockfile` exit 0.
   `scripts/install-lefthook.mjs` printed
   `sync hooks: ✔️(pre-commit, pre-push, pre-merge-commit)`.
   The `/workspace` failure is environment-specific.

2. **Two `dsh-tool-skill` unit tests when host path `/workspace` has project skills.**
   File: `packages/skill/tool-skill/tests/tool-skill.spec.ts`.

   - `injects a stable durable name-and-description catalog at the first step`
   - `does not inject a catalog when no model-invocable skills are available`

   Both call `agentForCwd('/workspace')` as a vacant working directory that
   should not discover project skills. They do **not** use `process.cwd()`.
   This Cloud Agent host has upstream `.agents/skills` at `/workspace`, so the
   tests see the real DeepSeek skill catalog instead of `[]`.

   Confirmed 2026-09-15: a fresh clone at `/home/ubuntu/phase0-clean`
   (not `/workspace`, empty `core.hooksPath`) still failed the same two
   tests, because `/workspace` on the host remained populated. The same
   file then passed **32/32** when the test process bind-mounted an empty
   directory over `/workspace` (`unshare --user --map-root-user --mount`).
   **Not caused by the merge:** the spec and skill sources are unmodified
   upstream files; 22508 other tests passed in both checkouts. Do not change
   the spec in Phase 0.

3. **`pnpm dsh --dump-default-config` without `--profile`.** Upstream CLI at
   this revision requires `--profile <name>`. Use
   `pnpm dsh --profile web --dump-default-config`.

Expected fork-operations issues, not treated as merge bugs and not executed
as Phase 0 pass/fail gates.

### Fork CI portability audit (2026-09-15)

Inspected `.github/workflows/ci.yml` and the other 20 imported workflow
files. Observed job conclusions on PR #4 at
`5c6d1c25588d71d3fa9b1480cd8063daa48b66b3` via the GitHub Actions API
(job `labels`, `status`, `conclusion`, and failure logs). Phase 0 does
not retarget or rewrite these workflows.

**Do not claim that this fork automatically falls back to GitHub-hosted
runners.** That is true only for expressions that already default to
`ubuntu-latest` / `ubuntu-24.04` / `windows-*` GitHub-hosted labels, or
for release rehearsals whose self-hosted leg is gated on
`github.repository == 'deepseek-harness/deepseek-harness'`.

`ci.yml` Linux enterprise jobs resolve `runs-on` as: Blacksmith label if
`DSH_CI_FAILOVER_LINUX` is `blacksmith`; in-house self-hosted pool if
that variable is `selfhosted` and Dependabot predicates pass; otherwise
the default label `dsh-ubuntu-24-04-16core`.

Unset `DSH_CI_FAILOVER_LINUX` selects `dsh-ubuntu-24-04-16core`, an
upstream hosted-enterprise runner label, **not** `ubuntu-latest`. Windows
PR jobs likewise default to `dsh-windows-2025-16core`. This fork does
not provide those labels, so the jobs remain queued. Future fork-CI
remediation (not Phase 0) would add matching runners, set the failover
repository variables to a pool this fork owns, or retarget `runs-on`.

#### Jobs that ran correctly on this fork (GitHub-hosted labels)

| Workflow / job | Label | Conclusion |
|---|---|---|
| CI / node 22.19, 24.9, 26 | `ubuntu-latest` | success |
| CI / node 24 / benchmarks | `ubuntu-24.04` | success |
| CI / python 3.10 / keyless SDK | `ubuntu-latest` | success |
| CI / python runtime plan + wheel build steps | `ubuntu-latest` / `windows-2025` | success until live-API preflight |
| Node Addon System (matrix + darwin/linux) | `ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-15-intel`, `macos-latest` | success |
| Release (dsh) Dependency layout + Pack | `ubuntu-24.04` | success (self-hosted gate false; fallback `ubuntu-24.04`) |
| Release (vendor) Pack npm tarballs | `ubuntu-24.04` | success (same fallback) |

#### Jobs queued because the required runner does not exist

| Workflow / job | `runs-on` label | Status |
|---|---|---|
| CI / node 24 / static | `dsh-ubuntu-24-04-16core` | queued |
| CI / node 24 / coverage | `dsh-ubuntu-24-04-16core` | queued |
| CI / node 24 / snapshots and artifacts | `dsh-ubuntu-24-04-16core` | queued |
| CI / windows node 24 / build | `dsh-windows-2025-16core` | queued |
| CI / windows node 24 / coverage | `dsh-windows-2025-16core` | queued |
| CI / windows node 24 / native tests | `dsh-windows-2025-16core` | queued |
| CI / windows node 24 / observational | `dsh-windows-2025-16core` | queued |

`all-checks-passed` defaults to `ubuntu-latest` but `needs` the queued
enterprise jobs, so the required aggregate cannot finish.

#### Jobs that failed only because fork secrets / tokens / app vars are missing

Not source or runtime failures. Logs show successful checkout/install
(or policy checkout) then a missing-credential error:

| Workflow / job | Missing material | Log signal |
|---|---|---|
| E2E (real DeepSeek API) / e2e | `secrets.DEEPSEEK_API_KEY_EXTERNAL` | Preflight: `DEEPSEEK_API_KEY is empty` |
| CI python runtime installed-wheel real API (linux/win) | `secrets.DEEPSEEK_API_KEY_EXTERNAL` | `DEEPSEEK_API_KEY_EXTERNAL is empty; the installed-wheel real API test cannot self-skip.` Same-repo PRs are not skipped (`head.repo.fork` is false). |
| Build PR preview / cloudflare pages preview | `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | wrangler: token required in non-interactive env (build itself reached upload) |
| Issue policy / Issue lifecycle | `vars.DSH_ISSUE_APP_CLIENT_ID` and `secrets.DSH_ISSUE_APP_PRIVATE_KEY`; token owner is `deepseek-harness/deepseek-harness` | `client-id` must be a non-empty string |

`e2e.yml` skips untrusted **fork PRs**; a branch PR on this repository
is treated as trusted and then hard-fails the empty-secret preflight.

#### Jobs that represent an actual source/runtime failure

None observed on PR #4. Primary upstream static/coverage/snapshot gates
never started (queued), so they are an **unrun** baseline, not a red
runtime result.

Upstream `verify-translation-pairing` requires every `docs/**` document to
be a bilingual pair. This repository's planning files under `docs/plans/`
and Phase 0 notes under `docs/notes/` / `docs/upstream-sync.md` are
English-only by design. That is a documented fork documentation mismatch,
not a reason to edit upstream pairing machinery in Phase 0.

Workflows not exercised on this PR (master-only, path filters, or
`workflow_dispatch`): `ci-master.yml`, `sandbox.yml`, `docs-pages.yml`,
`expected-filenames.yml`, `e2b-e2e.yml`, `pi-ai-provider-e2e.yml`,
release-publish / python-release / node-addon-system-release.

Install warnings observed and not treated as failures:

- Unsupported-platform skips for darwin/arm64 native packages on linux x64.
- `Failed to create bin ... apps/cli/lib/bin.js` before `pnpm run build`.
  Source launch (`pnpm dsh` via tsx) does not need that bin.

## Security and safety warnings from upstream

See `SAFETY.md` at the imported commit. Material facts:

- Experimental developer-preview software. No security audit. Not
  production-ready.
- Can execute model-generated code and commands, load third-party plugins,
  and access network, processes, credentials, and files.
- Sandbox, approval, and permission controls do not guarantee isolation.
- Must not be the sole security control for untrusted workloads.
- MIT license: no warranty.

A HEAD-tree scan after import found no tracked `.env` files, no filenames
that look like private keys, and no `BEGIN * PRIVATE KEY` headers. Workflow
files reference GitHub secret *names* only.

### Full Git-history secret scan (2026-09-15)

Scanned **all Git objects** reachable from this branch, not only HEAD.
History was not rewritten. No force-push.

Commands:

- `git rev-list --objects --all` (417,547 ids)
- `git cat-file --batch-check --batch-all-objects` then blob content scan
  of 183,284 candidate blobs (size 1..2,000,000 bytes; skipped known
  binary extensions; 12 NUL-binary blobs skipped)
- High-confidence regexes: PEM/PGP private-key armor; `AKIA…`; GitHub
  `ghp_` / `gho_` / `ghs_` / `github_pat_`; GitLab `glpat-`; Slack
  `xox…`; Stripe `sk_live_` / `rk_live_`; `sk-` / `sk-ant-`; `npm_`;
  Google `AIza…`; JWT-like triples; `aws_secret_access_key` /
  `private_key` / `client_secret` quoted assignments
- Complementary `git log --all -S` for private-key armor and those token
  prefixes
- `git log --all --diff-filter=A` for `.pem`, `.p12`, `.pfx`, `.p8`,
  `.env`, `id_rsa`, `id_ed25519`, `*credentials.json`,
  `*service-account*.json` — **no such files added**

Results: 41 regex hits on 11 paths. **No live production credential
identified.** Every hit is dummy material used to test telemetry
redaction. Introducing commits are ancestors of imported SHA
`c291e7961a515f6d7af9304e7fd1d257929aef26` (existed upstream). None appear
in this project's unique commits.

| Path (historical and/or current) | Finding types | At imported SHA? | At HEAD? | Severity | Origin |
|---|---|---|---|---|---|
| `packages/session/session-telemetry-otel/tests/fixtures/driver.ts` | dummy `sk-…` fixture | yes | yes | info (fixture) | existed upstream |
| `packages/session/session-telemetry-otel/tests/loader-composition.e2e.ts` | dummy `sk-…` fixture | yes | yes | info (fixture) | existed upstream |
| `packages/session/session-telemetry/tests/redact.spec.ts` | dummy `sk-fixture*` at HEAD | yes (current path) | yes | info (fixture) | existed upstream |
| Historical `packages/telemetry/session-telemetry/tests/redact.spec.ts` and deleted sdk/scaffold telemetry redactor specs | dummy PEM armor, `AKIA…`, GitHub PAT *shape*, Slack *shape*, JWT *shape* | no | no | info (fixture) | existed upstream; later deleted or moved upstream |
| Deleted upstream telemetry packages (`packages/sdk/telemetry/…`, `packages/scaffold/telemetry/…`, `packages/telemetry/session-telemetry…`, `examples/headless-agent/tests/fixtures/telemetry-otel-driver.ts`) | same dummy redactor corpus, including one `packages/sdk/telemetry/src/redaction-contract.ts` blob (`e92b34bd7e42cc84ddcbe9233c30e5a58ba53e5a`, 2026-07-20) with an inline dummy `sk-…` used as a redaction contract sample | no | no | info (fixture) | existed upstream; later deleted upstream |

HEAD still contains upstream dummy `sk-fixture*` strings in telemetry tests.
HEAD contains **no** PEM private-key armor and **no** GitHub PAT / Slack /
`AKIA` matches.

This project's unique commits (docs/roadmap/inspection only, plus the
merge commit) introduced **no** secret-scan hits.

## Files added outside the upstream import

These paths are this project's, not DeepSeek Harness:

- `docs/plans/general-agent-harness.md`
- `.cursor/rules/general-agent-harness.mdc`
- `docs/notes/phase-0-reference-inspection.md`
- `docs/upstream-sync.md`

No Cybersecurity domain package, policy plugin, tool-surface code, or other
Phase 1+ runtime was added.

## Phase 0 reference-inspection record

Canonical Section 2.4 record:
[`docs/notes/phase-0-reference-inspection.md`](notes/phase-0-reference-inspection.md).
It was written against the live upstream repository *before* the merge, then
updated with the merge commit SHA.

Required Section 2.4 answers:

1. **Seams inspected (package/path and revision).** Repository lineage at
   `deepseek-ai/deepseek-harness` `c291e7961a515f6d7af9304e7fd1d257929aef26`:
   repository identity, `LICENSE`, `package.json` engines/`packageManager`,
   `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `README.md`, `SAFETY.md`,
   `.github/workflows/*` (21 files), `AGENTS.md`, `docs/development.md`,
   `docs/testing.md`, `apps/cli/README.md`, `.gitattributes`, `.gitignore`,
   `.editorconfig`, `lefthook.yml`, `tsconfig*.json`, `vitest*.ts`. Phase 0
   has no runtime seam.
2. **What they already provide.** A complete MIT-licensed Cordis monorepo
   with reproducible pnpm 11.7.0 lockfile, Node `^22.19.0 || >=24.0.0`,
   shipped profiles (`web`, `headless`, `sdk`, `sdk-minimal`, `acp`), and
   upstream commands for install, typecheck, unit tests, lint, config dump,
   and keyless snapshot replay. Runtime plugins are imported unchanged.
3. **Sentinel.** Not relevant for Phase 0. Not imported or vendored.
4. **Why `REUSE`/`EXTEND` is insufficient for `NEW`/`REPLACE`.** Not
   applicable. Phase 0 is `REUSE` only.

Additional inspection facts (license, SAFETY.md, workflows, local pre-merge
state) are in the canonical record and are not repeated here in full.
