/**
 * Package-contributed preset roots are a live slot on the existing roster,
 * not a second registry: `$DSH_HOME` is isolated because the derived user
 * root is still resolved in the constructor when `includeUserRoot` is left on.
 */

import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import Group from '@deepseek-ai/cordis-plugin-group'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import AgentPresets, {
  COMPOSITION_FILE, SHIPPED_PRESET_ROOT, type Config, type PresetRoot,
} from '@deepseek-ai/dsh-agent-presets'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const SYSTEM_ROOT = join(FIXTURES, 'system')
const USER_ROOT = join(FIXTURES, 'user')
const CONTRIBUTE_PLUGIN = join(FIXTURES, 'plugins', 'contribute.js')
const USER_ROOT_SEGMENT = '.agent-presets'
const EMPTY = '[]\n'

let home: string
let previousHome: string | undefined
const contexts: Context[] = []
const tempRoots: string[] = []

beforeEach(async () => {
  previousHome = process.env.DSH_HOME
  home = await mkdtemp(join(tmpdir(), 'dsh-contrib-home-'))
  process.env.DSH_HOME = home
})

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(home, { recursive: true, force: true })
  for (const root of tempRoots.splice(0)) await rm(root, { recursive: true, force: true })
})

/** Boot a roster without the full agent stack. */
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
    includeUserRoot: false,
    ...config,
  })
  contexts.push(ctx)
  return ctx
}

/** Boot registries a contributed preset can actually mount into. */
async function harness(config: Partial<Config> = {}): Promise<Context> {
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(FIXTURES).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  ctx.loader.builtins.group = Group
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt, { personaPrefix: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(AgentPresets, {
    default: 'standard',
    roots: [],
    includeShippedRoot: false,
    includeUserRoot: false,
    ...config,
  })
  contexts.push(ctx)
  return ctx
}

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-contrib-root-'))
  tempRoots.push(root)
  return root
}

async function seedPreset(root: string, id: string, composition = EMPTY): Promise<string> {
  const dir = join(root, id)
  await mkdir(dir, { recursive: true })
  const path = join(dir, COMPOSITION_FILE)
  await writeFile(path, composition)
  return path
}

function toolComposition(tool: string): string {
  return `- id: only\n  name: ${CONTRIBUTE_PLUGIN}\n  config:\n    tool: ${tool}\n`
}

const toolNames = (ctx: Context, agent?: Agent): string[] =>
  ctx.tools.schemas(agent).map(schema => schema.name).sort()

async function agentOn(ctx: Context, id: string, presetId?: string): Promise<Agent> {
  const handle = await ctx.agents.create({
    sessionId: SessionId(id),
    setup: async (agentCtx: Context) => void await ctx.agentPresets.mount(agentCtx, presetId),
  })
  return handle.agent
}

function contributePlugin(name: string) {
  return {
    name,
    inject: ['agentPresets'] as const,
    apply(ctx: Context, config: PresetRoot) {
      ctx.agentPresets.registerRoot({ path: config.path, trust: config.trust })
    },
  }
}

describe('package-contributed preset roots', () => {
  it('leaves the derived root list unchanged when nothing has registered', async () => {
    const ctx = await roster({
      includeShippedRoot: true,
      includeUserRoot: true,
      roots: [{ path: SYSTEM_ROOT, trust: 'system' }],
    })

    expect(ctx.agentPresets.roots.map(root => root.path)).toEqual([
      SHIPPED_PRESET_ROOT,
      SYSTEM_ROOT,
      join(home, USER_ROOT_SEGMENT),
    ])
    expect(ctx.agentPresets.roots.map(root => root.trust)).toEqual(['system', 'system', 'user'])
  })

  it('discovers one contributed root through list and resolve', async () => {
    const root = await tempRoot()
    const path = await seedPreset(root, 'alpha')
    const ctx = await roster()
    ctx.agentPresets.registerRoot({ path: root, trust: 'system' })

    const listed = await ctx.agentPresets.list()
    expect(listed).toEqual([expect.objectContaining({ id: 'alpha', trust: 'system', path })])
    expect(await ctx.agentPresets.resolve('alpha')).toMatchObject({ id: 'alpha', path })
  })

  it('keeps multiple contributed roots in registration order', async () => {
    const first = await tempRoot()
    const second = await tempRoot()
    await seedPreset(first, 'first')
    await seedPreset(second, 'second')
    const ctx = await roster()
    ctx.agentPresets.registerRoot({ path: first, trust: 'system' })
    ctx.agentPresets.registerRoot({ path: second, trust: 'system' })

    expect(ctx.agentPresets.roots.map(root => root.path)).toEqual([first, second])
    expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['first', 'second'])
  })

  it('lets an earlier contribution win a duplicate id', async () => {
    const first = await tempRoot()
    const second = await tempRoot()
    const winner = await seedPreset(first, 'twin')
    await seedPreset(second, 'twin')
    const ctx = await roster()
    ctx.agentPresets.registerRoot({ path: first, trust: 'system' })
    ctx.agentPresets.registerRoot({ path: second, trust: 'user' })

    const twin = await ctx.agentPresets.resolve('twin')
    expect(twin.path).toBe(winner)
    expect(twin.trust).toBe('system')
  })

  it('lets the shipped root beat a contributed duplicate id', async () => {
    const root = await tempRoot()
    await seedPreset(root, 'standard')
    const ctx = await roster({ includeShippedRoot: true })
    ctx.agentPresets.registerRoot({ path: root, trust: 'user' })

    const standard = await ctx.agentPresets.resolve('standard')
    expect(standard.path.startsWith(SHIPPED_PRESET_ROOT)).toBe(true)
    expect(standard.trust).toBe('system')
  })

  it('lets a configured root beat a contributed duplicate id', async () => {
    const root = await tempRoot()
    await seedPreset(root, 'standard')
    const ctx = await roster({ roots: [{ path: SYSTEM_ROOT, trust: 'system' }] })
    ctx.agentPresets.registerRoot({ path: root, trust: 'user' })

    const standard = await ctx.agentPresets.resolve('standard')
    expect(standard.path.startsWith(SYSTEM_ROOT)).toBe(true)
    expect(standard.trust).toBe('system')
  })

  it('lets a contribution beat the derived user root on a duplicate id', async () => {
    const root = await tempRoot()
    const winner = await seedPreset(root, 'mine')
    await mkdir(join(home, USER_ROOT_SEGMENT, 'mine'), { recursive: true })
    await writeFile(join(home, USER_ROOT_SEGMENT, 'mine', COMPOSITION_FILE), EMPTY)
    const ctx = await roster({ includeUserRoot: true })
    ctx.agentPresets.registerRoot({ path: root, trust: 'system' })

    const mine = await ctx.agentPresets.resolve('mine')
    expect(mine.path).toBe(winner)
    expect(mine.trust).toBe('system')
  })

  it('places contributed roots after configured roots and before the user root', async () => {
    const contributed = await tempRoot()
    const ctx = await roster({
      includeShippedRoot: true,
      includeUserRoot: true,
      roots: [{ path: SYSTEM_ROOT, trust: 'system' }],
    })
    ctx.agentPresets.registerRoot({ path: contributed, trust: 'system' })

    expect(ctx.agentPresets.roots.map(root => root.path)).toEqual([
      SHIPPED_PRESET_ROOT,
      SYSTEM_ROOT,
      contributed,
      join(home, USER_ROOT_SEGMENT),
    ])
  })

  it('removes only the disposed contribution', async () => {
    const first = await tempRoot()
    const second = await tempRoot()
    await seedPreset(first, 'keep-me')
    await seedPreset(second, 'drop-me')
    const ctx = await roster()
    ctx.agentPresets.registerRoot({ path: first, trust: 'system' })
    const drop = ctx.agentPresets.registerRoot({ path: second, trust: 'system' })

    drop()
    drop()

    expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['keep-me'])
    expect(ctx.agentPresets.roots.map(root => root.path)).toEqual([first])
  })

  it('does not splice another contribution when the disposer runs after the fiber already unregistered', async () => {
    const first = await tempRoot()
    const second = await tempRoot()
    await seedPreset(first, 'keep-me')
    await seedPreset(second, 'drop-me')
    const ctx = await roster()
    ctx.agentPresets.registerRoot({ path: first, trust: 'system' })
    let drop: () => void = () => undefined
    const fiber = await ctx.plugin({
      name: 'contribute-then-dispose',
      inject: ['agentPresets'],
      apply(pluginCtx: Context) {
        drop = pluginCtx.agentPresets.registerRoot({ path: second, trust: 'system' })
      },
    })

    await fiber.dispose()
    drop()

    expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['keep-me'])
    expect(ctx.agentPresets.roots.map(root => root.path)).toEqual([first])
  })

  it('unregisters automatically when the calling plugin fiber disposes', async () => {
    const root = await tempRoot()
    await seedPreset(root, 'ephemeral')
    const ctx = await roster()
    const fiber = await ctx.plugin({
      name: 'contribute-ephemeral',
      inject: ['agentPresets'],
      apply(pluginCtx: Context) {
        pluginCtx.agentPresets.registerRoot({ path: root, trust: 'system' })
      },
    })

    expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['ephemeral'])
    await fiber.dispose()
    expect(await ctx.agentPresets.list()).toEqual([])
  })

  it('survives repeated register and dispose cycles on the same plugin', async () => {
    const root = await tempRoot()
    await seedPreset(root, 'cycle')
    const ctx = await roster()
    const plugin = {
      name: 'contribute-cycle',
      inject: ['agentPresets'] as const,
      apply(pluginCtx: Context) {
        pluginCtx.agentPresets.registerRoot({ path: root, trust: 'system' })
      },
    }

    for (let round = 0; round < 3; round += 1) {
      const fiber = await ctx.plugin(plugin)
      expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['cycle'])
      await fiber.dispose()
      expect(await ctx.agentPresets.list()).toEqual([])
    }
  })

  it('sees a filesystem change on the next list without restarting', async () => {
    const root = await tempRoot()
    const ctx = await roster()
    ctx.agentPresets.registerRoot({ path: root, trust: 'system' })

    expect(await ctx.agentPresets.list()).toEqual([])
    const path = await seedPreset(root, 'late')
    expect(await ctx.agentPresets.list()).toEqual([
      expect.objectContaining({ id: 'late', path }),
    ])
  })

  it('lists a broken contributed preset instead of skipping it', async () => {
    const root = await tempRoot()
    await mkdir(join(root, 'ghost'))
    const ctx = await roster()
    ctx.agentPresets.registerRoot({ path: root, trust: 'system' })

    const ghost = (await ctx.agentPresets.list()).find(preset => preset.id === 'ghost')
    expect(ghost?.broken).toMatch(/missing/)
    expect(await ctx.agentPresets.resolve('ghost')).toMatchObject({ id: 'ghost' })
  })

  it('does not steal authoring when the contribution is system-trusted', async () => {
    const contributed = await tempRoot()
    await seedPreset(contributed, 'source')
    const ctx = await roster({ includeUserRoot: true })
    ctx.agentPresets.registerRoot({ path: contributed, trust: 'system' })

    expect(ctx.agentPresets.authorable).toBe(true)
    await ctx.agentPresets.copy('source', 'copied')
    expect(existsSync(join(home, USER_ROOT_SEGMENT, 'copied', COMPOSITION_FILE))).toBe(true)
    expect(existsSync(join(contributed, 'copied'))).toBe(false)
  })

  it('makes a contributed user root the writable root when it precedes the home root', async () => {
    const contributed = await tempRoot()
    await seedPreset(contributed, 'source')
    const ctx = await roster({ includeUserRoot: true })
    ctx.agentPresets.registerRoot({ path: contributed, trust: 'user' })

    await ctx.agentPresets.copy('source', 'copied')
    expect(existsSync(join(contributed, 'copied', COMPOSITION_FILE))).toBe(true)
    expect(existsSync(join(home, USER_ROOT_SEGMENT, 'copied'))).toBe(false)
  })
})

describe('contributed roots through real Loader composition', () => {
  it('registers two yaml plugins in profile order and unloads one independently', async () => {
    const first = await tempRoot()
    const second = await tempRoot()
    await seedPreset(first, 'from-a')
    await seedPreset(second, 'from-b')
    const configDir = await tempRoot()
    const configPath = join(configDir, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@deepseek-ai/dsh-session-projection'",
      "- name: '@deepseek-ai/dsh-agent-presets'",
      '  config:',
      '    default: standard',
      '    includeShippedRoot: false',
      '    includeUserRoot: false',
      '    roots: []',
      '- name: contribute-root-a',
      '  config:',
      `    path: ${JSON.stringify(first)}`,
      '    trust: system',
      '- name: contribute-root-b',
      '  config:',
      `    path: ${JSON.stringify(second)}`,
      '    trust: system',
      '',
    ].join('\n'))

    const ctx = new Context()
    ctx.baseUrl = pathToFileURL(configDir).href + '/'
    await ctx.plugin(Loader)
    ctx.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
      ['@deepseek-ai/dsh-agent-presets', AgentPresets],
      ['contribute-root-a', contributePlugin('contribute-root-a')],
      ['contribute-root-b', contributePlugin('contribute-root-b')],
    ])
    ctx.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof ctx.loader.internal>
    await ctx.loader.create({
      name: 'cordis:include',
      config: { path: pathToFileURL(configPath).href },
    })
    await ctx.loader.await()
    contexts.push(ctx)

    expect([...ctx.loader.entries()].filter(entry => entry.fiber === undefined && !entry.disabled)).toEqual([])
    expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['from-a', 'from-b'])

    const entryA = [...ctx.loader.entries()].find(entry => entry.options.name === 'contribute-root-a')
    expect(entryA?.fiber).toBeDefined()
    await entryA!.fiber!.dispose()

    expect((await ctx.agentPresets.list()).map(preset => preset.id)).toEqual(['from-b'])
    expect(ctx.agentPresets.roots.map(root => root.path)).toEqual([second])
  })
})

describe('standing mounts after a contribution is removed', () => {
  it('keeps a joined agent and composeFrom on the live generation', async () => {
    const root = await tempRoot()
    await seedPreset(root, 'live', toolComposition('live-tool'))
    const ctx = await harness()
    const drop = ctx.agentPresets.registerRoot({ path: root, trust: 'system' })
    const parent = await agentOn(ctx, 'sess-contrib-parent', 'live')
    expect(toolNames(ctx, parent)).toEqual(['live-tool'])

    drop()
    await expect(ctx.agentPresets.resolve('live')).rejects.toThrow(/not found/)
    expect(toolNames(ctx, parent)).toEqual(['live-tool'])

    const child = (await ctx.agents.create({
      sessionId: SessionId('sess-contrib-child'),
      setup: (childCtx: Context) => void ctx.agentPresets.composeFrom(childCtx, parent.ctx),
    })).agent
    expect(ctx.agentPresets.composedPreset(child.ctx)).toBe('live')
    expect(toolNames(ctx, child)).toEqual(['live-tool'])
  })

  it('still refuses a contributed preset that publishes into the root realm', async () => {
    const ctx = await harness()
    ctx.agentPresets.registerRoot({ path: USER_ROOT, trust: 'system' })

    await expect(agentOn(ctx, 'sess-contrib-leaky', 'leaky'))
      .rejects.toThrow(/process-global service\(s\) \[aaaFixtureLeakedSvc, zzzFixtureLeakedSvc\]/)
    expect(ctx.agents.get(SessionId('sess-contrib-leaky'))).toBeUndefined()
  })
})
