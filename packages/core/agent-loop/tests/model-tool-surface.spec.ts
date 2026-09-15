/**
 * Scripted loop proof: the model calls an exposed alias, one canonical tool
 * runs through the normal pipeline, and the request header records the alias.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId, foldRequestHeader } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime, { defineContentToolFixture, type ToolExecution } from '@deepseek-ai/dsh-tools'
import AgentRegistry, { type Agent } from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { MockAdapter, textResponse, toolCallResponse } from './mock-adapter.ts'

function waitForIdle(ctx: Context, agent: Agent): Promise<void> {
  return new Promise((resolve) => {
    const dispose = ctx.on('agent/status', ({ agent: subject, status }) => {
      if (subject === agent && status === 'idle') {
        dispose()
        resolve()
      }
    })
  })
}

async function harness(adapter: MockAdapter): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter(['mock'], adapter)
  return ctx
}

describe('model tool surface through the agent loop', () => {
  it('executes one canonical tool when the model calls the exposed alias', async () => {
    const adapter = new MockAdapter([
      toolCallResponse('c1', 'ping', { text: 'hi' }, 'calling ping'),
      textResponse('done'),
    ])
    const ctx = await harness(adapter)
    const bodies: unknown[] = []
    const pipelineNames: string[] = []
    ctx.tools.register(defineContentToolFixture({
      name: 'echo',
      description: 'echo back',
      parameters: { text: { type: 'string' } },
      async execute(args) {
        bodies.push(args)
        return [{ type: 'text', text: `echo:${args.text}` }]
      },
    }))
    ctx.on('tools/pre-execute', (exec: ToolExecution, next) => {
      pipelineNames.push(exec.name)
      return next()
    })
    const agent = await ctx.agentLoop.create(SessionId('surface-loop'), {
      provider: 'mock',
      model: 'mock',
    })
    agent.ctx.tools.registerSurface({
      id: 'loop-alias',
      project: schema => schema.name === 'echo' ? { exposedName: 'ping' } : { exposedName: schema.name },
    })

    agent.followup(createUserMessage({ content: [{ type: 'text', text: 'use ping' }], source: { kind: 'user' } }))
    await waitForIdle(ctx, agent)

    expect(bodies).toEqual([{ text: 'hi' }])
    expect(pipelineNames).toEqual(['echo'])
    expect(adapter.requests).toHaveLength(2)
    expect(adapter.requests[0]?.tools?.map(tool => tool.name)).toEqual(['ping'])
    expect(adapter.requests[0]?.tools?.[0]?.parameters).toEqual({
      type: 'object',
      properties: { text: { type: 'string' } },
    })

    const events = agent.session.snapshotEvents()
    const header = foldRequestHeader(events)
    expect(header?.tools?.map(tool => tool.name)).toEqual(['ping'])
    expect(structuredClone(adapter.requests[0]?.tools ?? [])).toEqual(structuredClone(header?.tools ?? []))

    const call = events.find(event => event.type === 'tool/call')
    expect(call?.type === 'tool/call' && call.data.name).toBe('ping')
    expect(call?.type === 'tool/call' && call.data.arguments).toBe('{"text":"hi"}')
    const resultEvent = events.find(event => event.type === 'tool/result')
    expect(resultEvent?.type === 'tool/result').toBe(true)
    if (resultEvent?.type !== 'tool/result') throw new Error('expected tool/result')
    const toolResultBlock = resultEvent.data.message.content[0]
    expect(toolResultBlock).toMatchObject({ type: 'tool-result', isError: false })
    expect(toolResultBlock.type === 'tool-result' ? toolResultBlock.content : undefined).toEqual([
      { type: 'text', text: 'echo:hi' },
    ])
    const secondMessages = adapter.requests[1]?.messages ?? []
    const toolResultMessage = secondMessages.find(message =>
      message.content.some(block => block.type === 'tool-result'))
    expect(toolResultMessage).toBeDefined()
    const block = toolResultMessage!.content.find(item => item.type === 'tool-result')!
    expect(block).toMatchObject({ toolCallId: 'c1', isError: false })
    expect(block.content).toEqual([{ type: 'text', text: 'echo:hi' }])
  })
})
