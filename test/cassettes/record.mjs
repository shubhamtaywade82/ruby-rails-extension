#!/usr/bin/env node
/**
 * record.mjs - Records real HTTP cassettes for RailsAgent's provider tests.
 *
 * This is NOT run in CI or by `pnpm test` — cassettes are committed fixtures,
 * recorded once (and re-recorded only when a provider's response shape
 * changes) by a maintainer who has the relevant credentials. Each scenario
 * below is skipped, with a clear message, when its required env var isn't
 * set — this script is safe to run with only some credentials available.
 *
 * Usage:
 *   OPENAI_API_KEY=sk-...        node test/cassettes/record.mjs   # openai cassette
 *   ANTHROPIC_API_KEY=sk-ant-... node test/cassettes/record.mjs   # anthropic cassette
 *   CLOUD_OLLAMA_HOST=... CLOUD_OLLAMA_API_KEY=... CLOUD_OLLAMA_MODEL=...
 *                                 node test/cassettes/record.mjs   # ollama cassette
 *
 * A real local Ollama also works for the ollama cassette: just have it
 * running on OLLAMA_HOST (default http://localhost:11434) with no API key.
 */

import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
mkdirSync(__dirname, { recursive: true })

const SYSTEM_PROMPT = 'You are RailsForge AI, a senior Ruby on Rails engineering assistant.'
const USER_PROMPT = 'In one sentence, what does ActiveRecord::Base#save do?'

async function recordChatCompletion(cassetteName, { url, headers, model, provenance }) {
  console.log(`Recording ${cassetteName} from ${url} (model: ${model})...`)
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: USER_PROMPT },
      ],
      temperature: 0.2,
    }),
  })
  const body = await res.json()
  writeCassette(cassetteName, provenance, res, body)
}

async function recordAnthropicMessage(cassetteName, { apiKey, model, provenance }) {
  console.log(`Recording ${cassetteName} from https://api.anthropic.com/v1/messages (model: ${model})...`)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: USER_PROMPT }],
      temperature: 0.2,
    }),
  })
  const body = await res.json()
  writeCassette(cassetteName, provenance, res, body)
}

function writeCassette(name, provenance, res, body) {
  const cassette = {
    provenance,
    recordedAt: new Date().toISOString(),
    response: { status: res.status, ok: res.ok, statusText: res.statusText, body },
  }
  const file = path.join(__dirname, `${name}.json`)
  writeFileSync(file, `${JSON.stringify(cassette, null, 2)}\n`, 'utf8')
  console.log(`  -> wrote ${file} (status ${res.status})`)
}

async function main() {
  const ranAny = []

  if (process.env.CLOUD_OLLAMA_HOST && process.env.CLOUD_OLLAMA_API_KEY) {
    const model = process.env.CLOUD_OLLAMA_MODEL || 'gpt-oss:20b'
    await recordChatCompletion('rails-agent-ollama-chat', {
      url: `${process.env.CLOUD_OLLAMA_HOST.replace(/\/$/, '')}/v1/chat/completions`,
      headers: { Authorization: `Bearer ${process.env.CLOUD_OLLAMA_API_KEY}` },
      model,
      provenance: `Recorded live against ${process.env.CLOUD_OLLAMA_HOST} (Ollama Cloud), model "${model}". ` +
        'RailsAgent\'s own Ollama calls in production go to a local/self-hosted Ollama instance ' +
        '(railsForge.ollama.host, no auth), not this cloud endpoint — this cassette exists to validate ' +
        'response parsing against a genuine Ollama-compatible chat-completion response, not to reproduce ' +
        'the exact production request.',
    })
    ranAny.push('ollama')
  } else if (process.env.OLLAMA_HOST) {
    try {
      const model = process.env.OLLAMA_MODEL || 'qwen2.5-coder:14b'
      await recordChatCompletion('rails-agent-ollama-chat', {
        url: `${process.env.OLLAMA_HOST.replace(/\/$/, '')}/v1/chat/completions`,
        headers: {},
        model,
        provenance: `Recorded live against a local Ollama at ${process.env.OLLAMA_HOST}, model "${model}".`,
      })
      ranAny.push('ollama')
    } catch (err) {
      console.log(`Skipping ollama cassette: local Ollama at ${process.env.OLLAMA_HOST} unreachable (${err.message}).`)
    }
  } else {
    console.log('Skipping ollama cassette: set CLOUD_OLLAMA_HOST+CLOUD_OLLAMA_API_KEY, or OLLAMA_HOST for a local instance.')
  }

  if (process.env.OPENAI_API_KEY) {
    await recordChatCompletion('rails-agent-openai-chat', {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      provenance: 'Recorded live against https://api.openai.com/v1/chat/completions.',
    })
    ranAny.push('openai')
  } else {
    console.log('Skipping openai cassette: OPENAI_API_KEY not set.')
  }

  if (process.env.ANTHROPIC_API_KEY) {
    await recordAnthropicMessage('rails-agent-anthropic-message', {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      provenance: 'Recorded live against https://api.anthropic.com/v1/messages.',
    })
    ranAny.push('anthropic')
  } else {
    console.log('Skipping anthropic cassette: ANTHROPIC_API_KEY not set.')
  }

  if (ranAny.length === 0) {
    console.log('\nNo cassettes recorded — no provider credentials were available in this environment.')
    process.exitCode = 1
  } else {
    console.log(`\nRecorded cassette(s) for: ${ranAny.join(', ')}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
