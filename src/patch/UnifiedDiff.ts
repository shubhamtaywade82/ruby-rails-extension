/**
 * UnifiedDiff - Parse and apply `git diff`-style unified diffs.
 *
 * RailsForge asks the AI to return its fix as a unified diff, so complex fixes
 * spanning multiple hunks — and even multiple files — are applied precisely
 * instead of being reconstructed from heuristics. This module is the strict
 * application half: every hunk's old block (context + removed lines) must match
 * the current buffer verbatim, with a small line-shift allowance because small
 * models drift line numbers. A hunk that no longer matches is rejected, never
 * guessed.
 */

export interface UnifiedHunk {
  /** File named by the preceding `+++` header (null when the diff has none). */
  file: string | null
  /** 0-based line index in the original file where this hunk's old block begins. */
  oldStart: number
  /** Old lines in diff order (' ' context and '-' removed), verbatim. */
  oldLines: string[]
  /** New lines in diff order (' ' context and '+' added), verbatim. */
  newLines: string[]
}

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/
const FENCE = /^```(?:diff)?\s*$/

/**
 * Parses unified diff text into hunks. Tolerates prose, ```diff fences, git
 * metadata headers, and `\ No newline at end of file` markers. Declared line
 * counts are ignored — the actual prefixed lines are authoritative, since
 * models routinely miscount. Returns null when no valid hunks are present.
 */
export function parseUnifiedDiff(diffText: string): UnifiedHunk[] | null {
  const hunks: UnifiedHunk[] = []
  let file: string | null = null
  let current: UnifiedHunk | null = null

  for (const raw of diffText.split('\n')) {
    const line = raw
    if (FENCE.test(line)) {
      // An opening fence starts the diff, a closing fence ends it — reset hunk
      // state so trailing prose after the fence isn't mistaken for diff content.
      current = null
      continue
    }
    if (line.startsWith('diff --git ') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('\\')) {continue}

    if (line.startsWith('+++ ')) {
      const name = line.slice(4).trim()
      file = name.startsWith('b/') ? name.slice(2) : name
      continue
    }

    const m = HUNK_HEADER.exec(line)
    if (m) {
      current = { file, oldStart: Math.max(0, Number(m[1]) - 1), oldLines: [], newLines: [] }
      hunks.push(current)
      continue
    }

    if (!current) {continue}
    if (line.startsWith('-')) { current.oldLines.push(line.slice(1)); continue }
    if (line.startsWith('+')) { current.newLines.push(line.slice(1)); continue }
    if (line.startsWith(' ')) {
      current.oldLines.push(line.slice(1))
      current.newLines.push(line.slice(1))
      continue
    }
    return null
  }

  if (hunks.length === 0 || hunks.some(h => h.oldLines.length === 0 && h.newLines.length === 0)) {return null}
  return hunks
}

export type ApplyResult =
  | { ok: true; text: string }
  | { ok: false; reason: string; hunkLine: number }

/**
 * Applies hunks to `fullText`, verifying each old block against the buffer.
 * `maxShift` allows hunks whose declared line numbers drifted by up to that
 * many lines (in either direction); each hunk's offset accumulates so later
 * hunks stay aligned after earlier ones change the file.
 *
 * Positioning is whitespace-tolerant (like `git apply --ignore-whitespace`):
 * context lines that differ only in indentation still locate the hunk, since
 * small models routinely re-indent copied context. The applied content is the
 * diff's own lines, so tolerance never changes what gets written — only where
 * it is found. A hunk whose block matches nowhere is rejected, never guessed.
 */
export function applyUnifiedHunks(fullText: string, hunks: UnifiedHunk[], maxShift = 10): ApplyResult {
  const lines = fullText.split('\n')
  const out: string[] = []
  let cursor = 0
  let offset = 0

  for (const h of hunks) {
    const target = h.oldStart + offset
    const found = matchBlock(lines, h.oldLines, target, maxShift)
    if (found === -1) {
      return {
        ok: false,
        reason: `hunk at line ${h.oldStart + 1} no longer matches the current file (${h.oldLines.length} context/removed line(s) not found)`,
        hunkLine: h.oldStart + 1,
      }
    }
    out.push(...lines.slice(cursor, found))
    out.push(...h.newLines)
    cursor = found + h.oldLines.length
    offset += h.newLines.length - h.oldLines.length
  }

  out.push(...lines.slice(cursor))
  return { ok: true, text: out.join('\n') }
}

/** Collapses all whitespace runs to a single space — used to compare context lines loosely. */
function normalizeSpace(line: string): string {
  return line.trim().replace(/\s+/g, ' ')
}

/**
 * Locates `block` within `lines`, preferring the declared `target` line and
 * searching ±`maxShift`. Exact matches win; if none exists, whitespace-tolerant
 * matches (indentation drift) are accepted, choosing the closest candidate.
 */
function matchBlock(lines: string[], block: string[], target: number, maxShift: number): number {
  if (block.length === 0) {return Math.min(Math.max(target, 0), lines.length)}

  const lo = Math.max(0, target - maxShift)
  const hi = Math.min(lines.length - block.length, target + maxShift)
  const normBlock = block.map(normalizeSpace)
  let best = -1
  let bestDist = Infinity
  let bestExact = false
  for (let i = lo; i <= hi; i++) {
    let exact = true
    let fuzzy = true
    for (let k = 0; k < block.length; k++) {
      if (lines[i + k] !== block[k]) {exact = false}
      if (normalizeSpace(lines[i + k]) !== normBlock[k]) {fuzzy = false}
      if (!exact && !fuzzy) {break}
    }
    if (!exact && !fuzzy) {continue}
    const dist = Math.abs(i - target)
    // Prefer the closest candidate; at equal distance, exact beats fuzzy.
    if (dist < bestDist || (dist === bestDist && exact && !bestExact)) {
      best = i
      bestDist = dist
      bestExact = exact
    }
  }
  return best
}
