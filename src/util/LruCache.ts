/**
 * LruCache - Bounded in-memory cache with least-recently-used eviction, backing
 * railsForge.performance.cacheSize. Built on a plain Map, which JS guarantees
 * iterates in insertion order — `get`/`set` re-insert the touched key so it
 * moves to the "most recently used" end, and the first key in iteration order
 * is always the least recently used one to evict.
 */
export class LruCache<K, V> {
  private map = new Map<K, V>()

  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) {return undefined}
    const value = this.map.get(key) as V
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: K, value: V): void {
    this.map.delete(key)
    this.map.set(key, value)
    if (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value
      if (oldestKey !== undefined) {this.map.delete(oldestKey)}
    }
  }

  has(key: K): boolean {
    return this.map.has(key)
  }

  delete(key: K): boolean {
    return this.map.delete(key)
  }

  keys(): IterableIterator<K> {
    return this.map.keys()
  }

  clear(): void {
    this.map.clear()
  }

  get size(): number {
    return this.map.size
  }
}
