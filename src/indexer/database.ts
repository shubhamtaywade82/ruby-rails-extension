/**
 * database - SQLite schema for the persistent AST-backed index (Phase 12).
 *
 * One writer (the indexer worker thread), many readers (CodeLens/hover/commands on
 * the extension host) — SQLite's WAL mode supports exactly that concurrency model
 * from separate `Database` connections to the same file, which is why the worker and
 * the main thread each open their own connection rather than sharing one across the
 * thread boundary (better-sqlite3 connections aren't thread-safe to share directly).
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3')

export type SqliteDatabase = InstanceType<typeof Database>

export function openIndexDatabase(dbPath: string, readonly = false): SqliteDatabase {
  const db: SqliteDatabase = new Database(dbPath, { readonly, fileMustExist: readonly })
  if (!readonly) {
    db.pragma('journal_mode = WAL')
    migrate(db)
  }
  return db
}

function migrate(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS symbols (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      superclass TEXT,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      includes TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
    CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path);

    CREATE TABLE IF NOT EXISTS methods (
      id TEXT PRIMARY KEY,
      symbol_id TEXT NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      is_public INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      normalized_body TEXT NOT NULL,
      body_tokens TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_methods_symbol ON methods(symbol_id);
    CREATE INDEX IF NOT EXISTS idx_methods_file ON methods(file_path);

    CREATE TABLE IF NOT EXISTS dependencies (
      from_name TEXT NOT NULL,
      to_name TEXT NOT NULL,
      kind TEXT NOT NULL,
      line INTEGER NOT NULL,
      hard_coded INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      PRIMARY KEY (from_name, to_name, kind, line, file_path)
    );
    CREATE INDEX IF NOT EXISTS idx_dependencies_from ON dependencies(from_name);
    CREATE INDEX IF NOT EXISTS idx_dependencies_to ON dependencies(to_name);

    CREATE TABLE IF NOT EXISTS embeddings (
      symbol_id TEXT PRIMARY KEY REFERENCES symbols(id) ON DELETE CASCADE,
      content_hash TEXT NOT NULL,
      vector TEXT NOT NULL
    );
  `)
}
