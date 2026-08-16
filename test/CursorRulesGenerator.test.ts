import { describe, it, expect } from 'vitest'
import { buildCursorRulesContent } from '../src/mcp/CursorRulesGenerator'
import { SchemaTable } from '../src/rails/SchemaIndexer'
import { RailsRoute } from '../src/rails/RoutesIndexer'
import { IndexedPattern } from '../src/patterns/ProjectPatternIndexer'

describe('buildCursorRulesContent', () => {
  const table: SchemaTable = {
    name: 'users',
    columns: new Map([['email', { name: 'email', type: 'string', nullable: false }]]),
    indexes: [],
    foreignKeys: [],
  }
  const route: RailsRoute = { verb: 'GET', uriPattern: '/users', controller: 'users', action: 'index' }
  const pattern: IndexedPattern = {
    id: '1', type: 'service', name: 'CreateOrderService', filePath: '/repo/app/services/create_order_service.rb',
    lineStart: 1, publicMethods: ['call'], preview: '',
  }

  it('states the Rails version constraint for a Rails project', () => {
    const content = buildCursorRulesContent({
      rubyVersion: '3.3.0', railsVersion: '7.1.0', hasRails: true,
      tables: [], routes: [], patterns: [], mcpServerAvailable: false,
    })
    expect(content).toContain('This is a Rails 7.1.0 project on Ruby 3.3.0')
  })

  it('states the standalone-Ruby constraint for a non-Rails project', () => {
    const content = buildCursorRulesContent({
      rubyVersion: '3.3.0', hasRails: false,
      tables: [], routes: [], patterns: [], mcpServerAvailable: false,
    })
    expect(content).toContain('This is a standalone Ruby project (not Rails)')
    expect(content).not.toContain('This is a Rails')
  })

  it('includes schema, routes, and patterns sections when data is present', () => {
    const content = buildCursorRulesContent({
      rubyVersion: '3.3.0', railsVersion: '7.1.0', hasRails: true,
      tables: [table], routes: [route], patterns: [pattern], mcpServerAvailable: true,
    })

    expect(content).toContain('`users`: email:string')
    expect(content).toContain('GET `/users` → `users#index`')
    expect(content).toContain('**service**: CreateOrderService')
    expect(content).toContain('railsforge` MCP server is available')
  })

  it('omits sections entirely when there is nothing to report', () => {
    const content = buildCursorRulesContent({
      rubyVersion: '3.3.0', railsVersion: '7.1.0', hasRails: true,
      tables: [], routes: [], patterns: [], mcpServerAvailable: false,
    })
    expect(content).not.toContain('## Database Schema')
    expect(content).not.toContain('## Routes')
    expect(content).not.toContain('## Existing Patterns')
  })
})
