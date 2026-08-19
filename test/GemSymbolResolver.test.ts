import { describe, it, expect } from 'vitest'
import { GemSymbolResolver } from '../src/docs/GemSymbolResolver'

describe('GemSymbolResolver', () => {
  it('resolves a namespace whose gem name differs via the curated table', () => {
    const resolver = new GemSymbolResolver(new Map([['view_component', '3.9.0']]))
    expect(resolver.resolve('ViewComponent::Base')).toEqual({ gem: 'view_component', version: '3.9.0' })
  })

  it('resolves via snake_case when not in the curated table', () => {
    const resolver = new GemSymbolResolver(new Map([['strong_migrations', '1.7.0']]))
    expect(resolver.resolve('StrongMigrations::Error')).toEqual({ gem: 'strong_migrations', version: '1.7.0' })
  })

  it('resolves a single-word namespace that matches its gem name lowercased', () => {
    const resolver = new GemSymbolResolver(new Map([['pundit', '2.3.1']]))
    expect(resolver.resolve('Pundit')).toEqual({ gem: 'pundit', version: '2.3.1' })
  })

  it('returns null when no candidate matches a locked gem', () => {
    const resolver = new GemSymbolResolver(new Map([['pundit', '2.3.1']]))
    expect(resolver.resolve('SomeUnrelatedThing')).toBeNull()
  })

  it('returns null for an empty symbol', () => {
    const resolver = new GemSymbolResolver(new Map())
    expect(resolver.resolve('')).toBeNull()
  })
})
