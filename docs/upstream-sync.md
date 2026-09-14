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

Status: pending at the pre-test revision. This section is updated after the
commands above run on the merge commit.

| Check | Command | Result |
|---|---|---|
| Dependency install | `pnpm install --frozen-lockfile` | pending |
| Typecheck | `pnpm run typecheck` | pending |
| Unit tests | `pnpm run test` | pending |
| Lint | `pnpm run lint` | pending |
| Default config dump | `pnpm dsh --dump-default-config` | pending |
| Web profile config dump | `pnpm dsh --profile web --dump-config` | pending |
| Headless profile config dump | `pnpm dsh --profile headless --dump-config` | pending |
| Shipped profile smoke | `pnpm run test:snapshot` | pending |

### Known baseline failures

None recorded yet. Upstream failures that are not caused by this merge will be
listed here without a Phase 0 source fix.

Expected fork-operations issues, not treated as merge bugs:

- Imported GitHub workflows target upstream runners, secrets
  (`DEEPSEEK_API_KEY_EXTERNAL`, `NPM_TOKEN`), and repository name checks.
  They may fail or skip on `mahmoudemad68/Cyber_harness`.
- Upstream `verify-translation-pairing` requires every `docs/**` document to
  be a bilingual pair. This repository's planning files under `docs/plans/`
  and Phase 0 notes under `docs/notes/` are English-only by design. That is
  a documented fork documentation mismatch, not an upstream test defect and
  not a reason to edit upstream pairing machinery in Phase 0.

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
files reference GitHub secret *names* only. Upstream history was not
rewritten.

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
