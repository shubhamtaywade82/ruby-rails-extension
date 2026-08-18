export const DiagnosticSeverity = {
  Error: 0,
  Warning: 1,
  Information: 2,
  Hint: 3,
}

export class Range {
  constructor(
    public startLine: number,
    public startChar: number,
    public endLine: number,
    public endChar: number,
  ) {}
}

export class Position {
  constructor(
    public line: number,
    public character: number,
  ) {}
}

export class Diagnostic {
  public source?: string
  public code?: string | number
  constructor(
    public range: Range,
    public message: string,
    public severity: number = 0,
  ) {}
}

export class CodeAction {
  public edit?: unknown
  public command?: unknown
  constructor(
    public title: string,
    public kind?: unknown,
  ) {}
}

export const CodeActionKind = {
  QuickFix: 'QuickFix',
  RefactorExtract: 'RefactorExtract',
}

export class MarkdownString {
  public isTrusted = false
  private value = ''
  appendMarkdown(str: string) {
    this.value += str
    return this
  }
}

export class Hover {
  constructor(
    public contents: MarkdownString,
    public range?: Range,
  ) {}
}

export class ThemeIcon {
  constructor(public id: string) {}
}

export class TreeItem {
  constructor(
    public label: string,
    public collapsibleState?: number,
  ) {}
}

export const TreeItemCollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
}

export const languages = {
  createDiagnosticCollection: () => ({
    set: () => {},
    delete: () => {},
    dispose: () => {},
  }),
}

export const workspace = {
  createFileSystemWatcher: () => ({
    onDidChange: () => {},
    dispose: () => {},
  }),
}

export const window = {
  createStatusBarItem: () => ({
    show: () => {},
  }),
  createOutputChannel: () => ({
    name: 'RailsForge',
    appendLine: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    show: () => {},
    dispose: () => {},
  }),
}

export const commands = {
  registerCommand: () => ({ dispose: () => {} }),
  executeCommand: () => Promise.resolve(),
}
