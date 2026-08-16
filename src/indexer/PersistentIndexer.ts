/**
 * PersistentIndexer - parses a Ruby file via RubyAstParser and upserts its classes/
 * methods/dependency edges into the SQLite index. Pure enough to unit test directly
 * against an in-memory database — the worker thread (indexer.worker.ts) is a thin
 * message-loop wrapper around these same functions.
 */

import * as crypto from 'crypto'
import { RubyAstParser, ParsedClass } from './RubyAstParser'
import { SqliteDatabase } from './database'

function contentHash(content: string): string {
  return crypto.createHash('sha1').update(content).digest('hex')
}

function normalizeMethodBody(bodyText: string): string {
  // Strip the `def name(...)`/`end` wrapper and leading indentation so two methods
  // with the same logic but different names/whitespace still compare as similar.
  const lines = bodyText.split('\n').slice(1, -1)
  return lines.map(l => l.trim()).filter(Boolean).join('\n')
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_]+/).filter(t => t.length > 1)
}

export function indexFileIntoDb(db: SqliteDatabase, filePath: string, content: string, parser: RubyAstParser): void {
  const hash = contentHash(content)
  const existing = db.prepare('SELECT id, content_hash FROM symbols WHERE file_path = ?').all(filePath) as Array<{ id: string; content_hash: string }>
  if (existing.length > 0 && existing.every(e => e.content_hash === hash)) {
    return // unchanged since last index
  }

  removeFileFromDb(db, filePath)

  const classes = parser.parseClasses(content)
  const now = Date.now()

  const insertSymbol = db.prepare(`
    INSERT INTO symbols (id, name, superclass, file_path, start_line, end_line, includes, content_hash, updated_at)
    VALUES (@id, @name, @superclass, @file_path, @start_line, @end_line, @includes, @content_hash, @updated_at)
  `)
  const insertMethod = db.prepare(`
    INSERT INTO methods (id, symbol_id, name, is_public, file_path, start_line, end_line, normalized_body, body_tokens)
    VALUES (@id, @symbol_id, @name, @is_public, @file_path, @start_line, @end_line, @normalized_body, @body_tokens)
  `)
  const insertDependency = db.prepare(`
    INSERT OR IGNORE INTO dependencies (from_name, to_name, kind, line, hard_coded, file_path)
    VALUES (@from_name, @to_name, @kind, @line, @hard_coded, @file_path)
  `)

  const tx = db.transaction((parsedClasses: ParsedClass[]) => {
    for (const klass of parsedClasses) {
      const symbolId = `${filePath}::${klass.name}`
      insertSymbol.run({
        id: symbolId,
        name: klass.name,
        superclass: klass.superclass,
        file_path: filePath,
        start_line: klass.startLine,
        end_line: klass.endLine,
        includes: JSON.stringify(klass.includes),
        content_hash: hash,
        updated_at: now,
      })

      const constructorParams = new Set(klass.methods.find(m => m.name === 'initialize')?.params ?? [])

      for (const method of klass.methods) {
        const normalized = normalizeMethodBody(method.bodyText)
        insertMethod.run({
          id: `${symbolId}#${method.name}:${method.startLine}`,
          symbol_id: symbolId,
          name: method.name,
          is_public: method.isPublic ? 1 : 0,
          file_path: filePath,
          start_line: method.startLine,
          end_line: method.endLine,
          normalized_body: normalized,
          body_tokens: JSON.stringify(tokenize(normalized)),
        })
      }

      for (const call of klass.calls) {
        if (!call.receiver || !/^[A-Z]/.test(call.receiver)) {continue}
        if (!['call', 'new'].includes(call.method)) {continue}

        insertDependency.run({
          from_name: klass.name,
          to_name: call.receiver,
          kind: 'call',
          line: call.line,
          hard_coded: constructorParams.has(call.receiver) ? 0 : 1,
          file_path: filePath,
        })
      }

      for (const include of klass.includes) {
        insertDependency.run({
          from_name: klass.name,
          to_name: include,
          kind: 'include',
          line: klass.startLine,
          hard_coded: 0,
          file_path: filePath,
        })
      }
    }
  })
  tx(classes)
}

export function removeFileFromDb(db: SqliteDatabase, filePath: string): void {
  db.prepare('DELETE FROM symbols WHERE file_path = ?').run(filePath)
  db.prepare('DELETE FROM methods WHERE file_path = ?').run(filePath)
  db.prepare('DELETE FROM dependencies WHERE file_path = ?').run(filePath)
}
