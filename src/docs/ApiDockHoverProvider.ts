/**
 * ApiDockHoverProvider - Appends apidock.com's top-rated community note (real-world
 * gotchas the official guides/API docs often miss) to the hover tooltip for a
 * curated set of Rails/Ruby/RSpec methods. Registered alongside RailsForge's other
 * single-purpose hover providers (SchemaHoverProvider, VersionDocsEngine, GemLensProvider,
 * RelatedHoverProvider) — VS Code merges all providers' results into one tooltip, so
 * this only needs to contribute its own section, never suppress the others.
 */

import * as vscode from 'vscode'
import { ApiDockClient } from './ApiDockClient'
import { ApiDockMethodIndex } from './ApiDockMethodIndex'

export class ApiDockHoverProvider implements vscode.HoverProvider {
  constructor(
    private client: ApiDockClient,
    private index: ApiDockMethodIndex,
    private isEnabled: () => boolean,
  ) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | null> {
    if (!this.isEnabled()) {return null}

    const range = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*[?!]?/)
    if (!range) {return null}

    const word = document.getText(range)
    const lookup = this.index.lookup(word)
    if (!lookup) {return null}

    const note = await this.client.fetchNotes(lookup)
    if (!note || (!note.summary && !note.topNote)) {return null}

    const md = new vscode.MarkdownString()
    md.isTrusted = false
    md.appendMarkdown(`### APIDock: \`${lookup.className.replace(/\//g, '::')}#${lookup.methodName}\`\n\n`)
    if (note.summary) {
      md.appendMarkdown(`${note.summary}\n\n`)
    }
    if (note.topNote) {
      md.appendMarkdown(`💡 **APIDock Community Note:** ${note.topNote}\n\n`)
    }
    md.appendMarkdown(`[View on APIDock](${note.url})`)

    return new vscode.Hover(md, range)
  }
}
