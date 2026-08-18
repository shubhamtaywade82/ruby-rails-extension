import { describe, it, expect, vi, afterEach } from 'vitest'
import { RailsAgent } from '../src/agent/RailsAgent'
import { SchemaIndexer } from '../src/rails/SchemaIndexer'
import { RoutesIndexer } from '../src/rails/RoutesIndexer'

function buildAgent(overrides: Partial<ConstructorParameters<typeof RailsAgent>[2]>): RailsAgent {
  return new RailsAgent(new SchemaIndexer(), new RoutesIndexer(), {
    ollamaHost: 'http://localhost:11434',
    model: 'qwen2.5-coder:14b',
    ...overrides,
  })
}

describe('RailsAgent provider dispatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the Ollama OpenAI-compatible endpoint by default, with no Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ollama reply' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({})
    const result = await agent.run('hello', {})

    expect(result).toEqual({ success: true, response: 'ollama reply', iterations: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('calls OpenAI with a Bearer token when provider is openai and a key is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'openai reply' } }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({ provider: 'openai', openaiModel: 'gpt-4o-mini', getApiKey: async () => 'sk-test' })
    const result = await agent.run('hello', {})

    expect(result).toEqual({ success: true, response: 'openai reply', iterations: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect(JSON.parse(init.body as string).model).toBe('gpt-4o-mini')
  })

  it('fails clearly when provider is openai and no key is configured, without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({ provider: 'openai', getApiKey: async () => undefined })
    const result = await agent.run('hello', {})

    expect(result.success).toBe(false)
    expect(result.response).toContain('No OpenAI API key configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls Anthropic Messages API with x-api-key and extracts the text content block', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'claude reply' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({ provider: 'anthropic', anthropicModel: 'claude-sonnet-4-5', getApiKey: async () => 'anthropic-key' })
    const result = await agent.run('hello', {})

    expect(result).toEqual({ success: true, response: 'claude reply', iterations: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const headers = init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('anthropic-key')
    expect(headers['anthropic-version']).toBeTruthy()
    expect(JSON.parse(init.body as string).model).toBe('claude-sonnet-4-5')
  })

  it('healthCheck reports true for a cloud provider only when a key is configured, without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const withKey = buildAgent({ provider: 'anthropic', getApiKey: async () => 'key' })
    const withoutKey = buildAgent({ provider: 'anthropic', getApiKey: async () => undefined })

    expect(await withKey.healthCheck()).toBe(true)
    expect(await withoutKey.healthCheck()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
