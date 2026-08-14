/**
 * PatternRecognitionEngine - AST & structural heuristics to detect design patterns and code smells
 */

export interface PatternOpportunity {
  id: string
  patternName: string
  category: 'creational' | 'structural' | 'behavioral' | 'smell'
  title: string
  message: string
  line: number
  refactoringGuruUrl?: string
  suggestedAction?: string
}

export class PatternRecognitionEngine {
  analyzeCode(code: string, fileName: string): PatternOpportunity[] {
    const opportunities: PatternOpportunity[] = []
    const lines = code.split('\n')

    this.detectConditionalStrategy(lines, opportunities)
    this.detectSingletonHazard(lines, opportunities)
    this.detectFacadeOpportunity(lines, opportunities)
    this.detectPrimitiveObsession(lines, opportunities)
    this.detectFormObjectOpportunity(fileName, lines, opportunities)

    return opportunities
  }

  private detectConditionalStrategy(lines: string[], list: PatternOpportunity[]): void {
    let caseLine = -1
    let whenCount = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.startsWith('case ')) {
        caseLine = i + 1
        whenCount = 0
      } else if (caseLine > 0 && line.startsWith('when ')) {
        whenCount++
        if (whenCount >= 3) {
          list.push({
            id: 'REPLACE-CONDITIONAL-STRATEGY',
            patternName: 'Strategy Pattern',
            category: 'behavioral',
            title: 'Replace Conditional with Strategy Object',
            message: 'Multi-branch conditional detected. Refactor into Strategy classes to isolate algorithms and adhere to Open/Closed Principle.',
            line: caseLine,
            refactoringGuruUrl: 'https://refactoring.guru/design-patterns/strategy/ruby',
            suggestedAction: 'railsforge.replaceWithStrategy',
          })
          caseLine = -1
        }
      } else if (line === 'end' && caseLine > 0) {
        caseLine = -1
      }
    }
  }

  private detectSingletonHazard(lines: string[], list: PatternOpportunity[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line.includes('include Singleton') || line.startsWith('@@instance')) {
        list.push({
          id: 'SINGLETON-HAZARD',
          patternName: 'Singleton Anti-Pattern',
          category: 'creational',
          title: 'Singleton Hazard in Rails',
          message: 'Singleton creates shared global state and impairs test concurrency. Prefer Dependency Injection or Rails services.',
          line: i + 1,
          refactoringGuruUrl: 'https://refactoring.guru/design-patterns/singleton/ruby',
        })
      }
    }
  }

  private detectFacadeOpportunity(lines: string[], list: PatternOpportunity[]): void {
    const subsystemCalls = new Set<string>()
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const matches = line.match(/\b([A-Z][a-zA-Z0-9]+(?:Service|Client|Gateway|Notifier|Mailer))\b/g)
      if (matches) {
        matches.forEach(m => subsystemCalls.add(m))
      }
    }

    if (subsystemCalls.size >= 4) {
      list.push({
        id: 'INTRODUCE-FACADE',
        patternName: 'Facade Pattern',
        category: 'structural',
        title: 'Introduce Facade Service',
        message: `High subsystem coupling (${subsystemCalls.size} clients/services called). Introduce a Facade Service to encapsulate complex orchestration.`,
        line: 1,
        refactoringGuruUrl: 'https://refactoring.guru/design-patterns/facade/ruby',
      })
    }
  }

  private detectPrimitiveObsession(lines: string[], list: PatternOpportunity[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/\b(?:amount_cents|currency|start_date|end_date|latitude|longitude)\b/.test(line)) {
        if (line.includes('def ') || line.includes('validates ')) {
          list.push({
            id: 'PRIMITIVE-OBSESSION',
            patternName: 'Value Object Pattern',
            category: 'smell',
            title: 'Primitive Obsession (Value Object Opportunity)',
            message: 'Domain concepts represented by raw primitives. Encapsulate into a Value Object (e.g. Money, DateRange) using Data.define.',
            line: i + 1,
            refactoringGuruUrl: 'https://refactoring.guru/refactoring/smells/primitive-obsession',
          })
          break
        }
      }
    }
  }

  private detectFormObjectOpportunity(fileName: string, lines: string[], list: PatternOpportunity[]): void {
    if (!fileName.includes('/app/controllers/')) {return}

    let nestedParamsCount = 0
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('.permit(') && (line.includes('_attributes') || line.includes(':['))) {
        nestedParamsCount++
      }
    }

    if (nestedParamsCount >= 2) {
      list.push({
        id: 'INTRODUCE-FORM-OBJECT',
        patternName: 'Form Object Pattern',
        category: 'structural',
        title: 'Introduce Form Object',
        message: 'Complex nested parameters and multi-model updates detected in controller. Extract into an ActiveModel Form Object.',
        line: 1,
        refactoringGuruUrl: 'https://refactoring.guru/design-patterns',
      })
    }
  }
}
