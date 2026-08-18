/**
 * OpenApiSkeletonGenerator - Builds a minimal OpenAPI 3.0 YAML skeleton from
 * RoutesIndexer's parsed route table. Most useful for API-only apps, whose
 * every route is an actual API endpoint rather than an HTML page.
 *
 * Deliberately a *skeleton*, not full API documentation: RailsForge knows the
 * HTTP method, path, and controller#action for each route, but not request/
 * response bodies (those live in serializers/jbuilder views/strong params
 * RailsForge doesn't parse) — every response is left as a TODO for the
 * developer to fill in, same spirit as `rswag`/`rspec-openapi` scaffolds.
 */

import { RailsRoute } from '../rails/RoutesIndexer'

export interface OpenApiSkeletonOptions {
  title: string
  version?: string
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])

/** Converts a `rails routes` URI pattern into an OpenAPI path: strips the format suffix and `:param` -> `{param}`. */
export function railsPathToOpenApiPath(uriPattern: string): string {
  return uriPattern
    .replace(/\(\.:format\)$/, '')
    .replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
}

export function extractPathParams(openApiPath: string): string[] {
  const matches = openApiPath.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g) ?? []
  return matches.map(m => m.slice(1, -1))
}

export function buildOpenApiSkeleton(routes: RailsRoute[], options: OpenApiSkeletonOptions): string {
  const byPath = groupByPathAndMethod(routes)

  const lines: string[] = [
    'openapi: 3.0.3',
    'info:',
    `  title: ${yamlString(options.title)}`,
    `  version: ${yamlString(options.version ?? '0.1.0')}`,
    'paths:',
  ]

  if (byPath.size === 0) {
    lines[lines.length - 1] = 'paths: {}'
    return `${lines.join('\n')}\n`
  }

  for (const [openApiPath, methodRoutes] of byPath) {
    lines.push(`  ${openApiPath}:`)
    for (const [method, route] of methodRoutes) {
      lines.push(`    ${method}:`)
      lines.push(`      operationId: ${yamlString(`${route.controller.replace(/\//g, '_')}_${route.action}`)}`)
      lines.push(`      summary: ${yamlString(`${route.controller}#${route.action}`)}`)

      const pathParams = extractPathParams(openApiPath)
      if (pathParams.length > 0) {
        lines.push('      parameters:')
        for (const param of pathParams) {
          lines.push(`        - name: ${param}`)
          lines.push('          in: path')
          lines.push('          required: true')
          lines.push('          schema:')
          lines.push('            type: string')
        }
      }

      lines.push('      responses:')
      lines.push("        '200':")
      lines.push('          description: TODO — describe the response (RailsForge only knows the route, not the serializer/jbuilder shape)')
    }
  }

  return `${lines.join('\n')}\n`
}

function groupByPathAndMethod(routes: RailsRoute[]): Map<string, Map<string, RailsRoute>> {
  const byPath = new Map<string, Map<string, RailsRoute>>()

  for (const route of routes) {
    const method = route.verb.toLowerCase()
    if (!HTTP_METHODS.has(method)) {continue}

    const openApiPath = railsPathToOpenApiPath(route.uriPattern)
    if (!openApiPath) {continue}

    const methods = byPath.get(openApiPath) ?? new Map<string, RailsRoute>()
    methods.set(method, route)
    byPath.set(openApiPath, methods)
  }

  return byPath
}

function yamlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}
