/** Regression tests for this fork's CI overlays. Runtime sources stay untouched. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  isTranslationPairingManifestExcluded,
  parseTranslationPairingManifest,
} from '../translation-pairing.ts'

const root = resolve(import.meta.dirname, '../..')
const forkRepo = 'mahmoudemad68/Cyber_harness'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadWorkflow(name: string): Record<string, unknown> {
  const workflow: unknown = yaml.load(
    readFileSync(resolve(root, '.github/workflows', name), 'utf8'),
  )
  if (!isRecord(workflow)) {
    throw new TypeError(`${name} must define a workflow`)
  }
  return workflow
}

function workflowJob(name: string, job: string): Record<string, unknown> {
  const workflow = loadWorkflow(name)
  if (!isRecord(workflow.jobs)) {
    throw new TypeError(`${name} must define jobs`)
  }
  const found = workflow.jobs[job]
  if (!isRecord(found)) {
    throw new TypeError(`${name} must define job ${job}`)
  }
  return found
}

function evaluateRunsOn(
  expression: string,
  repository: string | undefined,
  vars: Record<string, string> = {},
  login = 'maintainer',
): unknown {
  const body = expression.trim().slice(3, -2)
  return runInNewContext(body, {
    vars,
    fromJSON: JSON.parse,
    github: {
      repository,
      event: { pull_request: { user: { login } } },
    },
  }, { timeout: 1000 })
}

describe('fork CI runner selection', () => {
  it.each([
    ['node-24', 'ubuntu-24.04', 'dsh-ubuntu-24-04-16core'],
    ['node-24-coverage', 'ubuntu-24.04', 'dsh-ubuntu-24-04-16core'],
    ['node-24-consumers', 'ubuntu-24.04', 'dsh-ubuntu-24-04-16core'],
    ['windows-build', 'windows-2025', 'dsh-windows-2025-16core'],
    ['windows-native-tests', 'windows-2025', 'dsh-windows-2025-16core'],
  ] as const)('%s uses GitHub-hosted runners on this fork and keeps the upstream default', (
    jobName,
    forkRunner,
    upstreamRunner,
  ) => {
    const selector = workflowJob('ci.yml', jobName)['runs-on']
    expect(typeof selector).toBe('string')
    expect(evaluateRunsOn(selector as string, forkRepo)).toBe(forkRunner)
    expect(evaluateRunsOn(selector as string, undefined)).toBe(upstreamRunner)
    expect(evaluateRunsOn(selector as string, 'deepseek-ai/deepseek-harness')).toBe(upstreamRunner)
  })

  it('does not queue Fork CI jobs on DeepSeek enterprise labels', () => {
    const workflow = JSON.stringify(loadWorkflow('ci-fork.yml'))
    expect(workflow).not.toContain('dsh-ubuntu-24-04-16core')
    expect(workflow).not.toContain('dsh-windows-2025-16core')
    expect(workflowJob('ci-fork.yml', 'static')['runs-on']).toBe('ubuntu-24.04')
    expect(workflowJob('ci-fork.yml', 'unit')['runs-on']).toBe('ubuntu-24.04')
    expect(workflowJob('ci-fork.yml', 'snapshot')['runs-on']).toBe('ubuntu-24.04')
    expect(workflowJob('ci-fork.yml', 'fork-checks-passed')['runs-on']).toBe('ubuntu-latest')
  })
})

describe('fork documentation pairing exclusions', () => {
  it('excludes this project\'s owned docs without pairing DeepSeek docs out', () => {
    const manifest = parseTranslationPairingManifest(
      readFileSync(resolve(root, 'scripts/translation-pairing.manifest.json'), 'utf8'),
    )
    expect(isTranslationPairingManifestExcluded('docs/plans/general-agent-harness.md', manifest)).toBe(true)
    expect(isTranslationPairingManifestExcluded('docs/notes/phase-0-reference-inspection.md', manifest)).toBe(true)
    expect(isTranslationPairingManifestExcluded('docs/ci/fork-ci.md', manifest)).toBe(true)
    expect(isTranslationPairingManifestExcluded('docs/upstream-sync.md', manifest)).toBe(true)
    expect(isTranslationPairingManifestExcluded('docs/testing.md', manifest)).toBe(false)
    expect(isTranslationPairingManifestExcluded('docs/i18n/README.md', manifest)).toBe(false)
    for (const file of ['scripts/verify-md-wrap.ts', 'scripts/verify-md-links.ts']) {
      const source = readFileSync(resolve(root, file), 'utf8')
      expect(source).toContain("relativePath.startsWith('docs/plans/')")
      expect(source).toContain("relativePath.startsWith('docs/notes/')")
      expect(source).toContain("relativePath.startsWith('docs/ci/')")
      expect(source).toContain("relativePath === 'docs/upstream-sync.md'")
    }
  })
})

describe('optional secret-dependent fork skips', () => {
  it('keeps the DeepSeek e2e fail-loud path except on this fork without the key', () => {
    const e2e = workflowJob('e2e.yml', 'e2e')
    expect(String(e2e.if)).toContain("github.repository != 'mahmoudemad68/Cyber_harness'")
    expect(String(e2e.if)).toContain('secrets.DEEPSEEK_API_KEY_EXTERNAL')
    const preflight = (e2e.steps as Array<Record<string, unknown>>)
      .find(step => step.name === 'Preflight (require DEEPSEEK_API_KEY)')
    expect(String(preflight?.run)).toContain('exit 1')
  })

  it('keeps installed-wheel live-API fail-loud text while skipping this fork without the key', () => {
    const build = workflowJob('build-exe-for-python-sdk.yml', 'build')
    const posix = (build.steps as Array<Record<string, unknown>>)
      .find(step => step.name === 'Preflight installed-wheel real API test (POSIX)')
    expect(String(posix?.if)).toContain("github.repository != 'mahmoudemad68/Cyber_harness'")
    expect(String(posix?.run)).toContain('exit 1')
  })
})
