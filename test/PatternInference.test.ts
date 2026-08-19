import { describe, it, expect } from 'vitest'
import { ProjectPatternIndexer } from '../src/patterns/ProjectPatternIndexer'
import { inferPatternGuidelines, inferAllPatternGuidelines } from '../src/patterns/PatternInference'

function serviceFile(className: string, superclass: string, methodName: string): string {
  return `class ${className} < ${superclass}\n  def ${methodName}\n  end\nend\n`
}

describe('inferPatternGuidelines', () => {
  it('returns null when there are no patterns of this type', () => {
    expect(inferPatternGuidelines([])).toBeNull()
  })

  it('infers the majority base class and primary method when patterns agree', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/create_order_service.rb', serviceFile('CreateOrderService', 'Interactor', 'call'))
    indexer.indexFile('/app/services/cancel_order_service.rb', serviceFile('CancelOrderService', 'Interactor', 'call'))
    indexer.indexFile('/app/services/refund_service.rb', serviceFile('RefundService', 'Interactor', 'call'))

    const result = inferPatternGuidelines(indexer.getPatternsByType('service'))
    expect(result).toEqual({
      baseClass: 'Interactor',
      methodName: 'call',
      sampleSize: 3,
      confidence: 1,
    })
  })

  it('reports fractional confidence when patterns disagree on base class', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'ApplicationService', 'call'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'ApplicationService', 'call'))
    indexer.indexFile('/app/services/c_service.rb', serviceFile('CService', 'Interactor', 'call'))

    const result = inferPatternGuidelines(indexer.getPatternsByType('service'))
    expect(result?.baseClass).toBe('ApplicationService')
    expect(result?.confidence).toBeCloseTo(2 / 3)
  })

  it('returns null baseClass when no pattern has a superclass at all', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/plain_service.rb', 'class PlainService\n  def call\n  end\nend\n')

    const result = inferPatternGuidelines(indexer.getPatternsByType('service'))
    expect(result?.baseClass).toBeNull()
    expect(result?.confidence).toBe(0)
  })
})

describe('inferAllPatternGuidelines', () => {
  it('only reports pattern types that actually have indexed patterns', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/x_service.rb', serviceFile('XService', 'ApplicationService', 'call'))

    const result = inferAllPatternGuidelines(indexer)
    expect(result.service).toBeDefined()
    expect(result.query).toBeUndefined()
    expect(result.policy).toBeUndefined()
  })
})
