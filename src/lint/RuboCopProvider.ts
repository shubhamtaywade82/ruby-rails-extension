/**
 * RuboCopProvider - Real-time RuboCop linting, diagnostics, code actions, and autocorrect
 */

import * as vscode from 'vscode'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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
      const offenses = await this.runRuboCop(document.fileName)
      this.updateDiagnostics(document, offenses)
    } catch {
      // RuboCop execution or parsing failed gracefully
    }
  }

  private async runRuboCop(filePath: string): Promise<RuboCopOffense[]> {
    const cmd = `bundle exec rubocop --format json "${filePath}" || rubocop --format json "${filePath}"`
    try {
      const { stdout } = await execAsync(cmd, { maxBuffer: 10 * 1024 * 1024 })
      const parsed = JSON.parse(stdout)
      return parsed.files?.[0]?.offenses ?? []
    } catch (err: unknown) {
      const execErr = err as { stdout?: string }
      if (execErr.stdout) {
        try {
          const parsed = JSON.parse(execErr.stdout)
          return parsed.files?.[0]?.offenses ?? []
        } catch {
          return []
        }
      }
      return []
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
    const cmd = `bundle exec rubocop ${flag} "${uri.fsPath}" || rubocop ${flag} "${uri.fsPath}"`
    try {
      await execAsync(cmd)
      return true
    } catch {
      return false
    }
  }

  dispose(): void {
    this.diagnosticCollection.dispose()
  }
}
