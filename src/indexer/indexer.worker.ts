/**
 * indexer.worker - runs off the extension host thread so parsing a large workspace's
 * worth of Ruby files (tree-sitter) and writing to SQLite never blocks the UI. Thin by
 * design: all real logic lives in PersistentIndexer/database.ts, which are unit tested
 * directly against an in-memory database without needing a worker at all.
 */

import { parentPort, workerData } from 'worker_threads'
import { openIndexDatabase } from './database'
import { indexFileIntoDb, removeFileFromDb } from './PersistentIndexer'
import { RubyAstParser } from './RubyAstParser'

interface IndexFileMessage {
  type: 'index_file'
  requestId?: number
  filePath: string
  content: string
}
interface RemoveFileMessage {
  type: 'remove_file'
  requestId?: number
  filePath: string
}
type WorkerMessage = IndexFileMessage | RemoveFileMessage

if (parentPort) {
  const db = openIndexDatabase((workerData as { dbPath: string }).dbPath)
  const parser = new RubyAstParser()

  // Signals the DB file (and WAL mode) exist before the main thread tries to open its
  // own read-only connection to the same path — PersistentIndexClient.create() awaits this.
  parentPort.postMessage({ type: 'ready' })

  parentPort.on('message', (message: WorkerMessage) => {
    try {
      if (message.type === 'index_file') {
        indexFileIntoDb(db, message.filePath, message.content, parser)
      } else if (message.type === 'remove_file') {
        removeFileFromDb(db, message.filePath)
      }
      parentPort?.postMessage({ type: 'done', requestId: message.requestId, filePath: message.filePath })
    } catch (err) {
      parentPort?.postMessage({ type: 'error', requestId: message.requestId, filePath: message.filePath, message: String(err) })
    }
  })
}
