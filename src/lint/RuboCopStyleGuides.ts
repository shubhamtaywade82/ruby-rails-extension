/**
 * RuboCopStyleGuides - Applies a community RuboCop style guide by wiring up each guide's
 * own real activation mechanism, verified against each project's published README before
 * writing this (not scraped/guessed config files):
 *
 * - Shopify (`rubocop-shopify`): `inherit_gem: { rubocop-shopify: rubocop.yml }`
 *   (github.com/Shopify/ruby-style-guide)
 * - GitLab (`gitlab-styles`): `inherit_gem: { gitlab-styles: [rubocop-default.yml] }`
 *   (gitlab.com/gitlab-org/ruby/gems/gitlab-styles)
 * - Airbnb (`rubocop-airbnb`): NOT `inherit_gem` — it's a RuboCop *plugin*, activated via
 *   a `plugins:` key in its own file (`.rubocop_airbnb.yml`, kept separate because RuboCop
 *   resolves `inherit_from` before `plugins`/`require`, so a same-file `plugins:` entry
 *   would make an existing `.rubocop_todo.yml`'s `Airbnb/*` disables warn as unknown cops)
 *   referenced from `.rubocop.yml`'s `inherit_from` list. (github.com/airbnb/ruby)
 *
 * Text-based editing (no YAML parser dependency), same "pragmatic over rigorous" choice
 * this codebase already makes elsewhere (CursorRulesGenerator, etc.) — safe because the
 * only structure touched is a single top-level `inherit_from`/`inherit_gem` key, checked
 * for idempotency before ever writing.
 */

export type RuboCopStyleGuideId = 'shopify' | 'gitlab' | 'airbnb'

export interface StyleGuideApplication {
  guide: RuboCopStyleGuideId
  label: string
  gemName: string
  /** Prepended into .rubocop.yml verbatim (shopify/gitlab's inherit_gem form). */
  rubocopYmlBlock?: string
  /** A standalone file this guide needs (airbnb's plugin-activation file). */
  extraFile?: { name: string; content: string }
  /** When set, this entry is merged into .rubocop.yml's `inherit_from` list instead of using `rubocopYmlBlock`. */
  inheritFromEntry?: string
  /** Substring that means "already applied" — checked before writing anything. */
  alreadyAppliedMarker: string
}

export function getStyleGuideApplication(guide: RuboCopStyleGuideId): StyleGuideApplication {
  switch (guide) {
    case 'shopify':
      return {
        guide,
        label: 'Shopify Ruby Style Guide',
        gemName: 'rubocop-shopify',
        rubocopYmlBlock: 'inherit_gem:\n  rubocop-shopify: rubocop.yml\n',
        alreadyAppliedMarker: 'rubocop-shopify',
      }
    case 'gitlab':
      return {
        guide,
        label: 'GitLab Ruby Style Guide',
        gemName: 'gitlab-styles',
        rubocopYmlBlock: 'inherit_gem:\n  gitlab-styles:\n    - rubocop-default.yml\n',
        alreadyAppliedMarker: 'gitlab-styles',
      }
    case 'airbnb':
      return {
        guide,
        label: 'Airbnb Ruby Style Guide',
        gemName: 'rubocop-airbnb',
        extraFile: { name: '.rubocop_airbnb.yml', content: 'plugins:\n  - rubocop-airbnb\n' },
        inheritFromEntry: '.rubocop_airbnb.yml',
        alreadyAppliedMarker: '.rubocop_airbnb.yml',
      }
  }
}

export function ensureGemInGemfile(content: string, gemName: string): { content: string; changed: boolean } {
  const pattern = new RegExp(`^\\s*gem\\s+["']${escapeRegExp(gemName)}["']`, 'm')
  if (pattern.test(content)) {return { content, changed: false }}

  const separator = content.length === 0 || content.endsWith('\n') ? '' : '\n'
  return { content: `${content}${separator}gem "${gemName}", require: false\n`, changed: true }
}

/** Shopify/GitLab: prepends a ready-made `inherit_gem` block, skipping if the guide's gem name is already referenced anywhere in the file. */
export function applyInheritGemBlock(content: string, block: string, marker: string): { content: string; changed: boolean } {
  if (content.includes(marker)) {return { content, changed: false }}
  return { content: `${block}\n${content}`, changed: true }
}

/**
 * Airbnb: merges `entry` into .rubocop.yml's `inherit_from` list — handling the three
 * shapes a real .rubocop.yml can already be in (no `inherit_from` key yet, an existing
 * multi-line list, or an existing single scalar file) — rather than the simpler
 * whole-block prepend `applyInheritGemBlock` uses, since a project can only have one
 * `inherit_from` key and a second one would silently shadow the first.
 */
export function applyAirbnbInheritFrom(content: string, entry: string): { content: string; changed: boolean } {
  if (content.includes(entry)) {return { content, changed: false }}

  const listMatch = /^inherit_from:[ \t]*\n((?:[ \t]*-[ \t]*.+\n?)+)/m.exec(content)
  if (listMatch) {
    const replacement = `inherit_from:\n  - ${entry}\n${listMatch[1]}`
    return { content: content.replace(listMatch[0], replacement), changed: true }
  }

  const scalarMatch = /^inherit_from:[ \t]*(\S.*)$/m.exec(content)
  if (scalarMatch) {
    const replacement = `inherit_from:\n  - ${entry}\n  - ${scalarMatch[1].trim()}`
    return { content: content.replace(scalarMatch[0], replacement), changed: true }
  }

  const separator = content.length === 0 ? '' : '\n'
  return { content: `inherit_from:\n  - ${entry}\n${separator}${content}`, changed: true }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
