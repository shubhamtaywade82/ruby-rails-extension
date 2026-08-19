/**
 * RuboCopProvider - Real-time RuboCop linting, diagnostics, code actions, and autocorrect
 */

import * as vscode from 'vscode'
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface RuboCopOffense {
  severity: 'info' | 'refactor' | 'convention' | 'warning' | 'error' | 'fatal'
  message: string
  cop_name: string
  corrected: boolean
  correctable: boolean
  location: {
    start_line: number
    start_column: number
    last_line: number
    last_column: number
  }
}

export class RuboCopProvider implements vscode.CodeActionProvider {
  private diagnosticCollection = vscode.languages.createDiagnosticCollection('rubocop')

  async lintDocument(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== 'ruby' || document.isUntitled) {
      return
    }

    try {
      const offenses = await this.runRuboCop(document.fileName, document.getText())
      this.updateDiagnostics(document, offenses)
    } catch {
      // RuboCop execution or parsing failed gracefully
    }
  }

  private async runRuboCop(filePath: string, content: string): Promise<RuboCopOffense[]> {
    // --stdin pipes the in-memory buffer to rubocop so unsaved edits are linted, while the
    // FILE value still resolves the right .rubocop.yml. execFile (not exec/a shell string)
    // so `filePath` — which can contain arbitrary characters in an untrusted workspace — is
    // never interpreted by a shell.
    const args = ['--format', 'json', '--stdin', filePath]
    const viaBundle = await this.tryRuboCop('bundle', ['exec', 'rubocop', ...args], content)
    if (viaBundle) {return viaBundle}
    return (await this.tryRuboCop('rubocop', args, content)) ?? []
  }

  /** Runs one rubocop invocation; returns null (not []) only when it couldn't produce usable output at all, so the caller knows to try the next command instead of accepting "zero offenses". */
  private async tryRuboCop(command: string, args: string[], content: string): Promise<RuboCopOffense[] | null> {
    try {
      const stdout = await this.spawnWithStdin(command, args, content)
      return stdout === null ? null : this.parseOffenses(stdout)
    } catch {
      return null
    }
  }

  private spawnWithStdin(command: string, args: string[], content: string): Promise<string | null> {
    return new Promise(resolve => {
      const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'ignore'] })
      let stdout = ''
      child.stdout.on('data', chunk => { stdout += chunk })
      child.on('error', () => resolve(null))
      child.on('close', () => resolve(stdout))
      child.stdin.end(content)
    })
  }

  private parseOffenses(stdout: string): RuboCopOffense[] | null {
    try {
      const parsed = JSON.parse(stdout)
      return parsed.files?.[0]?.offenses ?? []
    } catch {
      return null
    }
  }

  private updateDiagnostics(document: vscode.TextDocument, offenses: RuboCopOffense[]): void {
    const diagnostics: vscode.Diagnostic[] = offenses.map(off => {
      const start = new vscode.Position(off.location.start_line - 1, off.location.start_column - 1)
      const end = new vscode.Position(off.location.last_line - 1, off.location.last_column)
      const range = new vscode.Range(start, end)
      const severity = this.mapSeverity(off.severity)

      const diag = new vscode.Diagnostic(range, `${off.message} (${off.cop_name})`, severity)
      diag.source = 'RuboCop'
      diag.code = off.cop_name
      return diag
    })

    this.diagnosticCollection.set(document.uri, diagnostics)
  }

  private mapSeverity(sev: string): vscode.DiagnosticSeverity {
    switch (sev) {
      case 'error':
      case 'fatal':
        return vscode.DiagnosticSeverity.Error
      case 'warning':
        return vscode.DiagnosticSeverity.Warning
      case 'convention':
      case 'refactor':
        return vscode.DiagnosticSeverity.Information
      default:
        return vscode.DiagnosticSeverity.Hint
    }
  }

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    for (const diag of context.diagnostics) {
      if (diag.source !== 'RuboCop' || !diag.code) {continue}
      const copName = String(diag.code)

      const aiAction = new vscode.CodeAction(
        `✨ RailsForge AI: Fix ${copName}`,
        vscode.CodeActionKind.QuickFix,
      )
      aiAction.command = {
        command: 'railsforge.applyAiFix',
        title: 'Apply AI Fix',
        arguments: [document.uri, diag.range, diag.message],
      }
      actions.push(aiAction)

      const disableLine = new vscode.CodeAction(
        `Disable ${copName} for this line`,
        vscode.CodeActionKind.QuickFix,
      )
      disableLine.edit = new vscode.WorkspaceEdit()
      const lineText = document.lineAt(range.start.line).text
      disableLine.edit.insert(
        document.uri,
        new vscode.Position(range.start.line, lineText.length),
        ` # rubocop:disable ${copName}`,
      )
      actions.push(disableLine)
    }

    const autoFixFile = new vscode.CodeAction(
      'RuboCop: Autocorrect entire file (-a)',
      vscode.CodeActionKind.SourceFixAll,
    )
    autoFixFile.command = {
      command: 'railsforge.rubocopAutocorrect',
      title: 'RuboCop Autocorrect',
      arguments: [document.uri, 'safe'],
    }
    actions.push(autoFixFile)

    return actions
  }

  async autoCorrectFile(uri: vscode.Uri, mode: 'safe' | 'unsafe' = 'safe'): Promise<boolean> {
    const flag = mode === 'unsafe' ? '-A' : '-a'
    const args = [flag, uri.fsPath]
    try {
      await execFileAsync('bundle', ['exec', 'rubocop', ...args])
      return true
    } catch {
      try {
        await execFileAsync('rubocop', args)
        return true
      } catch {
        return false
      }
    }
  }

  dispose(): void {
    this.diagnosticCollection.dispose()
  }
}
