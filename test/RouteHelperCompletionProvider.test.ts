import { describe, it, expect, beforeEach } from 'vitest'
import { RoutesIndexer } from '../src/rails/RoutesIndexer'
import { RouteHelperCompletionProvider } from '../src/rails/RouteHelperCompletionProvider'
import type { TextDocument } from 'vscode'

class MockDocument implements Partial<TextDocument> {
  private _text: string
  private _langId: string
  constructor(text: string, langId = 'ruby') {
    this._text = text
    this._langId = langId
  }
  get languageId() { return this._langId }
  getWordRangeAtPosition() {
    return { start: { line: 0, character: 0 }, end: { line: 0, character: this._text.length } } as any
  }
  getText() { return this._text }
}

describe('RouteHelperCompletionProvider', () => {
  let indexer: RoutesIndexer
  let provider: RouteHelperCompletionProvider

  beforeEach(() => {
    indexer = new RoutesIndexer()
    indexer.parseRoutesDsl(`
      Rails.application.routes.draw do
        resources :users
        resources :orders, only: [:index, :show]
        namespace :api do
          namespace :v1 do
            resources :products
          end
        end
      end
    `)
    provider = new RouteHelperCompletionProvider(indexer)
  })

  it('completes users_path and users_url', () => {
    const doc = new MockDocument('users_')
    const results = provider.provideCompletionItems(doc as TextDocument, { line: 0, character: 6 } as any, {} as any, {} as any) as any[]
    const helpers = results?.map((r: any) => r.label) ?? []
    expect(helpers).toContain('users_path')
    expect(helpers).toContain('users_url')
  })

  it('completes namespaced route helpers', () => {
    const doc = new MockDocument('api_v1_products_')
    const results = provider.provideCompletionItems(doc as TextDocument, { line: 0, character: 19 } as any, {} as any, {} as any) as any[]
    const helpers = results?.map((r: any) => r.label) ?? []
    expect(helpers).toContain('api_v1_products_path')
    expect(helpers).toContain('api_v1_products_url')
  })

  it('returns undefined for non-ruby files', () => {
    const doc = new MockDocument('users_', 'javascript')
    const results = provider.provideCompletionItems(doc as TextDocument, { line: 0, character: 6 } as any, {} as any, {} as any)
    expect(results).toBeUndefined()
  })

  it('returns undefined for short prefixes', () => {
    const doc = new MockDocument('u')
    const results = provider.provideCompletionItems(doc as TextDocument, { line: 0, character: 1 } as any, {} as any, {} as any)
    expect(results).toBeUndefined()
  })

  it('includes route details in completion items', () => {
    const doc = new MockDocument('users_path')
    const results = provider.provideCompletionItems(doc as TextDocument, { line: 0, character: 10 } as any, {} as any, {} as any) as any[]
    const item = results?.find((r: any) => r.label === 'users_path')
    expect(item).toBeDefined()
    expect(item.detail).toContain('GET')
    expect(item.documentation).toContain('users')
  })

  it('only returns matching helpers', () => {
    const doc = new MockDocument('orders_')
    const results = provider.provideCompletionItems(doc as TextDocument, { line: 0, character: 7 } as any, {} as any, {} as any) as any[]
    const helpers = results?.map((r: any) => r.label) ?? []
    expect(helpers).toContain('orders_path')
    expect(helpers).toContain('orders_url')
    expect(helpers).not.toContain('users_path')
  })
})
