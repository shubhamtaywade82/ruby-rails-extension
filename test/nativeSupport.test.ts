import { describe, it, expect, afterEach } from 'vitest'
import { isPersistentIndexSupported } from '../src/indexer/nativeSupport'

describe('isPersistentIndexSupported', () => {
  const original = process.versions.napi

  afterEach(() => {
    Object.defineProperty(process.versions, 'napi', { value: original, configurable: true })
  })

  it('returns true when the runtime reports N-API >= 10', () => {
    Object.defineProperty(process.versions, 'napi', { value: '10', configurable: true })
    expect(isPersistentIndexSupported()).toBe(true)

    Object.defineProperty(process.versions, 'napi', { value: '11', configurable: true })
    expect(isPersistentIndexSupported()).toBe(true)
  })

  it('returns false when the runtime reports N-API < 10 (e.g. Node 20.x)', () => {
    Object.defineProperty(process.versions, 'napi', { value: '9', configurable: true })
    expect(isPersistentIndexSupported()).toBe(false)
  })

  it('returns false when napi is missing entirely', () => {
    Object.defineProperty(process.versions, 'napi', { value: undefined, configurable: true })
    expect(isPersistentIndexSupported()).toBe(false)
  })
})
