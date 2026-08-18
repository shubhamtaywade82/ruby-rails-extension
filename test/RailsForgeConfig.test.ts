import { describe, it, expect } from 'vitest'
import { buildExcludeGlob, isExcludedPath, DEFAULT_EXCLUDE_PATTERNS } from '../src/config/RailsForgeConfig'

describe('buildExcludeGlob', () => {
  it('returns null for an empty pattern list', () => {
    expect(buildExcludeGlob([])).toBeNull()
  })

  it('returns the single pattern unwrapped when there is only one', () => {
    expect(buildExcludeGlob(['**/node_modules/**'])).toBe('**/node_modules/**')
  })

  it('combines multiple patterns into a brace-group glob', () => {
    expect(buildExcludeGlob(['**/node_modules/**', '**/tmp/**'])).toBe('{**/node_modules/**,**/tmp/**}')
  })

  it('drops blank entries', () => {
    expect(buildExcludeGlob(['**/tmp/**', '  ', ''])).toBe('**/tmp/**')
  })
})

describe('isExcludedPath', () => {
  it('matches a file under an excluded directory', () => {
    expect(isExcludedPath('/repo/vendor/bundle/gems/foo.rb', DEFAULT_EXCLUDE_PATTERNS)).toBe(true)
    expect(isExcludedPath('/repo/tmp/cache/foo.rb', DEFAULT_EXCLUDE_PATTERNS)).toBe(true)
  })

  it('does not match a file outside any excluded directory', () => {
    expect(isExcludedPath('/repo/app/models/user.rb', DEFAULT_EXCLUDE_PATTERNS)).toBe(false)
  })

  it('respects custom exclude patterns', () => {
    expect(isExcludedPath('/repo/spec/dummy/db/schema.rb', ['**/spec/dummy/**'])).toBe(true)
    expect(isExcludedPath('/repo/db/schema.rb', ['**/spec/dummy/**'])).toBe(false)
  })
})
