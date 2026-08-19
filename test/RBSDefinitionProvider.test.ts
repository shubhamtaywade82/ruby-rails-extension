import { describe, it, expect } from 'vitest'
import { findEnclosingClass } from '../src/types/RBSDefinitionProvider'

describe('findEnclosingClass', () => {
  it('finds the immediate enclosing class for a 2-space-indented method', () => {
    const lines = [
      'class Greeter',
      '  attr_reader :name',
      '',
    ]
    expect(findEnclosingClass(lines, 2)).toBe('Greeter')
  })

  it('finds the innermost class when nested inside a module', () => {
    const lines = [
      'module App',
      '  class Greeter',
      '    attr_reader :name',
      '',
    ]
    expect(findEnclosingClass(lines, 4)).toBe('Greeter')
  })

  it('skips blank lines while scanning upward', () => {
    const lines = [
      'class Greeter',
      '',
      '  ',
      '',
    ]
    expect(findEnclosingClass(lines, 2)).toBe('Greeter')
  })

  it('returns null when there is no enclosing class/module', () => {
    expect(findEnclosingClass(['# a comment', ''], 0)).toBeNull()
  })

  it('does not cross out of a sibling class defined earlier at the same file', () => {
    const lines = [
      'class First',
      '  def foo; end',
      'end',
      '',
      'class Second',
      '',
    ]
    expect(findEnclosingClass(lines, 2)).toBe('Second')
  })
})
