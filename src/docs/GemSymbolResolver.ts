/**
 * GemSymbolResolver - Best-effort mapping from a Ruby constant (e.g. hovered/selected
 * text like "Pundit" or "Sidekiq::Worker") to the gem that defines it, for
 * RubyDocProvider lookups. RailsForge has no full Ruby type inference, so this is
 * a heuristic, in priority order:
 *
 * 1. A curated namespace -> gem-name table, for the (common) case where a gem's
 *    published name doesn't match its top-level module (`view_component` ships
 *    `ViewComponent`, `factory_bot` ships `FactoryBot`, etc).
 * 2. snake_case of the namespace, matched against the project's actual locked
 *    gems — covers everything not worth curating by hand.
 * 3. The namespace lowercased as-is — covers single-word gems that publish
 *    their exact name (`faraday` ships `Faraday`, `pundit` ships `Pundit`).
 *
 * Each step only succeeds if the candidate name is an *actual* locked gem
 * (from GemfileLockParser), so a guess that doesn't match anything the
 * project depends on correctly resolves to null rather than a wrong gem.
 */

const NAMESPACE_TO_GEM: Record<string, string> = {
  ViewComponent: 'view_component',
  FactoryBot: 'factory_bot',
  RSpec: 'rspec-core',
  ActiveInteraction: 'active_interaction',
  ActionMailer: 'actionmailer',
  ActiveSupport: 'activesupport',
  ActiveModel: 'activemodel',
  ActiveRecord: 'activerecord',
  ActionController: 'actionpack',
  ActionView: 'actionview',
  ActionCable: 'actioncable',
  ActiveJob: 'activejob',
  ActiveStorage: 'activestorage',
}

export interface GemResolution {
  gem: string
  version: string
}

export class GemSymbolResolver {
  private namespaceToGem: Record<string, string>

  constructor(private lockedVersions: Map<string, string>, customMappings: { namespace: string; gem: string }[] = []) {
    this.namespaceToGem = { ...NAMESPACE_TO_GEM }
    for (const { namespace, gem } of customMappings) {
      this.namespaceToGem[namespace] = gem
    }
  }

  resolve(symbolFqn: string): GemResolution | null {
    const topLevel = symbolFqn.split('::')[0]?.trim()
    if (!topLevel) {return null}

    const mapped = this.namespaceToGem[topLevel]
    if (mapped) {
      const resolved = this.resolveVersion(mapped)
      if (resolved) {return resolved}
    }

    const snakeCase = toSnakeCase(topLevel)
    const bySnakeCase = this.resolveVersion(snakeCase)
    if (bySnakeCase) {return bySnakeCase}

    return this.resolveVersion(topLevel.toLowerCase())
  }

  private resolveVersion(gem: string): GemResolution | null {
    const version = this.lockedVersions.get(gem)
    return version ? { gem, version } : null
  }
}

function toSnakeCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase()
}
