import { describe, it, expect } from 'vitest'
import {
  ensureGemInGemfile,
  applyInheritGemBlock,
  applyAirbnbInheritFrom,
  getStyleGuideApplication,
} from '../src/lint/RuboCopStyleGuides'

describe('getStyleGuideApplication', () => {
  it('uses inherit_gem for shopify, matching the real published README', () => {
    const app = getStyleGuideApplication('shopify')
    expect(app.gemName).toBe('rubocop-shopify')
    expect(app.rubocopYmlBlock).toBe('inherit_gem:\n  rubocop-shopify: rubocop.yml\n')
  })

  it('uses inherit_gem with a list for gitlab, matching gitlab-styles\' README', () => {
    const app = getStyleGuideApplication('gitlab')
    expect(app.gemName).toBe('gitlab-styles')
    expect(app.rubocopYmlBlock).toBe('inherit_gem:\n  gitlab-styles:\n    - rubocop-default.yml\n')
  })

  it('uses a separate plugin file + inherit_from for airbnb, not inherit_gem', () => {
    const app = getStyleGuideApplication('airbnb')
    expect(app.gemName).toBe('rubocop-airbnb')
    expect(app.rubocopYmlBlock).toBeUndefined()
    expect(app.extraFile).toEqual({ name: '.rubocop_airbnb.yml', content: 'plugins:\n  - rubocop-airbnb\n' })
    expect(app.inheritFromEntry).toBe('.rubocop_airbnb.yml')
  })
})

describe('ensureGemInGemfile', () => {
  it('appends the gem line when absent', () => {
    const result = ensureGemInGemfile('gem "rails"\n', 'rubocop-shopify')
    expect(result.changed).toBe(true)
    expect(result.content).toBe('gem "rails"\ngem "rubocop-shopify", require: false\n')
  })

  it('is idempotent when the gem is already present (single or double quotes)', () => {
    expect(ensureGemInGemfile('gem "rubocop-shopify", require: false\n', 'rubocop-shopify').changed).toBe(false)
    expect(ensureGemInGemfile('gem \'rubocop-shopify\'\n', 'rubocop-shopify').changed).toBe(false)
  })

  it('handles an empty Gemfile', () => {
    const result = ensureGemInGemfile('', 'rubocop-shopify')
    expect(result.content).toBe('gem "rubocop-shopify", require: false\n')
  })
})

describe('applyInheritGemBlock', () => {
  it('prepends the block to an existing .rubocop.yml', () => {
    const result = applyInheritGemBlock('AllCops:\n  NewCops: enable\n', 'inherit_gem:\n  rubocop-shopify: rubocop.yml\n', 'rubocop-shopify')
    expect(result.changed).toBe(true)
    expect(result.content).toBe('inherit_gem:\n  rubocop-shopify: rubocop.yml\n\nAllCops:\n  NewCops: enable\n')
  })

  it('is idempotent when the marker is already present anywhere in the file', () => {
    const result = applyInheritGemBlock('inherit_gem:\n  rubocop-shopify: rubocop.yml\n', 'inherit_gem:\n  rubocop-shopify: rubocop.yml\n', 'rubocop-shopify')
    expect(result.changed).toBe(false)
  })

  it('creates the file fresh when there is no existing content', () => {
    const result = applyInheritGemBlock('', 'inherit_gem:\n  rubocop-shopify: rubocop.yml\n', 'rubocop-shopify')
    expect(result.content).toBe('inherit_gem:\n  rubocop-shopify: rubocop.yml\n\n')
  })
})

describe('applyAirbnbInheritFrom', () => {
  it('adds a fresh inherit_from key when none exists', () => {
    const result = applyAirbnbInheritFrom('AllCops:\n  NewCops: enable\n', '.rubocop_airbnb.yml')
    expect(result.changed).toBe(true)
    expect(result.content).toBe('inherit_from:\n  - .rubocop_airbnb.yml\n\nAllCops:\n  NewCops: enable\n')
  })

  it('prepends into an existing multi-line inherit_from list', () => {
    const content = 'inherit_from:\n  - .rubocop_todo.yml\n  - .rubocop_other.yml\n\nAllCops:\n  NewCops: enable\n'
    const result = applyAirbnbInheritFrom(content, '.rubocop_airbnb.yml')
    expect(result.changed).toBe(true)
    expect(result.content).toBe(
      'inherit_from:\n  - .rubocop_airbnb.yml\n  - .rubocop_todo.yml\n  - .rubocop_other.yml\n\nAllCops:\n  NewCops: enable\n',
    )
  })

  it('converts an existing scalar inherit_from into a list', () => {
    const content = 'inherit_from: .rubocop_todo.yml\n\nAllCops:\n  NewCops: enable\n'
    const result = applyAirbnbInheritFrom(content, '.rubocop_airbnb.yml')
    expect(result.changed).toBe(true)
    expect(result.content).toBe(
      'inherit_from:\n  - .rubocop_airbnb.yml\n  - .rubocop_todo.yml\n\nAllCops:\n  NewCops: enable\n',
    )
  })

  it('is idempotent once already applied', () => {
    const content = 'inherit_from:\n  - .rubocop_airbnb.yml\n\nAllCops:\n  NewCops: enable\n'
    expect(applyAirbnbInheritFrom(content, '.rubocop_airbnb.yml').changed).toBe(false)
  })

  it('handles an empty .rubocop.yml', () => {
    const result = applyAirbnbInheritFrom('', '.rubocop_airbnb.yml')
    expect(result.content).toBe('inherit_from:\n  - .rubocop_airbnb.yml\n')
  })
})
