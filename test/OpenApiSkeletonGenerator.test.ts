import { describe, it, expect } from 'vitest'
import { buildOpenApiSkeleton, railsPathToOpenApiPath, extractPathParams } from '../src/docs/OpenApiSkeletonGenerator'
import { RailsRoute } from '../src/rails/RoutesIndexer'

describe('railsPathToOpenApiPath', () => {
  it('strips the (.:format) suffix', () => {
    expect(railsPathToOpenApiPath('/users(.:format)')).toBe('/users')
  })

  it('converts :param segments to {param}', () => {
    expect(railsPathToOpenApiPath('/users/:id/edit(.:format)')).toBe('/users/{id}/edit')
  })

  it('converts multiple params', () => {
    expect(railsPathToOpenApiPath('/users/:user_id/posts/:id(.:format)')).toBe('/users/{user_id}/posts/{id}')
  })
})

describe('extractPathParams', () => {
  it('returns all {param} names in order', () => {
    expect(extractPathParams('/users/{user_id}/posts/{id}')).toEqual(['user_id', 'id'])
  })

  it('returns an empty array for a path with no params', () => {
    expect(extractPathParams('/users')).toEqual([])
  })
})

describe('buildOpenApiSkeleton', () => {
  const routes: RailsRoute[] = [
    { verb: 'GET', uriPattern: '/users(.:format)', controller: 'users', action: 'index', helperName: 'users' },
    { verb: 'POST', uriPattern: '/users(.:format)', controller: 'users', action: 'create' },
    { verb: 'GET', uriPattern: '/users/:id(.:format)', controller: 'users', action: 'show', helperName: 'user' },
  ]

  it('emits a valid-looking OpenAPI document with title and version', () => {
    const yaml = buildOpenApiSkeleton(routes, { title: 'My API', version: '1.0.0' })
    expect(yaml).toContain('openapi: 3.0.3')
    expect(yaml).toContain("title: 'My API'")
    expect(yaml).toContain("version: '1.0.0'")
  })

  it('groups multiple HTTP methods under the same path', () => {
    const yaml = buildOpenApiSkeleton(routes, { title: 'My API' })
    expect(yaml).toContain('  /users:')
    expect(yaml).toContain('    get:')
    expect(yaml).toContain('    post:')
  })

  it('emits path parameters for dynamic segments', () => {
    const yaml = buildOpenApiSkeleton(routes, { title: 'My API' })
    expect(yaml).toContain('  /users/{id}:')
    expect(yaml).toContain('- name: id')
    expect(yaml).toContain('in: path')
  })

  it('includes operationId and a TODO response description', () => {
    const yaml = buildOpenApiSkeleton(routes, { title: 'My API' })
    expect(yaml).toContain("operationId: 'users_index'")
    expect(yaml).toContain("summary: 'users#index'")
    expect(yaml).toContain('TODO')
  })

  it('skips non-HTTP-verb routes and produces an empty paths object when there are none left', () => {
    const yaml = buildOpenApiSkeleton([], { title: 'Empty' })
    expect(yaml).toContain('paths: {}')
  })

  it('defaults version to 0.1.0 when omitted', () => {
    const yaml = buildOpenApiSkeleton(routes, { title: 'My API' })
    expect(yaml).toContain("version: '0.1.0'")
  })
})
