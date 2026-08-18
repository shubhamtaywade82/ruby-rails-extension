import { describe, it, expect } from 'vitest'
import { extractGemNameAtPosition } from '../src/gems/GemNameParser'

describe('extractGemNameAtPosition', () => {
  it('resolves the gem name when the cursor is inside a double-quoted gem call', () => {
    const line = 'gem "rails", "~> 7.1"'
    const char = line.indexOf('rails') + 2
    expect(extractGemNameAtPosition(line, char)).toBe('rails')
  })

  it('resolves the gem name when the cursor is inside a single-quoted gem call', () => {
    const line = "gem 'pg'"
    const char = line.indexOf('pg') + 1
    expect(extractGemNameAtPosition(line, char)).toBe('pg')
  })

  it('resolves gem names containing dots and hyphens', () => {
    const line = 'gem "view_component"'
    const char = line.indexOf('view_component') + 4
    expect(extractGemNameAtPosition(line, char)).toBe('view_component')
  })

  it('returns null when the cursor is on the version constraint, not the name', () => {
    const line = 'gem "rails", "~> 7.1"'
    const char = line.indexOf('~> 7.1') + 2
    expect(extractGemNameAtPosition(line, char)).toBeNull()
  })

  it('returns null for lines with no gem declaration', () => {
    const line = 'source "https://rubygems.org"'
    expect(extractGemNameAtPosition(line, 10)).toBeNull()
  })
})
