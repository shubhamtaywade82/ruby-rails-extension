import { describe, it, expect } from 'vitest'
import { ProjectPatternIndexer } from '../src/patterns/ProjectPatternIndexer'
import { getEffectiveServiceObjectGuidelines } from '../src/config/EffectiveGuidelines'

function serviceFile(className: string, superclass: string, methodName: string): string {
  return `class ${className} < ${superclass}\n  def ${methodName}\n  end\nend\n`
}

describe('getEffectiveServiceObjectGuidelines', () => {
  it('falls back to RailsForge defaults with no config and no indexed patterns', () => {
    const result = getEffectiveServiceObjectGuidelines(null, new ProjectPatternIndexer())
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
      indexer,
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

    const result = getEffectiveServiceObjectGuidelines(null, indexer)
    expect(result.baseClass).toBe('Interactor')
    expect(result.methodName).toBe('run')
    expect(result.source.baseClass).toBe('inferred')
  })

  it('ignores inference from too small a sample (a single one-off service)', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/only_service.rb', serviceFile('OnlyService', 'SomeOneOffBase', 'call'))

    const result = getEffectiveServiceObjectGuidelines(null, indexer)
    expect(result.baseClass).toBe('ApplicationService')
    expect(result.source.baseClass).toBe('default')
  })

  it('ignores inference when the codebase itself disagrees (confidence below the bar)', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'BaseOne', 'call'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'BaseTwo', 'call'))
    indexer.indexFile('/app/services/c_service.rb', serviceFile('CService', 'BaseThree', 'call'))

    const result = getEffectiveServiceObjectGuidelines(null, indexer)
    expect(result.source.baseClass).toBe('default')
  })

  it('lets config override just the dir while inference still supplies the base class', () => {
    const indexer = new ProjectPatternIndexer()
    indexer.indexFile('/app/services/a_service.rb', serviceFile('AService', 'Interactor', 'call'))
    indexer.indexFile('/app/services/b_service.rb', serviceFile('BService', 'Interactor', 'call'))

    const result = getEffectiveServiceObjectGuidelines({ architecture: { serviceObjects: { dir: 'lib/operations' } } }, indexer)
    expect(result.dir).toBe('lib/operations')
    expect(result.source.dir).toBe('config')
    expect(result.baseClass).toBe('Interactor')
    expect(result.source.baseClass).toBe('inferred')
  })
})
