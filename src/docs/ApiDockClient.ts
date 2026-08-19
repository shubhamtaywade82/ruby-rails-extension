/**
 * ApiDockClient - Thin wrapper over apidock.com, the crowdsourced Ruby/Rails/RSpec
 * documentation site. apidock.com has no public API, so this scrapes the top
 * community note and method summary out of a doc page's HTML with defensive
 * regexes rather than a real HTML parser (keeps this dependency-free, matching
 * RubyGemsClient/EmbeddingClient). The markup isn't documented and can change
 * without notice, so every extraction step degrades to `null` instead of
 * throwing — callers treat a `null`/empty result as "no note available", never
 * as an error. Deliberately not a new dependency: reuses the same global-`fetch`
 * + LRU-cache approach as RubyGemsClient, plus a TTL so entries expire instead
 * of pinning a possibly-stale community note in memory forever.
 *
 * This file has no `vscode` import so it can run unmodified inside the
 * standalone MCP server process (see src/mcp/server.ts's file header).
 */

import { LruCache } from '../util/LruCache'

export type ApiDockNamespace = 'rails' | 'ruby' | 'rspec'

export interface ApiDockLookup {
  namespace: ApiDockNamespace
  /** Class/module path as apidock.com URLs spell it, e.g. "ActiveRecord/Base" or "String". */
  className: string
  methodName: string
}

export interface ApiDockNote {
  url: string
  summary: string | null
  topNote: string | null
}

export interface ApiDockClientOptions {
  cacheSize?: number
  cacheTtlMs?: number
  timeoutMs?: number
  baseUrl?: string
}

const DEFAULT_CACHE_SIZE = 200
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_BASE_URL = 'https://apidock.com'

interface CacheEntry {
  value: ApiDockNote | null
  expiresAt: number
}

export class ApiDockClient {
  private cache: LruCache<string, CacheEntry>
  private cacheTtlMs: number
  private timeoutMs: number
  private baseUrl: string

  constructor(options: ApiDockClientOptions = {}) {
    this.cache = new LruCache(options.cacheSize ?? DEFAULT_CACHE_SIZE)
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  async fetchNotes(lookup: ApiDockLookup): Promise<ApiDockNote | null> {
    const key = `${lookup.namespace}/${lookup.className}/${lookup.methodName}`
    const cached = this.cache.get(key)
    if (cached && cached.expiresAt > Date.now()) {return cached.value}

    const value = await this.request(lookup)
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs })
    return value
  }

  private async request(lookup: ApiDockLookup): Promise<ApiDockNote | null> {
    const url = `${this.baseUrl}/${lookup.namespace}/${lookup.className}/${encodeURIComponent(lookup.methodName)}`

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) })
      if (!res.ok) {return null}

      const html = await res.text()
      const summary = extractSummary(html)
      const topNote = extractTopNote(html)
      if (!summary && !topNote) {return null}

      return { url, summary, topNote }
    } catch {
      return null
    }
  }
}

const DESCRIPTION_START_PATTERNS = [
  /id=["']method-description["'][^>]*>/i,
  /id=["']text["'][^>]*>/i,
  /class=["']method_description["'][^>]*>/i,
]

const NOTES_START_PATTERNS = [/id=["']notes["'][^>]*>/i]

// Matched against the whole opening tag (not just the attribute) so a section is
// always truncated at a clean tag boundary rather than mid-tag, which would leave
// a dangling "<div" (missing its closing ">") that stripHtml can't strip.
const SECTION_END_PATTERNS = [
  /<[^>]*\bid=["']notes["'][^>]*>/i,
  /<[^>]*\bid=["']comments["'][^>]*>/i,
  /<[^>]*\bid=["']related[-_]?methods?["'][^>]*>/i,
  /<h2[^>]*>\s*(Instance|Class|Protected|Private) methods/i,
  /<footer/i,
]

/** Best-effort extraction of the method description block, truncated to a hover-sized summary. */
export function extractSummary(html: string): string | null {
  const section = extractSection(html, DESCRIPTION_START_PATTERNS, SECTION_END_PATTERNS)
  if (!section) {return null}

  const text = stripHtml(section)
  if (text.length < 10) {return null}

  return text.length > 500 ? `${text.slice(0, 500).trimEnd()}…` : text
}

/** Best-effort extraction of the first (apidock sorts by votes, so highest-rated) community note. */
export function extractTopNote(html: string): string | null {
  const section = extractSection(html, NOTES_START_PATTERNS, SECTION_END_PATTERNS)
  if (!section) {return null}

  const paragraphs = [...section.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  for (const match of paragraphs) {
    const text = stripHtml(match[1])
    // Skip vote/meta fragments like "8 thanks" that sometimes land in their own <p>.
    if (text.length >= 20 && !/^\d+\s+thanks?$/i.test(text)) {
      return text.length > 400 ? `${text.slice(0, 400).trimEnd()}…` : text
    }
  }
  return null
}

function extractSection(html: string, startPatterns: RegExp[], endPatterns: RegExp[]): string | null {
  for (const start of startPatterns) {
    const startMatch = start.exec(html)
    if (!startMatch) {continue}

    const from = startMatch.index + startMatch[0].length
    const remainder = html.slice(from)
    let to = html.length
    for (const end of endPatterns) {
      const endMatch = new RegExp(end.source, end.flags).exec(remainder)
      if (endMatch) {
        const absoluteIndex = from + endMatch.index
        if (absoluteIndex < to) {to = absoluteIndex}
      }
    }
    return html.slice(from, to)
  }
  return null
}

function stripHtml(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
