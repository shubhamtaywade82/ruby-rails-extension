import { describe, it, expect } from 'vitest'
import { DesignPrincipleLinter, PrincipleDiagnostic } from '../src/principles/DesignPrincipleLinter'

describe('DesignPrincipleLinter', () => {
  const linter = new DesignPrincipleLinter()

  it('detects Law of Demeter violations in deep chained calls', () => {
    const lines = [
      'def user_city',
      '  user.account.billing.address.city',
      'end',
    ]

    const list: PrincipleDiagnostic[] = []
    linter['checkLawOfDemeter'](lines, list)

    expect(list.length).toBe(1)
    expect(list[0].id).toBe('DEMETER-VIOLATION')
    expect(list[0].line).toBe(2)
    expect(list[0].demeter).toEqual({ receiver: 'user', method: 'city' })
  })

  it('flags dynamic metaprogramming for KISS principle', () => {
    const lines = [
      'class DynamicModel',
      '  define_method :custom_action do',
      '    # complex logic',
      '  end',
      'end',
    ]

    const list: PrincipleDiagnostic[] = []
    linter['checkKISS'](lines, list)

    expect(list.length).toBe(1)
    expect(list[0].id).toBe('KISS-METAPROGRAMMING')
    expect(list[0].line).toBe(2)
  })

  it('identifies unused private methods for YAGNI principle', () => {
    const lines = [
      'class UserService',
      '  def call',
      '    true',
      '  end',
      '  private',
      '  def unused_dead_method',
      '    123',
      '  end',
      'end',
    ]

    const list: PrincipleDiagnostic[] = []
    linter['checkYAGNI'](lines, list)

    expect(list.length).toBe(1)
    expect(list[0].id).toBe('YAGNI-UNUSED-PRIVATE')
    expect(list[0].line).toBe(6)
    expect(list[0].endLine).toBe(8)
  })

  it('flags fat classes in a gem/script lib/ directory without the Rails-specific quick fix', () => {
    const lines = Array.from({ length: 201 }, (_, i) => `  # line ${i}`)
    lines.unshift('class BigGemClass')
    lines.push('end')

    const list: PrincipleDiagnostic[] = []
    linter['checkSRP']('/repo/lib/my_gem/big_gem_class.rb', lines, list)

    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('SRP-FAT-CLASS')
    expect(list[0].quickFixCommand).toBeUndefined()
  })

  it('does not flag a lib/ file that lives under an unrelated app/ workspace path', () => {
    const lines = Array.from({ length: 201 }, () => '  # line')

    const list: PrincipleDiagnostic[] = []
    linter['checkSRP']('/repo/app/lib_looking_dir/lib/thing.rb', lines, list)

    expect(list).toHaveLength(0)
  })
})
