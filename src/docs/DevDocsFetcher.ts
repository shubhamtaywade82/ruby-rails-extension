/**
 * DevDocsFetcher - Downloads a DevDocs docset's raw data files (index.json + db.json,
 * e.g. for "rails~7.1") and caches them on disk so hover lookups never hit the network.
 *
 * DevDocs (devdocs.io) is open-source and serves its documentation as plain JSON rather
 * than only through its own web app — `index.json` lists every documented symbol and
 * `db.json` maps each page path to that page's full RDoc-generated HTML (verified
 * against the real `rails~7.1` docset before writing this: both endpoints, their JSON
 * shape, and the HTML markup inside `db.json`'s values are real, not guessed). Caching
 * these two files locally is what turns DevDocsHoverProvider from "another network
 * round-trip" into genuinely offline, zero-latency hovers.
 *
 * Cached under `{workspaceRoot}/.railsforge/devdocs/{slug}/` — workspace-local rather
 * than VS Code's opaque global storage, for the same reason PersistentIndexManager
 * caches its AST index there: the standalone MCP server process (src/mcp/server.ts)
 * needs to find the same cache just by knowing the workspace root, with no VS Code APIs
 * available to it at all.
 *
 * No `vscode` import, so it can run inside that MCP server process too, though in
 * practice only the extension host calls `ensureDocset` (on activation, and via the
 * `railsforge.updateDevDocs` command) — the MCP server only ever reads what's already
 * cached (see DevDocsOfflineIndex).
 */

import * as fs from 'fs'
import * as path from 'path'

export interface DevDocsFetcherOptions {
  cacheDir: string
  timeoutMs?: number
  baseUrl?: string
}

const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_BASE_URL = 'https://documents.devdocs.io'

export class DevDocsFetcher {
  private cacheDir: string
  private timeoutMs: number
  private baseUrl: string

  constructor(options: DevDocsFetcherOptions) {
    this.cacheDir = options.cacheDir
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  /**
   * Ensures `{cacheDir}/{slug}/index.json` and `db.json` exist on disk, downloading them
   * if missing (or if `forceRefresh` is set). Returns whether the docset is usable
   * afterwards — false on any network/parse failure, never throws, and leaves a
   * previously-good cache in place rather than deleting it on a failed refresh.
   */
  async ensureDocset(slug: string, forceRefresh = false): Promise<boolean> {
    const dir = path.join(this.cacheDir, slug)
    const indexPath = path.join(dir, 'index.json')
    const dbPath = path.join(dir, 'db.json')

    if (!forceRefresh && fs.existsSync(indexPath) && fs.existsSync(dbPath)) {
      return true
    }

    const index = await this.downloadJson(`${this.baseUrl}/${slug}/index.json`)
    if (!index) {return fs.existsSync(indexPath) && fs.existsSync(dbPath)}

    const db = await this.downloadJson(`${this.baseUrl}/${slug}/db.json`)
    if (!db) {return fs.existsSync(indexPath) && fs.existsSync(dbPath)}

    try {
      fs.mkdirSync(dir, { recursive: true })
      // Write to a temp path and rename so a hover/MCP read never observes a
      // half-written file if the process is killed mid-write.
      this.writeAtomic(indexPath, index)
      this.writeAtomic(dbPath, db)
      return true
    } catch {
      return false
    }
  }

  private writeAtomic(destPath: string, content: string): void {
    const tmpPath = `${destPath}.tmp`
    fs.writeFileSync(tmpPath, content, 'utf8')
    fs.renameSync(tmpPath, destPath)
  }

  private async downloadJson(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) })
      if (!res.ok) {return null}
      return await res.text()
    } catch {
      return null
    }
  }
}

/** "3.3.0" + "ruby" -> "ruby~3.3", matching DevDocs' major.minor slug convention. */
export function toDevDocsSlug(prefix: string, version: string): string {
  const [major, minor] = version.split('.')
  return minor ? `${prefix}~${major}.${minor}` : `${prefix}~${major}`
}
