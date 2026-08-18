/**
 * ErbTagCompletionProvider - Expands a freshly typed `<%` into the three
 * standard ERB tag forms (output, execution, comment), matching the
 * "Simple Ruby ERB" extension's tag-expansion snippets.
 */

import * as vscode from 'vscode'

export class ErbTagCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const linePrefix = document.lineAt(position).text.slice(0, position.character)
    if (!linePrefix.endsWith('<%')) {return undefined}

    return [
      this.buildItem('<%= %>  (output)', '= ${1} %>', 'Ruby output tag — evaluates and prints the result'),
      this.buildItem('<% %>  (execution)', ' ${1} %>', 'Ruby execution tag — evaluates without printing'),
      this.buildItem('<%# %>  (comment)', '# ${1} %>', 'ERB comment — not evaluated or rendered'),
    ]
  }

  private buildItem(label: string, snippet: string, detail: string): vscode.CompletionItem {
    const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet)
    item.insertText = new vscode.SnippetString(snippet)
    item.detail = detail
    return item
  }
}
