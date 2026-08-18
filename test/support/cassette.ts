/**
 * cassette.ts - Minimal VCR-style HTTP cassette player for tests.
 *
 * A cassette is a JSON fixture holding a real HTTP response captured once
 * from a genuine LLM API call (see test/cassettes/record.mjs), so tests
 * validate request-building and response-parsing logic against actual
 * provider payloads instead of hand-typed guesses at their shape.
 *
 * Deliberately simple: one cassette = one recorded response, replayed
 * unconditionally regardless of what the caller's request looked like.
 * There is no request matching (unlike full VCR/Polly.js) — tests that need
 * to assert on the outgoing request do so separately, by wrapping the
 * returned stub and inspecting its call arguments (see RailsAgent.cassette.test.ts).
 * That's enough for this codebase's needs and avoids taking on a new
 * dependency for a handful of call sites.
 */

import * as fs from 'fs'
import * as path from 'path'

export interface Cassette {
  /** Human-readable note on exactly what was called to record this — see record.mjs. */
  provenance: string
  recordedAt: string
  response: {
    status: number
    ok: boolean
    statusText: string
    body: unknown
  }
}

const CASSETTE_DIR = path.join(__dirname, '..', 'cassettes')

export function cassettePath(name: string): string {
  return path.join(CASSETTE_DIR, `${name}.json`)
}

export function loadCassette(name: string): Cassette {
  const file = cassettePath(name)
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing cassette '${name}' at ${file}. Cassettes are recorded from real API calls and can't be faked — ` +
      `run 'node test/cassettes/record.mjs' with the relevant provider credentials set to generate it.`,
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Cassette
}

/**
 * Returns a fetch stub that replays cassette `name`'s recorded response for
 * every call. Use with `vi.stubGlobal('fetch', cassetteFetch('name'))`.
 */
export function cassetteFetch(name: string): typeof fetch {
  const cassette = loadCassette(name)
  const stub = async (): Promise<Response> => {
    return {
      ok: cassette.response.ok,
      status: cassette.response.status,
      statusText: cassette.response.statusText,
      json: async () => cassette.response.body,
    } as Response
  }
  return stub as typeof fetch
}
