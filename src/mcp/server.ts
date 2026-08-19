/**
 * RailsForge MCP server (Phase 14) - exposes the same schema/routes/pattern/dependency
 * intelligence RailsForge uses internally as MCP tools, so any MCP-capable AI client
 * (not just the built-in @rails chat participant) can query a Rails project's context.
 *
 * Runs as a standalone Node process (started by the MCP client via stdio), NOT inside
 * the VS Code extension host — it imports only the vscode-free indexer classes
 * (SchemaIndexer, RoutesIndexer, ProjectPatternIndexer all have zero `vscode` imports)
 * and reads the same workspace-local .railsforge/index.sqlite3 the extension's
 * PersistentIndexManager maintains when the workspace is open in VS Code with
 * RailsForge installed. If that file doesn't exist yet, dependency/duplicate tools
 * degrade to a clear "index not built" message instead of failing silently.
 */

import * as fs from 'fs'
import * as path from 'path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'
import { ProjectPatternIndexer, PatternType } from '../patterns/ProjectPatternIndexer'
import { openIndexDatabase } from '../indexer/database'
import { isPersistentIndexSupported } from '../indexer/nativeSupport'
import { PersistentDependencyGraph } from '../indexer/PersistentDependencyGraph'
import { DuplicateMethodDetector } from '../indexer/DuplicateMethodDetector'
import { ApiDockClient } from '../docs/ApiDockClient'
import { ApiDockMethodIndex } from '../docs/ApiDockMethodIndex'
import { RubyDocProvider } from '../docs/RubyDocProvider'
import { GemSymbolResolver } from '../docs/GemSymbolResolver'
import { parseGemfileLock } from '../gems/GemfileLockParser'

const workspaceRoot = process.env.RAILSFORGE_WORKSPACE_ROOT ?? process.cwd()

const DEFAULT_EXCLUDED_DIR_NAMES = ['node_modules', 'vendor', 'tmp', 'log', '.git', 'coverage']

/**
 * This process runs outside the VS Code extension host (started by the MCP client via
 * stdio — see the file header), so it has no access to `vscode.workspace.getConfiguration`.
 * To still honor `railsForge.excludePatterns` set at the project level, read it straight
 * out of the workspace's `.vscode/settings.json`. Global (user) settings.json isn't in a
 * reliably discoverable location outside the editor, so only the project-level file is
 * supported here; falls back to sane defaults if the file is absent or unparseable.
 */
function loadExcludedDirNames(): Set<string> {
  try {
    const settingsPath = path.join(workspaceRoot, '.vscode', 'settings.json')
    if (!fs.existsSync(settingsPath)) {return new Set(DEFAULT_EXCLUDED_DIR_NAMES)}

    const json = JSON.parse(stripJsonComments(fs.readFileSync(settingsPath, 'utf8'))) as Record<string, unknown>
    const patterns = json['railsForge.excludePatterns']
    if (!Array.isArray(patterns) || patterns.length === 0) {return new Set(DEFAULT_EXCLUDED_DIR_NAMES)}

    const dirNames = patterns
      .filter((p): p is string => typeof p === 'string')
      .map(p => p.replace(/^\*\*\//, '').replace(/\/\*\*$/, '').replace(/\/\*+$/, ''))
      .filter(Boolean)
    return dirNames.length > 0 ? new Set(dirNames) : new Set(DEFAULT_EXCLUDED_DIR_NAMES)
  } catch {
    return new Set(DEFAULT_EXCLUDED_DIR_NAMES)
  }
}

// Strips line comments and block comments from JSONC so plain JSON.parse can read a VS Code settings.json.
function stripJsonComments(text: string): string {
  return text.replace(/"(?:[^"\\]|\\.)*"|\/\/.*$|\/\*[\s\S]*?\*\//gm, match =>
    match.startsWith('"') ? match : '',
  )
}

const excludedDirNames = loadExcludedDirNames()

function loadSchemaIndexer(): SchemaIndexer {
  const indexer = new SchemaIndexer()
  const schemaPath = path.join(workspaceRoot, 'db', 'schema.rb')
  if (fs.existsSync(schemaPath)) {
    indexer.parseSchema(fs.readFileSync(schemaPath, 'utf8'))
  }
  return indexer
}

function loadRoutesIndexer(): RoutesIndexer {
  const indexer = new RoutesIndexer()
  const routesPath = path.join(workspaceRoot, 'config', 'routes.rb')
  if (fs.existsSync(routesPath)) {
    indexer.parseRoutesTable(fs.readFileSync(routesPath, 'utf8'))
  }
  return indexer
}

function loadPatternIndexer(): ProjectPatternIndexer {
  const indexer = new ProjectPatternIndexer()
  for (const dir of ['app', 'lib']) {
    walkRubyFiles(path.join(workspaceRoot, dir), file => {
      indexer.indexFile(file, fs.readFileSync(file, 'utf8'))
    })
  }
  return indexer
}

function walkRubyFiles(dir: string, onFile: (filePath: string) => void): void {
  if (!fs.existsSync(dir)) {return}
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (excludedDirNames.has(entry.name)) {continue}
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkRubyFiles(full, onFile)
    } else if (entry.name.endsWith('.rb')) {
      try {
        onFile(full)
      } catch {
        // Skip unreadable files.
      }
    }
  }
}

function openPersistentDbReadonly() {
  // Must come before the require('better-sqlite3') inside openIndexDatabase — see
  // database.ts's doc comment on why an unsupported runtime can't be recovered from
  // via try/catch.
  if (!isPersistentIndexSupported()) {return null}

  const dbPath = path.join(workspaceRoot, '.railsforge', 'index.sqlite3')
  if (!fs.existsSync(dbPath)) {return null}
  try {
    return openIndexDatabase(dbPath, true)
  } catch {
    return null
  }
}

const server = new McpServer({ name: 'railsforge', version: '0.1.0' })

server.registerTool(
  'get_schema',
  {
    title: 'Get ActiveRecord schema',
    description: 'Returns database columns for a model (or all tables if no model is given), from db/schema.rb.',
    inputSchema: { model: z.string().optional().describe('Model class name, e.g. "User"') },
  },
  async ({ model }) => {
    const schema = loadSchemaIndexer()
    if (model) {
      const columns = schema.getModelColumns(model)
      return { content: [{ type: 'text', text: JSON.stringify(columns, null, 2) }] }
    }
    const tables = schema.getAllTables().map(t => ({ name: t.name, columns: Array.from(t.columns.values()) }))
    return { content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }] }
  },
)

server.registerTool(
  'list_routes',
  {
    title: 'List Rails routes',
    description: 'Lists routes, optionally filtered by a search string matched against verb/path/controller#action.',
    inputSchema: { filter: z.string().optional() },
  },
  async ({ filter }) => {
    const routes = loadRoutesIndexer()
    const results = filter ? routes.searchRoutes(filter) : routes.getAllRoutes()
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] }
  },
)

server.registerTool(
  'list_patterns',
  {
    title: 'List project patterns',
    description: 'Lists this project\'s own Service/Query/Form/Policy/Decorator/Concern classes, optionally filtered by type.',
    inputSchema: { type: z.enum(['service', 'query', 'form', 'policy', 'decorator', 'concern']).optional() },
  },
  async ({ type }) => {
    const indexer = loadPatternIndexer()
    const patterns = type ? indexer.getPatternsByType(type as PatternType) : indexer.getAllPatterns()
    const summary = patterns.map(p => ({ name: p.name, type: p.type, filePath: p.filePath, publicMethods: p.publicMethods }))
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
  },
)

server.registerTool(
  'find_similar_pattern',
  {
    title: 'Find similar existing pattern',
    description: 'Given a proposed class name (e.g. "CreateOrderService"), finds the closest existing Service/Query/etc. in this project — use before generating new code.',
    inputSchema: { name: z.string() },
  },
  async ({ name }) => {
    const indexer = loadPatternIndexer()
    const target = indexer.getAllPatterns().find(p => p.name === name)
    if (!target) {
      return { content: [{ type: 'text', text: `No existing pattern named "${name}" found; nothing to compare against.` }] }
    }
    const similar = indexer.findSimilar(target)
    return { content: [{ type: 'text', text: JSON.stringify(similar, null, 2) }] }
  },
)

server.registerTool(
  'get_dependencies',
  {
    title: 'Get dependencies/callers',
    description: 'Returns collaborators (what this class depends on) and callers (what depends on this class), from the persistent AST index. Requires the workspace to have been opened in VS Code with RailsForge at least once.',
    inputSchema: { name: z.string() },
  },
  async ({ name }) => {
    const db = openPersistentDbReadonly()
    if (!db) {
      return { content: [{ type: 'text', text: 'RailsForge persistent index not found (.railsforge/index.sqlite3). Open this workspace in VS Code with RailsForge installed first.' }] }
    }
    const graph = new PersistentDependencyGraph(db)
    const result = { collaborators: graph.getCollaborators(name), callers: graph.getCallers(name) }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  },
)

server.registerTool(
  'find_duplicate_methods',
  {
    title: 'Find near-duplicate methods',
    description: 'Finds near-duplicate method bodies across the indexed codebase (candidates for extracting a shared concern/method). Requires the persistent AST index.',
    inputSchema: {},
  },
  async () => {
    const db = openPersistentDbReadonly()
    if (!db) {
      return { content: [{ type: 'text', text: 'RailsForge persistent index not found (.railsforge/index.sqlite3). Open this workspace in VS Code with RailsForge installed first.' }] }
    }
    const detector = new DuplicateMethodDetector(db)
    return { content: [{ type: 'text', text: JSON.stringify(detector.findDuplicates(), null, 2) }] }
  },
)

const apiDockClient = new ApiDockClient()
const apiDockMethodIndex = new ApiDockMethodIndex()

/** apidock.com groups docs under a top-level rails/ruby/rspec namespace; guess it from the class name's prefix. */
function classifyApiDockNamespace(className: string): 'rails' | 'ruby' | 'rspec' {
  if (/^RSpec\b/.test(className)) {return 'rspec'}
  if (/^(ActiveRecord|ActiveModel|ActiveSupport|ActionController|ActionView|ActionMailer|ActionCable|ActiveJob|AbstractController|ActionDispatch|Rails)\b/.test(className)) {return 'rails'}
  return 'ruby'
}

/**
 * Prefers ApiDockMethodIndex's curated mapping (more precise apidock.com class paths, e.g.
 * "ActiveModel/Validations/ClassMethods" for `validates`), but only when it actually agrees
 * with the caller's class_name — otherwise falls back to constructing the lookup directly
 * from class_name/method_name so a method also indexed under a different class isn't
 * silently misattributed.
 */
function resolveApiDockLookup(className: string, methodName: string) {
  const indexed = apiDockMethodIndex.lookup(methodName)
  const normalizedClassName = className.replace(/::/g, '/')
  if (indexed && indexed.className.toLowerCase() === normalizedClassName.toLowerCase()) {
    return indexed
  }
  return {
    namespace: classifyApiDockNamespace(className),
    className: normalizedClassName,
    methodName,
  }
}

server.registerTool(
  'get_method_notes',
  {
    title: 'Get APIDock method notes',
    description: 'Fetches apidock.com\'s community notes and doc summary for a Ruby/Rails/RSpec method — call this before generating code that uses an unfamiliar method, to ground it in real-world gotchas (skipped validations/callbacks, deprecated behavior, surprising defaults) that official docs often miss.',
    inputSchema: {
      method_name: z.string().describe('Method name, e.g. "update_attribute"'),
      class_name: z.string().describe('Class or module name, e.g. "ActiveRecord::Base"'),
    },
  },
  async ({ method_name, class_name }) => {
    const lookup = resolveApiDockLookup(class_name, method_name)
    const notes = await apiDockClient.fetchNotes(lookup)
    if (!notes) {
      return { content: [{ type: 'text', text: `No APIDock notes found for ${class_name}#${method_name}.` }] }
    }
    return { content: [{ type: 'text', text: JSON.stringify(notes, null, 2) }] }
  },
)

const rubyDocProvider = new RubyDocProvider()

function loadLockedGemVersions(): Map<string, string> {
  const lockPath = path.join(workspaceRoot, 'Gemfile.lock')
  if (!fs.existsSync(lockPath)) {return new Map()}
  return parseGemfileLock(fs.readFileSync(lockPath, 'utf8'))
}

server.registerTool(
  'get_gem_documentation',
  {
    title: 'Get gem documentation (rubydoc.info)',
    description: 'Fetches YARD documentation (signature, description, params, return type) for a class/method in one of this project\'s dependency gems, at the exact version locked in Gemfile.lock — use this before generating code that calls into a gem (Pundit, Sidekiq, dry-rb, etc.) whose API isn\'t in RailsForge\'s own indexed patterns.',
    inputSchema: {
      gem_name: z.string().optional().describe('Gem name as it appears in Gemfile.lock, e.g. "pundit". Omitted: resolved from class_name\'s top-level namespace.'),
      class_name: z.string().describe('Class or module name, e.g. "Pundit" or "Sidekiq::Client"'),
      method_name: z.string().describe('Method name, e.g. "authorize"'),
      version: z.string().optional().describe('Exact gem version. Omitted: read from this project\'s Gemfile.lock.'),
    },
  },
  async ({ gem_name, class_name, method_name, version }) => {
    const lockedVersions = loadLockedGemVersions()

    let gem = gem_name
    let resolvedVersion = version
    if (!gem) {
      const resolved = new GemSymbolResolver(lockedVersions).resolve(class_name)
      if (!resolved) {
        return { content: [{ type: 'text', text: `Could not determine which gem defines "${class_name}" — pass gem_name explicitly, or check it's listed in this project's Gemfile.lock.` }] }
      }
      gem = resolved.gem
      resolvedVersion = resolvedVersion ?? resolved.version
    }
    resolvedVersion = resolvedVersion ?? lockedVersions.get(gem)
    if (!resolvedVersion) {
      return { content: [{ type: 'text', text: `No locked version found for gem "${gem}" in Gemfile.lock, and no version was given.` }] }
    }

    const entry = await rubyDocProvider.fetchMethod(gem, resolvedVersion, class_name, method_name)
    if (!entry) {
      return { content: [{ type: 'text', text: `No rubydoc.info documentation found for ${gem}@${resolvedVersion} ${class_name}#${method_name}.` }] }
    }
    return { content: [{ type: 'text', text: JSON.stringify(entry, null, 2) }] }
  },
)

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main()
