import { describe, it, expect } from 'vitest'
import { parseVersion, bumpVersion, replaceVersionInContent } from '../src/gems/GemVersionBumper'

describe('parseVersion', () => {
  it('extracts the version string from a standard version.rb', () => {
    const content = 'module MyGem\n  VERSION = "1.2.3"\nend\n'
    expect(parseVersion(content)).toBe('1.2.3')
  })

  it('supports single-quoted version strings', () => {
    expect(parseVersion("VERSION = '0.1.0'")).toBe('0.1.0')
  })

  it('returns null when there is no VERSION assignment', () => {
    expect(parseVersion('module MyGem\nend\n')).toBeNull()
  })
})

describe('bumpVersion', () => {
  it('bumps the patch part and resets nothing else', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4')
  })

  it('bumps the minor part and resets patch to 0', () => {
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0')
  })

  it('bumps the major part and resets minor/patch to 0', () => {
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0')
  })

  it('treats a missing patch component as 0', () => {
    expect(bumpVersion('1.2', 'patch')).toBe('1.2.1')
  })
})

describe('replaceVersionInContent', () => {
  it('replaces only the version string, preserving the rest of the file', () => {
    const content = 'module MyGem\n  VERSION = "1.2.3"\nend\n'
    expect(replaceVersionInContent(content, '1.3.0')).toBe('module MyGem\n  VERSION = "1.3.0"\nend\n')
  })

  it('preserves single-quote style by normalizing to double quotes', () => {
    expect(replaceVersionInContent("VERSION = '0.1.0'", '0.2.0')).toBe('VERSION = "0.2.0"')
  })
})
