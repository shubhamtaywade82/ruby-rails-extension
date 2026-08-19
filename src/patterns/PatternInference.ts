/**
 * PatternInference - Auto-learns a project's own conventions (base class, primary method
 * name) from patterns ProjectPatternIndexer already found, for when there's no
 * `.railsforge.yml` telling RailsForge explicitly. `inferPatternGuidelines` deliberately
 * reuses ProjectPatternIndexer's existing index rather than re-scanning the filesystem —
 * no new file-walking, just aggregation over data already collected for
 * `find_similar_pattern`/the pattern catalog.
 *
 * That data only ever comes from a fixed set of conventional directories, though (see
 * ProjectPatternIndexer's own DIR_TYPE_MAP), so a project keeping its service-equivalent
 * objects in `app/operations` instead of `app/services` would otherwise never be inferred
 * from at all — not just "the directory name is unknown," inference would find zero
 * patterns and silently fall back to Rails' defaults no matter how consistent the
 * project's own `app/operations` convention actually is. `findServiceObjectsDir` +
 * `indexServiceObjectsDir` close that gap with a small, separate directory-name scan
 * (checked in a fixed priority order, first match wins) purpose-built for service
 * objects specifically — the one pattern type `.railsforge.yml` lets a team override the
 * directory for.
 */

import * as fs from 'fs'
import * as path from 'path'
import { IndexedPattern, PatternType, ProjectPatternIndexer } from './ProjectPatternIndexer'

/** Checked in priority order; the first directory that exists and contains at least one .rb file wins. */
const ALTERNATE_SERVICE_OBJECT_DIRS = ['app/services', 'app/operations', 'app/interactors', 'lib/services', 'lib/operations']

export interface InferredPatternGuidelines {
  /** Most common superclass among indexed patterns of this type, or null if none share one (e.g. plain-object/module pattern, or too few samples). */
  baseClass: string | null
  /** Most common first public method name — the conventional "entry point" (`call`, `execute`, `run`, ...). */
  methodName: string | null
  sampleSize: number
  /** Share of `sampleSize` that agreed on `baseClass` (0 when baseClass is null). Callers should treat a low-confidence inference as a hint, not a rule. */
  confidence: number
}

export function inferPatternGuidelines(patterns: IndexedPattern[]): InferredPatternGuidelines | null {
  if (patterns.length === 0) {return null}

  const baseClasses = patterns.map(p => p.superclass).filter((s): s is string => Boolean(s))
  const primaryMethods = patterns.flatMap(p => (p.publicMethods.length > 0 ? [p.publicMethods[0]] : []))

  const bestBaseClass = mostCommon(baseClasses)
  const bestMethod = mostCommon(primaryMethods)

  return {
    baseClass: bestBaseClass?.value ?? null,
    methodName: bestMethod?.value ?? null,
    sampleSize: patterns.length,
    confidence: bestBaseClass ? bestBaseClass.count / patterns.length : 0,
  }
}

export function inferAllPatternGuidelines(indexer: ProjectPatternIndexer): Partial<Record<PatternType, InferredPatternGuidelines>> {
  const result: Partial<Record<PatternType, InferredPatternGuidelines>> = {}
  const types: PatternType[] = ['service', 'query', 'form', 'policy', 'decorator', 'concern']

  for (const type of types) {
    const inferred = inferPatternGuidelines(indexer.getPatternsByType(type))
    if (inferred) {result[type] = inferred}
  }

  return result
}

/**
 * Checks each of `ALTERNATE_SERVICE_OBJECT_DIRS` in priority order and returns the first
 * that exists and holds at least one `.rb` file — a project keeping its service-equivalent
 * objects somewhere other than `app/services` (`app/operations`, `app/interactors`, ...)
 * still gets found, without needing `.railsforge.yml` to say so first.
 */
export function findServiceObjectsDir(workspaceRoot: string): string | null {
  for (const dir of ALTERNATE_SERVICE_OBJECT_DIRS) {
    const full = path.join(workspaceRoot, dir)
    try {
      if (fs.statSync(full).isDirectory() && fs.readdirSync(full).some(f => f.endsWith('.rb'))) {
        return dir
      }
    } catch {
      // Directory doesn't exist (or isn't readable) — try the next candidate.
    }
  }
  return null
}

/**
 * A small, standalone scan of `dir`'s top-level `.rb` files, indexed as `service` patterns
 * regardless of whether `dir` matches ProjectPatternIndexer's own conventional-directory
 * list — for computing inference over a directory that list doesn't already cover. Uses a
 * fresh, throwaway indexer rather than mutating a shared one, so this never interferes
 * with the caller's own already-populated index.
 */
export function indexServiceObjectsDir(workspaceRoot: string, dir: string): IndexedPattern[] {
  const full = path.join(workspaceRoot, dir)
  let entries: string[]
  try {
    entries = fs.readdirSync(full)
  } catch {
    return []
  }

  const indexer = new ProjectPatternIndexer()
  for (const file of entries) {
    if (!file.endsWith('.rb')) {continue}
    const filePath = path.join(full, file)
    try {
      indexer.indexFileAs(filePath, fs.readFileSync(filePath, 'utf8'), 'service')
    } catch {
      // Skip an unreadable file rather than failing the whole scan.
    }
  }
  return indexer.getPatternsByType('service')
}

function mostCommon(values: string[]): { value: string; count: number } | null {
  if (values.length === 0) {return null}

  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  let best: { value: string; count: number } | null = null
  for (const [value, count] of counts) {
    if (!best || count > best.count) {best = { value, count }}
  }
  return best
}
