/**
 * RailsArchitectureTreeProvider - Sidebar tree view displaying project architecture and health
 */

import * as vscode from 'vscode'
import { ProjectEnvironment } from '../environment/EnvironmentDetector'
import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'
import { StimulusIndexer } from '../hotwire/StimulusIndexer'

export class ArchitectureItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly description?: string,
    public readonly iconPath?: vscode.ThemeIcon,
  ) {
    super(label, collapsibleState)
  }
}

export class RailsArchitectureTreeProvider implements vscode.TreeDataProvider<ArchitectureItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ArchitectureItem | undefined | void> = new vscode.EventEmitter<ArchitectureItem | undefined | void>()
  readonly onDidChangeTreeData: vscode.Event<ArchitectureItem | undefined | void> = this._onDidChangeTreeData.event

  constructor(
    private env: ProjectEnvironment,
    private schemaIndexer: SchemaIndexer,
    private routesIndexer: RoutesIndexer,
    private stimulusIndexer: StimulusIndexer,
  ) {}

  refresh(env: ProjectEnvironment): void {
    this.env = env
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: ArchitectureItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: ArchitectureItem): Thenable<ArchitectureItem[]> {
    if (!element) {
      return Promise.resolve(this.getRootItems())
    }

    if (element.label === 'Runtime Environment') {
      return Promise.resolve(this.getEnvironmentItems())
    }

    if (element.label === 'Database & Models') {
      return Promise.resolve(this.getDatabaseItems())
    }

    if (element.label === 'Routes & Hotwire') {
      return Promise.resolve(this.getRoutesHotwireItems())
    }

    return Promise.resolve([])
  }

  private getRootItems(): ArchitectureItem[] {
    return [
      new ArchitectureItem(
        'Runtime Environment',
        vscode.TreeItemCollapsibleState.Expanded,
        `Ruby ${this.env.rubyVersion} | Rails ${this.env.railsVersion}`,
        new vscode.ThemeIcon('ruby'),
      ),
      new ArchitectureItem(
        'Database & Models',
        vscode.TreeItemCollapsibleState.Collapsed,
        `${this.schemaIndexer.getAllTables().length} Tables Indexed`,
        new vscode.ThemeIcon('database'),
      ),
      new ArchitectureItem(
        'Routes & Hotwire',
        vscode.TreeItemCollapsibleState.Collapsed,
        `${this.routesIndexer.getAllRoutes().length} Routes | ${this.stimulusIndexer.getAllControllers().length} Controllers`,
        new vscode.ThemeIcon('zap'),
      ),
    ]
  }

  private getEnvironmentItems(): ArchitectureItem[] {
    return [
      new ArchitectureItem(`Ruby: ${this.env.rubyVersion}`, vscode.TreeItemCollapsibleState.None),
      new ArchitectureItem(`Rails: ${this.env.railsVersion}`, vscode.TreeItemCollapsibleState.None),
      new ArchitectureItem(`Hotwire / Turbo: ${this.env.hasHotwire ? 'Active ✓' : 'Inactive ✗'}`, vscode.TreeItemCollapsibleState.None),
      new ArchitectureItem(`Testing Framework: ${this.env.testFramework.toUpperCase()}`, vscode.TreeItemCollapsibleState.None),
      new ArchitectureItem(`Strong Migrations: ${this.env.hasStrongMigrations ? 'Enabled ✓' : 'Disabled ✗'}`, vscode.TreeItemCollapsibleState.None),
    ]
  }

  private getDatabaseItems(): ArchitectureItem[] {
    return this.schemaIndexer.getAllTables().map(t => {
      const colCount = t.columns.size
      return new ArchitectureItem(
        t.name,
        vscode.TreeItemCollapsibleState.None,
        `${colCount} columns`,
        new vscode.ThemeIcon('table'),
      )
    })
  }

  private getRoutesHotwireItems(): ArchitectureItem[] {
    const items: ArchitectureItem[] = [
      new ArchitectureItem(`Total Routes: ${this.routesIndexer.getAllRoutes().length}`, vscode.TreeItemCollapsibleState.None),
    ]

    for (const c of this.stimulusIndexer.getAllControllers()) {
      items.push(
        new ArchitectureItem(
          `Stimulus: ${c.identifier}`,
          vscode.TreeItemCollapsibleState.None,
          `${c.targets.length} targets, ${c.actions.length} actions`,
          new vscode.ThemeIcon('symbol-event'),
        ),
      )
    }

    return items
  }
}
