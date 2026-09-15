/**
 * One authoring or document-read call captures its root list at entry.
 * A contribution registered or disposed while discovery is in flight must
 * not change that call's source, duplicate check, writable destination, or
 * deletion target. `$DSH_HOME` is isolated because the derived user root
 * is still resolved in the constructor when `includeUserRoot` is left on.
 */

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AgentPresets, {
  COMPOSITION_FILE, type Config, type PresetRoot,
} from '@deepseek-ai/dsh-agent-presets'

const discoveryHarness = vi.hoisted(() => ({
  calls: 0,
  hookRuns: 0,
  onDiscover: undefined as ((roots: readonly PresetRoot[]) => void) | undefined,
}))

vi.mock('../src/discovery.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/discovery.ts')>()
  return {
    ...actual,
    discoverPresets: async (roots: readonly PresetRoot[], harnessBase: string) => {
      discoveryHarness.calls += 1
      await Promise.resolve()
      const hook = discoveryHarness.onDiscover
      if (hook !== undefined) {
        discoveryHarness.hookRuns += 1
        hook(roots)
      }
      return actual.discoverPresets(roots, harnessBase)
    },
  }
})

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const USER_ROOT_SEGMENT = '.agent-presets'
const SOURCE_A = '[]\n# snapshot-source\n'
const SOURCE_B = '[]\n# live-winner\n'

let home: string
let previousHome: string | undefined
const contexts: Context[] = []
const tempRoots: string[] = []

beforeEach(async () => {
  previousHome = process.env.DSH_HOME
  home = await mkdtemp(join(tmpdir(), 'dsh-snapshot-home-'))
  process.env.DSH_HOME = home
  discoveryHarness.calls = 0
  discoveryHarness.hookRuns = 0
  discoveryHarness.onDiscover = undefined
})

afterEach(async () => {
  discoveryHarness.onDiscover = undefined
  await Promise.allSettled(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
  for (const root of tempRoots.splice(0)) await rm(root, { recursive: true, force: true })
})

async function roster(config: Partial<Config> = {}): Promise<Context> {
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(FIXTURES).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentPresets, {
    default: 'standard',
    roots: [],
    includeShippedRoot: false,
    includeUserRoot: true,
    ...config,
  })
  contexts.push(ctx)
  return ctx
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-snapshot-root-'))
  tempRoots.push(root)
  return root
}

async function seedPreset(root: string, id: string, composition: string): Promise<void> {
  const dir = join(root, id)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, COMPOSITION_FILE), composition)
}

function homeRoot(): string {
  return join(home, USER_ROOT_SEGMENT)
}

describe('in-flight root contributions cannot retarget one authoring call', () => {
  it('list and resolve stay live across separate calls', async () => {
    const contrib = await tempRoot()
    await seedPreset(contrib, 'late', SOURCE_B)
    const ctx = await roster()
    await seedPreset(homeRoot(), 'home', SOURCE_A)

    discoveryHarness.onDiscover = () => {
      ctx.agentPresets.registerRoot({ path: contrib, trust: 'system' })
    }

    const first = await ctx.agentPresets.list()
    expect(discoveryHarness.hookRuns).toBe(1)
    expect(first.map(preset => preset.id)).toEqual(['home'])

    discoveryHarness.onDiscover = undefined
    const second = await ctx.agentPresets.list()
    expect(second.map(preset => preset.id)).toEqual(['late', 'home'])
    expect((await ctx.agentPresets.resolve('late')).path).toBe(join(contrib, 'late', COMPOSITION_FILE))
  })

  it('copy writes to the captured first user root, not a contribution registered mid-scan', async () => {
    const contrib = await tempRoot()
    const ctx = await roster()
    await seedPreset(homeRoot(), 'from', SOURCE_A)

    discoveryHarness.onDiscover = (roots) => {
      expect(roots.map(root => root.path)).not.toContain(contrib)
      ctx.agentPresets.registerRoot({ path: contrib, trust: 'user' })
      expect(ctx.agentPresets.roots[0]?.path).toBe(contrib)
    }

    await ctx.agentPresets.copy('from', 'copied')

    expect(discoveryHarness.hookRuns).toBe(1)
    expect(discoveryHarness.calls).toBe(1)
    discoveryHarness.onDiscover = undefined
    expect(existsSync(join(homeRoot(), 'copied', COMPOSITION_FILE))).toBe(true)
    expect(existsSync(join(contrib, 'copied'))).toBe(false)
    expect((await ctx.agentPresets.list()).map(preset => preset.id).sort())
      .toEqual(['copied', 'from'])
  })

  it('copy still refuses an id that the captured list occupies after that root is disposed mid-scan', async () => {
    const contrib = await tempRoot()
    await seedPreset(contrib, 'taken', SOURCE_B)
    const ctx = await roster()
    await seedPreset(homeRoot(), 'from', SOURCE_A)
    const drop = ctx.agentPresets.registerRoot({ path: contrib, trust: 'user' })

    discoveryHarness.onDiscover = (roots) => {
      expect(roots.map(root => root.path)).toContain(contrib)
      drop()
      expect(ctx.agentPresets.roots.map(root => root.path)).not.toContain(contrib)
    }

    await expect(ctx.agentPresets.copy('from', 'taken')).rejects.toThrow(/already exists/)

    expect(discoveryHarness.hookRuns).toBe(1)
    expect(discoveryHarness.calls).toBe(1)
    discoveryHarness.onDiscover = undefined
    expect(existsSync(join(homeRoot(), 'taken'))).toBe(false)
    expect(existsSync(join(contrib, 'taken', COMPOSITION_FILE))).toBe(true)
  })

  it('copy keeps the source composition from the captured list', async () => {
    const contrib = await tempRoot()
    await seedPreset(contrib, 'from', SOURCE_B)
    const ctx = await roster()
    await seedPreset(homeRoot(), 'from', SOURCE_A)

    discoveryHarness.onDiscover = () => {
      ctx.agentPresets.registerRoot({ path: contrib, trust: 'system' })
      expect(ctx.agentPresets.roots[0]?.path).toBe(contrib)
    }

    await ctx.agentPresets.copy('from', 'copied')

    expect(discoveryHarness.hookRuns).toBe(1)
    expect(discoveryHarness.calls).toBe(1)
    discoveryHarness.onDiscover = undefined
    expect(await readFile(join(homeRoot(), 'copied', COMPOSITION_FILE), 'utf8')).toBe(SOURCE_A)
    expect(await ctx.agentPresets.read('from')).toBe(SOURCE_B)
  })

  it('remove deletes the captured directory when a same-id contribution appears mid-scan', async () => {
    const contrib = await tempRoot()
    await seedPreset(contrib, 'mine', SOURCE_B)
    const ctx = await roster()
    await seedPreset(homeRoot(), 'mine', SOURCE_A)

    discoveryHarness.onDiscover = () => {
      ctx.agentPresets.registerRoot({ path: contrib, trust: 'user' })
    }

    await ctx.agentPresets.remove('mine')

    expect(discoveryHarness.hookRuns).toBe(1)
    expect(discoveryHarness.calls).toBe(1)
    discoveryHarness.onDiscover = undefined
    expect(existsSync(join(homeRoot(), 'mine'))).toBe(false)
    expect(existsSync(join(contrib, 'mine', COMPOSITION_FILE))).toBe(true)
    expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['mine'])
  })

  it('remove still deletes under the captured writable root after that root is disposed mid-scan', async () => {
    const contrib = await tempRoot()
    await seedPreset(contrib, 'mine', SOURCE_A)
    const ctx = await roster()
    await seedPreset(homeRoot(), 'mine', SOURCE_B)
    const drop = ctx.agentPresets.registerRoot({ path: contrib, trust: 'user' })

    discoveryHarness.onDiscover = (roots) => {
      expect(roots[0]?.path).toBe(contrib)
      drop()
      expect(ctx.agentPresets.roots.map(root => root.path)).not.toContain(contrib)
    }

    await ctx.agentPresets.remove('mine')

    expect(discoveryHarness.hookRuns).toBe(1)
    expect(discoveryHarness.calls).toBe(1)
    discoveryHarness.onDiscover = undefined
    expect(existsSync(join(contrib, 'mine'))).toBe(false)
    expect(existsSync(join(homeRoot(), 'mine', COMPOSITION_FILE))).toBe(true)
  })

  it('readDocument returns the captured composition when a same-id contribution appears mid-scan', async () => {
    const contrib = await tempRoot()
    await seedPreset(contrib, 'doc', SOURCE_B)
    const ctx = await roster()
    await seedPreset(homeRoot(), 'doc', SOURCE_A)

    discoveryHarness.onDiscover = () => {
      ctx.agentPresets.registerRoot({ path: contrib, trust: 'system' })
    }

    const document = await ctx.agentPresets.readDocument('doc')

    expect(discoveryHarness.hookRuns).toBe(1)
    expect(discoveryHarness.calls).toBe(1)
    discoveryHarness.onDiscover = undefined
    expect(document).toMatchObject({ agentPreset: 'doc', trust: 'user', content: SOURCE_A })
    expect(await ctx.agentPresets.read('doc')).toBe(SOURCE_B)
  })
})
