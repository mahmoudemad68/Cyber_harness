# Fork CI policy

This note is the fork-owned CI policy for `mahmoudemad68/Cyber_harness`.
It is not a DeepSeek Harness bilingual document. DeepSeek's pairing gate
stays in force for DeepSeek-owned docs; this path is excluded from that
corpus on purpose. See [Ownership boundary](#ownership-boundary).

Phase 0 imported DeepSeek Harness workflows unchanged. Those workflows
assume DeepSeek enterprise runners and DeepSeek-only secrets. This fork
keeps the imported runtime and adds the smallest overlay so a normal
pull request can reach a **deterministic final status**.

Do not treat this as a runtime architecture phase. Do not start Phase 1
from this note.

## Required PR gate

Branch protection for this repository should require **Fork CI / fork checks passed**.
That aggregate is GitHub-hosted, keyless, and fails only on real
install/typecheck/lint/unit/snapshot/pairing regressions.

| Check | Workflow / job | Why it is required |
|---|---|---|
| `fork checks passed` | Fork CI / `fork-checks-passed` | Deterministic aggregate over the rows below |
| `typecheck lint pairing` | Fork CI / `static` | Frozen lockfile install, `pnpm run typecheck`, `pnpm run lint`, `pnpm run verify-translation-pairing`, `pnpm run verify-package-invariants` |
| `unit tests` | Fork CI / `unit` | `pnpm run test` after isolating `/workspace` |
| `headless snapshot smoke` | Fork CI / `snapshot` | `build:native-system` then `build:lib:host`, then keyless recorded-session replay through `dsh --profile headless` |

Recommended additional required checks that already run on GitHub-hosted
runners without this overlay:

| Check | Workflow |
|---|---|
| `Pack npm tarballs` and `Dependency layout` | Release (dsh) |
| `Pack npm tarballs` | Release (vendor) |
| `node 22.19`, `node 24.9`, `node 26` | CI / node-compat |
| `python 3.10 / keyless SDK` | CI / python-sdk |
| `node 24 / benchmarks` | CI / node-24-bench |

Do **not** require:

- `CI / all checks passed` until the retargeted 16-core-shaped jobs have
  proven they finish on GitHub-hosted 4-core runners (they are no longer
  queued; they may still be slow)
- E2E (real DeepSeek API)
- Cloudflare Pages upload/verify
- Issue policy / Issue lifecycle
- `ci-master.yml` fleet benchmarks or self-hosted standbys
- release-publish / python-release / node-addon-system-release

## Runner substitutions

Jobs that defaulted to `dsh-ubuntu-24-04-16core` or
`dsh-windows-2025-16core` queued forever on this fork. The `runs-on`
expressions now start with a **positive repository match**:

```text
github.repository == 'mahmoudemad68/Cyber_harness' && '<github-hosted>'
|| <unchanged DeepSeek failover>
|| '<original DeepSeek label>'
```

The match is positive on purpose. Upstream unit tests evaluate `runs-on`
with `github.repository` undefined; a negative
`github.repository != 'deepseek-ai/...'` clause would steal the default
to GitHub-hosted and fail those tests.

| Job | Upstream default | This fork |
|---|---|---|
| `node-24` (static) | `dsh-ubuntu-24-04-16core` | `ubuntu-24.04` |
| `node-24-coverage` | `dsh-ubuntu-24-04-16core` | `ubuntu-24.04` |
| `node-24-consumers` | `dsh-ubuntu-24-04-16core` | `ubuntu-24.04` |
| `windows-build` | `dsh-windows-2025-16core` | `windows-2025` |
| `windows-coverage` | `dsh-windows-2025-16core` | `windows-2025` |
| `windows-native-tests` | `dsh-windows-2025-16core` | `windows-2025` |
| `windows-observational` | `dsh-windows-2025-16core` | `windows-2025` |

Concurrency is reduced on this fork only (fewer workers/partitions). That
adapts parallelism to a 4-core GitHub-hosted runner. It does not drop
suites.

Jobs that **cannot** honestly run here, and are left explicit rather than
queued:

| Job / workflow | Why GitHub-hosted is not a substitute | Fork behavior |
|---|---|---|
| `ci-master.yml` `serial-linux-selfhosted` / `serial-windows` | Persistent DeepSeek VMs (`vm-backup`, `dsh-win-ci`) | Triggers only on `master` push; this fork's default branch is `main`, so they do not run |
| `ci-master.yml` larger/consolidated runner benchmarks | DeepSeek fleet labels from 4-core through 96-core | `workflow_dispatch` still selects those labels; do not dispatch on this fork |
| `sandbox.yml` | Master-only kernel proofs; bwrap/Landlock/Seatbelt | Triggers on `master` only; not a PR gate |

## Optional / secret-dependent jobs

Missing DeepSeek credentials must **skip**, not fail a normal PR. No fake
secrets are committed. Official DeepSeek repositories keep fail-loud
preflights.

| Workflow / step | Secret or var | This fork when missing | DeepSeek when missing |
|---|---|---|---|
| E2E (real DeepSeek API) / job | `DEEPSEEK_API_KEY_EXTERNAL` | Job skipped | Trusted PR still runs; preflight `exit 1` |
| Python installed-wheel live API | `DEEPSEEK_API_KEY_EXTERNAL` | Live-API steps skipped; keyless wheel tests still run | Preflight `exit 1` |
| Cloudflare upload / verify / comment | `CLOUDFLARE_API_TOKEN` | Those steps skipped after the keyless build | Upload still runs and fails |
| Issue policy / Issue lifecycle | `DSH_ISSUE_APP_CLIENT_ID` + `DSH_ISSUE_APP_PRIVATE_KEY` | Token failure is non-blocking; handler prints `SKIPPED` | Token + policy still required |
| `e2b-e2e.yml`, `pi-ai-provider-e2e.yml` | E2B / provider keys | Manual `workflow_dispatch` only | Same |
| `release-publish.yml` | npm token | Manual dispatch only | Same |

Status language:

- **SKIPPED** — optional external integration unavailable
- **FAILED** — install, typecheck, lint, unit, snapshot, pairing, or pack regression

## `/workspace` fixture

`packages/skill/tool-skill/tests/tool-skill.spec.ts` calls
`agentForCwd('/workspace')` as a vacant working directory. A Cloud Agent
checkout that *is* `/workspace` makes those two tests fail because they
discover real `.agents/skills`. GitHub-hosted images usually lack that
path. Fork CI still reproduces the vacant directory explicitly via
`scripts/ci-isolate-workspace-fixture.sh` (empty bind-mount over
`/workspace`). The spec is not edited.

## Ownership boundary

| Path | Owner | Pairing |
|---|---|---|
| `docs/plans/` | this project (roadmap) | excluded |
| `docs/notes/` | this project (Phase 0 inspection) | excluded |
| `docs/ci/` | this project (fork CI policy) | excluded |
| `docs/upstream-sync.md` | this project | excluded |
| `.cursor/rules/` | this project | outside `docs/**` |
| All other `docs/**` | DeepSeek Harness | still bilingual |
| `.agents/notes/**` (except already excluded) | DeepSeek Harness | unchanged |

Do not add fake `.zh.md` / `.i18n.yaml` pairs for this project's
planning notes. Do not weaken `verify-translation-pairing` itself.
Exclusions use the existing `scripts/translation-pairing.manifest.json`
`excluded` list (exact path or prefix ending in `/`).

## Upstream deviations

Recorded so a future `git merge upstream/master` can be reconciled
without rewriting workflows from scratch.

1. **`.github/workflows/ci.yml`** — prepend the Cyber_harness
   `runs-on` clause on seven enterprise/Windows jobs; reduce fork-only
   concurrency; isolate `/workspace` on Linux coverage.
2. **`.github/workflows/ci-fork.yml`** — new overlay; absent upstream.
   The snapshot job runs `pnpm run build:native-system` then
   `pnpm run build:lib:host` because headless replay loads
   `native/system/packages/linux-x64/bin/glibc/system.node`.
3. **`.github/workflows/e2e.yml`** — empty live-API key SKIPPED inside the
   preflight script on this fork (`GITHUB_REPOSITORY`). Do not put `secrets`
   in `if:` (GitHub rejects that named-value and aborts the workflow graph).
   `exit 1` remains for DeepSeek.
4. **`.github/workflows/build-exe-for-python-sdk.yml`** — live-API
   preflight skips this fork when the key is empty inside the step script
   (`GITHUB_REPOSITORY`); reusable workflows cannot use `secrets` in `if`.
   `exit 1` remains in the POSIX script for DeepSeek.
5. **`.github/workflows/build-preview-cloudflare.yml`** — detect credentials
   in a step (`env` + `GITHUB_OUTPUT`); upload/verify/comment skip when
   unavailable. `pnpm run build` still runs. Do not put `secrets` in `if:`.
6. **`.github/workflows/issue-policy.yml`** / **`issue-lifecycle.yml`** —
   empty Issue App id is SKIPPED rather than a PR failure. Lifecycle job
   `if` stays undefined (upstream unit test pin).
7. **`scripts/translation-pairing.manifest.json`** — exclude this
   project's documentation paths listed above.
8. **`scripts/fork-owned-docs.ts`**, consumed by **`scripts/verify-md-wrap.ts`**,
   **`scripts/verify-md-links.ts`**, and **`scripts/verify-mermaid.ts`** —
   skip the same project-owned paths so DeepSeek's wrap, link, and mermaid
   gates still cover DeepSeek docs without reformatting this project's
   planning notes, treating planned Phase 1+ package paths as missing files,
   or failing on roadmap sequence diagrams that Mermaid cannot parse.
9. **`scripts/ci-isolate-workspace-fixture.sh`** and
   **`scripts/tests/fork-ci.spec.ts`** — fork-only helpers/tests.

## Reconciling a future upstream merge

1. Merge `upstream/master` on a feature branch. Do not copy a snapshot.
2. If upstream rewrote a `runs-on` expression, keep their failover logic
   and put `github.repository == 'mahmoudemad68/Cyber_harness' && '…'`
   first again. Do not use a negative DeepSeek-repo check; that breaks
   `scripts/ci-workflow.spec.ts`.
3. If upstream tightens a pinned `if:` string (`all-checks-passed`,
   Windows jobs, python-runtime, issue-lifecycle token step, e2e
   bubblewrap, POSIX live-API `exit 1`), restore the pin and move fork
   behavior to an extra `&&` clause or overlay workflow.
4. Re-run `pnpm exec vitest run scripts/ci-workflow.spec.ts scripts/tests/ci-master-platforms.spec.ts scripts/preview-workflow.spec.ts scripts/tests/fork-ci.spec.ts`. Keep `scripts/fork-owned-docs.ts` wired into wrap, link, and mermaid gates if those files are regenerated.
5. Keep `ci-fork.yml` as the required aggregate even if upstream
   `all checks passed` becomes usable here.
