import { describe, it, expect } from 'vitest'
import { ServiceExtractor } from '../src/refactor/ServiceExtractor'

describe('ServiceExtractor', () => {
  const extractor = new ServiceExtractor()
  const root = '/path/to/my_app'

  it('generates a clean Service Object and replacement call', () => {
    const code = `
user = User.find(user_id)
user.update!(status: 'active')
UserMailer.welcome(user).deliver_later
user
`
    const res = extractor.extractService('ActivateUser', code, ['user_id'], root)

    expect(res.serviceFilePath).toContain('/app/services/activate_user_service.rb')
    expect(res.serviceCode).toContain('class ActivateUserService < ApplicationService')
    expect(res.serviceCode).toContain('def self.call(user_id)')
    expect(res.serviceCode).toContain('attr_reader :user_id')
    expect(res.serviceCode).toContain("user.update!(status: 'active')")
    expect(res.replacementCall).toBe('ActivateUserService.call(user_id)')
  })

  it('detects free variables the selection reads but does not assign', () => {
    const code = `
order = Order.create!(user: current_user, total: params[:total])
OrderMailer.confirmation(order).deliver_later
`
    const freeVars = extractor.detectFreeVariables(code)

    expect(freeVars).toContain('current_user')
    expect(freeVars).toContain('params')
    expect(freeVars).not.toContain('order')
  })
})
