/**
 * EffectiveGuidelines - Combines `.railsforge.yml` (explicit) and PatternInference
 * (learned from the codebase) into one answer per field, with a clear precedence:
 * explicit config > confident inference > RailsForge's built-in Rails-generator default.
 * `source` on each field says which one won, so a consumer (or `get_project_guidelines`)
 * can show its work instead of presenting a guess as certainty.
 *
 * Scoped to service objects only, not all six pattern types ProjectPatternIndexer knows
 * about: `.railsforge.yml`'s schema only details service_objects (base class, method
 * name, pattern style) — presenters/policies only get a directory override, nothing to
 * merge — so this is where the real per-field merge logic actually earns its complexity.
 */

import { ProjectPatternIndexer } from '../patterns/ProjectPatternIndexer'
import { inferPatternGuidelines } from '../patterns/PatternInference'
import { loadProjectGuidelines, ProjectGuidelines } from './ProjectGuidelines'

export type GuidelineSource = 'config' | 'inferred' | 'default'

export interface EffectiveServiceObjectGuidelines {
  dir: string
  baseClass: string
  methodName: string
  source: { dir: GuidelineSource; baseClass: GuidelineSource; methodName: GuidelineSource }
}

const DEFAULT_SERVICE_DIR = 'app/services'
const DEFAULT_SERVICE_BASE_CLASS = 'ApplicationService'
const DEFAULT_SERVICE_METHOD_NAME = 'call'

/** An inferred base class is only trusted once it's the majority (not just plurality) of a reasonably-sized sample — a single one-off superclass among 2 services shouldn't override the Rails default. */
const MIN_INFERENCE_CONFIDENCE = 0.5
const MIN_INFERENCE_SAMPLE_SIZE = 2

export function getEffectiveServiceObjectGuidelines(
  explicit: ProjectGuidelines | null,
  indexer: ProjectPatternIndexer,
): EffectiveServiceObjectGuidelines {
  const configured = explicit?.architecture?.serviceObjects
  const inferred = inferPatternGuidelines(indexer.getPatternsByType('service'))
  const trustInference = Boolean(inferred) && inferred!.sampleSize >= MIN_INFERENCE_SAMPLE_SIZE && inferred!.confidence >= MIN_INFERENCE_CONFIDENCE

  const dir = configured?.dir ?? DEFAULT_SERVICE_DIR
  const baseClass = configured?.baseClass ?? (trustInference && inferred!.baseClass ? inferred!.baseClass : DEFAULT_SERVICE_BASE_CLASS)
  const methodName = configured?.methodName ?? (trustInference && inferred!.methodName ? inferred!.methodName : DEFAULT_SERVICE_METHOD_NAME)

  return {
    dir,
    baseClass,
    methodName,
    source: {
      dir: configured?.dir ? 'config' : 'default',
      baseClass: configured?.baseClass ? 'config' : trustInference && inferred!.baseClass ? 'inferred' : 'default',
      methodName: configured?.methodName ? 'config' : trustInference && inferred!.methodName ? 'inferred' : 'default',
    },
  }
}

/** One-shot: load `.railsforge.yml` (if present) and merge it with inference, for a command/MCP-tool call site that doesn't already have the config loaded. */
export function loadEffectiveServiceObjectGuidelines(workspaceRoot: string, indexer: ProjectPatternIndexer): EffectiveServiceObjectGuidelines {
  return getEffectiveServiceObjectGuidelines(loadProjectGuidelines(workspaceRoot), indexer)
}
