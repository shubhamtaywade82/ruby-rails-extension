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
import { PersistentDependencyGraph } from '../indexer/PersistentDependencyGraph'
import { DuplicateMethodDetector } from '../indexer/DuplicateMethodDetector'

const workspaceRoot = process.env.RAILSFORGE_WORKSPACE_ROOT ?? process.cwd()

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
    if (entry.name === 'node_modules' || entry.name === 'vendor') {continue}
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

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

void main()
