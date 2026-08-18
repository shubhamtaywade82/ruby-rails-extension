/**
 * RubyGemsClient - Thin wrapper over the public RubyGems.org API
 * (https://guides.rubygems.org/rubygems-org-api/). Deliberately not a new
 * dependency: reuses the same global-`fetch` approach as EmbeddingClient.
 * Never throws — callers treat `null` as "info unavailable", matching how
 * EmbeddingClient signals an unreachable Ollama host.
 */

export interface GemInfo {
  name: string
  version: string
  summary: string
  homepageUri?: string
  documentationUri?: string
}

interface RubyGemsApiResponse {
  name: string
  version: string
  info?: string
  summary?: string
  homepage_uri?: string
  documentation_uri?: string
}

export class RubyGemsClient {
  private cache: Map<string, GemInfo | null> = new Map()

  async fetchGemInfo(name: string): Promise<GemInfo | null> {
    if (this.cache.has(name)) {
      return this.cache.get(name) ?? null
    }

    const info = await this.request(name)
    this.cache.set(name, info)
    return info
  }

  private async request(name: string): Promise<GemInfo | null> {
    const url = `https://rubygems.org/api/v1/gems/${encodeURIComponent(name)}.json`

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) {return null}

      const json = (await res.json()) as RubyGemsApiResponse
      if (!json.name || !json.version) {return null}

      return {
        name: json.name,
        version: json.version,
        summary: json.summary || json.info || '',
        homepageUri: json.homepage_uri || undefined,
        documentationUri: json.documentation_uri || undefined,
      }
    } catch {
      return null
    }
  }
}
