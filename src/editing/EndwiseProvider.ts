/**
 * EndwiseProvider - Auto-inserts a matching `end` when the previous line opens
 * a Ruby block (def/class/module/if/unless/while/until/case/begin/for/do),
 * mirroring the standalone "vim-endwise" / "endwise" extension's behavior.
 */

import * as vscode from 'vscode'

const KEYWORD_OPENERS = /^(def|class|module|case|begin|for)\b/
const MODIFIER_OPENERS = /^(if|unless|while|until)\b/
// `x = if condition` — if/case/begin used as an expression assigned to a
// variable. Deliberately excludes `return`/`yield`, since `return if x` and
// `yield if x` are near-universally the statement-modifier form, not
// `return (if x ... end)`.
const ASSIGNED_OPENERS = /=\s*(if|unless|case|begin)\b/

/**
 * Returns true if `lineText` opens a Ruby block that has not already been
 * closed on the same line (e.g. `def foo; end`, `arr.each { |x| x }`).
 */
export function needsEndKeyword(lineText: string): boolean {
  const code = lineText.replace(/#.*$/, '').trimEnd()
  const trimmed = code.trim()
  if (!trimmed) {return false}

  // Already closed on the same line, e.g. `def foo; end` or `if x then y end`.
  if (/\bend\s*$/.test(code)) {return false}

  // `arr.each do |x|` / `arr.each do` — a `do` block always needs `end`,
  // regardless of what precedes it on the line.
  if (/\bdo(\s*\|[^|]*\|)?\s*$/.test(code)) {return true}

  if (KEYWORD_OPENERS.test(trimmed)) {return true}

  // Leading if/unless/while/until — excludes statement modifiers like
  // `return foo if bar`, which never start the line with the keyword.
  if (MODIFIER_OPENERS.test(trimmed)) {return true}

  // `result = if condition` / `x = case value` — if/case/begin used as an
  // expression assigned to a variable, returned, or yielded.
  if (ASSIGNED_OPENERS.test(trimmed)) {return true}

  return false
}

export class EndwiseProvider implements vscode.OnTypeFormattingEditProvider {
  provideOnTypeFormattingEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.TextEdit[]> {
    if (position.line === 0) {return []}

    const previousLine = document.lineAt(position.line - 1)
    if (!needsEndKeyword(previousLine.text)) {return []}

    const indent = ' '.repeat(previousLine.firstNonWhitespaceCharacterIndex)
    return [new vscode.TextEdit(new vscode.Range(position, position), `\n${indent}end`)]
  }
}
