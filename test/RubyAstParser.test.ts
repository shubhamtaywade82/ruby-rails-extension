import { describe, it, expect } from 'vitest'
import { RubyAstParser } from '../src/indexer/RubyAstParser'

const parser = new RubyAstParser()

describe('RubyAstParser', () => {
  it('extracts class name, superclass, public methods, and constructor params', () => {
    const code = `
class CreateOrderService < ApplicationService
  def initialize(user:, payment_gateway: PaymentGateway)
    @user = user
    @payment_gateway = payment_gateway
  end

  def call
    @payment_gateway.charge(@user)
  end

  private

  def log_error
    puts 'error'
  end
end
`
    const [klass] = parser.parseClasses(code)

    expect(klass.name).toBe('CreateOrderService')
    expect(klass.superclass).toBe('ApplicationService')

    const publicMethods = klass.methods.filter(m => m.isPublic).map(m => m.name)
    expect(publicMethods).toEqual(['initialize', 'call'])

    const privateMethods = klass.methods.filter(m => !m.isPublic).map(m => m.name)
    expect(privateMethods).toEqual(['log_error'])

    const initialize = klass.methods.find(m => m.name === 'initialize')!
    expect(initialize.params).toEqual(['user', 'payment_gateway'])
  })

  it('extracts include/prepend/extend module references', () => {
    const code = `
class OrderJob
  include Sidekiq::Job
  prepend Retryable
  extend ActiveSupport::Concern
end
`
    const [klass] = parser.parseClasses(code)
    expect(klass.includes).toEqual(['Sidekiq::Job', 'Retryable', 'ActiveSupport::Concern'])
  })

  it('extracts calls with receivers, including calls nested inside method bodies', () => {
    const code = `
class CreateOrderService < ApplicationService
  def call
    order = Order.create!(user: @user)
    PaymentGatewayService.call(order: order)
    order
  end
end
`
    const [klass] = parser.parseClasses(code)
    const calls = klass.calls.map(c => `${c.receiver}.${c.method}`)

    expect(calls).toContain('Order.create!')
    expect(calls).toContain('PaymentGatewayService.call')
  })

  it('returns an empty array for content it cannot usefully parse, without throwing', () => {
    expect(() => parser.parseClasses('')).not.toThrow()
    expect(parser.parseClasses('')).toEqual([])
  })

  it('extracts multiple top-level classes from one file', () => {
    const code = `
class Foo
  def a; end
end

class Bar
  def b; end
end
`
    const classes = parser.parseClasses(code)
    expect(classes.map(c => c.name)).toEqual(['Foo', 'Bar'])
  })
})
