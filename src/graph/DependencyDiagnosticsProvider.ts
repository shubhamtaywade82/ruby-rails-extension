/**
 * DependencyDiagnosticsProvider - Flags hard-coded collaborators (e.g. `PaymentGatewayService.call`
 * inside another service) found by MinimalDependencyGraph, with a Quick Fix that injects the
 * collaborator class via a keyword constructor param instead of referencing it directly.
 */

import * as vscode from 'vscode'
import { MinimalDependencyGraph, DependencyEdge } from './MinimalDependencyGraph'
import { ProjectPatternIndexer } from '../patterns/ProjectPatternIndexer'

export class DependencyDiagnosticsProvider implements vscode.CodeActionProvider {
  private diagnosticCollection = vscode.languages.createDiagnosticCollection('railsforge-dependencies')

  constructor(
    private graph: MinimalDependencyGraph,
    private indexer: ProjectPatternIndexer,
  ) {}

  updateDiagnostics(document: vscode.TextDocument): void {
    if (document.languageId !== 'ruby') {return}

    const pattern = this.indexer.getAllPatterns().find(p => p.filePath === document.fileName)
    if (!pattern) {
      this.diagnosticCollection.delete(document.uri)
      return
    }

    const hardCoded = this.graph.getHardCodedCollaborators(pattern.name)
    const diagnostics = hardCoded.map(edge => this.toDiagnostic(edge))
    this.diagnosticCollection.set(document.uri, diagnostics)
  }

  private toDiagnostic(edge: DependencyEdge): vscode.Diagnostic {
    const line = Math.max(0, edge.line - 1)
    const range = new vscode.Range(line, 0, line, 120)
    const diag = new vscode.Diagnostic(
      range,
      `Hard-coded collaborator '${edge.to}'. Consider injecting it via the constructor for easier testing/mocking.`,
      vscode.DiagnosticSeverity.Information,
    )
    diag.source = 'RailsForge Dependencies'
    diag.code = `HARDCODED:${edge.to}`
    return diag
  }

  provideCodeActions(
    document: vscode.TextDocument,
    _range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = []

    for (const diag of context.diagnostics) {
      if (diag.source !== 'RailsForge Dependencies' || typeof diag.code !== 'string') {continue}

      const collaborator = diag.code.replace('HARDCODED:', '')
      const action = new vscode.CodeAction(
        `Inject ${collaborator} via constructor`,
        vscode.CodeActionKind.Refactor,
      )
      const edit = this.buildInjectionEdit(document, collaborator)
      if (edit) {
        action.edit = edit
        actions.push(action)
      }

      actions.push(this.askRailsAction(diag))
    }

    return actions
  }

  private askRailsAction(diag: vscode.Diagnostic): vscode.CodeAction {
    const action = new vscode.CodeAction('$(sparkle) Ask @rails to fix this', vscode.CodeActionKind.QuickFix)
    action.command = {
      command: 'workbench.action.chat.open',
      title: 'Ask @rails',
      arguments: [{ query: `@rails /fix ${diag.message}` }],
    }
    return action
  }

  /**
   * Adds `<param>: <Collaborator>` to `initialize` (default value keeps behavior identical),
   * assigns `@<param> = <param>` in the body, and rewrites `Collaborator.call(`/`Collaborator.new(`
   * call sites in this file to `@<param>.call(`/`@<param>.new(`.
   */
  private buildInjectionEdit(document: vscode.TextDocument, collaborator: string): vscode.WorkspaceEdit | null {
    const text = document.getText()
    const paramName = this.underscore(collaborator)

    const initMatch = /def\s+initialize\s*\(([^)]*)\)/.exec(text)
    const edit = new vscode.WorkspaceEdit()

    if (initMatch) {
      const params = initMatch[1].trim()
      const newParams = params.length > 0 ? `${params}, ${paramName}: ${collaborator}` : `${paramName}: ${collaborator}`
      const paramsStart = document.positionAt(text.indexOf(initMatch[1], initMatch.index))
      const paramsEnd = document.positionAt(text.indexOf(initMatch[1], initMatch.index) + initMatch[1].length)
      edit.replace(document.uri, new vscode.Range(paramsStart, paramsEnd), newParams)

      const bodyInsertOffset = text.indexOf('\n', initMatch.index + initMatch[0].length) + 1
      const bodyInsertPos = document.positionAt(bodyInsertOffset)
      edit.insert(document.uri, bodyInsertPos, `    @${paramName} = ${paramName}\n`)
    } else {
      const classMatch = /^\s*class\s+[A-Z][\w:]*.*$/m.exec(text)
      if (!classMatch) {return null}
      const insertPos = document.positionAt(classMatch.index + classMatch[0].length + 1)
      edit.insert(
        document.uri,
        insertPos,
        `  def initialize(${paramName}: ${collaborator})\n    @${paramName} = ${paramName}\n  end\n\n`,
      )
    }

    const callSiteRegex = new RegExp(`\\b${collaborator}\\.(call|new)\\b`, 'g')
    let match: RegExpExecArray | null
    while ((match = callSiteRegex.exec(text)) !== null) {
      const start = document.positionAt(match.index)
      const end = document.positionAt(match.index + collaborator.length)
      edit.replace(document.uri, new vscode.Range(start, end), `@${paramName}`)
    }

    return edit
  }

  private underscore(str: string): string {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
  }

  dispose(): void {
    this.diagnosticCollection.dispose()
  }
}
