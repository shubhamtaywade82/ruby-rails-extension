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
  /** YAGNI: last line (1-based) of the unused method, so the Quick Fix can delete the whole block. */
  endLine?: number
  /** Demeter: first receiver and final message in the chain, so the Quick Fix can propose a `delegate`. */
  demeter?: { receiver: string; method: string }
}

export class DesignPrincipleLinter implements vscode.CodeActionProvider {
  private diagnosticCollection = vscode.languages.createDiagnosticCollection('railsforge-principles')
  private metadataByDoc: Map<string, PrincipleDiagnostic[]> = new Map()

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

    this.metadataByDoc.set(document.uri.toString(), diagnostics)

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
        const segments = match[1].split('.')
        list.push({
          id: 'DEMETER-VIOLATION',
          title: 'Law of Demeter Violation',
          message: `Deep association chain detected: '${match[1]}'. Use 'delegate :method, to: :assoc' or encapsulate in a model method.`,
          line: i + 1,
          severity: vscode.DiagnosticSeverity.Warning,
          demeter: { receiver: segments[0], method: segments[segments.length - 1] },
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
    const privateMethods: Array<{ name: string; line: number; endLine: number }> = []
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
          privateMethods.push({ name: defMatch[1], line: i + 1, endLine: this.findMethodEndLine(lines, i) })
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
          endLine: m.endLine,
        })
      }
    }
  }

  /** Given the 0-based index of a `def ...` line, finds the 1-based line of its matching `end`. */
  private findMethodEndLine(lines: string[], defLineIndex: number): number {
    const defLine = lines[defLineIndex].trim()
    if (/\)\s*=(?!=|>)/.test(defLine) || /^def\s+\S+\s*=(?!=|>)/.test(defLine)) {
      return defLineIndex + 1
    }

    let depth = 1
    for (let i = defLineIndex + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (/^(class|module|if|unless|case|while|until|begin|def)\b/.test(trimmed) || /\bdo(\s*\|[^|]*\|)?\s*$/.test(trimmed)) {
        depth++
      }
      if (trimmed === 'end' || /^end\b/.test(trimmed)) {
        depth--
        if (depth === 0) {return i + 1}
      }
    }
    return defLineIndex + 1
  }

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []
    const metadata = this.metadataByDoc.get(document.uri.toString()) ?? []

    for (const diag of context.diagnostics) {
      if (diag.source !== 'RailsForge Principles') {continue}

      const meta = metadata.find(m => m.id === diag.code && Math.max(0, m.line - 1) === diag.range.start.line)

      if (diag.code === 'SRP-FAT-CLASS') {
        const extractAction = new vscode.CodeAction(
          'Extract selected code to Service Object',
          vscode.CodeActionKind.RefactorExtract,
        )
        extractAction.isPreferred = true
        extractAction.command = {
          command: 'railsforge.extractService',
          title: 'Extract Service Object',
        }
        actions.push(extractAction)
      }

      if (diag.code === 'DEMETER-VIOLATION' && meta?.demeter) {
        const { receiver, method } = meta.demeter
        const delegateAction = new vscode.CodeAction(
          `Add 'delegate :${method}, to: :${receiver}'`,
          vscode.CodeActionKind.QuickFix,
        )
        delegateAction.isPreferred = true
        delegateAction.edit = this.buildDelegateEdit(document, diag.range.start.line, receiver, method)
        actions.push(delegateAction)
      }

      if (diag.code === 'YAGNI-UNUSED-PRIVATE' && meta?.endLine) {
        const removeAction = new vscode.CodeAction('Remove unused method', vscode.CodeActionKind.QuickFix)
        removeAction.isPreferred = true
        const edit = new vscode.WorkspaceEdit()
        const start = new vscode.Position(diag.range.start.line, 0)
        const end = new vscode.Position(meta.endLine, 0)
        edit.delete(document.uri, new vscode.Range(start, end))
        removeAction.edit = edit
        actions.push(removeAction)
      }

      const aiAction = new vscode.CodeAction(`✨ AI: Suggest fix — ${meta?.title ?? diag.code}`, vscode.CodeActionKind.QuickFix)
      aiAction.command = {
        command: 'railsforge.applyAiFix',
        title: 'Apply AI Fix',
        arguments: [document.uri, diag.range, diag.message],
      }
      actions.push(aiAction)
    }

    return actions
  }

  /** Inserts `delegate :method, to: :receiver` on the line right after the enclosing `class` line. */
  private buildDelegateEdit(document: vscode.TextDocument, violationLine: number, receiver: string, method: string): vscode.WorkspaceEdit {
    const edit = new vscode.WorkspaceEdit()
    let classLine = -1
    for (let i = violationLine; i >= 0; i--) {
      if (/^\s*class\s+[A-Z]/.test(document.lineAt(i).text)) {
        classLine = i
        break
      }
    }
    if (classLine === -1) {return edit}

    const insertAt = new vscode.Position(classLine + 1, 0)
    edit.insert(document.uri, insertAt, `  delegate :${method}, to: :${receiver}\n`)
    return edit
  }

  dispose(): void {
    this.diagnosticCollection.dispose()
    this.metadataByDoc.clear()
  }
}
