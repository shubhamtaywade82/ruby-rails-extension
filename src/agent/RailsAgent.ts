/**
 * RailsAgent - Local LLM Agent for Ruby on Rails engineering
 */

import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'
import { ProjectEnvironment } from '../environment/EnvironmentDetector'
import { ProjectPatternIndexer } from '../patterns/ProjectPatternIndexer'

export interface RailsAgentConfig {
  ollamaHost: string
  model: string
  maxIterations?: number
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
    const url = `${this.config.ollamaHost.replace(/\/$/, '')}/v1/chat/completions`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      })

      if (!res.ok) {
        return {
          success: false,
          response: `Ollama error: ${res.status} ${res.statusText}`,
          iterations: 1,
        }
      }

      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const reply = json.choices?.[0]?.message?.content ?? 'No response generated.'

      return {
        success: true,
        response: reply,
        iterations: 1,
      }
    } catch (err) {
      return {
        success: false,
        response: `Failed to connect to local Ollama at ${this.config.ollamaHost}: ${String(err)}`,
        iterations: 0,
      }
    }
  }

  /**
   * Asks the local model to rewrite `code` so it no longer triggers `diagnosticMessage`.
   * Returns null (never throws) if the model is unreachable or the response isn't usable,
   * so callers can show a clean "AI fix unavailable" message instead of a stack trace.
   */
  async suggestCodeFix(code: string, diagnosticMessage: string, context: RailsAgentContext): Promise<string | null> {
    const instruction = [
      `Fix the following Ruby code so it no longer triggers this issue: "${diagnosticMessage}".`,
      'Follow SOLID/DRY/YAGNI/KISS and this project\'s existing patterns.',
      'Respond with ONLY the corrected Ruby code. No explanation, no markdown code fences.',
      '',
      code,
    ].join('\n')

    const result = await this.run(instruction, context)
    if (!result.success) {return null}

    const cleaned = result.response.trim().replace(/^```(?:ruby)?\n?/, '').replace(/\n?```$/, '')
    return cleaned.length > 0 ? cleaned : null
  }

  async healthCheck(): Promise<boolean> {
    try {
      const url = `${this.config.ollamaHost.replace(/\/$/, '')}/api/tags`
      const res = await fetch(url, { method: 'GET' })
      return res.ok
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
