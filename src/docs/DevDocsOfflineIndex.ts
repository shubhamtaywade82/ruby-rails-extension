/**
 * DevDocsOfflineIndex - Queries a DevDocsFetcher-cached docset entirely from disk: no
 * network, no APIDock/RubyDoc-style timeout handling needed, because there's nothing to
 * time out. Reads `index.json` (symbol name -> page path) and `db.json` (page path ->
 * full RDoc-generated HTML for that page) and extracts just the one method's or class's
 * fragment out of that page — verified against real `rails~7.1` data before writing
 * this extractor (see DevDocsFetcher's header for how that data got here).
 *
 * `db.json` is large (~10-15MB of JSON per docset), so it's parsed lazily — only once a
 * lookup actually needs it — and kept in memory afterwards so repeat lookups against the
 * same docset are instant. `index.json` is much smaller and always loaded up front so
 * `lookup()` itself is synchronous.
 *
 * No `vscode` import, so both the extension host (DevDocsHoverProvider) and the
 * standalone MCP server (`get_offline_docs`) can use the exact same class.
 */

import * as fs from 'fs'
import * as path from 'path'
import { stripHtmlTags, decodeHtmlEntities } from '../util/HtmlText'

interface RawDevDocsEntry {
  name: string
  path: string
  type: string
}

interface DevDocsIndexEntry extends RawDevDocsEntry {
  slug: string
}

export interface DevDocsResult {
  slug: string
  name: string
  signature: string | null
  description: string | null
  sourceCode: string | null
  url: string
}

export class DevDocsOfflineIndex {
  private entriesByKey = new Map<string, DevDocsIndexEntry[]>()
  private dbCache = new Map<string, Record<string, string> | null>()

  constructor(private cacheDir: string, slugs: string[]) {
    for (const slug of slugs) {
      this.loadEntries(slug)
    }
  }

  private loadEntries(slug: string): void {
    const indexPath = path.join(this.cacheDir, slug, 'index.json')
    if (!fs.existsSync(indexPath)) {return}

    try {
      const data = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as { entries: RawDevDocsEntry[] }
      for (const entry of data.entries) {
        const hashIndex = entry.name.indexOf('#')
        const key = (hashIndex === -1 ? entry.name : entry.name.slice(hashIndex + 1)).toLowerCase()
        const list = this.entriesByKey.get(key) ?? []
        list.push({ ...entry, slug })
        this.entriesByKey.set(key, list)
      }
    } catch {
      // Corrupt/partial cache file — skip this docset rather than failing the whole lookup.
    }
  }

  /**
   * Looks up a bare identifier (method name, or class/module name for one with no `#`).
   * Ruby method names collide constantly across classes (`save`, `each`, `find`) — with
   * no type inference to disambiguate, this returns the first candidate that actually
   * extracts real content, on the theory that an empty/stub entry is less useful than
   * whichever same-named method happens to have a written docstring.
   */
  lookup(word: string): DevDocsResult | null {
    const candidates = this.entriesByKey.get(word.toLowerCase())
    if (!candidates || candidates.length === 0) {return null}

    let fallback: DevDocsResult | null = null
    for (const candidate of candidates) {
      const result = this.extract(candidate)
      if (!result) {continue}
      if (result.description) {return result}
      fallback = fallback ?? result
    }
    return fallback
  }

  private extract(entry: DevDocsIndexEntry): DevDocsResult | null {
    const db = this.loadDb(entry.slug)
    if (!db) {return null}

    const hashIndex = entry.path.indexOf('#')
    const pagePath = hashIndex === -1 ? entry.path : entry.path.slice(0, hashIndex)
    const fragmentId = hashIndex === -1 ? null : entry.path.slice(hashIndex + 1)
    const pageHtml = db[pagePath]
    if (!pageHtml) {return null}

    const url = `https://devdocs.io/${entry.slug.replace('~', '/')}/${entry.path}`
    return fragmentId
      ? extractMethodEntry(pageHtml, fragmentId, entry, url)
      : extractClassEntry(pageHtml, entry, url)
  }

  private loadDb(slug: string): Record<string, string> | null {
    if (this.dbCache.has(slug)) {return this.dbCache.get(slug) ?? null}

    const dbPath = path.join(this.cacheDir, slug, 'db.json')
    if (!fs.existsSync(dbPath)) {
      this.dbCache.set(slug, null)
      return null
    }
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as Record<string, string>
      this.dbCache.set(slug, data)
      return data
    } catch {
      this.dbCache.set(slug, null)
      return null
    }
  }
}

function extractMethodEntry(pageHtml: string, fragmentId: string, entry: DevDocsIndexEntry, url: string): DevDocsResult | null {
  const headingPattern = new RegExp(`<div class="method-heading" id=["']${escapeRegExp(fragmentId)}["']>([\\s\\S]*?)<\\/div>`)
  const heading = headingPattern.exec(pageHtml)
  if (!heading) {return null}

  const blockStart = pageHtml.lastIndexOf('<div class="method-detail', heading.index)
  const from = blockStart !== -1 ? blockStart : heading.index
  const block = pageHtml.slice(from, findBlockEnd(pageHtml, heading.index + heading[0].length))

  const name = /<span class="method-name">([\s\S]*?)<\/span>/.exec(heading[1])
  const args = /<span class="method-args">([\s\S]*?)<\/span>/.exec(heading[1])
  const signature = normalizeText(`${name ? stripTags(name[1]) : ''}${args ? stripTags(args[1]) : ''}`) || null

  const sourceMatch = /<pre[^>]*>([\s\S]*?)<\/pre>/.exec(block)
  const sourceCode = sourceMatch ? stripTagsPreserveWhitespace(sourceMatch[1]).replace(/^# File [^\n]*\n?/, '').trim() || null : null

  const descriptionStart = block.indexOf('<div class="method-description">')
  const descriptionScope = descriptionStart === -1 ? block : block.slice(descriptionStart)
  const withoutCode = descriptionScope.replace(/<pre[\s\S]*?<\/pre>/g, '')
  const description = normalizeText(htmlToPlainText(withoutCode)) || null

  return { slug: entry.slug, name: entry.name, signature, description, sourceCode, url }
}

function extractClassEntry(pageHtml: string, entry: DevDocsIndexEntry, url: string): DevDocsResult | null {
  const escapedName = escapeRegExp(entry.name)
  const headingPattern = new RegExp(`<h1[^>]*id=["'](?:class|module)-${escapedName}["'][^>]*>([\\s\\S]*?)<\\/h1>`)
  const heading = headingPattern.exec(pageHtml)
  if (!heading) {return null}

  const descriptionPattern = /<section class="description">([\s\S]*?)<\/section>/
  const description = descriptionPattern.exec(pageHtml.slice(heading.index))

  return {
    slug: entry.slug,
    name: entry.name,
    signature: normalizeText(stripTags(heading[1])) || null,
    description: description ? normalizeText(htmlToPlainText(description[1])) || null : null,
    sourceCode: null,
    url,
  }
}

/**
 * Every method/class block on a DevDocs page is followed, sooner or later, by that
 * page's `<div class="_attribution">` copyright footer (verified in the `rails~7.1`
 * fixtures) — a reliable fallback boundary for the *last* method on a page, where
 * there's no next `<div class="method-detail">` sibling to stop at.
 */
function findBlockEnd(pageHtml: string, from: number): number {
  const nextBlock = pageHtml.indexOf('<div class="method-detail', from)
  const attribution = pageHtml.indexOf('<div class="_attribution">', from)
  const candidates = [nextBlock, attribution, pageHtml.length].filter(i => i !== -1)
  return Math.min(...candidates)
}

/** Converts `<li>` items to "- " bullet lines, then strips all remaining tags — so prose extracted from a `<ul>` stays readable as markdown instead of raw HTML. */
function htmlToPlainText(html: string): string {
  const withBullets = html.replace(/<li>([\s\S]*?)<\/li>/g, (_match, inner: string) => `\n- ${stripTags(inner).trim()}`)
  return stripTags(withBullets)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripTags(fragment: string): string {
  return decodeHtmlEntities(stripHtmlTags(fragment))
}

/** Same tag-stripping as `stripTags`, but keeps original newlines/indentation intact — for `<pre>` source code, where collapsing whitespace would corrupt it. */
function stripTagsPreserveWhitespace(fragment: string): string {
  return decodeHtmlEntities(stripHtmlTags(fragment, ''))
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
