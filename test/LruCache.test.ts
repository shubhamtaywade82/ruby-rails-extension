import { describe, it, expect } from 'vitest'
import { LruCache } from '../src/util/LruCache'

describe('LruCache', () => {
  it('stores and retrieves values under maxSize', () => {
    const cache = new LruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)

    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBe(2)
    expect(cache.size).toBe(2)
  })

  it('evicts the least-recently-used entry once maxSize is exceeded', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    expect(cache.has('a')).toBe(false)
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
    expect(cache.size).toBe(2)
  })

  it('touching a key via get() protects it from eviction', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a') // 'a' is now more recently used than 'b'
    cache.set('c', 3) // should evict 'b', not 'a'

    expect(cache.has('a')).toBe(true)
    expect(cache.has('b')).toBe(false)
    expect(cache.has('c')).toBe(true)
  })

  it('re-setting an existing key updates it without duplicating or growing size', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('a', 2)

    expect(cache.get('a')).toBe(2)
    expect(cache.size).toBe(1)
  })

  it('delete removes an entry', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.delete('a')

    expect(cache.has('a')).toBe(false)
    expect(cache.get('a')).toBeUndefined()
  })

  it('clear empties the cache', () => {
    const cache = new LruCache<string, number>(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.clear()

    expect(cache.size).toBe(0)
  })

  it('keys() iterates in least-recently-used-first order', () => {
    const cache = new LruCache<string, number>(3)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)

    expect(Array.from(cache.keys())).toEqual(['a', 'b', 'c'])
  })
})
