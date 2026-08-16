import { describe, it, expect } from 'vitest'
import { findDuplicateCallSites } from '../src/refactor/DuplicateCallSiteFinder'

describe('findDuplicateCallSites', () => {
  const snippet = `user = User.find(params[:id])\nuser.update!(status: 'active')`

  it('finds an exact duplicate of the snippet in another file', () => {
    const files = new Map([
      ['/repo/app/controllers/a_controller.rb', `def foo\n  ${snippet}\nend`],
      ['/repo/app/controllers/b_controller.rb', `def bar\n  ${snippet}\nend`],
    ])

    const results = findDuplicateCallSites(snippet, files, '/repo/app/controllers/a_controller.rb')

    expect(results).toHaveLength(1)
    expect(results[0].filePath).toBe('/repo/app/controllers/b_controller.rb')
  })

  it('excludes the source file itself even if it contains the snippet again', () => {
    const files = new Map([
      ['/repo/app/controllers/a_controller.rb', `${snippet}\n\n${snippet}`],
    ])

    const results = findDuplicateCallSites(snippet, files, '/repo/app/controllers/a_controller.rb')
    expect(results).toEqual([])
  })

  it('finds multiple occurrences within the same other file', () => {
    const files = new Map([
      ['/repo/app/controllers/b_controller.rb', `${snippet}\n\n${snippet}`],
    ])

    const results = findDuplicateCallSites(snippet, files, '/repo/app/controllers/a_controller.rb')
    expect(results).toHaveLength(2)
  })

  it('ignores snippets that are too short to safely match', () => {
    const files = new Map([['/repo/x.rb', 'foo']])
    expect(findDuplicateCallSites('foo', files, '/repo/other.rb')).toEqual([])
  })

  it('returns nothing when there are no duplicates', () => {
    const files = new Map([['/repo/app/controllers/b_controller.rb', 'something unrelated entirely']])
    expect(findDuplicateCallSites(snippet, files, '/repo/app/controllers/a_controller.rb')).toEqual([])
  })
})
