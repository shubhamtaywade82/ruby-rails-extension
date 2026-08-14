/**
 * RailsAgent - Local LLM Agent for Ruby on Rails engineering
 */

import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'
import { ProjectEnvironment } from '../environment/EnvironmentDetector'

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
    const railsVer = this.env?.railsVersion ?? '7.1.0'

    const parts: string[] = [
      'You are RailsForge AI, a senior Ruby on Rails engineering assistant.',
      `CRITICAL CONSTRAINT: The active project strictly uses Ruby ${rubyVer} and Rails ${railsVer}.`,
      `Do NOT use or suggest features from newer Ruby or Rails versions. Only use standard library modules and gem APIs compatible with Ruby ${rubyVer} and Rails ${railsVer}.`,
      'Always produce clean, modern, idiomatic code adhering to RuboCop-Rails standards.',
      'Follow SOLID principles, avoid fat controllers, extract business logic to Service Objects, and prevent N+1 queries.',
    ]

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
}
