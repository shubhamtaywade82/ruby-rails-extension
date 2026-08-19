import { describe, it, expect } from 'vitest'
import { ApiDockMethodIndex } from '../src/docs/ApiDockMethodIndex'

describe('ApiDockMethodIndex', () => {
  it('resolves a built-in Rails method to its apidock.com path', () => {
    const index = new ApiDockMethodIndex()
    expect(index.lookup('has_secure_password')).toEqual({
      namespace: 'rails',
      className: 'ActiveModel/SecurePassword/ClassMethods',
      methodName: 'has_secure_password',
    })
  })

  it('resolves built-in Ruby and RSpec entries too', () => {
    const index = new ApiDockMethodIndex()
    expect(index.lookup('tap')?.namespace).toBe('ruby')
    expect(index.lookup('let')?.namespace).toBe('rspec')
  })

  it('returns null for an unknown keyword', () => {
    const index = new ApiDockMethodIndex()
    expect(index.lookup('some_totally_unknown_method')).toBeNull()
  })

  it('lets custom mappings override a built-in entry', () => {
    const index = new ApiDockMethodIndex([
      { keyword: 'save', namespace: 'ruby', className: 'MyGem/Persistable', methodName: 'save' },
    ])
    expect(index.lookup('save')).toEqual({
      namespace: 'ruby',
      className: 'MyGem/Persistable',
      methodName: 'save',
    })
  })

  it('lets custom mappings add a brand-new keyword', () => {
    const index = new ApiDockMethodIndex([
      { keyword: 'acts_as_list', namespace: 'rails', className: 'ActsAsList/List', methodName: 'acts_as_list' },
    ])
    expect(index.lookup('acts_as_list')).not.toBeNull()
  })
})
