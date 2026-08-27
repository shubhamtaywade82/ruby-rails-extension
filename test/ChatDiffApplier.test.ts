import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as vscode from 'vscode'
import {
  looksLikeDiff,
  extractCodeBlocks,
  inferTargetFile,
  applyDiffToFile,
  applyFullFileReplacement,
  createNewFile,
  smartApplyResponse,
} from '../src/chat/ChatDiffApplier'
import { parseUnifiedDiff, applyUnifiedHunks } from '../src/patch/UnifiedDiff'
import { diffLines, applyHunks } from '../src/extension'

vi.mock('../src/patch/UnifiedDiff', () => ({
  parseUnifiedDiff: vi.fn(),
  applyUnifiedHunks: vi.fn(),
}))

vi.mock('../src/extension', () => ({
  diffLines: vi.fn(),
  applyHunks: vi.fn(),
}))

vi.mock('../src/util/Logger', () => ({
  Logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const mockedParse = vi.mocked(parseUnifiedDiff)
const mockedApplyUnified = vi.mocked(applyUnifiedHunks)
const mockedDiffLines = vi.mocked(diffLines)
const mockedApplyHunks = vi.mocked(applyHunks)

const originalText = 'class User\n  def name\n    "old"\n  end\nend\n'
const targetUri = new vscode.Uri('/test/workspace/app/models/user.rb')

function makeEditor(text: string) {
  const doc = new vscode.TextDocument('/test/workspace/app/models/user.rb', 'ruby', text)
  return {
    document: doc,
    selection: new vscode.Selection(0, 0, 0, 0),
    edit: vi.fn().mockResolvedValue(true),
    revealRange: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('looksLikeDiff', () => {
  it('detects @@ hunk header', () => {
    expect(looksLikeDiff('some text\n@@ -1,3 +1,4 @@')).toBe(true)
  })

  it('detects --- file header', () => {
    expect(looksLikeDiff('--- a/file.rb')).toBe(true)
  })

  it('detects +++ file header', () => {
    expect(looksLikeDiff('+++ b/file.rb')).toBe(true)
  })

  it('detects diff --git header', () => {
    expect(looksLikeDiff('diff --git a/file.rb b/file.rb')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(looksLikeDiff('class User\n  def name\n  end\nend')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(looksLikeDiff('')).toBe(false)
  })
})

describe('extractCodeBlocks', () => {
  it('extracts a single ruby code block', () => {
    const md = '\x60\x60\x60ruby\nclass Foo\nend\n\x60\x60\x60'
    const blocks = extractCodeBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].lang).toBe('ruby')
    expect(blocks[0].code).toBe('class Foo\nend\n')
    expect(blocks[0].filePath).toBeNull()
  })

  it('extracts code block with file path', () => {
    const md = '\x60\x60\x60ruby:app/models/user.rb\nclass User\nend\n\x60\x60\x60'
    const blocks = extractCodeBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].lang).toBe('ruby')
    expect(blocks[0].filePath).toBe('app/models/user.rb')
  })

  it('extracts multiple code blocks', () => {
    const md = '\x60\x60\x60ruby\nclass A\nend\n\x60\x60\x60\nSome text\n\x60\x60\x60diff\n--- a/f.rb\n+++ b/f.rb\n\x60\x60\x60'
    const blocks = extractCodeBlocks(md)
    expect(blocks).toHaveLength(2)
    expect(blocks[0].lang).toBe('ruby')
    expect(blocks[1].lang).toBe('diff')
  })

  it('returns empty array for text with no code blocks', () => {
    expect(extractCodeBlocks('plain text')).toEqual([])
  })

  it('handles code blocks with language having hyphens', () => {
    const md = '\x60\x60\x60text-x-custom\nsome code\n\x60\x60\x60'
    const blocks = extractCodeBlocks(md)
    expect(blocks).toHaveLength(1)
    expect(blocks[0].lang).toBe('text-x-custom')
  })
})

describe('inferTargetFile', () => {
  const root = '/test/workspace'

  it('uses explicit filePath from block header', () => {
    const block = { lang: 'ruby', filePath: 'app/models/user.rb', code: '', precedingText: '' }
    expect(inferTargetFile(block, root)).toBe('/test/workspace/app/models/user.rb')
  })

  it('returns null when no filePath and no preceding text match', () => {
    const block = { lang: 'ruby', filePath: null, code: '', precedingText: 'some random text' }
    expect(inferTargetFile(block, root)).toBeNull()
  })

  it('detects file path from preceding comment', () => {
    const block = { lang: 'ruby', filePath: null, code: '', precedingText: '# app/services/my_service.rb' }
    expect(inferTargetFile(block, root)).toBe('/test/workspace/app/services/my_service.rb')
  })

  it('detects file path from File: prefix', () => {
    const block = { lang: 'ruby', filePath: null, code: '', precedingText: 'File: app/models/post.rb' }
    expect(inferTargetFile(block, root)).toBe('/test/workspace/app/models/post.rb')
  })

  it('detects bare file path in preceding text', () => {
    const block = { lang: 'ruby', filePath: null, code: '', precedingText: 'app/helpers/users_helper.rb' }
    expect(inferTargetFile(block, root)).toBe('/test/workspace/app/helpers/users_helper.rb')
  })
})

describe('applyDiffToFile', () => {
  it('returns failure when diff cannot be parsed', async () => {
    mockedParse.mockReturnValue(null)
    const result = await applyDiffToFile('not a diff', targetUri, 'test')
    expect(result.applied).toBe(false)
    expect(result.message).toContain('Could not parse')
  })

  it('returns failure when hunks are empty', async () => {
    mockedParse.mockReturnValue([])
    const result = await applyDiffToFile('not a diff', targetUri, 'test')
    expect(result.applied).toBe(false)
    expect(result.message).toContain('Could not parse')
  })

  it('returns failure when no hunks match the target file', async () => {
    mockedParse.mockReturnValue([
      { file: 'other_file.rb', oldStart: 0, oldLines: ['old'], newLines: ['new'] },
    ])
    const result = await applyDiffToFile('diff text', targetUri, 'test')
    expect(result.applied).toBe(false)
    expect(result.message).toContain('only targets other files')
  })

  it('returns failure when hunk application fails', async () => {
    mockedParse.mockReturnValue([
      { file: null, oldStart: 0, oldLines: ['old line'], newLines: ['new line'] },
    ])
    mockedApplyUnified.mockReturnValue({ ok: false, reason: 'hunk mismatch', hunkLine: 1 })
    const result = await applyDiffToFile('diff text', targetUri, 'test')
    expect(result.applied).toBe(false)
    expect(result.message).toContain('no longer matches')
  })

  it('applies diff and shows preview when user confirms', async () => {
    const newContent = 'class User\n  def name\n    "new"\n  end\nend\n'
    mockedParse.mockReturnValue([
      { file: null, oldStart: 0, oldLines: ['class User'], newLines: ['class User2'] },
    ])
    mockedApplyUnified.mockReturnValue({ ok: true, text: newContent })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return new vscode.TextDocument((arg as vscode.Uri).fsPath, 'ruby', originalText)
    })
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Changes' as any)
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    const editor = makeEditor(originalText)
    editor.selection = new vscode.Selection(0, 0, 0, 0)
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(editor as any)
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const result = await applyDiffToFile('@@ -1 +1 @@\n-class User\n+class User2', targetUri, 'test')
    expect(result.applied).toBe(true)
    expect(result.message).toBe('Changes applied.')
  })

  it('discards changes when user clicks Discard', async () => {
    mockedParse.mockReturnValue([
      { file: null, oldStart: 0, oldLines: ['x'], newLines: ['y'] },
    ])
    mockedApplyUnified.mockReturnValue({ ok: true, text: 'new text' })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return new vscode.TextDocument((arg as vscode.Uri).fsPath, 'ruby', originalText)
    })
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Discard' as any)

    const result = await applyDiffToFile('diff', targetUri, 'test')
    expect(result.applied).toBe(false)
    expect(result.message).toBe('Changes discarded.')
  })
})

describe('applyFullFileReplacement', () => {
  it('returns no changes when content is identical', async () => {
    // stripFences calls trim(), so the comparison is against trimmed text
    const sameText = 'class User\n  def name\n    "old"\n  end\nend'
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument(targetUri.fsPath, 'ruby', sameText),
    )
    const result = await applyFullFileReplacement(sameText, targetUri, 'test')
    expect(result.applied).toBe(false)
    expect(result.message).toContain('identical')
  })

  it('shows diff preview and applies when confirmed', async () => {
    const newContent = 'class User2\nend\n'
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return new vscode.TextDocument((arg as vscode.Uri).fsPath, 'ruby', originalText)
    })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Changes' as any)
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    const editor = makeEditor(originalText)
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(editor as any)
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const result = await applyFullFileReplacement(newContent, targetUri, 'test')
    expect(result.applied).toBe(true)
  })

  it('re-diffs when document changed during review', async () => {
    const newContent = 'class User2\nend\n'
    const doc = new vscode.TextDocument(targetUri.fsPath, 'ruby', originalText)
    let textCallCount = 0
    const originalGetText = doc.getText.bind(doc)
    doc.getText = (range?: any) => {
      textCallCount++
      return textCallCount <= 1 ? originalGetText(range) : 'class Modified\nend\n'
    }
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return doc
    })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Changes' as any)
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    mockedDiffLines.mockReturnValue([{ startLine: 0, removedCount: 1, inserted: ['class User2'] }])
    mockedApplyHunks.mockReturnValue('rediffed content')
    const editor = makeEditor('class Modified\nend\n')
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(editor as any)
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const result = await applyFullFileReplacement(newContent, targetUri, 'test')
    expect(result.applied).toBe(true)
    expect(mockedDiffLines).toHaveBeenCalled()
  })
})

describe('createNewFile', () => {
  it('creates file with suggested path', async () => {
    const spy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/app/services/foo_service.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    const result = await createNewFile('class FooService\nend', '/test/workspace', 'app/services/foo_service.rb')
    expect(result.applied).toBe(true)
    expect(result.message).toContain('Created')
    expect(spy).toHaveBeenCalled()
  })

  it('prompts for path when none provided and user provides one', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('app/services/bar_service.rb')
    vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/app/services/bar_service.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    const result = await createNewFile('class BarService\nend', '/test/workspace')
    expect(result.applied).toBe(true)
    expect(vscode.window.showInputBox).toHaveBeenCalledWith({
      prompt: 'Enter relative file path (e.g. app/services/my_service.rb)',
      value: 'app/services/',
    })
  })

  it('returns failure when no path provided and user cancels', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined)
    const result = await createNewFile('content', '/test/workspace')
    expect(result.applied).toBe(false)
    expect(result.message).toBe('No file path provided.')
  })

  it('strips markdown fences from content', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('app/services/baz.rb')
    const spy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/app/services/baz.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    await createNewFile('\x60\x60\x60ruby\nclass Baz\nend\n\x60\x60\x60', '/test/workspace', 'app/services/baz.rb')
    const written = (spy.mock.calls[0][1] as Buffer).toString('utf8')
    expect(written).toBe('class Baz\nend')
  })
})

describe('smartApplyResponse', () => {
  // Helper to build responses with code blocks that survive stripFences.
  // stripFences only removes fences at the very start/end of the text.
  // By adding trailing text, the closing fence is not at the end,
  // so extractCodeBlocks can still find the blocks.
  function fencedBlock(lang: string, code: string, filePath?: string) {
    const header = filePath ? '\x60\x60\x60' + lang + ':' + filePath : '\x60\x60\x60' + lang
    return header + '\n' + code + '\n\x60\x60\x60'
  }

  it('creates new file for /service command with ruby block containing class', async () => {
    vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/app/services/x.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    const response = 'Here is the service:\n\n' + fencedBlock('ruby', 'class UserService\n  def call\n  end\nend', 'app/services/user_service.rb') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      command: 'service',
    })
    expect(result.applied).toBe(true)
  })

  it('creates new file for /scaffold command', async () => {
    vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/app/models/product.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    const response = 'Here is the scaffold:\n\n' + fencedBlock('ruby', 'class Product < ApplicationRecord\nend') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      command: 'scaffold',
    })
    expect(result.applied).toBe(true)
  })

  it('creates new file for /migrate command', async () => {
    vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/db/migrate/x.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    const response = 'Migration generated:\n\n' + fencedBlock('ruby', 'class CreatePosts < ActiveRecord::Migration[7.0]\nend') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      command: 'migrate',
    })
    expect(result.applied).toBe(true)
  })

  it('tries diff application for diff-like responses with active file', async () => {
    const diffText = '@@ -1 +1 @@\n-old\n+new'
    mockedParse.mockReturnValue([
      { file: null, oldStart: 0, oldLines: ['old'], newLines: ['new'] },
    ])
    mockedApplyUnified.mockReturnValue({ ok: true, text: 'new\n' })
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return new vscode.TextDocument((arg as vscode.Uri).fsPath, 'ruby', 'old\n')
    })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Changes' as any)
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    const editor = makeEditor('old\n')
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(editor as any)
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const result = await smartApplyResponse(diffText, {
      workspaceRoot: '/test/workspace',
      activeFileUri: targetUri,
    })
    expect(result.applied).toBe(true)
  })

  it('falls through to full-file replacement when diff fails but code block is large', async () => {
    const bigFile = 'class HugeService\n' + Array.from({ length: 15 }, (_, i) => '  def method_' + i + '\n  end\n').join('') + 'end\n'
    mockedParse.mockReturnValue(null)
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return new vscode.TextDocument((arg as vscode.Uri).fsPath, 'ruby', originalText)
    })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Changes' as any)
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    const editor = makeEditor(bigFile)
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(editor as any)
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const response = 'Here is the updated file:\n\n' + fencedBlock('ruby', bigFile) + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      activeFileUri: targetUri,
    })
    expect(result.applied).toBe(true)
  })

  it('returns failure for unrecognized response with no active file', async () => {
    const result = await smartApplyResponse('plain text response', {
      workspaceRoot: '/test/workspace',
    })
    expect(result.applied).toBe(false)
    expect(result.message).toContain('Could not determine')
  })

  it('/fix command tries each code block as diff, then selection replacement', async () => {
    mockedParse.mockReturnValue(null)
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument(targetUri.fsPath, 'ruby', 'line1\nold_selection\nline3\n'),
    )
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    const editor = makeEditor('line1\nold_selection\nline3\n')
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const response = 'Here is the fix:\n\n' + fencedBlock('ruby', 'new_code') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      activeFileUri: targetUri,
      command: 'fix',
      selection: 'old_selection',
    })
    expect(result.applied).toBe(true)
  })

  it('/fix command returns failure when selection not found in document', async () => {
    mockedParse.mockReturnValue(null)
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument(targetUri.fsPath, 'ruby', 'line1\nline2\n'),
    )
    const editor = makeEditor('line1\nline2\n')
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const response = 'Here is the fix:\n\n' + fencedBlock('ruby', 'code') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      activeFileUri: targetUri,
      command: 'fix',
      selection: 'nonexistent_selection',
    })
    expect(result.applied).toBe(false)
  })

  it('/form command triggers create path', async () => {
    vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/app/forms/x.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    const response = 'Here is the form:\n\n' + fencedBlock('ruby', 'class UserForm\n  include ActiveModel::Model\nend') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      command: 'form',
    })
    expect(result.applied).toBe(true)
  })

  it('skips create commands when no ruby/class block found', async () => {
    const response = 'Here is the explanation:\n\n' + fencedBlock('text', 'Just some plain text\nno definitions here') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      command: 'service',
    })
    // Falls through to diff/fullfile paths, all fail, returns false
    expect(result.applied).toBe(false)
  })

  it('strips <think> block and falls back when only think content is present', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue('app/services/thunk.rb')
    const spy = vi.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue()
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument('/test/workspace/app/services/thunk.rb', 'ruby', ''),
    )
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(undefined as any)
    // stripFences should strip the <think> block; when only think content present, falls back to removing tags
    await createNewFile('<think>reasoning here</think>', '/test/workspace', 'app/services/thunk.rb')
    const written = (spy.mock.calls[0][1] as Buffer).toString('utf8')
    expect(written).not.toContain('<think>')
  })

  it('re-diffs and falls back when re-diff throws during preview review', async () => {
    const newContent = 'class User2\nend\n'
    const doc = new vscode.TextDocument(targetUri.fsPath, 'ruby', originalText)
    let textCallCount = 0
    const originalGetText = doc.getText.bind(doc)
    doc.getText = (range?: any) => {
      textCallCount++
      return textCallCount <= 1 ? originalGetText(range) : 'class Modified\nend\n'
    }
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return doc
    })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Changes' as any)
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    mockedDiffLines.mockImplementation(() => { throw new Error('re-diff failed') })
    const editor = makeEditor('class Modified\nend\n')
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(editor as any)
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const result = await applyFullFileReplacement(newContent, targetUri, 'test')
    expect(result.applied).toBe(true)
    // Logger.warn should have been called for the re-diff failure
    const { Logger } = await import('../src/util/Logger')
    expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('Re-diff failed'))
  })

  it('/fix command logs error when workspace.applyEdit returns false', async () => {
    mockedParse.mockReturnValue(null)
    vi.spyOn(vscode.workspace, 'openTextDocument').mockResolvedValue(
      new vscode.TextDocument(targetUri.fsPath, 'ruby', 'line1\nold_selection\nline3\n'),
    )
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(false)
    const editor = makeEditor('line1\nold_selection\nline3\n')
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: editor, configurable: true })

    const response = 'Here is the fix:\n\n' + fencedBlock('ruby', 'new_code') + '\nDone.'
    const result = await smartApplyResponse(response, {
      workspaceRoot: '/test/workspace',
      activeFileUri: targetUri,
      command: 'fix',
      selection: 'old_selection',
    })
    expect(result.applied).toBe(false)
    const { Logger } = await import('../src/util/Logger')
    expect(Logger.error).toHaveBeenCalledWith(expect.stringContaining('Selection replace'))
  })

  it('applies diff and opens editor via showTextDocument when activeTextEditor uri does not match', async () => {
    const newContent = 'class User\n  def name\n    "new"\n  end\nend\n'
    mockedParse.mockReturnValue([
      { file: null, oldStart: 0, oldLines: ['class User'], newLines: ['class User2'] },
    ])
    mockedApplyUnified.mockReturnValue({ ok: true, text: newContent })
    vi.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined)
    vi.spyOn(vscode.workspace, 'openTextDocument').mockImplementation(async (arg) => {
      if (arg && typeof arg === 'object' && 'content' in arg) {
        return new vscode.TextDocument('untitled', 'ruby', (arg as { content: string }).content)
      }
      return new vscode.TextDocument((arg as vscode.Uri).fsPath, 'ruby', originalText)
    })
    vi.spyOn(vscode.window, 'showInformationMessage').mockResolvedValue('Apply Changes' as any)
    vi.spyOn(vscode.workspace, 'applyEdit').mockResolvedValue(true)
    const editor = makeEditor(newContent)
    vi.spyOn(vscode.window, 'showTextDocument').mockResolvedValue(editor as any)
    // Set activeTextEditor to a DIFFERENT uri to trigger the else branch
    const otherEditor = makeEditor('other content')
    otherEditor.document = new vscode.TextDocument('/test/workspace/other_file.rb', 'ruby', 'other content')
    Object.defineProperty(vscode.window, 'activeTextEditor', { value: otherEditor, configurable: true })

    const result = await applyDiffToFile('@@ -1 +1 @@\n-class User\n+class User2', targetUri, 'test')
    expect(result.applied).toBe(true)
    expect(vscode.window.showTextDocument).toHaveBeenCalled()
  })
})
