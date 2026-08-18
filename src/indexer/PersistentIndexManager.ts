/**
 * PersistentIndexManager - vscode-facing lifecycle for the Phase 12 AST/SQLite index.
 *
 * Wraps PersistentIndexClient (worker thread + SQLite) with workspace scanning/watching
 * and exposes PersistentDependencyGraph (Phase 11: cycles) and DuplicateMethodDetector
 * (Phase 8: cross-file near-duplicate methods) on top of it.
 *
 * Deliberately fails soft: if the native modules can't load on some platform, or the
 * worker fails to start, `activate()` logs a warning and returns null instead of
 * throwing — Phase 8/11/13/14 features become unavailable, but the rest of RailsForge
 * (everything built before this session) keeps working exactly as it did.
 */

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { PersistentIndexClient } from './PersistentIndexClient'
import { PersistentDependencyGraph } from './PersistentDependencyGraph'
import { DuplicateMethodDetector } from './DuplicateMethodDetector'
import { isPersistentIndexSupported, getLinuxGlibcVersion } from './nativeSupport'
import { readConfig, buildExcludeGlob } from '../config/RailsForgeConfig'
import { Logger } from '../util/Logger'

const INDEXED_GLOB = '{app,lib}/**/*.rb'
// Always excluded regardless of railsForge.excludePatterns: this index is specifically
// app/lib source (see INDEXED_GLOB), so spec/test files never belong in it even if a
// user's exclude list doesn't happen to mention them.
const ALWAYS_EXCLUDED = ['**/spec/**', '**/test/**']

function resolveExcludeGlob(): string {
  return buildExcludeGlob([...readConfig().excludePatterns, ...ALWAYS_EXCLUDED]) ?? `{${ALWAYS_EXCLUDED.join(',')}}`
}

export class PersistentIndexManager implements vscode.Disposable {
  readonly dependencyGraph: PersistentDependencyGraph
  readonly duplicateDetector: DuplicateMethodDetector

  private constructor(
    private client: PersistentIndexClient,
    private workspaceRoot: string,
  ) {
    this.dependencyGraph = new PersistentDependencyGraph(client.getDb())
    this.duplicateDetector = new DuplicateMethodDetector(client.getDb())
  }

  static async activate(context: vscode.ExtensionContext, workspaceRoot: string): Promise<PersistentIndexManager | null> {
    if (!workspaceRoot) {return null}

    // Must run before anything in this call touches better-sqlite3, directly or
    // transitively (see database.ts's doc comment) — on an unsupported runtime,
    // loading that native module aborts the whole process, which no try/catch below
    // can protect against.
    if (!isPersistentIndexSupported()) {
      const glibc = process.platform === 'linux' ? ` (GLIBC: ${getLinuxGlibcVersion() ?? 'unknown'})` : ''
      Logger.warn(`RailsForge: persistent AST SQLite index requires Node N-API >= 10 and Linux GLIBC >= 2.33${glibc}. AST cache (Phase 8/11/13/14) is skipped; all core RailsForge features remain fully active.`)
      return null
    }

    try {
      // Workspace-local (not VS Code's opaque per-workspace global storage) so the
      // standalone MCP server (src/mcp/server.ts, run outside the extension host) can
      // find and read the same index just by knowing the workspace root — no need to
      // reconstruct VS Code's internal storage-path hashing. Should be gitignored by
      // the user's project, same as any other local build/cache artifact.
      const storageDir = path.join(workspaceRoot, '.railsforge')
      fs.mkdirSync(storageDir, { recursive: true })
      const dbPath = path.join(storageDir, 'index.sqlite3')
      const workerPath = path.join(context.extensionPath, 'dist', 'indexer', 'indexer.worker.js')

      const client = await PersistentIndexClient.create(workerPath, dbPath)
      const manager = new PersistentIndexManager(client, workspaceRoot)
      context.subscriptions.push(manager)

      await manager.scanWorkspace()
      manager.watch(context)

      return manager
    } catch (err) {
      // Native module unavailable, worker failed to start, etc. — degrade, don't break activation.
      Logger.error('RailsForge: persistent AST index unavailable, Phase 8/11/13/14 features disabled.', err)
      return null
    }
  }

  private async scanWorkspace(): Promise<void> {
    const files = await vscode.workspace.findFiles(INDEXED_GLOB, resolveExcludeGlob())
    await Promise.all(files.map(async file => {
      try {
        const content = fs.readFileSync(file.fsPath, 'utf8')
        await this.client.indexFile(file.fsPath, content)
      } catch {
        // Skip unreadable/binary files rather than aborting the whole scan.
      }
    }))
  }

  private watch(context: vscode.ExtensionContext): void {
    const watcher = vscode.workspace.createFileSystemWatcher(`**/${INDEXED_GLOB}`)
    const reindex = async (uri: vscode.Uri): Promise<void> => {
      if (fs.existsSync(uri.fsPath)) {
        await this.client.indexFile(uri.fsPath, fs.readFileSync(uri.fsPath, 'utf8'))
      } else {
        await this.client.removeFile(uri.fsPath)
      }
    }
    watcher.onDidChange(reindex)
    watcher.onDidCreate(reindex)
    watcher.onDidDelete(uri => void this.client.removeFile(uri.fsPath))
    context.subscriptions.push(watcher)
  }

  dispose(): void {
    this.client.dispose()
  }
}
