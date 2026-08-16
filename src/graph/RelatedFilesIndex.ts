/**
 * RelatedFilesIndex - Reverse index answering "what references this model/pattern"
 * so CodeLens/hover can show `4 Services · 2 Queries · 1 Policy · 6 Specs` on a model
 * or service without the developer opening each file to check.
 *
 * Pure regex/heuristic over ProjectPatternIndexer's patterns + spec files, matching
 * the rest of the codebase's dependency-light approach (see MinimalDependencyGraph).
 */

import { ProjectPatternIndexer, IndexedPattern, PatternType } from '../patterns/ProjectPatternIndexer'

export interface ModelRelations {
  patternsByType: Partial<Record<PatternType, IndexedPattern[]>>
  specCount: number
}

const ACTIVE_RECORD_USAGE = ['find', 'find_by', 'create', 'create!', 'new', 'where', 'all', 'includes', 'joins']

export class RelatedFilesIndex {
  private specsByClass: Map<string, Set<string>> = new Map()

  constructor(
    private indexer: ProjectPatternIndexer,
    private readFile: (filePath: string) => string,
  ) {}

  indexSpecFile(filePath: string, content: string): void {
    this.removeSpecFile(filePath)
    const className = this.describedClassName(content)
    if (!className) {return}

    const set = this.specsByClass.get(className) ?? new Set<string>()
    set.add(filePath)
    this.specsByClass.set(className, set)
  }

  private describedClassName(content: string): string | undefined {
    const rspecMatch = /^\s*(?:RSpec\.)?describe\s+([A-Z][\w:]*)/m.exec(content)
    if (rspecMatch) {return rspecMatch[1]}

    // Minitest convention: `class CreateOrderServiceTest < ActiveSupport::TestCase`
    const minitestMatch = /^\s*class\s+([A-Z]\w*)Test\s*</m.exec(content)
    return minitestMatch?.[1]
  }

  removeSpecFile(filePath: string): void {
    for (const set of this.specsByClass.values()) {
      set.delete(filePath)
    }
  }

  getSpecCount(className: string): number {
    return this.specsByClass.get(className)?.size ?? 0
  }

  getSpecFiles(className: string): string[] {
    return Array.from(this.specsByClass.get(className) ?? [])
  }

  /** Patterns (services/queries/policies/...) that reference `modelName` in name or body. */
  getModelRelations(modelName: string): ModelRelations {
    const patternsByType: Partial<Record<PatternType, IndexedPattern[]>> = {}

    for (const pattern of this.indexer.getAllPatterns()) {
      if (!this.relatesToModel(pattern, modelName)) {continue}
      const list = patternsByType[pattern.type] ?? []
      list.push(pattern)
      patternsByType[pattern.type] = list
    }

    return { patternsByType, specCount: this.getSpecCount(modelName) }
  }

  private relatesToModel(pattern: IndexedPattern, modelName: string): boolean {
    if (pattern.name.includes(modelName)) {return true}

    let content: string
    try {
      content = this.readFile(pattern.filePath)
    } catch {
      return false
    }

    const usageRegex = new RegExp(`\\b${modelName}\\.(${ACTIVE_RECORD_USAGE.join('|')})\\b`)
    return usageRegex.test(content)
  }
}
