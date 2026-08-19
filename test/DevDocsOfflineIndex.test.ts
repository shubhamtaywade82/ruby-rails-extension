import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DevDocsOfflineIndex } from '../src/docs/DevDocsOfflineIndex'
import { PERSISTENCE_PAGE_HTML, ACTIONNOTFOUND_PAGE_HTML, HAS_SECURE_PASSWORD_PAGE_HTML } from './fixtures/devdocsFixtures'

let cacheDir: string

beforeAll(() => {
  cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-devdocs-test-'))
  const slugDir = path.join(cacheDir, 'rails~7.1')
  fs.mkdirSync(slugDir, { recursive: true })

  fs.writeFileSync(path.join(slugDir, 'index.json'), JSON.stringify({
    entries: [
      { name: 'ActiveRecord::Persistence#update_attribute', path: 'activerecord/persistence#method-i-update_attribute', type: 'ActiveRecord' },
      { name: 'ActiveRecord::Persistence#update_attribute!', path: 'activerecord/persistence#method-i-update_attribute-21', type: 'ActiveRecord' },
      { name: 'AbstractController::ActionNotFound', path: 'abstractcontroller/actionnotfound', type: 'AbstractController' },
      { name: 'ActiveModel::SecurePassword::ClassMethods#has_secure_password', path: 'activemodel/securepassword/classmethods#method-i-has_secure_password', type: 'ActiveModel' },
    ],
    types: [],
  }))

  fs.writeFileSync(path.join(slugDir, 'db.json'), JSON.stringify({
    'activerecord/persistence': PERSISTENCE_PAGE_HTML,
    'abstractcontroller/actionnotfound': ACTIONNOTFOUND_PAGE_HTML,
    'activemodel/securepassword/classmethods': HAS_SECURE_PASSWORD_PAGE_HTML,
  }))
})

afterAll(() => {
  fs.rmSync(cacheDir, { recursive: true, force: true })
})

describe('DevDocsOfflineIndex', () => {
  it('extracts a method entry with signature, description, and source code', () => {
    const index = new DevDocsOfflineIndex(cacheDir, ['rails~7.1'])
    const result = index.lookup('update_attribute')

    expect(result).not.toBeNull()
    expect(result!.signature).toBe('update_attribute(name, value)')
    expect(result!.description).toContain('Updates a single attribute and saves the record')
    expect(result!.description).toContain('- Validation is skipped.')
    expect(result!.description).not.toMatch(/<\/?[a-zA-Z]/)
    expect(result!.sourceCode).toContain('def update_attribute(name, value)')
    expect(result!.sourceCode).not.toContain('# File')
    expect(result!.url).toContain('rails/7.1/activerecord/persistence')
  })

  it('does not bleed the page footer into the last method on a page (no following sibling)', () => {
    const index = new DevDocsOfflineIndex(cacheDir, ['rails~7.1'])
    const result = index.lookup('has_secure_password')

    expect(result).not.toBeNull()
    expect(result!.description).toContain('Adds methods to set and authenticate against a BCrypt password')
    expect(result!.description).not.toMatch(/<\/?[a-zA-Z]/)
    expect(result!.description).not.toContain('_attribution')
    expect(result!.description).not.toContain('David Heinemeier Hansson')
  })

  it('does not bleed the next method\'s content into this one', () => {
    const index = new DevDocsOfflineIndex(cacheDir, ['rails~7.1'])
    const result = index.lookup('update_attribute')
    expect(result!.sourceCode).not.toContain('update_attribute!')
  })

  it('resolves the bang-method as a distinct entry', () => {
    const index = new DevDocsOfflineIndex(cacheDir, ['rails~7.1'])
    const result = index.lookup('update_attribute!')
    expect(result).not.toBeNull()
    expect(result!.signature).toBe('update_attribute!(name, value)')
  })

  it('extracts a class-level entry (no method fragment)', () => {
    const index = new DevDocsOfflineIndex(cacheDir, ['rails~7.1'])
    const result = index.lookup('AbstractController::ActionNotFound')
    expect(result).not.toBeNull()
    expect(result!.description).toContain('Raised when a non-existing controller action is triggered.')
  })

  it('returns null for a word not in the cached docset', () => {
    const index = new DevDocsOfflineIndex(cacheDir, ['rails~7.1'])
    expect(index.lookup('totally_unknown_method')).toBeNull()
  })

  it('returns null gracefully when the docset was never cached', () => {
    const index = new DevDocsOfflineIndex(cacheDir, ['ruby~3.3'])
    expect(index.lookup('update_attribute')).toBeNull()
  })
})
