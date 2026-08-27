/**
 * RouteHelperCompletionProvider - Autocompletes Rails named route helpers
 * (e.g. `users_path`, `edit_order_url`, `api_v1_products_path`) in Ruby files.
 *
 * Uses the same RoutesIndexer data that powers `RailsForge: Search Rails Routes`
 * and the route hover, so completions stay in sync with `config/routes.rb`.
 */

import * as vscode from 'vscode'
import type { RoutesIndexer, RailsRoute } from './RoutesIndexer'

/** Derive a helper name from the route's URI pattern and controller/action. */
function deriveHelperName(route: RailsRoute): string | null {
  if (route.helperName) { return route.helperName }

  // From URI pattern: "/users" -> "users", "/api/v1/products/:id" -> "api_v1_products"
  const parts = route.uriPattern
    .split('/')
    .filter(p => p && !p.startsWith(':'))
    .map(p => p.replace(/-/, '_'))

  if (parts.length === 0) { return null }

  const actionPrefixes: Record<string, string> = {
    new: 'new_',
    edit: 'edit_',
  }
  const prefix = actionPrefixes[route.action] ?? ''
  return `${prefix}${parts.join('_')}`
}

export class RouteHelperCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly routesIndexer: RoutesIndexer) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
    _context: vscode.CompletionContext,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const lang = document.languageId
    if (lang !== 'ruby' && lang !== 'erb') { return undefined }

    const wordRange = document.getWordRangeAtPosition(position, /[a-z_][a-z0-9_]*(?:_(?:path|url))?/)
    if (!wordRange) { return undefined }

    const prefix = document.getText(wordRange).toLowerCase()
    if (!prefix) { return undefined }

    const match = prefix.match(/^(.+?)(?:_(path|url))?$/)
    if (!match) { return undefined }
    const base = match[1]
    if (base.length < 2 && !match[2]) { return undefined }

    const items: vscode.CompletionItem[] = []
    const allRoutes = this.routesIndexer.getAllRoutes()
    const seen = new Set<string>()

    for (const route of allRoutes) {
      const name = deriveHelperName(route)
      if (!name) { continue }

      for (const suffix of ['_path', '_url'] as const) {
        const fullHelper = `${name}${suffix}`
        if (seen.has(fullHelper)) { continue }

        if (fullHelper.startsWith(prefix)) {
          seen.add(fullHelper)
          items.push(this.makeCompletion(fullHelper, route, name, suffix))
        }
      }
    }

    return items.length > 0 ? items : undefined
  }

  private makeCompletion(
    helper: string,
    route: RailsRoute,
    baseName: string,
    suffix: string,
  ): vscode.CompletionItem {
    const item = new vscode.CompletionItem(helper, vscode.CompletionItemKind.Function)
    item.detail = `${route.verb} ${route.uriPattern}`
    item.documentation = [
      `Maps to \`${route.controller}#${route.action}\``,
      '',
      `**URI:** \`${route.uriPattern}\``,
      `**Verb:** ${route.verb}`,
      `**Helper:** \`${helper}\``,
    ].join('\n')
    item.insertText = helper
    item.sortText = helper

    if (suffix === '_url') {
      item.sortText = `${baseName}_z_url`
    }

    return item
  }
}
