/**
 * PatternInference - Auto-learns a project's own conventions (base class, primary method
 * name) from patterns ProjectPatternIndexer already found, for when there's no
 * `.railsforge.yml` telling RailsForge explicitly. Deliberately reuses
 * ProjectPatternIndexer's existing index rather than re-scanning the filesystem — no new
 * file-walking, no new indexing pass, just aggregation over data already collected for
 * `find_similar_pattern`/the pattern catalog.
 *
 * One real limitation, worth stating rather than glossing over: ProjectPatternIndexer only
 * ever looks inside a fixed set of conventional directories (`/services/`, `/queries/`,
 * etc. — see its own DIR_TYPE_MAP). So this can genuinely learn "this project's services
 * inherit from `Interactor`, not `ApplicationService`" (real inference, since nothing told
 * it that superclass name in advance), but it can't discover that a project keeps its
 * service-equivalent objects in `lib/operations/` instead — that's what `.railsforge.yml`'s
 * `service_objects_dir` override exists for; inference alone can't find a directory it
 * never looks in.
 */

import { IndexedPattern, PatternType, ProjectPatternIndexer } from './ProjectPatternIndexer'

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
