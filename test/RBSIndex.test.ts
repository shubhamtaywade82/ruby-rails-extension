import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { parseRbs, RBSIndex } from '../src/types/RBSIndex'

// Real output of `rbs prototype rb` against a sample Greeter class — verified before
// writing the parser, not guessed at.
const SAMPLE_RBS = `module Greetable
  def hello: () -> "hi"
end

class Greeter
  @name: untyped

  include Greetable

  attr_reader name: untyped

  def initialize: (untyped name) -> void

  def greet: (untyped name, ?loud: bool) -> untyped

  def self.default: () -> untyped
end
`

describe('parseRbs', () => {
  it('parses instance methods with their signatures', () => {
    const methods = parseRbs(SAMPLE_RBS, 'sig/greeter.rbs')
    const greet = methods.find(m => m.methodName === 'greet')
    expect(greet).toEqual({
      className: 'Greeter',
      methodName: 'greet',
      isSelf: false,
      signature: '(untyped name, ?loud: bool) -> untyped',
      filePath: 'sig/greeter.rbs',
      line: 13,
    })
  })

  it('parses a self./class method and marks isSelf', () => {
    const methods = parseRbs(SAMPLE_RBS, 'sig/greeter.rbs')
    const defaultMethod = methods.find(m => m.methodName === 'default')
    expect(defaultMethod?.isSelf).toBe(true)
    expect(defaultMethod?.className).toBe('Greeter')
  })

  it('attributes a module-level method to its module', () => {
    const methods = parseRbs(SAMPLE_RBS, 'sig/greeter.rbs')
    const hello = methods.find(m => m.methodName === 'hello')
    expect(hello?.className).toBe('Greetable')
  })

  it('does not attribute methods once popped past their class\' end', () => {
    const methods = parseRbs(SAMPLE_RBS, 'sig/greeter.rbs')
    expect(methods.every(m => m.className === 'Greeter' || m.className === 'Greetable')).toBe(true)
  })
})

describe('RBSIndex', () => {
  let root: string

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-rbs-test-'))
    fs.mkdirSync(path.join(root, 'sig'), { recursive: true })
    fs.mkdirSync(path.join(root, 'sig', 'nested'), { recursive: true })
    fs.writeFileSync(path.join(root, 'sig', 'greeter.rbs'), SAMPLE_RBS)
    fs.writeFileSync(path.join(root, 'sig', 'nested', 'other.rbs'), 'class Other\n  def greet: () -> void\nend\n')
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
  })

  it('walks sig/ recursively and indexes every .rbs file', () => {
    const index = new RBSIndex()
    index.loadFromWorkspace(root)
    expect(index.isEmpty).toBe(false)
    expect(index.lookup('greet').length).toBe(2)
  })

  it('lookupExact disambiguates same-named methods across classes', () => {
    const index = new RBSIndex()
    index.loadFromWorkspace(root)
    const greeterGreet = index.lookupExact('Greeter', 'greet', false)
    expect(greeterGreet?.signature).toContain('loud')
    const otherGreet = index.lookupExact('Other', 'greet', false)
    expect(otherGreet?.signature).toBe('() -> void')
  })

  it('is empty when no sig/ directory exists', () => {
    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'railsforge-rbs-empty-'))
    const index = new RBSIndex()
    index.loadFromWorkspace(emptyRoot)
    expect(index.isEmpty).toBe(true)
    fs.rmSync(emptyRoot, { recursive: true, force: true })
  })
})
