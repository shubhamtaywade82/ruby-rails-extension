import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { describe, it, expect, afterEach } from 'vitest'
import { ProjectPatternIndexer } from '../src/patterns/ProjectPatternIndexer'
import { inferPatternGuidelines, inferAllPatternGuidelines, findServiceObjectsDir, indexServiceObjectsDir } from '../src/patterns/PatternInference'

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

describe('findServiceObjectsDir', () => {
  let tmpRoot: string

  afterEach(() => {
    if (tmpRoot) {fs.rmSync(tmpRoot, { recursive: true, force: true })}
  })

  it('returns null when none of the conventional directories exist', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-svcdir-'))
    expect(findServiceObjectsDir(tmpRoot)).toBeNull()
  })

  it('finds app/services when present', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-svcdir-'))
    fs.mkdirSync(path.join(tmpRoot, 'app', 'services'), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'app', 'services', 'x_service.rb'), serviceFile('XService', 'Base', 'call'))
    expect(findServiceObjectsDir(tmpRoot)).toBe('app/services')
  })

  it('falls back to app/operations when app/services does not exist', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-svcdir-'))
    fs.mkdirSync(path.join(tmpRoot, 'app', 'operations'), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'app', 'operations', 'x_operation.rb'), serviceFile('XOperation', 'Base', 'call'))
    expect(findServiceObjectsDir(tmpRoot)).toBe('app/operations')
  })

  it('ignores an empty directory with no .rb files and keeps looking', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-svcdir-'))
    fs.mkdirSync(path.join(tmpRoot, 'app', 'services'), { recursive: true })
    fs.mkdirSync(path.join(tmpRoot, 'app', 'operations'), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'app', 'operations', 'x_operation.rb'), serviceFile('XOperation', 'Base', 'call'))
    expect(findServiceObjectsDir(tmpRoot)).toBe('app/operations')
  })
})

describe('indexServiceObjectsDir', () => {
  let tmpRoot: string

  afterEach(() => {
    if (tmpRoot) {fs.rmSync(tmpRoot, { recursive: true, force: true })}
  })

  it('indexes .rb files in the given directory as service patterns', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-svcdir-'))
    fs.mkdirSync(path.join(tmpRoot, 'app', 'operations'), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'app', 'operations', 'create_order.rb'), serviceFile('CreateOrder', 'Interactor', 'run'))
    fs.writeFileSync(path.join(tmpRoot, 'app', 'operations', 'cancel_order.rb'), serviceFile('CancelOrder', 'Interactor', 'run'))
    fs.writeFileSync(path.join(tmpRoot, 'app', 'operations', 'README.md'), 'not ruby')

    const patterns = indexServiceObjectsDir(tmpRoot, 'app/operations')
    expect(patterns).toHaveLength(2)
    expect(patterns.every(p => p.type === 'service')).toBe(true)
    expect(patterns.map(p => p.superclass)).toEqual(['Interactor', 'Interactor'])
  })

  it('returns an empty array when the directory does not exist', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-svcdir-'))
    expect(indexServiceObjectsDir(tmpRoot, 'app/operations')).toEqual([])
  })
})
