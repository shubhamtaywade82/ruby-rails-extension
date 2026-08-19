import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { describe, it, expect, afterEach } from 'vitest'
import { ProjectPatternIndexer } from '../src/patterns/ProjectPatternIndexer'
import { getEffectiveServiceObjectGuidelines, loadEffectiveServiceObjectGuidelines } from '../src/config/EffectiveGuidelines'

function serviceFile(className: string, superclass: string, methodName: string): string {
  return `class ${className} < ${superclass}\n  def ${methodName}\n  end\nend\n`
}

describe('getEffectiveServiceObjectGuidelines', () => {
  it('falls back to RailsForge defaults with no config and no indexed patterns', () => {
    const result = getEffectiveServiceObjectGuidelines(null, [])
    expect(result).toEqual({
      dir: 'app/services',
      baseClass: 'ApplicationService',
      methodName: 'call',
      source: { dir: 'default', baseClass: 'default', methodName: 'default' },
    })
  })

  it('explicit .railsforge.yml config always wins over inference', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'Interactor', 'call'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'Interactor', 'call'))

    const result = getEffectiveServiceObjectGuidelines(
      { architecture: { serviceObjects: { baseClass: 'ApplicationService', methodName: 'execute' } } },
      indexer.getPatternsByType('service'),
    )
    expect(result.baseClass).toBe('ApplicationService')
    expect(result.methodName).toBe('execute')
    expect(result.source.baseClass).toBe('config')
    expect(result.source.methodName).toBe('config')
  })

  it('uses inference when confidence and sample size clear the bar', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'Interactor', 'run'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'Interactor', 'run'))
    indexer.indexFile('/app/services/c_service.rb', serviceFile('CService', 'Interactor', 'run'))

    const result = getEffectiveServiceObjectGuidelines(null, indexer.getPatternsByType('service'))
    expect(result.baseClass).toBe('Interactor')
    expect(result.methodName).toBe('run')
    expect(result.source.baseClass).toBe('inferred')
  })

  it('ignores inference from too small a sample (a single one-off service)', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/only_service.rb', serviceFile('OnlyService', 'SomeOneOffBase', 'call'))

    const result = getEffectiveServiceObjectGuidelines(null, indexer.getPatternsByType('service'))
    expect(result.baseClass).toBe('ApplicationService')
    expect(result.source.baseClass).toBe('default')
  })

  it('ignores inference when the codebase itself disagrees (confidence below the bar)', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'BaseOne', 'call'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'BaseTwo', 'call'))
    indexer.indexFile('/app/services/c_service.rb', serviceFile('CService', 'BaseThree', 'call'))

    const result = getEffectiveServiceObjectGuidelines(null, indexer.getPatternsByType('service'))
    expect(result.source.baseClass).toBe('default')
  })

  it('lets a discoveredDir win when config does not specify one, tracked as "inferred"', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/operations/a_operation.rb', serviceFile('AOperation', 'Interactor', 'call'))
    indexer.indexFile('/app/operations/b_operation.rb', serviceFile('BOperation', 'Interactor', 'call'))

    const result = getEffectiveServiceObjectGuidelines(null, indexer.getPatternsByType('service'), 'app/operations')
    expect(result.dir).toBe('app/operations')
    expect(result.source.dir).toBe('inferred')
  })

  it('lets config override just the dir while inference still supplies the base class', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'Interactor', 'call'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'Interactor', 'call'))

    const result = getEffectiveServiceObjectGuidelines(
      { architecture: { serviceObjects: { dir: 'lib/operations' } } },
      indexer.getPatternsByType('service'),
    )
    expect(result.dir).toBe('lib/operations')
    expect(result.source.dir).toBe('config')
    expect(result.baseClass).toBe('Interactor')
    expect(result.source.baseClass).toBe('inferred')
  })
})

describe('loadEffectiveServiceObjectGuidelines', () => {
  let tmpRoot: string

  afterEach(() => {
    if (tmpRoot) {fs.rmSync(tmpRoot, { recursive: true, force: true })}
  })

  it('falls back to defaults for an empty project with no config and no services anywhere', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-load-guidelines-'))
    const result = loadEffectiveServiceObjectGuidelines(tmpRoot, new ProjectPatternIndexer())
    expect(result.dir).toBe('app/services')
    expect(result.source).toEqual({ dir: 'default', baseClass: 'default', methodName: 'default' })
  })

  it('uses the standard indexer\'s app/services patterns when it already found some', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-load-guidelines-'))
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'Interactor', 'call'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'Interactor', 'call'))

    const result = loadEffectiveServiceObjectGuidelines(tmpRoot, indexer)
    expect(result.baseClass).toBe('Interactor')
    expect(result.source.baseClass).toBe('inferred')
  })

  it('falls back to scanning app/operations on disk when the standard indexer found nothing there', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-load-guidelines-'))
    fs.mkdirSync(path.join(tmpRoot, 'app', 'operations'), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'app', 'operations', 'a_operation.rb'), serviceFile('AOperation', 'Interactor', 'run'))
    fs.writeFileSync(path.join(tmpRoot, 'app', 'operations', 'b_operation.rb'), serviceFile('BOperation', 'Interactor', 'run'))

    // The standard indexer never saw app/operations/ (not app/services/), so it's empty —
    // loadEffectiveServiceObjectGuidelines must go find app/operations on its own.
    const result = loadEffectiveServiceObjectGuidelines(tmpRoot, new ProjectPatternIndexer())
    expect(result.dir).toBe('app/operations')
    expect(result.baseClass).toBe('Interactor')
    expect(result.methodName).toBe('run')
    expect(result.source.baseClass).toBe('inferred')
  })

  it('scans an explicitly configured non-standard dir directly, even though the standard indexer never saw it', () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-load-guidelines-'))
    fs.mkdirSync(path.join(tmpRoot, 'lib', 'ops'), { recursive: true })
    fs.writeFileSync(path.join(tmpRoot, 'lib', 'ops', 'a_op.rb'), serviceFile('AOp', 'Dry::Monads::Do', 'run'))
    fs.writeFileSync(path.join(tmpRoot, 'lib', 'ops', 'b_op.rb'), serviceFile('BOp', 'Dry::Monads::Do', 'run'))
    fs.writeFileSync(path.join(tmpRoot, '.railsforge.yml'), 'architecture:\n  service_objects_dir: "lib/ops"\n')

    const result = loadEffectiveServiceObjectGuidelines(tmpRoot, new ProjectPatternIndexer())
    expect(result.dir).toBe('lib/ops')
    expect(result.source.dir).toBe('config')
    expect(result.baseClass).toBe('Dry::Monads::Do')
    expect(result.source.baseClass).toBe('inferred')
  })
})
