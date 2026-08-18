/**
 * StimulusDefinitionProvider - Ctrl+Click / Cmd+Click navigation from
 * `data-controller="foo"` and `data-action="click->foo#bar"` in ERB/HAML/Slim
 * templates straight to the Stimulus controller's .js/.ts file (and, for actions,
 * the specific method).
 */

import * as vscode from 'vscode'
import { StimulusIndexer } from './StimulusIndexer'
import { matchActionAtPosition, matchControllerIdentifierAtPosition } from './StimulusAttributeParser'

export class StimulusDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private indexer: StimulusIndexer) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition> {
    const line = document.lineAt(position.line).text
    const char = position.character

    const action = matchActionAtPosition(line, char)
    if (action) {
      const controller = this.indexer.getController(action.identifier)
      if (!controller) {return null}
      const actionLine = controller.actionLines[action.action]
      const targetPos = new vscode.Position(actionLine ? actionLine - 1 : 0, 0)
      return new vscode.Location(vscode.Uri.file(controller.filePath), targetPos)
    }

    const identifier = matchControllerIdentifierAtPosition(line, char)
    if (identifier) {
      const controller = this.indexer.getController(identifier)
      if (!controller) {return null}
      return new vscode.Location(vscode.Uri.file(controller.filePath), new vscode.Position(0, 0))
    }

    return null
  }
}
