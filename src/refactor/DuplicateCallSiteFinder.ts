/**
 * DuplicateCallSiteFinder - Phase 13: when extracting a Service/Query Object, find other
 * files with an exact copy of the same selected code, so "Extract Service Object" can
 * offer to replace those call sites too instead of leaving duplicated logic behind.
 *
 * Deliberately exact-text matching (not fuzzy/AST similarity like DuplicateMethodDetector) —
 * this drives an automatic multi-file edit, so it only fires on matches safe enough to
 * apply without a human reviewing each one individually.
 */

export interface DuplicateCallSite {
  filePath: string
  index: number
  length: number
}

const MIN_SNIPPET_LENGTH = 20

export function findDuplicateCallSites(
  snippet: string,
  files: Map<string, string>,
  excludeFilePath: string,
): DuplicateCallSite[] {
  const normalized = snippet.trim()
  if (normalized.length < MIN_SNIPPET_LENGTH) {return []}

  const results: DuplicateCallSite[] = []
  for (const [filePath, content] of files) {
    if (filePath === excludeFilePath) {continue}

    let index = content.indexOf(normalized)
    while (index !== -1) {
      results.push({ filePath, index, length: normalized.length })
      index = content.indexOf(normalized, index + normalized.length)
    }
  }
  return results
}
