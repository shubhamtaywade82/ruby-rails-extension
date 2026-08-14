/**
 * FactoryBotResolver - Indexes FactoryBot factories and provides jump-to-definition
 */

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

export interface FactoryLocation {
  name: string
  filePath: string
  line: number
}

export class FactoryBotResolver implements vscode.DefinitionProvider {
  private factories: Map<string, FactoryLocation> = new Map()

  indexFactories(workspaceRoot: string): void {
    this.factories.clear()
    const factoryDirs = [
      path.join(workspaceRoot, 'spec', 'factories'),
      path.join(workspaceRoot, 'test', 'factories'),
    ]

    for (const dir of factoryDirs) {
      if (fs.existsSync(dir)) {
        this.scanDirectory(dir)
      }
    }
  }

  private scanDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        this.scanDirectory(fullPath)
      } else if (entry.name.endsWith('.rb')) {
        this.parseFactoryFile(fullPath)
      }
    }
  }

  private parseFactoryFile(filePath: string): void {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const match = /^\s*factory\s+:([a-zA-Z0-9_]+)/.exec(line)
      if (match) {
        this.factories.set(match[1], {
          name: match[1],
          filePath,
          line: i + 1,
        })
      }
    }
  }

  provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Definition> {
    const line = document.lineAt(position).text
    const match = /(?:create|build|build_stubbed|attributes_for)\s*\(\s*:([a-zA-Z0-9_]+)/.exec(line)
    if (!match) {return null}

    const factoryName = match[1]
    const loc = this.factories.get(factoryName)
    if (!loc) {return null}

    const targetUri = vscode.Uri.file(loc.filePath)
    const targetPos = new vscode.Position(loc.line - 1, 0)
    return new vscode.Location(targetUri, targetPos)
  }

  getFactory(name: string): FactoryLocation | undefined {
    return this.factories.get(name)
  }

  getAllFactories(): FactoryLocation[] {
    return Array.from(this.factories.values())
  }
}
