import { describe, it, expect } from 'vitest'
import { ValueObjectExtractor } from '../src/refactor/ValueObjectExtractor'
import * as fs from 'fs'
import * as path from 'path'

describe('ValueObjectExtractor', () => {
  const extractor = new ValueObjectExtractor()
  const testRoot = '/tmp/railsforge_value_test'

  it('generates an immutable Data.define Value Object', () => {
    const result = extractor.extractValueObject('Money', ['amount', 'currency'], testRoot)

    expect(result.filePath).toBe(path.join(testRoot, 'app', 'values', 'money.rb'))
    expect(result.code).toContain('class Money < Data.define(:amount, :currency)')
    expect(result.code).toContain('def to_s')

    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true })
    }
  })
})
