/**
 * RailsAgent - Local LLM Agent for Ruby on Rails engineering
 */

import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'
import { ProjectEnvironment } from '../environment/EnvironmentDetector'
import { ProjectPatternIndexer } from '../patterns/ProjectPatternIndexer'

import { OllamaClient } from '@nemesis-oss/ollama-sdk'

/** Duplicated (not imported) from config/RailsForgeConfig on purpose — this class stays vscode-free. */
export type AiAgentProvider = 'ollama' | 'openai' | 'anthropic'

export interface RailsAgentConfig {
  ollamaHost: string
  model: string
  maxIterations?: number
  /** Defaults to 'ollama' when omitted, preserving the original local-only behavior. */
  provider?: AiAgentProvider
  openaiModel?: string
  anthropicModel?: string
  /**
   * Async getter for the provider's API key (backed by vscode.SecretStorage — see
   * extension.ts's `railsforge.setAiApiKey` command). Only consulted for cloud
   * providers; Ollama never needs a key. A cloud provider without a configured key
   * fails `run()` with a clear message instead of sending an unauthenticated request.
   */
  getApiKey?: () => Promise<string | undefined>
}

export interface RailsAgentContext {
  fileContent?: string
  fileName?: string
  selection?: string
  workspaceRoot?: string
}

export interface RailsAgentResult {
  success: boolean
  response: string
  iterations: number
}

export class RailsAgent {
  constructor(
    private schemaIndexer: SchemaIndexer,
    private routesIndexer: RoutesIndexer,
    private config: RailsAgentConfig,
    private env?: ProjectEnvironment,
    private patternIndexer?: ProjectPatternIndexer,
  ) {}

  async run(prompt: string, context: RailsAgentContext): Promise<RailsAgentResult> {
    const systemPrompt = this.buildSystemPrompt(context)
    const { success, response } = await this.chatCompletion(systemPrompt, prompt)
    return { success, response, iterations: success ? 1 : 0 }
  }

  private async chatCompletion(systemPrompt: string, prompt: string): Promise<{ success: boolean; response: string }> {
    const provider = this.config.provider ?? 'ollama'

    if (provider === 'anthropic') {
      const apiKey = await this.config.getApiKey?.()
      if (!apiKey) {return this.missingApiKeyResult('Anthropic')}
      return this.callAnthropic(systemPrompt, prompt, this.config.anthropicModel ?? 'claude-sonnet-4-5', apiKey)
    }

    if (provider === 'openai') {
      const apiKey = await this.config.getApiKey?.()
      if (!apiKey) {return this.missingApiKeyResult('OpenAI')}
      return this.callOpenAiCompatible(
        'https://api.openai.com/v1/chat/completions',
        this.config.openaiModel ?? 'gpt-4o-mini',
        systemPrompt,
        prompt,
        apiKey,
        'OpenAI',
      )
    }

    return this.callOllama(systemPrompt, prompt)
  }

  private async callOllama(systemPrompt: string, prompt: string): Promise<{ success: boolean; response: string }> {
    try {
      const client = new OllamaClient({ baseUrl: this.config.ollamaHost })
      const text = await client.chatText({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        options: { temperature: 0.2 },
      })
      return { success: true, response: text }
    } catch (err) {
      return { success: false, response: `Failed to connect to local Ollama at ${this.config.ollamaHost}: ${String(err)}` }
    }
  }

  private missingApiKeyResult(providerLabel: string): { success: false; response: string } {
    return {
      success: false,
      response: `No ${providerLabel} API key configured. Run "RailsForge: Set AI Provider API Key" (railsforge.setAiApiKey) first, or switch railsForge.ai.provider back to "ollama".`,
    }
  }

  /** Ollama's /v1/chat/completions and OpenAI's /v1/chat/completions share the same request/response shape. */
  private async callOpenAiCompatible(
    url: string,
    model: string,
    systemPrompt: string,
    prompt: string,
    apiKey: string | undefined,
    connectionLabel: string,
  ): Promise<{ success: boolean; response: string }> {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      })

      if (!res.ok) {
        return { success: false, response: `${connectionLabel} error: ${res.status} ${res.statusText}` }
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      return { success: true, response: json.choices?.[0]?.message?.content ?? 'No response generated.' }
    } catch (err) {
      return { success: false, response: `Failed to connect to ${connectionLabel}: ${String(err)}` }
    }
  }

  private async callAnthropic(
    systemPrompt: string,
    prompt: string,
    model: string,
    apiKey: string,
  ): Promise<{ success: boolean; response: string }> {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
        }),
      })

      if (!res.ok) {
        return { success: false, response: `Anthropic error: ${res.status} ${res.statusText}` }
      }

      const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> }
      const text = json.content?.find(block => block.type === 'text')?.text
      return { success: true, response: text ?? 'No response generated.' }
    } catch (err) {
      return { success: false, response: `Failed to connect to Anthropic: ${String(err)}` }
    }
  }

  /**
   * Asks the local model to rewrite `code` so it no longer triggers `diagnosticMessage`.
   * Returns null (never throws) if the model is unreachable or the response isn't usable,
   * so callers can show a clean "AI fix unavailable" message instead of a stack trace.
   */
  async suggestCodeFix(code: string, diagnosticMessage: string, context: RailsAgentContext): Promise<string | null> {
    const isHeaderOrFull = code.trim().startsWith('# frozen_string_literal') || /^(class|module)\s+[A-Z]/.test(code.trim())
    const instruction = [
      `Fix the following Ruby snippet so it no longer triggers this issue: "${diagnosticMessage}".`,
      'Replace ONLY the targeted snippet. Do NOT output the entire file, class, or module.',
      'Follow SOLID/DRY/YAGNI/KISS and this project\'s existing patterns.',
      'The File Content above is READ-ONLY context, not something you can edit — but if a sibling method there ' +
        'shares this exact resource/pattern (e.g. both open the same kind of connection), your fix must stay ' +
        'consistent with it. Do not introduce a convention (like an injectable instance variable) in this snippet ' +
        'that the sibling method would then be missing.',
      'Never close, disconnect, or otherwise release an object this snippet did not itself create — if the object ' +
        'may have been supplied by the caller (e.g. via an instance variable), ownership isn\'t yours to end.',
      'Respond with ONLY the replacement Ruby code for this snippet. No explanation, no markdown code fences.',
      '',
      code,
    ].join('\n')

    const result = await this.run(instruction, context)
    if (!result.success) {return null}

    const cleaned = result.response.trim().replace(/^```(?:ruby)?\n?/, '').replace(/\n?```$/, '')
    if (!cleaned) {return null}

    // Safety guard: reject hallucinated full-file rewrites when replacing a single snippet
    const hadModule = /^\s*module\s+[A-Z]/m.test(code)
    if (!isHeaderOrFull && (/^#\s*frozen_string_literal/m.test(cleaned) || (!hadModule && /^module\s+[A-Z]/m.test(cleaned)))) {
      return null
    }

    return cleaned
  }

  /**
   * For Ollama, actually pings the local server. Cloud providers aren't pinged (no free,
   * side-effect-free health endpoint) — "healthy" just means a key is configured.
   */
  async healthCheck(): Promise<boolean> {
    const provider = this.config.provider ?? 'ollama'
    if (provider !== 'ollama') {
      return Boolean(await this.config.getApiKey?.())
    }

    try {
      const client = new OllamaClient({ baseUrl: this.config.ollamaHost })
      const checks = await client.healthCheck()
      return checks.some(c => c.reachable)
    } catch {
      return false
    }
  }

  private buildSystemPrompt(context: RailsAgentContext): string {
    const tables = this.schemaIndexer.getAllTables().map(t => `${t.name} (${Array.from(t.columns.keys()).join(', ')})`)
    const routes = this.routesIndexer.getAllRoutes().slice(0, 30).map(r => `${r.verb} ${r.uriPattern} => ${r.controller}#${r.action}`)
    const rubyVer = this.env?.rubyVersion ?? '3.3.0'
    // Undetected env defaults to "assume Rails" (RailsForge's primary use case); an explicitly
    // detected non-Rails project (a gem/script with no `rails` Gemfile.lock dependency) must not
    // be told it's constrained to a Rails version it doesn't actually depend on.
    const isRailsProject = this.env === undefined || this.env.hasRails

    const parts: string[] = isRailsProject
      ? [
        'You are RailsForge AI, a senior Ruby on Rails engineering assistant.',
        `CRITICAL CONSTRAINT: The active project strictly uses Ruby ${rubyVer} and Rails ${this.env?.railsVersion ?? '7.1.0'}.`,
        `Do NOT use or suggest features from newer Ruby or Rails versions. Only use standard library modules and gem APIs compatible with Ruby ${rubyVer} and Rails ${this.env?.railsVersion ?? '7.1.0'}.`,
        'Always produce clean, modern, idiomatic code adhering to RuboCop-Rails standards.',
        'Follow SOLID principles, avoid fat controllers, extract business logic to Service Objects, and prevent N+1 queries.',
        'Before generating a new Service, Query, Form, Policy, or Decorator, search the "Existing Project Patterns" list below. If a close match exists, reuse or extend it instead of writing a new one from scratch, and say so explicitly.',
      ]
      : [
        'You are RailsForge AI, a senior Ruby engineering assistant.',
        `CRITICAL CONSTRAINT: The active project is a standalone Ruby codebase (gem or script) using Ruby ${rubyVer}. It does NOT depend on Rails — do not assume ActiveRecord, ActionController, or any other Rails framework API is available unless it appears as an actual dependency below.`,
        'Only use Ruby standard library and gem APIs that are actually declared as dependencies.',
        'Follow SOLID principles and keep classes focused on a single responsibility.',
        'Before generating new code, search the "Existing Project Patterns" list below. If a close match exists, reuse or extend it instead of writing a new one from scratch, and say so explicitly.',
      ]

    const patternSummary = this.summarizePatterns()
    if (patternSummary) {
      parts.push(`Existing Project Patterns (reuse before generating new code):\n${patternSummary}`)
    }

    if (tables.length > 0) {
      parts.push(`Active Database Schema:\n${tables.join('\n')}`)
    }

    if (routes.length > 0) {
      parts.push(`Active Routes Summary (first 30):\n${routes.join('\n')}`)
    }

    if (context.fileName) {
      parts.push(`Current File: ${context.fileName}`)
    }

    if (context.fileContent) {
      parts.push(`File Content:\n\`\`\`ruby\n${context.fileContent}\n\`\`\``)
    }

    return parts.join('\n\n')
  }

  private summarizePatterns(): string {
    if (!this.patternIndexer) {return ''}

    const byType = new Map<string, string[]>()
    for (const pattern of this.patternIndexer.getAllPatterns()) {
      const list = byType.get(pattern.type) ?? []
      list.push(`${pattern.name} (${pattern.filePath})`)
      byType.set(pattern.type, list)
    }

    return Array.from(byType.entries())
      .map(([type, names]) => `- ${type}: ${names.slice(0, 8).join(', ')}`)
      .join('\n')
  }
}
