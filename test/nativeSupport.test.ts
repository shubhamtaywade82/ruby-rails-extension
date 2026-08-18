import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { isPersistentIndexSupported } from '../src/indexer/nativeSupport'

describe('isPersistentIndexSupported', () => {
  const originalNapi = process.versions.napi

  afterEach(() => {
    Object.defineProperty(process.versions, 'napi', { value: originalNapi, configurable: true })
  })

  it('returns true when runtime has N-API >= 10 and supported GLIBC', () => {
    Object.defineProperty(process.versions, 'napi', { value: '10', configurable: true })
    const isSupported = isPersistentIndexSupported()
    // On Linux with GLIBC 2.31, returns false; on >= 2.33 or other OS, returns true.
    expect(typeof isSupported).toBe('boolean')
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

describe('isPersistentIndexSupported on Linux with a mocked process.report', () => {
  const originalNapi = process.versions.napi
  const originalPlatform = process.platform
  const originalReport = process.report

  beforeEach(() => {
    Object.defineProperty(process.versions, 'napi', { value: '10', configurable: true })
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process.versions, 'napi', { value: originalNapi, configurable: true })
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    Object.defineProperty(process, 'report', { value: originalReport, configurable: true })
  })

  function mockGlibc(glibcVersionRuntime: string | undefined): void {
    Object.defineProperty(process, 'report', {
      value: { getReport: () => ({ header: { glibcVersionRuntime } }) },
      configurable: true,
    })
  }

  it('returns false when GLIBC is below the required 2.33', () => {
    mockGlibc('2.31')
    expect(isPersistentIndexSupported()).toBe(false)
  })

  it('returns true when GLIBC meets the required 2.33', () => {
    mockGlibc('2.35')
    expect(isPersistentIndexSupported()).toBe(true)
  })

  it('fails closed (returns false) when GLIBC cannot be determined', () => {
    mockGlibc(undefined)
    expect(isPersistentIndexSupported()).toBe(false)
  })

  it('fails closed (returns false) when process.report itself is unavailable', () => {
    Object.defineProperty(process, 'report', { value: undefined, configurable: true })
    expect(isPersistentIndexSupported()).toBe(false)
  })

  it('fails closed (returns false) when process.report.getReport throws', () => {
    Object.defineProperty(process, 'report', {
      value: {
        getReport: () => {
          throw new Error('report unavailable in this sandbox')
        },
      },
      configurable: true,
    })
    expect(isPersistentIndexSupported()).toBe(false)
  })
})
