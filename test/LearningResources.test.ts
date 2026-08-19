import { describe, it, expect } from 'vitest'
import { getLearningResource } from '../src/principles/LearningResources'

describe('getLearningResource', () => {
  it('returns a resource for each of DesignPrincipleLinter\'s diagnostic ids', () => {
    for (const id of ['SRP-FAT-CLASS', 'DEMETER-VIOLATION', 'KISS-METAPROGRAMMING', 'YAGNI-UNUSED-PRIVATE']) {
      const resource = getLearningResource(id)
      expect(resource).not.toBeNull()
      expect(resource!.book.length).toBeGreaterThan(0)
      expect(resource!.chapter.length).toBeGreaterThan(0)
      expect(resource!.note.length).toBeGreaterThan(0)
    }
  })

  it('returns null for an unknown diagnostic id', () => {
    expect(getLearningResource('SOME-UNKNOWN-ID')).toBeNull()
  })
})
