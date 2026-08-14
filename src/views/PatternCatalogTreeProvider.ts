/**
 * PatternCatalogTreeProvider - Sidebar tree view displaying the Refactoring Guru & Rails Design Patterns Catalog
 */

import * as vscode from 'vscode'

export class PatternItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly description?: string,
    public readonly tooltip?: string,
    public readonly guruUrl?: string,
    public readonly iconPath?: vscode.ThemeIcon,
  ) {
    super(label, collapsibleState)
    if (guruUrl) {
      this.command = {
        command: 'vscode.open',
        title: 'Open Refactoring Guru Documentation',
        arguments: [vscode.Uri.parse(guruUrl)],
      }
    }
  }
}

export class PatternCatalogTreeProvider implements vscode.TreeDataProvider<PatternItem> {
  getTreeItem(element: PatternItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: PatternItem): Thenable<PatternItem[]> {
    if (!element) {
      return Promise.resolve(this.getCategories())
    }

    if (element.label === 'Creational Patterns') {
      return Promise.resolve(this.getCreationalPatterns())
    }
    if (element.label === 'Structural Patterns') {
      return Promise.resolve(this.getStructuralPatterns())
    }
    if (element.label === 'Behavioral Patterns') {
      return Promise.resolve(this.getBehavioralPatterns())
    }
    if (element.label === 'Rails Idiomatic Patterns') {
      return Promise.resolve(this.getRailsPatterns())
    }

    return Promise.resolve([])
  }

  private getCategories(): PatternItem[] {
    return [
      new PatternItem('Rails Idiomatic Patterns', vscode.TreeItemCollapsibleState.Expanded, 'Service, Query, Form, Policy', undefined, undefined, new vscode.ThemeIcon('ruby')),
      new PatternItem('Behavioral Patterns', vscode.TreeItemCollapsibleState.Collapsed, 'Strategy, Command, Observer', undefined, undefined, new vscode.ThemeIcon('zap')),
      new PatternItem('Structural Patterns', vscode.TreeItemCollapsibleState.Collapsed, 'Adapter, Decorator, Facade', undefined, undefined, new vscode.ThemeIcon('layers')),
      new PatternItem('Creational Patterns', vscode.TreeItemCollapsibleState.Collapsed, 'Factory Method, Builder', undefined, undefined, new vscode.ThemeIcon('extensions')),
    ]
  }

  private getRailsPatterns(): PatternItem[] {
    return [
      new PatternItem('Service Object', vscode.TreeItemCollapsibleState.None, 'app/services (Single Responsibility call)', 'Encapsulates business operations with explicit Result returns.', 'https://refactoring.guru/design-patterns/command/ruby', new vscode.ThemeIcon('symbol-method')),
      new PatternItem('Query Object', vscode.TreeItemCollapsibleState.None, 'app/queries (Complex ActiveRecord chains)', 'Isolates complex multi-table SQL queries into testable classes.', undefined, new vscode.ThemeIcon('search')),
      new PatternItem('Form Object', vscode.TreeItemCollapsibleState.None, 'app/forms (ActiveModel::Model validations)', 'Decouples nested multi-model persistence and validations.', 'https://refactoring.guru/design-patterns', new vscode.ThemeIcon('note')),
      new PatternItem('Value Object', vscode.TreeItemCollapsibleState.None, 'app/values (Data.define immutability)', 'Eliminates Primitive Obsession by encapsulating domain primitives.', 'https://refactoring.guru/refactoring/smells/primitive-obsession', new vscode.ThemeIcon('symbol-constant')),
      new PatternItem('Policy Object', vscode.TreeItemCollapsibleState.None, 'app/policies (Pundit authorization)', 'Isolates user permissions into decoupled query methods.', undefined, new vscode.ThemeIcon('shield')),
    ]
  }

  private getBehavioralPatterns(): PatternItem[] {
    return [
      new PatternItem('Strategy Pattern', vscode.TreeItemCollapsibleState.None, 'Replace conditional with polymorphism', 'Defines a family of interchangeable algorithms.', 'https://refactoring.guru/design-patterns/strategy/ruby', new vscode.ThemeIcon('split-horizontal')),
      new PatternItem('Command Pattern', vscode.TreeItemCollapsibleState.None, 'Encapsulate action requests', 'Turns requests into standalone objects suitable for queuing and dispatch.', 'https://refactoring.guru/design-patterns/command/ruby', new vscode.ThemeIcon('terminal')),
      new PatternItem('Observer / Pub-Sub', vscode.TreeItemCollapsibleState.None, 'Decoupled event broadcasting', 'Notifies multiple objects without tight coupling.', 'https://refactoring.guru/design-patterns/observer/ruby', new vscode.ThemeIcon('broadcast')),
    ]
  }

  private getStructuralPatterns(): PatternItem[] {
    return [
      new PatternItem('Adapter Pattern', vscode.TreeItemCollapsibleState.None, 'Wrapper for external APIs', 'Converts third-party interface into expected application interface.', 'https://refactoring.guru/design-patterns/adapter/ruby', new vscode.ThemeIcon('plug')),
      new PatternItem('Facade Pattern', vscode.TreeItemCollapsibleState.None, 'Unified entry point to subsystems', 'Provides a simplified interface to a complex library or subsystem.', 'https://refactoring.guru/design-patterns/facade/ruby', new vscode.ThemeIcon('circuit-board')),
      new PatternItem('Decorator / ViewComponent', vscode.TreeItemCollapsibleState.None, 'Reusable UI components', 'Attaches flexible presentation logic to models without pollution.', 'https://refactoring.guru/design-patterns/decorator/ruby', new vscode.ThemeIcon('paintcan')),
    ]
  }

  private getCreationalPatterns(): PatternItem[] {
    return [
      new PatternItem('Factory Method', vscode.TreeItemCollapsibleState.None, 'Polymorphic instantiation', 'Provides an interface for creating objects in a superclass.', 'https://refactoring.guru/design-patterns/factory-method/ruby', new vscode.ThemeIcon('package')),
      new PatternItem('Builder Pattern', vscode.TreeItemCollapsibleState.None, 'Step-by-step object construction', 'Constructs complex objects step by step using method chains.', 'https://refactoring.guru/design-patterns/builder/ruby', new vscode.ThemeIcon('tools')),
      new PatternItem('Singleton (Hazard)', vscode.TreeItemCollapsibleState.None, 'Warning: Avoid global state in Rails', 'Global state hazard. Prefer dependency injection in modern Rails.', 'https://refactoring.guru/design-patterns/singleton/ruby', new vscode.ThemeIcon('warning')),
    ]
  }
}
