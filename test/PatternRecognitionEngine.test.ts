import { describe, it, expect } from 'vitest'
import { PatternRecognitionEngine } from '../src/patterns/PatternRecognitionEngine'

describe('PatternRecognitionEngine', () => {
  const engine = new PatternRecognitionEngine()

  it('detects conditional strategy pattern opportunity for multi-branch case statements', () => {
    const code = `
def calculate_tax(order)
  case order.country
  when "US"
    order.amount * 0.08
  when "UK"
    order.amount * 0.20
  when "CA"
    order.amount * 0.13
  else
    0
  end
end
`
    const opps = engine.analyzeCode(code, '/app/services/tax_calculator.rb')
    const strategy = opps.find(o => o.id === 'REPLACE-CONDITIONAL-STRATEGY')

    expect(strategy).toBeDefined()
    expect(strategy?.patternName).toBe('Strategy Pattern')
    expect(strategy?.refactoringGuruUrl).toContain('strategy/ruby')
  })

  it('detects Singleton anti-pattern hazard', () => {
    const code = `
class AppConfig
  include Singleton
  attr_accessor :api_key
end
`
    const opps = engine.analyzeCode(code, '/app/models/app_config.rb')
    const singleton = opps.find(o => o.id === 'SINGLETON-HAZARD')

    expect(singleton).toBeDefined()
    expect(singleton?.category).toBe('creational')
  })

  it('detects Primitive Obsession smell for value object candidates', () => {
    const code = `
class Account
  def update_balance(amount_cents, currency)
    # logic
  end
end
`
    const opps = engine.analyzeCode(code, '/app/models/account.rb')
    const valueObj = opps.find(o => o.id === 'PRIMITIVE-OBSESSION')

    expect(valueObj).toBeDefined()
    expect(valueObj?.refactoringGuruUrl).toContain('primitive-obsession')
  })
})
