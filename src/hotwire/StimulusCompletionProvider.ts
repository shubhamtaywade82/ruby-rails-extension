/**
 * StimulusCompletionProvider - IntelliSense completion for Stimulus controllers, actions, and targets
 */

import * as vscode from 'vscode'
import { StimulusIndexer } from './StimulusIndexer'

export class StimulusCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private indexer: StimulusIndexer) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const linePrefix = document.lineAt(position).text.substr(0, position.character)

    if (/data-controller=["'][^"']*$/.test(linePrefix)) {
      return this.suggestControllers()
    }

    if (/data-action=["'][^"']*$/.test(linePrefix)) {
      return this.suggestActions()
    }

    const targetMatch = /data-([a-zA-Z0-9_-]+)-target=["'][^"']*$/.exec(linePrefix)
    if (targetMatch) {
      return this.suggestTargets(targetMatch[1])
    }

    return undefined
  }

  private suggestControllers(): vscode.CompletionItem[] {
    return this.indexer.getAllControllers().map(c => {
      const item = new vscode.CompletionItem(c.identifier, vscode.CompletionItemKind.Class)
      item.detail = `Stimulus Controller: ${c.identifier}`
      item.documentation = new vscode.MarkdownString(`Path: \`${c.filePath}\``)
      return item
    })
  }

  private suggestActions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = []
    for (const c of this.indexer.getAllControllers()) {
      for (const action of c.actions) {
        const item = new vscode.CompletionItem(`${c.identifier}#${action}`, vscode.CompletionItemKind.Method)
        item.insertText = `click->${c.identifier}#${action}`
        item.detail = `Stimulus Action: ${c.identifier}#${action}`
        items.push(item)
      }
    }
    return items
  }

  private suggestTargets(controllerIdentifier: string): vscode.CompletionItem[] {
    const controller = this.indexer.getController(controllerIdentifier)
    if (!controller) {return []}

    return controller.targets.map(target => {
      const item = new vscode.CompletionItem(target, vscode.CompletionItemKind.Field)
      item.detail = `Stimulus Target: ${target}`
      item.documentation = new vscode.MarkdownString(`Defined in \`${controller.filePath}\``)
      return item
    })
  }
}
