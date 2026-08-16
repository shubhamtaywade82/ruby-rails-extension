/**
 * MinimalDependencyGraph - AST-free collaborator graph between this project's own
 * Service/Query/Form/Policy/Decorator patterns (as indexed by ProjectPatternIndexer).
 *
 * Deliberately dependency-light: regex over file text, not a real Ruby parser. Good
 * enough to flag "ServiceA hard-codes ServiceB.call(...) instead of injecting it" and
 * to answer "who calls this service", without adding tree-sitter/AST tooling.
 */

import { ProjectPatternIndexer, IndexedPattern } from '../patterns/ProjectPatternIndexer'

export interface DependencyEdge {
  from: string
  to: string
  line: number
  /** true when the collaborator is referenced as `Foo.call(...)`/`Foo.new(...)` directly, rather than injected. */
  hardCoded: boolean
}

export class MinimalDependencyGraph {
  private edges: DependencyEdge[] = []

  constructor(
    private indexer: ProjectPatternIndexer,
    private readFile: (filePath: string) => string,
  ) {}

  rebuild(): void {
    this.edges = []
    const patterns = this.indexer.getAllPatterns()
    const knownNames = new Set(patterns.map(p => p.name))

    for (const pattern of patterns) {
      let content: string
      try {
        content = this.readFile(pattern.filePath)
      } catch {
        continue
      }
      this.extractEdgesFromFile(pattern, content, knownNames)
    }
  }

  private extractEdgesFromFile(pattern: IndexedPattern, content: string, knownNames: Set<string>): void {
    const constructorInjected = this.constructorInjectedNames(content)

    const hardCodedRegex = /\b([A-Z][A-Za-z0-9_]*)\.(call|new)\b/g
    let match: RegExpExecArray | null
    while ((match = hardCodedRegex.exec(content)) !== null) {
      const [, name] = match
      if (name === pattern.name || !knownNames.has(name)) {continue}

      this.edges.push({
        from: pattern.name,
        to: name,
        line: content.slice(0, match.index).split('\n').length,
        hardCoded: !constructorInjected.has(name),
      })
    }
  }

  /** Names passed into `initialize` that look like collaborator classes (e.g. `payment_gateway: PaymentGateway`). */
  private constructorInjectedNames(content: string): Set<string> {
    const injected = new Set<string>()
    const initMatch = /def\s+initialize\s*\(([^)]*)\)/.exec(content)
    if (!initMatch) {return injected}

    const defaultRegex = /[A-Z][A-Za-z0-9_]*/g
    let match: RegExpExecArray | null
    while ((match = defaultRegex.exec(initMatch[1])) !== null) {
      injected.add(match[0])
    }
    return injected
  }

  getCollaborators(patternName: string): DependencyEdge[] {
    return this.edges.filter(e => e.from === patternName)
  }

  getHardCodedCollaborators(patternName: string): DependencyEdge[] {
    return this.getCollaborators(patternName).filter(e => e.hardCoded)
  }

  getCallers(patternName: string): DependencyEdge[] {
    return this.edges.filter(e => e.to === patternName)
  }

  getAllEdges(): DependencyEdge[] {
    return this.edges
  }
}
