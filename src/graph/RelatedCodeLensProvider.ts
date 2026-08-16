/**
 * RelatedCodeLensProvider - "🔗 4 Services · 2 Queries · 1 Policy · 6 Specs" on models,
 * and "🔗 Called by 7 · Depends on 3 · 2 Specs" on services/queries/policies/decorators,
 * so a developer sees what's connected to a class without opening each related file.
 */

import * as vscode from 'vscode'
import { RelatedFilesIndex } from './RelatedFilesIndex'
import { MinimalDependencyGraph } from './MinimalDependencyGraph'
import { ProjectPatternIndexer, PatternType } from '../patterns/ProjectPatternIndexer'

export class RelatedCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>()
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event

  constructor(
    private relatedIndex: RelatedFilesIndex,
    private dependencyGraph: MinimalDependencyGraph,
    private patternIndexer: ProjectPatternIndexer,
  ) {}

  refresh(): void {
    this._onDidChangeCodeLenses.fire()
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.fileName.includes('/app/models/') && !document.fileName.includes('/concerns/')) {
      return this.modelLenses(document)
    }

    if (this.patternIndexer.classifyPath(document.fileName)) {
      return this.patternLenses(document)
    }

    return []
  }

  private modelLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const text = document.getText()
    const match = /^class\s+([A-Z]\w*)/m.exec(text)
    if (!match) {return []}

    const modelName = match[1]
    const relations = this.relatedIndex.getModelRelations(modelName)
    const parts = Object.entries(relations.patternsByType).map(
      ([type, list]) => `${list!.length} ${this.pluralizeType(type as PatternType, list!.length)}`,
    )
    if (relations.specCount > 0) {
      parts.push(`${relations.specCount} Spec${relations.specCount === 1 ? '' : 's'}`)
    }
    if (parts.length === 0) {return []}

    const line = document.positionAt(match.index).line
    const range = new vscode.Range(line, 0, line, document.lineAt(line).text.length)
    return [new vscode.CodeLens(range, {
      title: `🔗 ${parts.join(' · ')}`,
      command: 'railsforge.showRelatedFiles',
      arguments: [modelName],
    })]
  }

  private patternLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = []
    const lineCount = document.lineCount

    for (let i = 0; i < lineCount; i++) {
      const pattern = this.patternIndexer.findPatternAt(document.fileName, i + 1)
      if (!pattern) {continue}

      const callers = this.dependencyGraph.getCallers(pattern.name).length
      const collaborators = this.dependencyGraph.getCollaborators(pattern.name).length
      const specCount = this.relatedIndex.getSpecCount(pattern.name)

      const parts: string[] = []
      if (callers > 0) {parts.push(`Called by ${callers}`)}
      if (collaborators > 0) {parts.push(`Depends on ${collaborators}`)}
      if (specCount > 0) {parts.push(`${specCount} Spec${specCount === 1 ? '' : 's'}`)}
      if (parts.length === 0) {continue}

      const range = new vscode.Range(i, 0, i, document.lineAt(i).text.length)
      lenses.push(new vscode.CodeLens(range, {
        title: `🔗 ${parts.join(' · ')}`,
        command: 'railsforge.showRelatedFiles',
        arguments: [pattern.name],
      }))
    }

    return lenses
  }

  private pluralizeType(type: PatternType, count: number): string {
    const label = type.charAt(0).toUpperCase() + type.slice(1)
    return count === 1 ? label : `${label}s`
  }
}
