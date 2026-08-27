/**
 * RelatedHoverProvider - Hovering a `class X` definition line shows its collaborators/
 * callers/specs (for services/queries/policies/decorators) or related patterns + specs
 * (for models), reusing RelatedFilesIndex/MinimalDependencyGraph. Only fires on the
 * class-definition line itself, so it doesn't add noise to every reference of the name.
 */

import * as vscode from 'vscode'
import { RelatedFilesIndex } from './RelatedFilesIndex'
import { MinimalDependencyGraph } from './MinimalDependencyGraph'
import { ProjectPatternIndexer } from '../patterns/ProjectPatternIndexer'

export class RelatedHoverProvider implements vscode.HoverProvider {
  constructor(
    private relatedIndex: RelatedFilesIndex,
    private dependencyGraph: MinimalDependencyGraph,
    private patternIndexer: ProjectPatternIndexer,
  ) {}

  async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | null> {
    const range = document.getWordRangeAtPosition(position)
    if (!range) {return null}

    const word = document.getText(range)
    if (!/^[A-Z]\w*$/.test(word)) {return null}

    const lineText = document.lineAt(position.line).text
    if (!new RegExp(`^\\s*class\\s+${word}\\b`).test(lineText)) {return null}

    const isKnownPattern = this.patternIndexer.getAllPatterns().some(p => p.name === word)
    return isKnownPattern ? this.hoverForPattern(word, range) : this.hoverForModel(word, range)
  }

  private hoverForPattern(name: string, range: vscode.Range): vscode.Hover | null {
    const callers = [...new Set(this.dependencyGraph.getCallers(name).map(c => c.from))]
    const collaborators = [...new Set(this.dependencyGraph.getCollaborators(name).map(c => c.to))]
    const specCount = this.relatedIndex.getSpecCount(name)

    if (callers.length === 0 && collaborators.length === 0 && specCount === 0) {return null}

    const md = new vscode.MarkdownString()
    md.isTrusted = true
    md.appendMarkdown(`### RailsForge: \`${name}\`\n\n`)
    if (collaborators.length > 0) {md.appendMarkdown(`**Depends on:** ${collaborators.join(', ')}\n\n`)}
    if (callers.length > 0) {md.appendMarkdown(`**Called by:** ${callers.join(', ')}\n\n`)}
    if (specCount > 0) {md.appendMarkdown(`**Specs:** ${specCount}\n\n`)}

    return new vscode.Hover(md, range)
  }

  private async hoverForModel(name: string, range: vscode.Range): Promise<vscode.Hover | null> {
    const relations = await this.relatedIndex.getModelRelations(name)
    const entries = Object.entries(relations.patternsByType)
    if (entries.length === 0 && relations.specCount === 0) {return null}

    const md = new vscode.MarkdownString()
    md.isTrusted = true
    md.appendMarkdown(`### RailsForge: \`${name}\`\n\n`)
    for (const [type, list] of entries) {
      const label = type.charAt(0).toUpperCase() + type.slice(1)
      md.appendMarkdown(`**${label}${list!.length === 1 ? '' : 's'}:** ${list!.map(p => p.name).join(', ')}\n\n`)
    }
    if (relations.specCount > 0) {md.appendMarkdown(`**Specs:** ${relations.specCount}\n\n`)}

    return new vscode.Hover(md, range)
  }
}
