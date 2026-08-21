import * as vscode from 'vscode'
import { Logger } from '../util/Logger'

export const RECOMMENDED_WATCHER_EXCLUDES: Readonly<Record<string, boolean>> = {
  '**/.git/objects/**': true,
  '**/.git/subtree-cache/**': true,
  '**/node_modules/**': true,
  '**/tmp/**': true,
  '**/log/**': true,
  '**/storage/**': true,
  '**/coverage/**': true,
  '**/public/assets/**': true,
  '**/public/packs/**': true,
  '**/vendor/bundle/**': true,
  '**/.bundle/**': true,
  '**/.ruby-lsp/**': true,
}

export const RECOMMENDED_SEARCH_EXCLUDES: Readonly<Record<string, boolean>> = {
  '**/tmp': true,
  '**/log': true,
  '**/storage': true,
  '**/coverage': true,
  '**/node_modules': true,
  '**/public/assets': true,
  '**/public/packs': true,
  '**/vendor/bundle': true,
}

export const RECOMMENDED_RUBY_LSP_EXCLUDES: readonly string[] = [
  '**/tmp/**',
  '**/log/**',
  '**/storage/**',
  '**/coverage/**',
  '**/vendor/**',
  '**/db/migrate/**',
]

const CRITICAL_WATCHER_KEYS = ['**/tmp/**', '**/log/**', '**/storage/**']

export function isOptimizationNeeded(
  currentWatchers?: Record<string, boolean>,
  currentSearch?: Record<string, boolean>,
): boolean {
  if (!currentWatchers) {return true}
  const hasMissingWatcher = CRITICAL_WATCHER_KEYS.some(key => !currentWatchers[key])
  const hasMissingSearch = !currentSearch || !currentSearch['**/tmp'] || !currentSearch['**/log']
  return hasMissingWatcher || hasMissingSearch
}

export function mergeObjectConfig(
  existing: Record<string, boolean> | undefined,
  recommended: Readonly<Record<string, boolean>>,
): Record<string, boolean> {
  const merged: Record<string, boolean> = { ...(existing ?? {}) }
  for (const [pattern, enabled] of Object.entries(recommended)) {
    if (merged[pattern] === undefined) {
      merged[pattern] = enabled
    }
  }
  return merged
}

export function mergeArrayConfig(
  existing: string[] | undefined,
  recommended: readonly string[],
): string[] {
  const set = new Set(existing ?? [])
  for (const item of recommended) {
    set.add(item)
  }
  return Array.from(set)
}

export async function optimizeRailsWorkspace(
  target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace,
): Promise<void> {
  const filesConfig = vscode.workspace.getConfiguration('files')
  const searchConfig = vscode.workspace.getConfiguration('search')
  const rubyLspConfig = vscode.workspace.getConfiguration('rubyLsp')

  const currentWatchers = filesConfig.get<Record<string, boolean>>('watcherExclude', {})
  const currentSearch = searchConfig.get<Record<string, boolean>>('exclude', {})
  const currentLspExcludes = rubyLspConfig.get<string[]>('indexing.excludedPatterns', [])

  const updatedWatchers = mergeObjectConfig(currentWatchers, RECOMMENDED_WATCHER_EXCLUDES)
  const updatedSearch = mergeObjectConfig(currentSearch, RECOMMENDED_SEARCH_EXCLUDES)
  const updatedLspExcludes = mergeArrayConfig(currentLspExcludes, RECOMMENDED_RUBY_LSP_EXCLUDES)

  await filesConfig.update('watcherExclude', updatedWatchers, target)
  await searchConfig.update('exclude', updatedSearch, target)
  await rubyLspConfig.update('indexing.excludedPatterns', updatedLspExcludes, target)
  await rubyLspConfig.update('rubocop.serverMode', true, target)
}

export async function handleWorkspaceAutoOptimization(
  mode: 'auto' | 'prompt' | 'disabled',
  hasRails: boolean,
): Promise<boolean> {
  if (!hasRails || mode === 'disabled') {
    return false
  }

  const filesConfig = vscode.workspace.getConfiguration('files')
  const searchConfig = vscode.workspace.getConfiguration('search')
  const currentWatchers = filesConfig.inspect<Record<string, boolean>>('watcherExclude')?.workspaceValue
  const currentSearch = searchConfig.inspect<Record<string, boolean>>('exclude')?.workspaceValue

  if (!isOptimizationNeeded(currentWatchers, currentSearch)) {
    return false
  }

  if (mode === 'auto') {
    await optimizeRailsWorkspace()
    Logger.info('RailsForge: Automatically optimized workspace watchers and search exclusions for Rails.')
    return true
  }

  const action = await vscode.window.showInformationMessage(
    'RailsForge: Optimize file watcher and search exclusions for large Rails repository to reduce CPU/memory?',
    'Optimize Workspace',
    'Not Now',
  )
  if (action === 'Optimize Workspace') {
    await optimizeRailsWorkspace()
    void vscode.window.showInformationMessage('RailsForge: Workspace performance settings successfully applied.')
    return true
  }

  return false
}
