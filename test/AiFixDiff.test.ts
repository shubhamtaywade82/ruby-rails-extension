import { describe, it, expect } from 'vitest'
import { diffLines, filterFixHunks, applyHunks, LineDiffHunk } from '../src/extension'

describe('diffLines', () => {
  it('produces a replacement hunk for a changed line', () => {
    const hunks = diffLines('a\nold\nc\n', 'a\nnew\nc\n')
    expect(hunks).toEqual([{ startLine: 1, removedCount: 1, inserted: ['new'] }])
  })

  it('is lossless: applying hunks reproduces the target text', () => {
    const oldText = 'class Foo\n  def bar\n    x\n    y\n  end\nend\n'
    const newText = 'class Foo\n  def bar\n    z\n  end\nend\n'
    expect(applyHunks(oldText, diffLines(oldText, newText))).toBe(newText)
  })

  it('round-trips pure insertions and pure removals', () => {
    const oldText = 'one\ntwo\nthree\n'
    const inserted = 'one\nnew line\ntwo\nthree\n'
    const removed = 'one\nthree\n'
    expect(applyHunks(oldText, diffLines(oldText, inserted))).toBe(inserted)
    expect(applyHunks(oldText, diffLines(oldText, removed))).toBe(removed)
  })
})

describe('filterFixHunks', () => {
  it('keeps hunks overlapping the diagnostic range and drops distant ones', () => {
    const hunks: LineDiffHunk[] = [
      { startLine: 5, removedCount: 1, inserted: ['# frozen_string_literal: true'] },
      { startLine: 20, removedCount: 2, inserted: ['def fixed', 'end'] },
      { startLine: 40, removedCount: 1, inserted: ['touched'] },
    ]
    const { keep, skipped } = filterFixHunks(hunks, { startLine: 19, endLine: 21 })
    expect(keep).toEqual([hunks[1]])
    expect(skipped).toBe(2)
  })

  it('keeps hunks touching either edge of the range', () => {
    const hunks: LineDiffHunk[] = [
      { startLine: 10, removedCount: 1, inserted: ['x'] },
      { startLine: 12, removedCount: 1, inserted: ['y'] },
    ]
    const { keep } = filterFixHunks(hunks, { startLine: 10, endLine: 12 })
    expect(keep.length).toBe(2)
  })

  it('counts pure-insertion hunks against the range', () => {
    const { keep, skipped } = filterFixHunks(
      [{ startLine: 3, removedCount: 0, inserted: ['extra'] }],
      { startLine: 3, endLine: 3 },
    )
    expect(keep.length).toBe(1)
    expect(skipped).toBe(0)
  })
})

describe('applyHunks with filtered fix', () => {
  it('applies only the diagnostic-range change from a model whole-file rewrite', () => {
    const original = [
      'class UsersController',
      '  def index',
      '    users = User.all.map(&:name)', // reported line (diagnostic range line 2)
      '  end',
      'end',
      '',
      'class ReportsController',
      '  def show',
      '    report = Report.find(params[:id])',
      '  end',
      'end',
      '',
    ].join('\n')

    // Model returned the whole file, rewriting both the reported line AND an
    // unrelated line in ReportsController.
    const modelOutput = [
      'class UsersController',
      '  def index',
      '    User.all.pluck(:name)', // the actual fix
      '  end',
      'end',
      '',
      'class ReportsController',
      '  def show',
      '    report = Report.find_by(id: params[:id])', // unrelated model change
      '  end',
      'end',
      '',
    ].join('\n')

    const hunks = diffLines(original, modelOutput)
    const { keep, skipped } = filterFixHunks(hunks, { startLine: 2, endLine: 2 })
    expect(keep.length).toBe(1)
    expect(skipped).toBe(1)

    const applied = applyHunks(original, keep)
    expect(applied).toContain('User.all.pluck(:name)')
    expect(applied).toContain('Report.find(params[:id])') // unrelated change suppressed
    expect(applied).not.toContain('Report.find_by')
  })
})