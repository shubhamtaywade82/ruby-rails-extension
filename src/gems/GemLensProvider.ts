/**
 * GemLensProvider - Hovering over a gem name in a Gemfile shows its latest
 * published version, summary, and links, sourced from RubyGems.org.
 */

import * as vscode from 'vscode'
import * as path from 'path'
import { RubyGemsClient } from './RubyGemsClient'
import { extractGemNameAtPosition } from './GemNameParser'

export class GemLensProvider implements vscode.HoverProvider {
  constructor(private client: RubyGemsClient) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | null> {
    if (path.basename(document.fileName) !== 'Gemfile') {return null}

    const line = document.lineAt(position.line).text
    const gemName = extractGemNameAtPosition(line, position.character)
    if (!gemName) {return null}

    const info = await this.client.fetchGemInfo(gemName)
    if (!info) {return null}

    const markdown = new vscode.MarkdownString()
    markdown.appendMarkdown(`**${info.name}** v${info.version}\n\n`)
    if (info.summary) {
      markdown.appendMarkdown(`${info.summary}\n\n`)
    }
    const links: string[] = []
    if (info.documentationUri) {links.push(`[Documentation](${info.documentationUri})`)}
    if (info.homepageUri) {links.push(`[Homepage](${info.homepageUri})`)}
    if (links.length > 0) {
      markdown.appendMarkdown(links.join(' · '))
    }
    markdown.isTrusted = false

    return new vscode.Hover(markdown)
  }
}
