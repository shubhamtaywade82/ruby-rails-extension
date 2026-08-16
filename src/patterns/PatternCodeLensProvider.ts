/**
 * PatternCodeLensProvider - "N similar patterns" CodeLens above Service/Query/Form/Policy
 * class definitions, backed by ProjectPatternIndexer. Lets a developer see prior art
 * without leaving the file.
 */

import * as vscode from 'vscode'
import { ProjectPatternIndexer } from './ProjectPatternIndexer'

export class PatternCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>()
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event

  constructor(private indexer: ProjectPatternIndexer) {}

  refresh(): void {
    this._onDidChangeCodeLenses.fire()
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!this.indexer.classifyPath(document.fileName)) {return []}

    const lenses: vscode.CodeLens[] = []
    const text = document.getText()
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const pattern = this.indexer.findPatternAt(document.fileName, i + 1)
      if (!pattern) {continue}

      const similar = this.indexer.findSimilar(pattern)
      if (similar.length === 0) {continue}

      const range = new vscode.Range(i, 0, i, lines[i].length)
      lenses.push(new vscode.CodeLens(range, {
        title: `📋 ${similar.length} similar ${pattern.type}${similar.length > 1 ? 's' : ''} in this project`,
        command: 'railsforge.showSimilarPatterns',
        arguments: [pattern.filePath, pattern.lineStart],
      }))
    }

    return lenses
  }
}
