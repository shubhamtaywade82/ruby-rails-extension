/**
 * SpeculativeFixCache - Pre-generates and caches AI fixes for common, deterministic RuboCop offenses.
 *
 * On workspace activation, pre-generates fixes for the top 20 most common RuboCop offenses
 * using a deterministic prompt template. This enables instant fixes for the majority of
 * issues without calling the model at request time.
 */

import * as vscode from 'vscode'
import { RailsAgent, RailsAgentContext } from './RailsAgent'
import { RailsAgentConfig } from './RailsAgent'

export interface CachedFix {
  diff: string
  diagnosticMessage: string
  cop: string
  codePattern: string // Regex or exact match for the code this fix applies to
  generatedAt: number
}

interface SpeculativeCacheConfig {
  maxEntries: number
  ttlMs: number
}

const DEFAULT_CONFIG: SpeculativeCacheConfig = {
  maxEntries: 100,
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
}

/**
 * Common RuboCop offenses that benefit from speculative caching.
 * These are frequent, deterministic, and follow predictable fix patterns.
 */
const COMMON_COP_TEMPLATES: Array<{ cop: string; codePattern: string; prompt: string }> = [
  {
    cop: 'Style/FrozenStringLiteralComment',
    codePattern: '^\\s*[^#]',
    prompt: `Fix this missing frozen_string_literal comment. Output ONLY a minimal unified diff adding the comment at the top of the file.`
  },
  {
    cop: 'Style/Documentation',
    codePattern: 'class\\s+[A-Z]\\w*',
    prompt: `Fix this missing top-level documentation comment. Output ONLY a minimal unified diff adding a single comment line above the class/module.`
  },
  {
    cop: 'Layout/TrailingWhitespace',
    codePattern: '\\s+$',
    prompt: `Fix trailing whitespace. Output ONLY a minimal unified diff removing trailing spaces.`
  },
  {
    cop: 'Rails/ReadWriteAttribute',
    codePattern: 'attr_(reader|writer|accessor)\\s+:',
    prompt: `Fix this Rails attribute accessor. Use ActiveRecord attribute methods instead. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Rails/SaveBang',
    codePattern: '\\.save(?!\\!)',
    prompt: `Fix this save call to use save! for exception-raising behavior. Output ONLY a minimal unified diff changing .save to .save!.`
  },
  {
    cop: 'Style/StringLiterals',
    codePattern: '"[^"]*"',
    prompt: `Fix string literal style. Prefer single quotes when no interpolation. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Layout/LineLength',
    codePattern: '.{120,}',
    prompt: `Fix line length violation. Break long lines appropriately. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Metrics/MethodLength',
    codePattern: 'def\\s+\\w+',
    prompt: `Fix method length violation. Extract helper methods. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Metrics/ClassLength',
    codePattern: 'class\\s+[A-Z]\\w*',
    prompt: `Fix class length violation. Extract to service/query/form object. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Style/GuardClause',
    codePattern: 'if\\s+.*\\n\\s+else',
    prompt: `Fix guard clause. Return early instead of if/else. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Rails/Pluck',
    codePattern: '\\.map\\{|\\.collect\\{',
    prompt: `Fix this to use pluck instead of map/collect. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Rails/WhereExists',
    codePattern: '\\.where\\(.*\\.exists',
    prompt: `Fix this to use where.exists instead. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Rails/OutputSafety',
    codePattern: '<%=',
    prompt: `Fix output safety. Use raw/sanitize appropriately. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Rails/Delegate',
    codePattern: 'def\\s+\\w+.*\\.\\w+',
    prompt: `Fix this to use delegate instead of manual delegation. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Style/EmptyMethod',
    codePattern: 'def\\s+\\w+\\s*\\(.*\\)\\s*\\n\\s*end',
    prompt: `Fix empty method. Add implementation or remove. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Style/RedundantReturn',
    codePattern: 'return\\s+',
    prompt: `Fix redundant return. Remove explicit return. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Style/RedundantSelf',
    codePattern: 'self\\.\\w+',
    prompt: `Fix redundant self. Remove explicit self. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Layout/SpaceAroundOperators',
    codePattern: '[^\\s][+\\-*/=]{1,2}[^\\s]',
    prompt: `Fix spacing around operators. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Style/NumericLiterals',
    codePattern: '\\d{4,}',
    prompt: `Fix numeric literals. Add underscores for readability. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Style/PercentQLiterals',
    codePattern: '"\\[.*\\]"',
    prompt: `Fix to use %q/%Q literal syntax. Output ONLY a minimal unified diff.`
  },
  {
    cop: 'Layout/FirstArrayElementIndentation',
    codePattern: '\\[\\s*\\n',
    prompt: `Fix array element indentation. Output ONLY a minimal unified diff.`
  }
]

export class SpeculativeFixCache {
  private cache = new Map<string, CachedFix>()
  private agent: RailsAgent
  private config: SpeculativeCacheConfig
  private warming: Promise<void> | null = null
  private warmed = false

  constructor(agent: RailsAgent, config?: Partial<SpeculativeCacheConfig>) {
    this.agent = agent
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Warms the cache by pre-generating fixes for common cops.
   * Call this on workspace activation. Idempotent - subsequent calls return the same promise.
   */
  async warm(): Promise<void> {
    if (this.warmed) { return }
    if (this.warming) { return this.warming }

    this.warming = this.doWarm()
    try {
      await this.warming
      this.warmed = true
    } finally {
      this.warming = null
    }
  }

  private async doWarm(): Promise<void> {
    console.log('[SpeculativeFixCache] Warming cache...')
    const start = Date.now()
    let generated = 0

    for (const template of COMMON_COP_TEMPLATES) {
      if (this.cache.size >= this.config.maxEntries) {break}

      try {
        const diff = await this.generateTemplateFix(template)
        if (diff) {
          const key = this.makeKey(template.cop, template.codePattern)
          this.cache.set(key, {
            diff,
            diagnosticMessage: template.cop,
            cop: template.cop,
            codePattern: template.codePattern,
            generatedAt: Date.now(),
          })
          generated++
        }
      } catch (e) {
        console.warn(`[SpeculativeFixCache] Failed to generate fix for ${template.cop}: ${e}`)
      }
    }

    console.log(`[SpeculativeFixCache] Warmed ${generated} fixes in ${Date.now() - start}ms`)
  }

  private async generateTemplateFix(template: typeof COMMON_COP_TEMPLATES[0]): Promise<string | null> {
    // Generate a minimal code example that triggers this cop
    const exampleCode = this.getExampleCode(template.cop, template.codePattern)
    if (!exampleCode) {return null}

    const context: RailsAgentContext = {
      fileContent: exampleCode,
      fileName: `example_${template.cop.replace(/\//g, '_')}.rb`,
      diagnosticMessage: template.cop,
      isFix: true,
    }

    const prompt = `Fix this ${template.cop} violation. ${template.prompt}`
    const result = await this.agent.suggestFix(exampleCode, template.cop, context)
    if (!result || result.type !== 'patch' || result.hunks.length === 0) {return null}

    // Convert hunks back to diff text for caching
    return this.hunksToDiff(result.hunks, exampleCode)
  }

  private getExampleCode(cop: string, pattern: string): string | null {
    // Return minimal code that triggers the cop
    const examples: Record<string, string> = {
      'Style/FrozenStringLiteralComment': 'class Foo\n  def bar; end\nend',
      'Style/Documentation': 'class Foo\n  def bar; end\nend',
      'Layout/TrailingWhitespace': 'class Foo\n  def bar\n    1 \n  end\nend',
      'Rails/ReadWriteAttribute': 'class Foo < ApplicationRecord\n  attr_reader :foo\nend',
      'Rails/SaveBang': 'class Foo < ApplicationRecord\n  def save_it\n    save\n  end\nend',
      'Style/StringLiterals': 'class Foo\n  def bar\n    "hello"\n  end\nend',
      'Layout/LineLength': 'class Foo\n  def bar\n    very_long_method_name_that_exceeds_the_maximum_line_length_allowed_by_rubocop\n  end\nend',
      'Metrics/MethodLength': 'class Foo\n  def very_long_method\n    1; 2; 3; 4; 5; 6; 7; 8; 9; 10\n  end\nend',
      'Metrics/ClassLength': 'class Foo\n  def m1; end; def m2; end; def m3; end; def m4; end; def m5; end; def m6; end; def m7; end; def m8; end; def m9; end; def m10; end\nend',
      'Style/GuardClause': 'class Foo\n  def bar\n    if condition\n      do_something\n    else\n      do_other\n    end\n  end\nend',
      'Rails/Pluck': 'class Foo < ApplicationRecord\n  def bar\n    User.all.map(&:name)\n  end\nend',
      'Rails/WhereExists': 'class Foo < ApplicationRecord\n  def bar\n    User.where(posts: { exists: true })\n  end\nend',
      'Rails/OutputSafety': '<%= @user.name %>',
      'Rails/Delegate': 'class Foo < ApplicationRecord\n  def bar\n    user.name\n  end\nend',
      'Style/EmptyMethod': 'class Foo\n  def bar\n  end\nend',
      'Style/RedundantReturn': 'class Foo\n  def bar\n    return 1\n  end\nend',
      'Style/RedundantSelf': 'class Foo\n  def bar\n    self.baz\n  end\nend',
      'Layout/SpaceAroundOperators': 'class Foo\n  def bar\n    1+2\n  end\nend',
      'Style/NumericLiterals': 'class Foo\n  def bar\n    1000000\n  end\nend',
      'Style/PercentQLiterals': 'class Foo\n  def bar\n    "hello"\n  end\nend',
      'Layout/FirstArrayElementIndentation': 'class Foo\n  def bar\n    [\n      1\n    ]\n  end\nend',
    }
    return examples[cop] ?? null
  }

  private hunksToDiff(hunks: any[], originalCode: string): string {
    // Reconstruct diff from hunks (simplified - just use the first hunk for template)
    const hunk = hunks[0]
    if (!hunk) {return ''}
    const lines = ['--- a/example.rb', '+++ b/example.rb']
    lines.push(`@@ -${hunk.oldStart + 1},${hunk.oldLines.length} +${hunk.oldStart + 1},${hunk.newLines.length} @@`)
    for (let i = 0; i < Math.max(hunk.oldLines.length, hunk.newLines.length); i++) {
      if (i < hunk.oldLines.length && i < hunk.newLines.length) {
        if (hunk.oldLines[i] !== hunk.newLines[i]) {
          lines.push(`-${hunk.oldLines[i]}`)
          lines.push(`+${hunk.newLines[i]}`)
        } else {
          lines.push(` ${hunk.oldLines[i]}`)
        }
      } else if (i < hunk.oldLines.length) {
        lines.push(`-${hunk.oldLines[i]}`)
      } else {
        lines.push(`+${hunk.newLines[i]}`)
      }
    }
    return lines.join('\n')
  }

  private makeKey(cop: string, codePattern: string): string {
    return `${cop}:${codePattern}`
  }

  /**
   * Retrieves a cached fix if it matches the diagnostic and code.
   * Returns null if no match or cache expired.
   */
  get(cop: string, code: string): string | null {
    const key = this.findMatchingKey(cop, code)
    if (!key) {return null}

    const entry = this.cache.get(key)
    if (!entry) {return null}

    // Check TTL
    if (Date.now() - entry.generatedAt > this.config.ttlMs) {
      this.cache.delete(key)
      return null
    }

    // Verify the code pattern matches
    try {
      const regex = new RegExp(entry.codePattern)
      if (!regex.test(code)) {return null}
    } catch {
      return null
    }

    return entry.diff
  }

  private findMatchingKey(cop: string, code: string): string | null {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.cop === cop) {
        try {
          if (new RegExp(entry.codePattern).test(code)) {return key}
        } catch {continue}
      }
    }
    return null
  }

  /**
   * Stores a fix in the cache (e.g., after successful model generation).
   */
  set(cop: string, codePattern: string, diff: string): void {
    if (this.cache.size >= this.config.maxEntries) {
      // Evict oldest
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {this.cache.delete(oldestKey)}
    }
    const key = this.makeKey(cop, codePattern)
    this.cache.set(key, {
      diff,
      diagnosticMessage: cop,
      cop,
      codePattern,
      generatedAt: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
    this.warmed = false
    this.warming = null
  }

  stats(): { size: number; warmed: boolean; entries: string[] } {
    return {
      size: this.cache.size,
      warmed: this.warmed,
      entries: Array.from(this.cache.keys()),
    }
  }
}