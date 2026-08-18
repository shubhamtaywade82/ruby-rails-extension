/**
 * SemanticSearchIndex - "find where we charge a card" style search over this project's
 * own indexed patterns (services/queries/policies/forms/decorators/concerns).
 *
 * No SQLite/vector DB dependency: embeddings (when available) are cached in-memory,
 * keyed by pattern id, and invalidated when the pattern's preview/location changes.
 * If the embedding model is unavailable (Ollama not running, model not pulled, or the
 * embed function isn't configured), search falls back to token-overlap keyword matching
 * over pattern name/preview/public methods — degraded, but never broken.
 */

import { ProjectPatternIndexer, IndexedPattern } from '../patterns/ProjectPatternIndexer'
import { LruCache } from '../util/LruCache'

export type EmbedFn = (text: string) => Promise<number[] | null>

export interface SearchResult {
  pattern: IndexedPattern
  score: number
  matchedBy: 'semantic' | 'keyword'
}

interface EmbeddingCacheEntry {
  vector: number[]
  /** Content fingerprint at embed time — a mismatch means the pattern changed and needs re-embedding. */
  contentKey: string
}

export class SemanticSearchIndex {
  private cache: LruCache<string, EmbeddingCacheEntry>

  constructor(
    private patternIndexer: ProjectPatternIndexer,
    private embed: EmbedFn,
    maxCacheSize = 200,
  ) {
    this.cache = new LruCache(maxCacheSize)
  }

  async search(query: string, limit = 10): Promise<SearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) {return []}

    const patterns = this.patternIndexer.getAllPatterns()
    if (patterns.length === 0) {return []}

    const queryVector = await this.embed(trimmed)
    if (queryVector) {
      const semanticResults = await this.semanticSearch(queryVector, patterns, limit)
      if (semanticResults.length > 0) {return semanticResults}
    }

    return this.keywordSearch(trimmed, patterns, limit)
  }

  private async semanticSearch(queryVector: number[], patterns: IndexedPattern[], limit: number): Promise<SearchResult[]> {
    await this.ensureEmbedded(patterns)

    return patterns
      .map(pattern => ({ pattern, vector: this.cache.get(pattern.id)?.vector }))
      .filter((entry): entry is { pattern: IndexedPattern; vector: number[] } => entry.vector !== undefined)
      .map(entry => ({ pattern: entry.pattern, score: cosineSimilarity(queryVector, entry.vector), matchedBy: 'semantic' as const }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  private async ensureEmbedded(patterns: IndexedPattern[]): Promise<void> {
    for (const pattern of patterns) {
      const key = this.contentKey(pattern)
      if (this.cache.get(pattern.id)?.contentKey === key) {continue}

      const vector = await this.embed(this.embeddingText(pattern))
      if (vector) {
        this.cache.set(pattern.id, { vector, contentKey: key })
      }
    }
  }

  private embeddingText(pattern: IndexedPattern): string {
    return [
      `${pattern.type}: ${pattern.name}`,
      pattern.publicMethods.length > 0 ? `Methods: ${pattern.publicMethods.join(', ')}` : '',
      pattern.preview,
    ].filter(Boolean).join('\n')
  }

  /** Cheap fingerprint to detect a pattern's content changed since it was last embedded, without hashing. */
  private contentKey(pattern: IndexedPattern): string {
    return `${pattern.filePath}:${pattern.lineStart}:${pattern.preview}`
  }

  private keywordSearch(query: string, patterns: IndexedPattern[], limit: number): SearchResult[] {
    const queryTokens = tokenize(query)
    if (queryTokens.length === 0) {return []}

    return patterns
      .map(pattern => ({
        pattern,
        score: tokenOverlap(queryTokens, tokenize(`${pattern.name} ${pattern.publicMethods.join(' ')} ${pattern.preview}`)),
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => ({ pattern: entry.pattern, score: entry.score, matchedBy: 'keyword' as const }))
  }

  /** Drops cached embeddings for patterns no longer in the indexer (e.g. after a file delete). */
  pruneStale(): void {
    const liveIds = new Set(this.patternIndexer.getAllPatterns().map(p => p.id))
    for (const id of Array.from(this.cache.keys())) {
      if (!liveIds.has(id)) {
        this.cache.delete(id)
      }
    }
  }
}

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2)
}

function tokenOverlap(queryTokens: string[], candidateTokens: string[]): number {
  const candidateSet = new Set(candidateTokens)
  return queryTokens.filter(t => candidateSet.has(t)).length
}

function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) {return 0}
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
