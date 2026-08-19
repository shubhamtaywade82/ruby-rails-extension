import { existsSync } from 'fs'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { RailsAgent } from '../src/agent/RailsAgent'
import { SchemaIndexer } from '../src/rails/SchemaIndexer'
import { RoutesIndexer } from '../src/rails/RoutesIndexer'
import { cassetteFetch, cassettePath } from './support/cassette'

function buildAgent(overrides: Partial<ConstructorParameters<typeof RailsAgent>[2]>): RailsAgent {
  return new RailsAgent(new SchemaIndexer(), new RoutesIndexer(), {
    ollamaHost: 'http://localhost:11434',
    model: 'qwen2.5-coder:14b',
    ...overrides,
  })
}

const OLLAMA_CASSETTE = 'rails-agent-ollama-chat'
const ANTHROPIC_CASSETTE = 'rails-agent-anthropic-message'
const hasAnthropicCassette = existsSync(cassettePath(ANTHROPIC_CASSETTE))

describe('RailsAgent provider dispatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls Ollama via @nemesis-oss/ollama-sdk by default, with no Authorization header, and parses a real recorded response', async () => {
    // rails-agent-ollama-chat.json was recorded from a genuine LLM call (see
    // test/cassettes/record.mjs) — this validates RailsAgent's response parsing
    // against an actual Ollama-compatible chat-completion payload, not a hand-typed guess.
    const fetchMock = vi.fn(cassetteFetch(OLLAMA_CASSETTE))
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({})
    const result = await agent.run('In one sentence, what does ActiveRecord::Base#save do?', {})

    expect(result.success).toBe(true)
    expect(result.iterations).toBe(1)
    expect(result.response).toContain('inserts')
    expect(result.response.toLowerCase()).toContain('database')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:11434/api/chat')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('calls OpenAI with a Bearer token when provider is openai, parsing the same OpenAI-compatible response shape', async () => {
    // RailsAgent's openai and ollama branches both go through the same
    // callOpenAiCompatible parser (see src/agent/RailsAgent.ts) — the recorded
    // Ollama cassette is a genuine example of that exact response shape, so it
    // validates the openai branch's parsing too, without needing a second
    // near-identical recording. Request construction (URL, auth header, model)
    // is asserted independently below, since that part isn't provider-shape-dependent.
    const fetchMock = vi.fn(cassetteFetch(OLLAMA_CASSETTE))
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({ provider: 'openai', openaiModel: 'gpt-4o-mini', getApiKey: async () => 'sk-test' })
    const result = await agent.run('In one sentence, what does ActiveRecord::Base#save do?', {})

    expect(result.success).toBe(true)
    expect(result.response).toContain('database')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect(JSON.parse(init.body as string).model).toBe('gpt-4o-mini')
  })

  it('fails clearly when provider is openai and no key is configured, without calling fetch', async () => {
    // No cassette needed: this path returns before making any request.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({ provider: 'openai', getApiKey: async () => undefined })
    const result = await agent.run('hello', {})

    expect(result.success).toBe(false)
    expect(result.response).toContain('No OpenAI API key configured')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.skipIf(!hasAnthropicCassette)(
    'calls Anthropic Messages API with x-api-key and extracts the text content block, parsing a real recorded response',
    async () => {
      const fetchMock = vi.fn(cassetteFetch(ANTHROPIC_CASSETTE))
      vi.stubGlobal('fetch', fetchMock)

      const agent = buildAgent({ provider: 'anthropic', anthropicModel: 'claude-sonnet-4-5', getApiKey: async () => 'anthropic-key' })
      const result = await agent.run('In one sentence, what does ActiveRecord::Base#save do?', {})

      expect(result.success).toBe(true)
      expect(result.response.length).toBeGreaterThan(0)

      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://api.anthropic.com/v1/messages')
      const headers = init.headers as Record<string, string>
      expect(headers['x-api-key']).toBe('anthropic-key')
      expect(headers['anthropic-version']).toBeTruthy()
      expect(JSON.parse(init.body as string).model).toBe('claude-sonnet-4-5')
    },
  )

  if (!hasAnthropicCassette) {
    it.todo(
      `anthropic cassette not recorded in this environment (no ANTHROPIC_API_KEY was available) — ` +
      `run 'ANTHROPIC_API_KEY=... node test/cassettes/record.mjs' to record ${ANTHROPIC_CASSETTE}.json and un-skip the test above`,
    )
  }

  it('healthCheck reports true for a cloud provider only when a key is configured, without calling fetch', async () => {
    // No response-shape to validate here (healthCheck only checks res.ok for Ollama,
    // and doesn't call fetch at all for cloud providers), so a plain spy is enough.
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const withKey = buildAgent({ provider: 'anthropic', getApiKey: async () => 'key' })
    const withoutKey = buildAgent({ provider: 'anthropic', getApiKey: async () => undefined })

    expect(await withKey.healthCheck()).toBe(true)
    expect(await withoutKey.healthCheck()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it(
    'suggestCodeFix tells the model to stay consistent with sibling methods and never close a caller-owned resource',
    async () => {
      // Regression test: applying the AI fix to two methods that share a resource (e.g. two
      // methods each opening a Redis connection) independently, one at a time, previously
      // produced inconsistent fixes — one method gained an injectable `@redis` seam, the
      // other didn't, and the seam's own fix closed `@redis` even when it might be
      // caller-supplied. Both failure modes trace back to instructions missing from the
      // prompt below, not model flakiness — this locks the instructions in place.
      const fetchMock = vi.fn(cassetteFetch(OLLAMA_CASSETTE))
      vi.stubGlobal('fetch', fetchMock)

      const agent = buildAgent({})
      await agent.suggestCodeFix('def foo\n  1\nend', 'Method too short', {
        fileContent: 'class Foo\n  def foo\n    1\n  end\nend',
      })

      const [, init] = fetchMock.mock.calls[0]
      const prompt = (JSON.parse(init.body as string).messages as Array<{ role: string; content: string }>)
        .find(m => m.role === 'user')?.content

      expect(prompt).toContain('sibling method')
      expect(prompt).toContain('Never close, disconnect, or otherwise release an object this snippet did not itself create')
    },
  )

  it('suggestCodeFix accepts module header documentation fixes without triggering the safety guard', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: {
          content: '# Top-level documentation for StringUtils\nmodule MyToolbox::StringUtils',
        },
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const agent = buildAgent({})
    const fix = await agent.suggestCodeFix(
      'module MyToolbox::StringUtils',
      'Style/Documentation: Missing top-level documentation comment for `module MyToolbox::StringUtils`.',
      { fileContent: 'module MyToolbox::StringUtils\n  def self.slug(s)\n    s.downcase\n  end\nend' },
    )

    expect(fix).toBe('# Top-level documentation for StringUtils\nmodule MyToolbox::StringUtils')
  })
})
