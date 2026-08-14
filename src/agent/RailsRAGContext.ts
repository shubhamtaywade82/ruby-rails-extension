/**
 * RailsRAGContext - Context grounding and hardware fallback engine for RailsForge AI
 */

import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'

export class RailsRAGContext {
  private preferredModels = ['qwen2.5-coder:14b', 'qwen2.5-coder:7b', 'deepseek-coder:6.7b', 'codellama']

  constructor(
    private schemaIndexer: SchemaIndexer,
    private routesIndexer: RoutesIndexer,
  ) {}

  async detectBestAvailableModel(host: string, requestedModel: string): Promise<string> {
    try {
      const res = await fetch(`${host.replace(/\/$/, '')}/api/tags`)
      if (!res.ok) {return requestedModel}

      const data = (await res.json()) as { models?: Array<{ name?: string }> }
      const available = new Set((data.models ?? []).map(m => m.name ?? ''))

      if (available.has(requestedModel)) {
        return requestedModel
      }

      for (const pref of this.preferredModels) {
        if (available.has(pref)) {
          return pref
        }
      }
      return requestedModel
    } catch {
      return requestedModel
    }
  }

  buildGroundedPrompt(userQuery: string, activeCode?: string): string {
    const relevantTables = this.findRelevantTables(userQuery)
    const relevantRoutes = this.findRelevantRoutes(userQuery).slice(0, 10)

    const sections: string[] = []
    if (relevantTables.length > 0) {
      sections.push('### Grounded ActiveRecord Schema:')
      for (const t of relevantTables) {
        const cols = Array.from(t.columns.values()).map(c => `${c.name}:${c.type}`).join(', ')
        sections.push(`- **${t.name}**: ${cols}`)
      }
    }

    if (relevantRoutes.length > 0) {
      sections.push('### Grounded Routes:')
      for (const r of relevantRoutes) {
        sections.push(`- \`${r.verb} ${r.uriPattern}\` => \`${r.controller}#${r.action}\``)
      }
    }

    if (activeCode) {
      sections.push(`### Target File Code:\n\`\`\`ruby\n${activeCode}\n\`\`\``)
    }

    return sections.join('\n\n')
  }

  private findRelevantTables(query: string) {
    const q = query.toLowerCase()
    return this.schemaIndexer.getAllTables().filter(t =>
      q.includes(t.name.toLowerCase()) ||
      t.name.toLowerCase().includes(q) ||
      Array.from(t.columns.keys()).some(k => q.includes(k.toLowerCase())),
    )
  }

  private findRelevantRoutes(query: string) {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
    return this.routesIndexer.getAllRoutes().filter(r => {
      const line = `${r.uriPattern} ${r.helperName ?? ''} ${r.controller} ${r.action}`.toLowerCase()
      return tokens.some(t => line.includes(t))
    })
  }
}

