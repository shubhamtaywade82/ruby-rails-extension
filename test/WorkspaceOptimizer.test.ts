import { describe, it, expect } from 'vitest'
import {
  isOptimizationNeeded,
  mergeObjectConfig,
  mergeArrayConfig,
  RECOMMENDED_WATCHER_EXCLUDES,
  RECOMMENDED_SEARCH_EXCLUDES,
  RECOMMENDED_RUBY_LSP_EXCLUDES,
} from '../src/workspace/WorkspaceOptimizer'

describe('WorkspaceOptimizer', () => {
  describe('isOptimizationNeeded', () => {
    it('returns true when watcher configuration is undefined', () => {
      expect(isOptimizationNeeded(undefined, undefined)).toBe(true)
    })

    it('returns true when critical watcher keys are missing', () => {
      const watchers = { '**/.git/**': true }
      expect(isOptimizationNeeded(watchers, RECOMMENDED_SEARCH_EXCLUDES)).toBe(true)
    })

    it('returns true when critical search keys are missing', () => {
      const watchers = {
        '**/tmp/**': true,
        '**/log/**': true,
        '**/storage/**': true,
      }
      expect(isOptimizationNeeded(watchers, {})).toBe(true)
    })

    it('returns false when critical watcher and search keys are already present', () => {
      const watchers = {
        '**/tmp/**': true,
        '**/log/**': true,
        '**/storage/**': true,
      }
      const search = {
        '**/tmp': true,
        '**/log': true,
      }
      expect(isOptimizationNeeded(watchers, search)).toBe(false)
    })
  })

  describe('mergeObjectConfig', () => {
    it('adds recommended settings to empty object', () => {
      const merged = mergeObjectConfig({}, RECOMMENDED_WATCHER_EXCLUDES)
      expect(merged['**/tmp/**']).toBe(true)
      expect(merged['**/log/**']).toBe(true)
      expect(merged['**/node_modules/**']).toBe(true)
    })

    it('preserves existing custom user settings without overwriting', () => {
      const existing = {
        '**/custom_dir/**': true,
        '**/tmp/**': false, // User explicitly set false
      }
      const merged = mergeObjectConfig(existing, RECOMMENDED_WATCHER_EXCLUDES)
      expect(merged['**/custom_dir/**']).toBe(true)
      expect(merged['**/tmp/**']).toBe(false) // Preserved user preference
      expect(merged['**/log/**']).toBe(true)
    })
  })

  describe('mergeArrayConfig', () => {
    it('combines array items without duplicates', () => {
      const existing = ['**/custom/**', '**/tmp/**']
      const merged = mergeArrayConfig(existing, RECOMMENDED_RUBY_LSP_EXCLUDES)
      expect(merged).toContain('**/custom/**')
      expect(merged).toContain('**/tmp/**')
      expect(merged).toContain('**/db/migrate/**')
      expect(merged.filter(x => x === '**/tmp/**')).toHaveLength(1)
    })
  })
})
