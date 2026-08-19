import { describe, it, expect } from 'vitest'
import { parseUnifiedDiff, applyUnifiedHunks } from '../src/patch/UnifiedDiff'

describe('parseUnifiedDiff', () => {
  it('parses a single hunk with context and additions', () => {
    const diff = [
      '@@ -1,3 +1,4 @@',
      ' class Order < ApplicationRecord',
      '+  scope :recent, -> { where(created_at: 1.day.ago..) }',
      ' end',
    ].join('\n')

    expect(parseUnifiedDiff(diff)).toEqual([
      {
        file: null,
        oldStart: 0,
        oldLines: ['class Order < ApplicationRecord', 'end'],
        newLines: ['class Order < ApplicationRecord', '  scope :recent, -> { where(created_at: 1.day.ago..) }', 'end'],
      },
    ])
  })

  it('tracks the file from +++ headers and strips the b/ prefix', () => {
    const diff = [
      '--- a/app/models/order.rb',
      '+++ b/app/models/order.rb',
      '@@ -1,1 +1,1 @@',
      '-class Order',
      '+class OrderTwo',
    ].join('\n')

    const hunks = parseUnifiedDiff(diff)
    expect(hunks?.[0].file).toBe('app/models/order.rb')
  })

  it('parses multiple hunks in sequence', () => {
    const diff = [
      '@@ -1,2 +1,2 @@',
      '-a',
      '+A',
      ' b',
      '@@ -5,1 +5,2 @@',
      ' c',
      '+d',
    ].join('\n')

    const hunks = parseUnifiedDiff(diff)
    expect(hunks).toHaveLength(2)
    expect(hunks?.[1].oldStart).toBe(4)
  })

  it('tolerates wrong line counts, prose, fences, and git metadata', () => {
    const diff = [
      'Here is the fix:',
      '```diff',
      'diff --git a/app/models/order.rb b/app/models/order.rb',
      'index 1111111..2222222 100644',
      '--- a/app/models/order.rb',
      '+++ b/app/models/order.rb',
      '@@ -999,99 +999,99 @@',
      '-old',
      '+new',
      '```',
      'Hope that helps.',
    ].join('\n')

    const hunks = parseUnifiedDiff(diff)
    expect(hunks).toHaveLength(1)
    expect(hunks?.[0].oldLines).toEqual(['old'])
    expect(hunks?.[0].newLines).toEqual(['new'])
  })

  it('returns null when there are no hunks', () => {
    expect(parseUnifiedDiff('no diff here')).toBeNull()
  })

  it('returns null on a malformed hunk line', () => {
    const diff = ['@@ -1,1 +1,1 @@', '?garbage?', '-a', '+b'].join('\n')
    expect(parseUnifiedDiff(diff)).toBeNull()
  })
})

describe('applyUnifiedHunks', () => {
  const FILE = ['alpha', 'bravo', 'charlie', 'delta', 'echo'].join('\n')

  it('applies a clean insertion', () => {
    const hunks = parseUnifiedDiff(['@@ -2,1 +2,2 @@', ' bravo', '+bravo2'].join('\n'))!
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result).toEqual({ ok: true, text: 'alpha\nbravo\nbravo2\ncharlie\ndelta\necho' })
  })

  it('applies a deletion', () => {
    const hunks = parseUnifiedDiff(['@@ -3,1 +3,0 @@', '-charlie'].join('\n'))!
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result).toEqual({ ok: true, text: 'alpha\nbravo\ndelta\necho' })
  })

  it('offsets later hunks after earlier ones shift the file', () => {
    const hunks = parseUnifiedDiff(
      [
        '@@ -1,1 +1,2 @@',
        ' alpha',
        '+alpha0',
        '@@ -3,1 +4,1 @@',
        ' charlie',
        '+charlie0',
      ].join('\n'),
    )!
    // Without offset tracking, the second hunk (targeting line 3) would apply
    // against the pre-insertion buffer and produce the wrong result.
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result).toEqual({ ok: true, text: 'alpha\nalpha0\nbravo\ncharlie\ncharlie0\ndelta\necho' })
  })

  it('finds the block even when the declared line number drifted', () => {
    const hunks = parseUnifiedDiff(['@@ -1,1 +1,2 @@', ' charlie', '+charlie0'].join('\n'))!
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result).toEqual({ ok: true, text: 'alpha\nbravo\ncharlie\ncharlie0\ndelta\necho' })
  })

  it('rejects a hunk whose context no longer matches', () => {
    const hunks = parseUnifiedDiff(['@@ -1,1 +1,2 @@', ' NOT_IN_FILE', '+x'].join('\n'))!
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.hunkLine).toBe(1)
      expect(result.reason).toContain('no longer matches')
    }
  })

  it('applies a hunk whose context drifted only in indentation', () => {
    // Small models re-indent copied context lines; the hunk must still be
    // located (like `git apply --ignore-whitespace`) without changing what
    // actually gets written — the applied line is the diff's own.
    const hunks = parseUnifiedDiff(['@@ -3,1 +3,1 @@', '-     charlie', '+  charlie0'].join('\n'))!
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result).toEqual({ ok: true, text: 'alpha\nbravo\n  charlie0\ndelta\necho' })
  })

  it('prefers the closest candidate and exact matches over fuzzy ones at equal distance', () => {
    // '  x' (fuzzy match, dist 1 from target line 2) and 'x' (exact, dist 1) are
    // equidistant from the declared position — the exact match must win.
    const text = ['  x', 'b', 'x'].join('\n')
    const hunks = parseUnifiedDiff(['@@ -2,1 +2,2 @@', ' x', '+x0'].join('\n'))!
    const result = applyUnifiedHunks(text, hunks)
    expect(result).toEqual({ ok: true, text: '  x\nb\nx\nx0' })
  })

  it('rejects a hunk whose context matches nowhere even with whitespace tolerance', () => {
    const hunks = parseUnifiedDiff(['@@ -1,2 +1,1 @@', ' ghost', ' phantom', '-x'].join('\n'))!
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result.ok).toBe(false)
  })

  it('applies hunks from one file in sequence, accumulating offsets across insertions', () => {
    const hunks = parseUnifiedDiff(
      [
        '@@ -1,1 +1,2 @@',
        ' alpha',
        '+alpha0',
        '@@ -5,1 +6,2 @@',
        ' echo',
        '+echo0',
      ].join('\n'),
    )!
    const result = applyUnifiedHunks(FILE, hunks)
    expect(result).toEqual({ ok: true, text: 'alpha\nalpha0\nbravo\ncharlie\ndelta\necho\necho0' })
  })
})