/**
 * EmbeddingClient - Thin wrapper over Ollama's /api/embeddings endpoint.
 *
 * Deliberately not a new dependency: reuses the same host/fetch approach as
 * RailsAgent, just against a separate (typically much smaller) embedding model
 * instead of the chat model. Never throws — callers treat `null` as "semantic
 * search unavailable, fall back to keyword search".
 */

export interface EmbeddingClientConfig {
  ollamaHost: string
  model: string
  timeoutMs?: number
}

export class EmbeddingClient {
  constructor(private config: EmbeddingClientConfig) {}

  async embed(text: string): Promise<number[] | null> {
    const url = `${this.config.ollamaHost.replace(/\/$/, '')}/api/embeddings`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.config.model, prompt: text }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 5000),
      })
      if (!res.ok) {return null}

      const json = (await res.json()) as { embedding?: number[] }
      return Array.isArray(json.embedding) && json.embedding.length > 0 ? json.embedding : null
    } catch {
      return null
    }
  }
}
