/**
 * RailsForgeConfig - Single read point for every `railsForge.*` setting.
 *
 * All settings are declared with the default "window" scope in package.json,
 * which VS Code resolves from both the user's global settings.json and the
 * current workspace's `.vscode/settings.json` (workspace wins) — so every
 * setting here is configurable at either level without any extra code.
 *
 * Nothing here is cached: call `readConfig()` fresh at the point of use so a
 * settings change takes effect on the next action without requiring a reload.
 * For code that needs to react to a change proactively (e.g. re-running a
 * workspace scan when excludePatterns changes), subscribe via `onConfigChanged`.
 */

import * as vscode from 'vscode'

export type AiProvider = 'ollama' | 'openai' | 'anthropic'
export type ProjectTypeOverride = 'auto' | 'monolith' | 'api_only' | 'gem' | 'script'
export type RubocopMode = 'safe' | 'unsafe'
export type TestingFramework = 'rspec' | 'minitest'

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/vendor/**',
  '**/tmp/**',
  '**/log/**',
  '**/.git/**',
  '**/coverage/**',
  '**/public/assets/**',
  '**/public/packs/**',
]

export interface RailsForgeConfig {
  excludePatterns: string[]
  projectTypeOverride: ProjectTypeOverride
  rubocopAutocorrectOnSave: boolean
  rubocopMode: RubocopMode
  brakemanScanOnSave: boolean
  testingFramework: TestingFramework
  schemaAutoIndex: boolean
  routesAutoIndex: boolean
  ollamaHost: string
  ollamaModel: string
  ollamaEmbeddingModel: string
  aiProvider: AiProvider
  aiOpenaiModel: string
  aiAnthropicModel: string
  mcpEnabled: boolean
  apiDocsEnabled: boolean
  performanceCacheSize: number
}

export function readConfig(scope?: vscode.ConfigurationScope): RailsForgeConfig {
  const cfg = vscode.workspace.getConfiguration('railsForge', scope)

  return {
    excludePatterns: cfg.get<string[]>('excludePatterns', DEFAULT_EXCLUDE_PATTERNS),
    projectTypeOverride: cfg.get<ProjectTypeOverride>('projectType.override', 'auto'),
    rubocopAutocorrectOnSave: cfg.get<boolean>('rubocop.autocorrectOnSave', false),
    rubocopMode: cfg.get<RubocopMode>('rubocop.mode', 'safe'),
    brakemanScanOnSave: cfg.get<boolean>('brakeman.scanOnSave', false),
    testingFramework: cfg.get<TestingFramework>('testing.framework', 'rspec'),
    schemaAutoIndex: cfg.get<boolean>('schema.autoIndex', true),
    routesAutoIndex: cfg.get<boolean>('routes.autoIndex', true),
    ollamaHost: cfg.get<string>('ollama.host', 'http://localhost:11434'),
    ollamaModel: cfg.get<string>('ollama.model', 'qwen2.5-coder:14b'),
    ollamaEmbeddingModel: cfg.get<string>('ollama.embeddingModel', 'nomic-embed-text'),
    aiProvider: cfg.get<AiProvider>('ai.provider', 'ollama'),
    aiOpenaiModel: cfg.get<string>('ai.openai.model', 'gpt-4o-mini'),
    aiAnthropicModel: cfg.get<string>('ai.anthropic.model', 'claude-sonnet-4-5'),
    mcpEnabled: cfg.get<boolean>('mcp.enabled', true),
    apiDocsEnabled: cfg.get<boolean>('apiDocs.enabled', true),
    performanceCacheSize: cfg.get<number>('performance.cacheSize', 200),
  }
}

/** Combines exclude glob patterns into the single-string form `vscode.workspace.findFiles` expects. */
export function buildExcludeGlob(patterns: string[]): string | null {
  const trimmed = patterns.map(p => p.trim()).filter(Boolean)
  if (trimmed.length === 0) {return null}
  return trimmed.length === 1 ? trimmed[0] : `{${trimmed.join(',')}}`
}

/** True if `filePath` falls under any of the configured exclude patterns' directory roots. */
export function isExcludedPath(filePath: string, excludePatterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  return excludePatterns.some(pattern => {
    const dir = pattern.replace(/^\*\*\//, '').replace(/\/\*\*$/, '')
    return dir.length > 0 && normalized.includes(`/${dir}/`)
  })
}

/** Fires whenever any `railsForge.*` setting changes, workspace or user level. */
export function onConfigChanged(listener: () => void): vscode.Disposable {
  return vscode.workspace.onDidChangeConfiguration(e => {
    if (e.affectsConfiguration('railsForge')) {
      listener()
    }
  })
}
