import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { bindScopeParent, createScope } from '@deepseek-ai/dsh-scope'
import type { Scope } from '@deepseek-ai/dsh-scope'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { TOOL_ORDER_REST } from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, {
  defineTool,
  type ModelToolSurface,
  type PreToolDecision,
  type ToolDefinition,
  type ToolExecution,
} from '@deepseek-ai/dsh-tools'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import type { SessionId } from '@deepseek-ai/dsh-session'

const testToolSignal = new AbortController().signal

async function mount(toolOrder?: string[]): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, { ...toolOrder ? { toolOrder } : {} })
  await ctx.plugin(ToolRuntime)
  return ctx
}

async function mintAgentScope(ctx: Context, name = 'surface-agent'): Promise<{ scope: Scope; key: Agent }> {
  const key = { id: name as SessionId } as Agent
  let scope!: Scope
  await ctx.plugin(Object.assign((inner: Context) => { scope = createScope(inner, key) },
    { inject: ['tools', 'systemPrompt'] }))
  return { scope, key }
}

function echo(name = 'echo', reply = `ran:${name}`): ToolDefinition {
  return defineTool({
    name,
    description: `tool ${name}`,
    parameters: { text: { type: 'string' } },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    execute(args) {
      return Promise.resolve(`${reply}:${args.text ?? ''}`)
    },
  })
}

function aliasSurface(
  mapping: Record<string, string | undefined>,
  descriptions: Record<string, string> = {},
  id = 'alias',
): ModelToolSurface {
  return {
    id,
    project(schema) {
      if (!Object.hasOwn(mapping, schema.name)) {
        return { exposedName: schema.name }
      }
      const exposedName = mapping[schema.name]
      if (exposedName === undefined) return undefined
      return {
        exposedName,
        ...Object.hasOwn(descriptions, schema.name) ? { description: descriptions[schema.name] } : {},
      }
    },
  }
}

async function run(
  ctx: Context,
  name: string,
  args: unknown = {},
  agent?: Agent,
  signal: AbortSignal = testToolSignal,
): Promise<{ result: Awaited<ReturnType<ToolRuntime['execute']>>; exec?: ToolExecution }> {
  let exec: ToolExecution | undefined
  const dispose = ctx.on('tools/result', (observed) => { exec = observed })
  try {
    const result = await ctx.tools.execute({
      signal,
      callId: ToolCallId('c1'),
      name,
      arguments: args,
      ...agent ? { agent } : {},
    })
    return { result, exec }
  } finally {
    dispose()
  }
}

describe('ModelToolSurface identity default', () => {
  it('keeps schemas, assembly, and execute identical when no surface is declared', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { key } = await mintAgentScope(ctx)

    expect(ctx.tools.schemas()).toEqual([{
      name: 'echo',
      description: 'tool echo',
      parameters: { type: 'object', properties: { text: { type: 'string' } } },
    }])
    expect(ctx.tools.schemas(key)).toEqual(ctx.tools.schemas())
    expect((await ctx.systemPrompt.assemble({ scope: key })).tools.map(tool => tool.name)).toEqual(['echo'])

    const { result, exec } = await run(ctx, 'echo', { text: 'hi' }, key)
    expect(result).toEqual({
      content: [{ type: 'text', text: 'ran:echo:hi' }],
      isError: false,
      value: 'ran:echo:hi',
    })
    expect(exec?.name).toBe('echo')
    expect(exec?.requestedName).toBeUndefined()
    expect(exec?.arguments).toEqual({ text: 'hi' })
  })

  it('treats an explicit identity project as equal to no surface', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    const without = ctx.tools.schemas(key)
    const assemblyWithout = await ctx.systemPrompt.assemble({ scope: key })
    scope.ctx.tools.registerSurface({
      id: 'identity',
      project: schema => ({ exposedName: schema.name }),
    })
    expect(ctx.tools.schemas(key)).toEqual(without)
    expect((await ctx.systemPrompt.assemble({ scope: key })).tools).toEqual(assemblyWithout.tools)
    const { result, exec } = await run(ctx, 'echo', { text: 'x' }, key)
    expect(result.isError).toBe(false)
    expect(exec?.name).toBe('echo')
    expect(exec?.requestedName).toBeUndefined()
  })
})

describe('ModelToolSurface projection and reverse resolution', () => {
  it('exposes the alias, executes the canonical tool once, and preserves arguments', async () => {
    const ctx = await mount()
    const args: unknown[] = []
    ctx.tools.register(defineTool({
      name: 'echo',
      description: 'tool echo',
      parameters: { text: { type: 'string', required: true } },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute(received) {
        args.push(received)
        return Promise.resolve(received.text)
      },
    }))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface(
      { echo: 'ping' },
      { echo: 'exposed ping' },
    ))

    expect(ctx.tools.schemas(key)).toEqual([{
      name: 'ping',
      description: 'exposed ping',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    }])
    expect(ctx.tools.schemas().map(tool => tool.name)).toEqual(['echo'])
    expect((await ctx.systemPrompt.assemble({ scope: key })).tools.map(tool => tool.name)).toEqual(['ping'])
    expect(ctx.tools.get('echo', key)?.name).toBe('echo')
    expect(ctx.tools.get('ping', key)).toBeUndefined()

    const names: string[] = []
    ctx.on('tools/pre-execute', (exec: ToolExecution, next: () => Promise<PreToolDecision>) => {
      names.push(exec.name)
      return next()
    })
    const { result, exec } = await run(ctx, 'ping', { text: 'hi' }, key)
    expect(args).toEqual([{ text: 'hi' }])
    expect(names).toEqual(['echo'])
    expect(exec?.name).toBe('echo')
    expect(exec?.requestedName).toBe('ping')
    expect(exec?.arguments).toEqual({ text: 'hi' })
    expect(result).toEqual({
      content: [{ type: 'text', text: 'hi' }],
      isError: false,
      value: 'hi',
    })
  })

  it('does not execute a renamed tool under its canonical name', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: 'ping' }))
    const { result } = await run(ctx, 'echo', {}, key)
    expect(result.isError).toBe(true)
    expect(result.error?.info).toEqual({ name: 'ToolNotFoundError', code: 'UNKNOWN_TOOL' })
  })

  it('restores identity when the surface is disposed', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    const lift = scope.ctx.tools.registerSurface(aliasSurface({ echo: 'ping' }))
    expect(ctx.tools.schemas(key).map(tool => tool.name)).toEqual(['ping'])
    lift()
    expect(ctx.tools.schemas(key).map(tool => tool.name)).toEqual(['echo'])
    const { result } = await run(ctx, 'echo', { text: 'back' }, key)
    expect(result.isError).toBe(false)
  })

  it('unwinds with the declaring plugin fiber', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    const plugin = Object.assign((inner: Context) => {
      inner.tools.registerSurface(aliasSurface({ echo: 'ping' }))
    }, { inject: ['tools'] as const })
    const fiber = await scope.ctx.plugin(plugin)
    expect(ctx.tools.schemas(key).map(tool => tool.name)).toEqual(['ping'])
    await fiber.dispose()
    expect(ctx.tools.schemas(key).map(tool => tool.name)).toEqual(['echo'])
  })

  it('lets the nearest scope win and refuses a second declaration', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope: parent, key: parentKey } = await mintAgentScope(ctx, 'parent')
    const childKey = { id: 'child' as SessionId } as Agent
    bindScopeParent(childKey, parentKey)
    let child!: Scope
    await ctx.plugin(Object.assign((inner: Context) => { child = createScope(inner, childKey) },
      { inject: ['tools', 'systemPrompt'] }))

    parent.ctx.tools.registerSurface(aliasSurface({ echo: 'from-parent' }, {}, 'parent-surface'))
    expect(ctx.tools.schemas(childKey).map(tool => tool.name)).toEqual(['from-parent'])
    child.ctx.tools.registerSurface(aliasSurface({ echo: 'from-child' }, {}, 'child-surface'))
    expect(ctx.tools.schemas(childKey).map(tool => tool.name)).toEqual(['from-child'])
    expect(ctx.tools.schemas(parentKey).map(tool => tool.name)).toEqual(['from-parent'])
    expect(() => child.ctx.tools.registerSurface(aliasSurface({ echo: 'other' }, {}, 'other')))
      .toThrow(/conflicts with "child-surface"/)
  })

  it('refuses an unscoped declaration', async () => {
    const ctx = await mount()
    expect(() => ctx.tools.registerSurface(aliasSurface({ echo: 'ping' })))
      .toThrow('requires a scoped context')
  })

  it('keeps toolOrder matching canonical names and rewrites after ordering', async () => {
    const ctx = await mount(['echo', TOOL_ORDER_REST, 'zeta'])
    ctx.tools.register(echo('zeta'))
    ctx.tools.register(echo('echo'))
    ctx.tools.register(echo('mid'))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: 'ping', zeta: 'last', mid: 'middle' }))
    expect((await ctx.systemPrompt.assemble({ scope: key })).tools.map(tool => tool.name))
      .toEqual(['ping', 'middle', 'last'])
  })
})

describe('ModelToolSurface fail-closed mapping', () => {
  it('rejects duplicate exposed names at projection time', async () => {
    const ctx = await mount()
    ctx.tools.register(echo('alpha'))
    ctx.tools.register(echo('beta'))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ alpha: 'shared', beta: 'shared' }))
    expect(() => ctx.tools.schemas(key)).toThrow(/same exposed name "shared"/)
    await expect(ctx.systemPrompt.assemble({ scope: key })).rejects.toThrow(/same exposed name "shared"/)
    await expect(run(ctx, 'shared', {}, key)).rejects.toThrow(/same exposed name "shared"/)
  })

  it('rejects an empty exposed name', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: '' }))
    expect(() => ctx.tools.schemas(key)).toThrow(/empty exposed name/)
  })

  it('rejects exposing a non-transport tool as run_code', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: 'run_code' }))
    expect(() => ctx.tools.schemas(key)).toThrow(/reserved name "run_code"/)
  })

  it('wraps a throwing project() at projection time', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface({
      id: 'boom',
      project() {
        throw new Error('nope')
      },
    })
    expect(() => ctx.tools.schemas(key)).toThrow(/project\(\) failed for "echo": nope/)
  })

  it('rejects an exposed name that another tool provider already contributed', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    ctx.systemPrompt.tools(() => ({
      schemas: [{ name: 'ping', description: 'foreign', parameters: { type: 'object', properties: {} } }],
    }))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: 'ping' }))
    await expect(ctx.systemPrompt.assemble({ scope: key }))
      .rejects.toThrow(/another tool provider already contributed/)
  })

  it('keeps a foreign provider tool whose name does not collide', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    ctx.systemPrompt.tools(() => ({
      schemas: [{ name: 'other', description: 'foreign', parameters: { type: 'object', properties: {} } }],
    }))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: 'ping' }))
    expect((await ctx.systemPrompt.assemble({ scope: key })).tools.map(tool => tool.name))
      .toEqual(['ping', 'other'])
  })

  it('hides a tool whose project returns undefined', async () => {
    const ctx = await mount()
    ctx.tools.register(echo('keep'))
    ctx.tools.register(echo('secret'))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ secret: undefined }))
    expect(ctx.tools.schemas(key).map(tool => tool.name)).toEqual(['keep'])
    expect((await ctx.systemPrompt.assemble({ scope: key })).tools.map(tool => tool.name)).toEqual(['keep'])
    expect(ctx.tools.get('secret', key)?.name).toBe('secret')
    const hidden = await run(ctx, 'secret', {}, key)
    expect(hidden.result.isError).toBe(true)
    expect(hidden.result.error?.info?.code).toBe('UNKNOWN_TOOL')
    const aliasedCanonical = await run(ctx, 'secret', {}, key)
    expect(aliasedCanonical.result.isError).toBe(true)
  })

  it('does not resolve a restricted tool through an alias', async () => {
    const ctx = await mount()
    ctx.tools.register(echo('open'))
    ctx.tools.register(echo('denied'))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.restrict({ deny: ['denied'] })
    scope.ctx.tools.registerSurface({
      id: 'try-denied',
      project(schema) {
        return { exposedName: schema.name === 'denied' ? 'leaked' : schema.name }
      },
    })
    expect(ctx.tools.schemas(key).map(tool => tool.name)).toEqual(['open'])
    const { result } = await run(ctx, 'leaked', {}, key)
    expect(result.isError).toBe(true)
    expect(result.error?.info?.code).toBe('UNKNOWN_TOOL')
    const canonical = await run(ctx, 'denied', {}, key)
    expect(canonical.result.isError).toBe(true)
  })
})

describe('ModelToolSurface concurrency and cancellation', () => {
  it('classifies through the canonical definition for an alias', async () => {
    const ctx = await mount()
    ctx.tools.register(defineTool({
      name: 'safe',
      description: 'safe',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      isConcurrencySafe: () => true,
      execute: () => Promise.resolve('ok'),
    }))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ safe: 'looks-mutating' }))
    expect(ctx.tools.executionMode({
      callId: ToolCallId('c1'),
      name: 'looks-mutating',
      arguments: {},
      agent: key,
      signal: testToolSignal,
    })).toEqual({ kind: 'parallel' })
    expect(ctx.tools.executionMode({
      callId: ToolCallId('c2'),
      name: 'safe',
      arguments: {},
      agent: key,
      signal: testToolSignal,
    })).toEqual({ kind: 'exclusive' })
  })

  it('returns ABORTED_BEFORE_DISPATCH when the alias is cancelled before the body', async () => {
    const ctx = await mount()
    ctx.tools.register(echo())
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: 'ping' }))
    const controller = new AbortController()
    controller.abort()
    const { result, exec } = await run(ctx, 'ping', {}, key, controller.signal)
    expect(result.error?.info?.code).toBe('ABORTED_BEFORE_DISPATCH')
    expect(exec?.name).toBe('echo')
    expect(exec?.requestedName).toBe('ping')
  })

  it('returns ABORTED when cancellation overtakes a started alias call', async () => {
    const ctx = await mount()
    const entered = Promise.withResolvers<undefined>()
    const release = Promise.withResolvers<string>()
    ctx.tools.register(defineTool({
      name: 'echo',
      description: 'echo',
      parameters: {},
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      execute() {
        entered.resolve(undefined)
        return release.promise
      },
    }))
    const { scope, key } = await mintAgentScope(ctx)
    scope.ctx.tools.registerSurface(aliasSurface({ echo: 'ping' }))
    const controller = new AbortController()
    const pending = run(ctx, 'ping', {}, key, controller.signal)
    await entered.promise
    controller.abort()
    release.resolve('done')
    const { result, exec } = await pending
    expect(result.error?.info?.code).toBe('ABORTED')
    expect(exec?.name).toBe('echo')
    expect(exec?.requestedName).toBe('ping')
  })
})
