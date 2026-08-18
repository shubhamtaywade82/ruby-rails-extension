/**
 * TurboFrameDefinitionProvider - Ctrl+Click / Cmd+Click navigation between all
 * occurrences of a Turbo Frame id (`turbo_frame_tag "cart"` / `<turbo-frame id="cart">`)
 * across the workspace's view templates.
 */

import * as vscode from 'vscode'
import { TurboFrameNavigator, extractFrameIdAtPosition } from './TurboFrameNavigator'

export class TurboFrameDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private navigator: TurboFrameNavigator) {}

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition> {
    const line = document.lineAt(position.line).text
    const id = extractFrameIdAtPosition(line, position.character)
    if (!id) {return null}

    const locations = this.navigator.findFrameLocations(id).filter(
      loc => !(loc.filePath === document.uri.fsPath && loc.line === position.line + 1),
    )
    if (locations.length === 0) {return null}

    return locations.map(loc => new vscode.Location(vscode.Uri.file(loc.filePath), new vscode.Position(loc.line - 1, 0)))
  }
}
