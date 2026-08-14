import { describe, it, expect } from 'vitest'
import { VersionDocsEngine } from '../src/docs/VersionDocsEngine'

describe('VersionDocsEngine', () => {
  const engine = new VersionDocsEngine()

  it('retrieves accurate documentation and guides for Rails DSL keywords', () => {
    const hasManyDoc = engine.getDoc('has_many')
    expect(hasManyDoc).toBeDefined()
    expect(hasManyDoc?.title).toContain('has_many')
    expect(hasManyDoc?.guideUrl).toContain('association_basics.html')

    const turboDoc = engine.getDoc('turbo_stream')
    expect(turboDoc).toBeDefined()
    expect(turboDoc?.railsVersionMin).toBe(7)

    const delegateDoc = engine.getDoc('delegate')
    expect(delegateDoc).toBeDefined()
    expect(delegateDoc?.summary).toContain('Law of Demeter')
  })
})
