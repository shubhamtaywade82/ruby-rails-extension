/**
 * ChatDiffApplier - Shared service for applying AI-generated diffs and code
 * changes from chat interfaces (both the native Copilot chat participant and the
 * sidebar webview). Extracted from extension.ts so both chat entry points can
 * reuse the same diff-parsing, preview, and application pipeline.
 *
 * Supports three modes:
 * 1. **Diff mode**: AI returned a unified diff → parse hunks → apply to the target file
 * 2. **Replace mode**: AI returned full file content → replace the entire file
 * 3. **Create mode**: AI returned content for a new file → write it
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { parseUnifiedDiff, applyUnifiedHunks, type UnifiedHunk } from '../patch/UnifiedDiff'
import { diffLines, filterFixHunks, applyHunks, type LineDiffHunk } from '../extension'
import { Logger } from '../util/Logger'

export interface ApplyDiffResult {
  applied: boolean
  message: string
}

/** Detects whether text looks like a unified diff. */
export function looksLikeDiff(text: string): boolean {
  return /^@@ -/m.test(text) || /^--- /m.test(text) || /^\+\+\+ /m.test(text) || /^diff --git /m.test(text)
}

/** Strips markdown code fences from model output. */
function stripFences(text: string): string {
  let cleaned = text.trim()
  // Remove <think>...</think> blocks (some models emit these)
  if (/^[\s\S]*?<\/think>/.test(cleaned)) {
    const outside = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    cleaned = outside.length > 0 ? outside : cleaned.replace(/<\/?think>/g, '').trim()
  }
  return cleaned.replace(/^```(?:ruby|diff)?\n?/, '').replace(/\n?```$/, '').trim()
}

/**
 * Extracts all code blocks from markdown text, returning each with its
 * language hint and surrounding context. This lets us detect file-path hints
 * like ```ruby:path/to/file.rb or ```diff:app/models/user.rb.
 */
export function extractCodeBlocks(markdown: string): Array<{ lang: string; filePath: string | null; code: string }> {
  const blocks: Array<{ lang: string; filePath: string | null; code: string }> = []
  // Match ```lang[:filePath]\n ... ```
  const re = /```([a-zA-Z0-9_-]+)(?::([\w./\-]+))?\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    blocks.push({ lang: m[1], filePath: m[2] ?? null, code: m[3] })
  }
  return blocks
}

/**
 * Tries to determine the target file for a code block. Looks for:
 * 1. Explicit file path in the fenced code header (```ruby:app/models/user.rb)
 * 2. A line just above the block like "# app/models/user.rb" or "File: app/models/user.rb"
 */
export function inferTargetFile(block: { lang: string; filePath: string | null; code: string; precedingText: string }, workspaceRoot: string): string | null {
  // 1. Explicit path from fenced header
  if (block.filePath) {
    const full = path.join(workspaceRoot, block.filePath)
    return full
  }
  // 2. Preceding comment line like "# path/to/file.rb" or "path/to/file.rb"
  const headerRe = /^(?:(?:#|File:)\s*)?([\w./\-]+\.rb)\s*$/m
  const match = headerRe.exec(block.precedingText)
  if (match) {
    const full = path.join(workspaceRoot, match[1])
    return full
  }
  return null
}

/**
 * Extracts the text immediately preceding a code fence in the markdown.
 */
function textBeforeBlock(markdown: string, blockIndex: number): string {
  const re = /```([a-zA-Z0-9_-]+)(?::([\w./\-]+))?\n/g
  let idx = 0
  let lastEnd = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(markdown)) !== null) {
    if (idx === blockIndex) {
      return markdown.slice(lastEnd, m.index)
    }
    lastEnd = m.index + m[0].length
    idx++
  }
  return ''
}

/**
 * Applies an AI-generated unified diff to an existing file.
 * Shows a diff preview first; user must click "Apply" to confirm.
 */
export async function applyDiffToFile(
  diffText: string,
  targetUri: vscode.Uri,
  label: string,
): Promise<ApplyDiffResult> {
  const cleaned = stripFences(diffText)
  const hunks = parseUnifiedDiff(cleaned)

  if (!hunks || hunks.length === 0) {
    return { applied: false, message: 'Could not parse the diff — the format was invalid.' }
  }

  const document = await vscode.workspace.openTextDocument(targetUri)
  const fullText = document.getText()

  // Filter hunks to this file only (multi-file diffs may have hunks for others)
  const targetName = path.basename(targetUri.fsPath)
  const relevant = hunks.filter(h => h.file === null || path.basename(h.file) === targetName)

  if (relevant.length === 0) {
    return { applied: false, message: 'The diff only targets other files — nothing to apply to this file.' }
  }

  const result = applyUnifiedHunks(fullText, relevant)
  if (!result.ok) {
    Logger.warn(`[ChatDiffApplier] Hunk application failed: ${result.reason}`)
    return { applied: false, message: `Diff no longer matches the file: ${result.reason}` }
  }

  return showDiffPreviewAndApply(targetUri, document, fullText, result.text, label)
}

/**
 * Applies AI-generated full file content as a replacement.
 * Shows a diff preview first; user must click "Apply" to confirm.
 */
export async function applyFullFileReplacement(
  newContent: string,
  targetUri: vscode.Uri,
  label: string,
): Promise<ApplyDiffResult> {
  const document = await vscode.workspace.openTextDocument(targetUri)
  const fullText = document.getText()
  const cleaned = stripFences(newContent)

  if (cleaned === fullText) {
    return { applied: false, message: 'The proposed content is identical to the current file — no changes.' }
  }

  return showDiffPreviewAndApply(targetUri, document, fullText, cleaned, label)
}

/**
 * Creates a new file with the given content. Prompts for a path if not provided.
 */
export async function createNewFile(
  content: string,
  workspaceRoot: string,
  suggestedPath?: string,
): Promise<ApplyDiffResult> {
  const cleaned = stripFences(content)
  const target = suggestedPath || await vscode.window.showInputBox({
    prompt: 'Enter relative file path (e.g. app/services/my_service.rb)',
    value: 'app/services/',
  })
  if (!target) {
    return { applied: false, message: 'No file path provided.' }
  }

  const fullPath = vscode.Uri.file(path.join(workspaceRoot, target))
  await vscode.workspace.fs.writeFile(fullPath, Buffer.from(cleaned, 'utf8'))
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(fullPath))
  return { applied: true, message: `Created ${target}` }
}

/**
 * Smart-apply: inspects AI response text and decides the best application strategy.
 * - If it contains a parseable unified diff → apply as diff
 * - If it contains a single large code block → replace target file
 * - If the /service, /scaffold, or /migrate command was used → create a new file
 * - Otherwise → insert at cursor (legacy behavior)
 */
export async function smartApplyResponse(
  responseText: string,
  options: {
    workspaceRoot: string
    activeFileUri?: vscode.Uri
    command?: string
    selection?: string
  },
): Promise<ApplyDiffResult> {
  const { workspaceRoot, activeFileUri, command, selection } = options
  const cleaned = stripFences(responseText)
  const blocks = extractCodeBlocks(cleaned)

  // Commands that typically CREATE new files
  const createCommands = new Set(['service', 'scaffold', 'migrate', 'form'])
  if (command && createCommands.has(command)) {
    // Use the code from the last ruby block as the new file content
    const lastRubyBlock = [...blocks].reverse().find(b => b.lang === 'ruby' || b.code.includes('class ') || b.code.includes('module '))
    if (lastRubyBlock) {
      const withContext = { ...lastRubyBlock, precedingText: '' }
      const inferred = inferTargetFile(withContext, workspaceRoot)
        ?? (lastRubyBlock.filePath ? path.join(workspaceRoot, lastRubyBlock.filePath) : undefined)
      return createNewFile(lastRubyBlock.code, workspaceRoot, inferred)
    }
  }

  // If response looks like a unified diff, try to apply it
  if (looksLikeDiff(cleaned)) {
    if (activeFileUri) {
      const result = await applyDiffToFile(cleaned, activeFileUri, 'RailsForge AI')
      if (result.applied) { return result }
      // Diff failed to apply — fall through to replacement
    }
  }

  // If there's a single large code block that looks like a full file, offer replacement
  if (activeFileUri && blocks.length > 0) {
    const mainBlock = blocks[0]
    // Heuristic: if the block has class/module defs and is >10 lines, treat as file replacement
    const isFullFile = mainBlock.code.split('\n').length > 10 &&
      /^(?:class|module)\s+[A-Z]/m.test(mainBlock.code)
    if (isFullFile) {
      const result = await applyFullFileReplacement(mainBlock.code, activeFileUri, 'RailsForge AI')
      if (result.applied) { return result }
    }
  }

  // For /fix command with an active file, try diff-then-replacement more aggressively
  if (command === 'fix' && activeFileUri && blocks.length > 0) {
    // Try each code block as a diff first
    for (const block of blocks) {
      if (looksLikeDiff(block.code)) {
        const result = await applyDiffToFile(block.code, activeFileUri, 'RailsForge AI Fix')
        if (result.applied) { return result }
      }
    }
    // If no diff worked, try the first block as a full replacement of the selection or file
    const code = blocks[0].code
    const document = await vscode.workspace.openTextDocument(activeFileUri)
    const fullText = document.getText()
    if (selection && selection.length > 0) {
      // Replace just the selection
      const selectionStart = fullText.indexOf(selection)
      if (selectionStart !== -1) {
        const start = document.positionAt(selectionStart)
        const end = document.positionAt(selectionStart + selection.length)
        const edit = new vscode.WorkspaceEdit()
        edit.replace(activeFileUri, new vscode.Range(start, end), code)
        const applied = await vscode.workspace.applyEdit(edit)
        return { applied, message: applied ? 'Replaced selected code.' : 'Failed to apply edit.' }
      }
    }
  }

  return { applied: false, message: 'Could not determine how to apply the changes. Use the Insert button to paste code at the cursor.' }
}

/**
 * Shared diff preview → confirm → apply flow.
 */
async function showDiffPreviewAndApply(
  targetUri: vscode.Uri,
  document: vscode.TextDocument,
  originalText: string,
  proposedText: string,
  label: string,
): Promise<ApplyDiffResult> {
  const proposedDoc = await vscode.workspace.openTextDocument({ content: proposedText, language: document.languageId })
  await vscode.commands.executeCommand('vscode.diff', targetUri, proposedDoc.uri, label)

  const choice = await vscode.window.showInformationMessage(
    'Review the diff, then confirm to apply.',
    'Apply Changes',
    'Discard',
  )
  void vscode.commands.executeCommand('workbench.action.closeActiveEditor')

  if (choice !== 'Apply Changes') {
    return { applied: false, message: 'Changes discarded.' }
  }

  const edit = new vscode.WorkspaceEdit()
  edit.replace(targetUri, new vscode.Range(document.positionAt(0), document.positionAt(originalText.length)), proposedText)
  const applied = await vscode.workspace.applyEdit(edit)

  if (!applied) {
    return { applied: false, message: 'Failed to apply the edit — the file may have been modified externally.' }
  }

  const editor = vscode.window.activeTextEditor?.document.uri.toString() === targetUri.toString()
    ? vscode.window.activeTextEditor
    : await vscode.window.showTextDocument(document)
  editor.selection = new vscode.Selection(new vscode.Position(0, 0), new vscode.Position(0, 0))
  editor.revealRange(new vscode.Range(0, 0, 0, 0), vscode.TextEditorRevealType.AtTop)

  return { applied: true, message: 'Changes applied.' }
}
