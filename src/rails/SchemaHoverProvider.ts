/**
 * SchemaHoverProvider - Rich schema hover tooltips for ActiveRecord models
 */

import * as vscode from 'vscode'
import { SchemaIndexer } from './SchemaIndexer'

export class SchemaHoverProvider implements vscode.HoverProvider {
  constructor(private schemaIndexer: SchemaIndexer) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position)
    if (!range) {return null}

    const word = document.getText(range)
    if (!/^[A-Z]\w+$/.test(word)) {
      return null
    }

    const columns = this.schemaIndexer.getModelColumns(word)
    if (columns.length === 0) {
      return null
    }

    const md = new vscode.MarkdownString()
    md.isTrusted = true
    md.appendMarkdown(`### ActiveRecord Schema: \`${word}\`\n\n`)
    md.appendMarkdown('| Column | Type | Nullable | Default |\n')
    md.appendMarkdown('| :--- | :--- | :---: | :--- |\n')

    for (const col of columns) {
      const nullStr = col.nullable ? '✓' : '✗'
      const defStr = col.default ? `\`${col.default}\`` : '-'
      md.appendMarkdown(`| **\`${col.name}\`** | \`${col.type}\` | ${nullStr} | ${defStr} |\n`)
    }

    return new vscode.Hover(md, range)
  }
}
