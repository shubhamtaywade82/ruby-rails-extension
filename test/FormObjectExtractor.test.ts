import { describe, it, expect } from 'vitest'
import { FormObjectExtractor } from '../src/refactor/FormObjectExtractor'
import * as fs from 'fs'
import * as path from 'path'

describe('FormObjectExtractor', () => {
  const extractor = new FormObjectExtractor()
  const testRoot = '/tmp/railsforge_form_test'

  it('generates an ActiveModel Form Object with attributes and validations', () => {
    const result = extractor.extractFormObject('UserRegistration', ['first_name', 'last_name', 'email'], testRoot)

    expect(result.filePath).toBe(path.join(testRoot, 'app', 'forms', 'user_registration_form.rb'))
    expect(result.code).toContain('class UserRegistrationForm')
    expect(result.code).toContain('include ActiveModel::Model')
    expect(result.code).toContain('attribute :first_name, :string')
    expect(result.code).toContain('def save')

    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true })
    }
  })
})
