import { describe, it, expect } from 'vitest'
import { parseGemfileLock } from '../src/gems/GemfileLockParser'

const SAMPLE_LOCK = `
GEM
  remote: https://rubygems.org/
  specs:
    actionpack (7.1.3)
      actionview (= 7.1.3)
      activesupport (= 7.1.3)
    actionview (7.1.3)
      activesupport (= 7.1.3)
    activesupport (7.1.3)
    pundit (2.3.1)
    rails (7.1.3)
      actionpack (= 7.1.3)
    sidekiq (7.2.0)

PLATFORMS
  x86_64-linux

DEPENDENCIES
  pundit
  rails
  sidekiq

BUNDLED WITH
   2.5.3
`

describe('parseGemfileLock', () => {
  it('extracts every top-level locked gem and its exact version', () => {
    const versions = parseGemfileLock(SAMPLE_LOCK)
    expect(versions.get('pundit')).toBe('2.3.1')
    expect(versions.get('rails')).toBe('7.1.3')
    expect(versions.get('sidekiq')).toBe('7.2.0')
    expect(versions.get('actionpack')).toBe('7.1.3')
  })

  it('does not pick up a spec\'s own dependency lines (6-space indent)', () => {
    const versions = parseGemfileLock(SAMPLE_LOCK)
    // "activesupport (= 7.1.3)" under actionpack is a dependency constraint, not a lock
    expect(versions.get('activesupport')).toBe('7.1.3') // still found via its own top-level spec line
    // actionpack, actionview, activesupport, pundit, rails, sidekiq — one entry each,
    // despite each dependency constraint line also appearing (at 6-space indent).
    expect(versions.size).toBe(6)
  })

  it('returns an empty map for content with no GEM section', () => {
    expect(parseGemfileLock('').size).toBe(0)
  })
})
