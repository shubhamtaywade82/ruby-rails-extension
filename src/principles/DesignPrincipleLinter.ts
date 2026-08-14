/**
 * DesignPrincipleLinter - Analyzes code for SOLID, DRY, KISS, YAGNI, and Law of Demeter violations
 */

import * as vscode from 'vscode'

export interface PrincipleDiagnostic {
  id: string
  title: string
  message: string
  line: number
  severity: vscode.DiagnosticSeverity
  quickFixTitle?: string
  quickFixCommand?: string
}

export class DesignPrincipleLinter implements vscode.CodeActionProvider {
  private diagnosticCollection = vscode.languages.createDiagnosticCollection('railsforge-principles')

  updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'ruby' || document.isUntitled) {
      return
    }

    const content = document.getText()
    const lines = content.split('\n')
    const diagnostics: PrincipleDiagnostic[] = []

    this.checkSRP(document.fileName, lines, diagnostics)
    this.checkLawOfDemeter(lines, diagnostics)
    this.checkKISS(lines, diagnostics)
    this.checkYAGNI(lines, diagnostics)

    const vscDiagnostics: vscode.Diagnostic[] = diagnostics.map(d => {
      const line = Math.max(0, d.line - 1)
      const range = new vscode.Range(line, 0, line, 80)
      const diag = new vscode.Diagnostic(range, `[${d.id}] ${d.title}: ${d.message}`, d.severity)
      diag.source = 'RailsForge Principles'
      diag.code = d.id
      return diag
    })

    this.diagnosticCollection.set(document.uri, vscDiagnostics)
  }

  private checkSRP(fileName: string, lines: string[], list: PrincipleDiagnostic[]): void {
    const isModelOrController = fileName.includes('/app/models/') || fileName.includes('/app/controllers/')
    if (!isModelOrController) {return}

    if (lines.length > 200) {
      list.push({
        id: 'SRP-FAT-CLASS',
        title: 'Single Responsibility Principle Violation',
        message: `Class has ${lines.length} lines. Consider extracting domain logic into Service Objects (app/services) or Query Objects (app/queries).`,
        line: 1,
        severity: vscode.DiagnosticSeverity.Information,
        quickFixTitle: 'Extract selection to Service Object',
        quickFixCommand: 'railsforge.extractService',
      })
    }
  }

  private checkLawOfDemeter(lines: string[], list: PrincipleDiagnostic[]): void {
    const demeterRegex = /\b([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+){3,})\b/
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.trim().startsWith('#')) {continue}

      const match = demeterRegex.exec(line)
      if (match && !match[1].includes('Rails.application') && !match[1].includes('config.')) {
        list.push({
          id: 'DEMETER-VIOLATION',
          title: 'Law of Demeter Violation',
          message: `Deep association chain detected: '${match[1]}'. Use 'delegate :method, to: :assoc' or encapsulate in a model method.`,
          line: i + 1,
          severity: vscode.DiagnosticSeverity.Warning,
        })
      }
    }
  }

  private checkKISS(lines: string[], list: PrincipleDiagnostic[]): void {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/\b(?:define_method|class_eval|instance_eval)\b/.test(line)) {
        list.push({
          id: 'KISS-METAPROGRAMMING',
          title: 'KISS Principle Warning',
          message: 'Dynamic metaprogramming detected. Prefer explicit methods, modules, or case statements for readability and maintainability.',
          line: i + 1,
          severity: vscode.DiagnosticSeverity.Information,
        })
      }
    }
  }

  private checkYAGNI(lines: string[], list: PrincipleDiagnostic[]): void {
    let insidePrivate = false
    const privateMethods: Array<{ name: string; line: number }> = []
    const fullText = lines.join('\n')

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (trimmed === 'private' || trimmed === 'protected') {
        insidePrivate = true
        continue
      }

      if (insidePrivate) {
        const defMatch = /^def\s+([a-zA-Z0-9_]+)/.exec(trimmed)
        if (defMatch) {
          privateMethods.push({ name: defMatch[1], line: i + 1 })
        }
      }
    }

    for (const m of privateMethods) {
      const occurrences = fullText.split(new RegExp(`\\b${m.name}\\b`)).length - 1
      if (occurrences <= 1) {
        list.push({
          id: 'YAGNI-UNUSED-PRIVATE',
          title: 'Potential YAGNI Violation',
          message: `Private method '${m.name}' is defined but never invoked in this file.`,
          line: m.line,
          severity: vscode.DiagnosticSeverity.Hint,
        })
      }
    }
  }

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    for (const diag of context.diagnostics) {
      if (diag.source !== 'RailsForge Principles') {continue}

      if (diag.code === 'SRP-FAT-CLASS') {
        const extractAction = new vscode.CodeAction(
          'Extract selected code to Service Object',
          vscode.CodeActionKind.RefactorExtract,
        )
        extractAction.command = {
          command: 'railsforge.extractService',
          title: 'Extract Service Object',
        }
        actions.push(extractAction)
      }
    }

    return actions
  }

  dispose(): void {
    this.diagnosticCollection.dispose()
  }
}
