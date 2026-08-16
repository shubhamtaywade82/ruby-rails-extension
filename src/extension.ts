/**
 * RailsForge Extension Entry Point
 */

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

import { SchemaIndexer } from './rails/SchemaIndexer'
import { RoutesIndexer } from './rails/RoutesIndexer'
import { MVCNavigator } from './rails/MVCNavigator'
import { SchemaHoverProvider } from './rails/SchemaHoverProvider'
import { RuboCopProvider } from './lint/RuboCopProvider'
import { BrakemanProvider } from './lint/BrakemanProvider'
import { ServiceExtractor } from './refactor/ServiceExtractor'
import { QueryExtractor } from './refactor/QueryExtractor'
import { BundlerAuditScanner } from './lint/BundlerAuditScanner'
import { StrongMigrationsAnalyzer } from './rails/StrongMigrationsAnalyzer'
import { PolicyNavigator } from './rails/PolicyNavigator'
import { ViewComponentResolver } from './rails/ViewComponentResolver'
import { MigrationDiagnostics } from './rails/MigrationDiagnostics'
import { StimulusIndexer } from './hotwire/StimulusIndexer'
import { StimulusCompletionProvider } from './hotwire/StimulusCompletionProvider'
import { TurboFrameNavigator } from './hotwire/TurboFrameNavigator'
import { TestExplorerController } from './testing/TestExplorerController'
import { TestCodeLensProvider } from './testing/TestCodeLensProvider'
import { EnvironmentDetector, ProjectEnvironment } from './environment/EnvironmentDetector'
import { RailsDeprecationLinter } from './lint/RailsDeprecationLinter'
import { DesignPrincipleLinter } from './principles/DesignPrincipleLinter'
import { VersionDocsEngine } from './docs/VersionDocsEngine'
import { FactoryBotResolver } from './testing/FactoryBotResolver'
import { RailsArchitectureTreeProvider } from './views/RailsArchitectureTreeProvider'
import { PatternCatalogTreeProvider } from './views/PatternCatalogTreeProvider'
import { PatternDiagnosticsProvider } from './patterns/PatternDiagnosticsProvider'
import { ProjectPatternIndexer } from './patterns/ProjectPatternIndexer'
import { PatternCodeLensProvider } from './patterns/PatternCodeLensProvider'
import { MinimalDependencyGraph } from './graph/MinimalDependencyGraph'
import { DependencyDiagnosticsProvider } from './graph/DependencyDiagnosticsProvider'
import { RelatedFilesIndex } from './graph/RelatedFilesIndex'
import { RelatedCodeLensProvider } from './graph/RelatedCodeLensProvider'
import { RelatedHoverProvider } from './graph/RelatedHoverProvider'
import { FormObjectExtractor } from './refactor/FormObjectExtractor'
import { ValueObjectExtractor } from './refactor/ValueObjectExtractor'
import { RefactoringMenuProvider } from './refactor/RefactoringMenuProvider'
import { RailsAgent } from './agent/RailsAgent'
import { RailsChatParticipant } from './chat/RailsChatParticipant'
import { RailsChatViewProvider } from './chat/RailsChatViewProvider'
import { PersistentIndexManager } from './indexer/PersistentIndexManager'
import { findDuplicateCallSites } from './refactor/DuplicateCallSiteFinder'
import { specFilePathFor, buildRspecSkeleton } from './refactor/SpecFileGenerator'
import { buildCursorRulesContent } from './mcp/CursorRulesGenerator'
import { EmbeddingClient } from './search/EmbeddingClient'
import { SemanticSearchIndex } from './search/SemanticSearchIndex'

export function activate(context: vscode.ExtensionContext): void {
  const schemaIndexer = new SchemaIndexer()
  const routesIndexer = new RoutesIndexer()
  const mvcNavigator = new MVCNavigator()
  const rubocopProvider = new RuboCopProvider()
  const brakemanProvider = new BrakemanProvider()
  const bundlerAuditScanner = new BundlerAuditScanner()
  const strongMigrationsAnalyzer = new StrongMigrationsAnalyzer()
  const migrationDiagnostics = new MigrationDiagnostics()
  const deprecationLinter = new RailsDeprecationLinter()
  const principleLinter = new DesignPrincipleLinter()
  const patternDiagnostics = new PatternDiagnosticsProvider()
  const projectPatternIndexer = new ProjectPatternIndexer()
  const patternCodeLensProvider = new PatternCodeLensProvider(projectPatternIndexer)
  const dependencyGraph = new MinimalDependencyGraph(projectPatternIndexer, filePath => fs.readFileSync(filePath, 'utf8'))
  const dependencyDiagnostics = new DependencyDiagnosticsProvider(dependencyGraph, projectPatternIndexer)
  const relatedFilesIndex = new RelatedFilesIndex(projectPatternIndexer, filePath => fs.readFileSync(filePath, 'utf8'))
  const relatedCodeLensProvider = new RelatedCodeLensProvider(relatedFilesIndex, dependencyGraph, projectPatternIndexer)
  const relatedHoverProvider = new RelatedHoverProvider(relatedFilesIndex, dependencyGraph, projectPatternIndexer)
  const docsEngine = new VersionDocsEngine()
  const factoryBotResolver = new FactoryBotResolver()
  const policyNavigator = new PolicyNavigator()
  const viewComponentResolver = new ViewComponentResolver()
  const stimulusIndexer = new StimulusIndexer()
  const turboFrameNavigator = new TurboFrameNavigator()
  const testExplorer = new TestExplorerController()
  const serviceExtractor = new ServiceExtractor()
  const queryExtractor = new QueryExtractor()
  const formExtractor = new FormObjectExtractor()
  const valueExtractor = new ValueObjectExtractor()
  const refactoringMenu = new RefactoringMenuProvider(
    serviceExtractor,
    queryExtractor,
    formExtractor,
    valueExtractor,
  )
  const envDetector = new EnvironmentDetector()

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
  const env: ProjectEnvironment = envDetector.detectEnvironment(workspaceRoot)

  // Set UI when contexts
  void vscode.commands.executeCommand('setContext', 'railsforge.hasHotwire', env.hasHotwire)
  void vscode.commands.executeCommand('setContext', 'railsforge.hasPundit', env.hasPundit)
  void vscode.commands.executeCommand('setContext', 'railsforge.hasViewComponent', env.hasViewComponent)

  const config = vscode.workspace.getConfiguration('railsForge')
  const ollamaHost = config.get<string>('ollama.host', 'http://localhost:11434')
  const agent = new RailsAgent(
    schemaIndexer,
    routesIndexer,
    {
      ollamaHost,
      model: config.get<string>('ollama.model', 'qwen2.5-coder:14b'),
    },
    env,
    projectPatternIndexer,
  )

  const embeddingClient = new EmbeddingClient({
    ollamaHost,
    model: config.get<string>('ollama.embeddingModel', 'nomic-embed-text'),
  })
  const semanticSearchIndex = new SemanticSearchIndex(projectPatternIndexer, text => embeddingClient.embed(text))

  // 1. Sidebar Chat Webview Provider (Same architecture as PineForge)
  const chatViewProvider = new RailsChatViewProvider(
    context.extensionUri,
    agent,
    schemaIndexer,
    routesIndexer,
  )
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('railsforge.chatView', chatViewProvider),
  )

  // Phase 12: persistent AST/SQLite index (tree-sitter + better-sqlite3, off-thread).
  // Powers Phase 8 (cross-file duplicate methods) and Phase 11 (dependency cycles) below.
  // Fails soft: commands check persistentIndex.manager and report "still indexing /
  // unavailable" rather than the extension crashing if native modules can't load.
  const persistentIndex: { manager: PersistentIndexManager | null } = { manager: null }
  if (workspaceRoot) {
    void PersistentIndexManager.activate(context, workspaceRoot).then(manager => {
      persistentIndex.manager = manager
    })
  }

  // 2. Initial Indexing & Live Workspace Analysis
  if (workspaceRoot) {
    loadSchema(workspaceRoot, schemaIndexer)
    loadRoutes(workspaceRoot, routesIndexer)
    loadStimulusControllers(workspaceRoot, stimulusIndexer)
    factoryBotResolver.indexFactories(workspaceRoot)
    patternDiagnostics.scanWorkspace()
    void loadProjectPatterns(projectPatternIndexer, patternCodeLensProvider, dependencyGraph, dependencyDiagnostics, relatedCodeLensProvider, semanticSearchIndex)
    void loadSpecFiles(relatedFilesIndex, relatedCodeLensProvider)
    watchProjectFiles(context, workspaceRoot, schemaIndexer, routesIndexer, migrationDiagnostics)
    watchPatternFiles(context, projectPatternIndexer, patternCodeLensProvider, dependencyGraph, dependencyDiagnostics, relatedCodeLensProvider, semanticSearchIndex)
    watchSpecFiles(context, relatedFilesIndex, relatedCodeLensProvider)
  }

  // 3. Activity Bar Tree Views
  const architectureTreeProvider = new RailsArchitectureTreeProvider(
    env,
    schemaIndexer,
    routesIndexer,
    stimulusIndexer,
  )
  vscode.window.registerTreeDataProvider('railsforge.architectureView', architectureTreeProvider)
  vscode.window.registerTreeDataProvider('railsforge.patternCatalogView', new PatternCatalogTreeProvider())

  // 3. Register Providers
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'ruby', scheme: 'file' }, new SchemaHoverProvider(schemaIndexer)),
    vscode.languages.registerHoverProvider({ language: 'ruby', scheme: 'file' }, docsEngine),
    vscode.languages.registerDefinitionProvider({ language: 'ruby', scheme: 'file' }, factoryBotResolver),
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, rubocopProvider),
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, migrationDiagnostics),
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, deprecationLinter),
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, principleLinter, {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.RefactorExtract],
    }),
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, patternDiagnostics),
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, dependencyDiagnostics, {
      providedCodeActionKinds: [vscode.CodeActionKind.Refactor],
    }),
    vscode.languages.registerCompletionItemProvider(
      ['erb', 'html', 'ruby'],
      new StimulusCompletionProvider(stimulusIndexer),
      '"',
      '\'',
      '=',
    ),
    vscode.languages.registerCodeLensProvider({ language: 'ruby', scheme: 'file' }, new TestCodeLensProvider()),
    vscode.languages.registerCodeLensProvider({ language: 'ruby', scheme: 'file' }, patternCodeLensProvider),
    vscode.languages.registerCodeLensProvider({ language: 'ruby', scheme: 'file' }, relatedCodeLensProvider),
    vscode.languages.registerHoverProvider({ language: 'ruby', scheme: 'file' }, relatedHoverProvider),
    testExplorer.getController(),
    migrationDiagnostics,
    deprecationLinter,
    principleLinter,
    patternDiagnostics,
    dependencyDiagnostics,
    rubocopProvider,
  )

  // 4. Live Document Watchers for Diagnostics & Design Pattern Suggestions
  vscode.workspace.onDidOpenTextDocument(doc => {
    testExplorer.discoverTestsInDocument(doc)
    migrationDiagnostics.updateDiagnostics(doc)
    deprecationLinter.updateDiagnostics(doc, env)
    principleLinter.updateDiagnostics(doc)
    patternDiagnostics.updateDiagnostics(doc)
    dependencyDiagnostics.updateDiagnostics(doc)
  }, null, context.subscriptions)

  vscode.workspace.onDidChangeTextDocument(e => {
    migrationDiagnostics.updateDiagnostics(e.document)
    deprecationLinter.updateDiagnostics(e.document, env)
    principleLinter.updateDiagnostics(e.document)
    patternDiagnostics.updateDiagnostics(e.document)
    dependencyDiagnostics.updateDiagnostics(e.document)
  }, null, context.subscriptions)

  // 4. Register Commands
  registerCommands(
    context,
    mvcNavigator,
    routesIndexer,
    rubocopProvider,
    brakemanProvider,
    bundlerAuditScanner,
    strongMigrationsAnalyzer,
    policyNavigator,
    viewComponentResolver,
    turboFrameNavigator,
    refactoringMenu,
    patternDiagnostics,
    serviceExtractor,
    queryExtractor,
    projectPatternIndexer,
    agent,
    principleLinter,
    relatedFilesIndex,
    dependencyGraph,
    persistentIndex,
    schemaIndexer,
    env,
    semanticSearchIndex,
  )

  // 5. Register Chat Participant
  RailsChatParticipant.getInstance().register(context, agent, schemaIndexer, routesIndexer)

  // 6. Suggest the ruby-lsp add-on when ruby-lsp is present but the gem isn't
  if (workspaceRoot) {
    void suggestRubyLspAddon(context, workspaceRoot)
  }

  // 6. Status Bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBar.text = '$(ruby) RailsForge'
  statusBar.tooltip = 'RailsForge: Active'
  statusBar.show()
  context.subscriptions.push(statusBar)
}

async function suggestRubyLspAddon(context: vscode.ExtensionContext, root: string): Promise<void> {
  const dismissedKey = 'railsforge.dismissedRubyLspAddonSuggestion'
  if (context.globalState.get<boolean>(dismissedKey)) {return}

  const rubyLspInstalled = Boolean(vscode.extensions.getExtension('Shopify.ruby-lsp'))
  if (!rubyLspInstalled) {return}

  const lockPath = path.join(root, 'Gemfile.lock')
  if (!fs.existsSync(lockPath)) {return}
  const lock = fs.readFileSync(lockPath, 'utf8')
  if (!lock.includes(' ruby-lsp ') || lock.includes('railsforge-ruby-lsp')) {return}

  const choice = await vscode.window.showInformationMessage(
    'RailsForge can add schema-aware hover directly into ruby-lsp via a small companion gem (railsforge-ruby-lsp). Add it to your Gemfile?',
    'Show Instructions',
    "Don't show again",
  )
  if (choice === 'Show Instructions') {
    void vscode.env.openExternal(vscode.Uri.parse('https://github.com/shubhamtaywade82/railsforge/tree/main/ruby-lsp-addon'))
  }
  if (choice) {
    void context.globalState.update(dismissedKey, true)
  }
}

function loadStimulusControllers(root: string, indexer: StimulusIndexer): void {
  const controllersDir = path.join(root, 'app', 'javascript', 'controllers')
  if (fs.existsSync(controllersDir)) {
    const files = fs.readdirSync(controllersDir)
    for (const f of files) {
      if (f.endsWith('_controller.js') || f.endsWith('_controller.ts')) {
        const full = path.join(controllersDir, f)
        const code = fs.readFileSync(full, 'utf8')
        indexer.parseControllerCode(full, code)
      }
    }
  }
}
async function loadProjectPatterns(
  indexer: ProjectPatternIndexer,
  codeLensProvider: PatternCodeLensProvider,
  dependencyGraph: MinimalDependencyGraph,
  dependencyDiagnostics: DependencyDiagnosticsProvider,
  relatedCodeLensProvider: RelatedCodeLensProvider,
  semanticSearchIndex: SemanticSearchIndex,
): Promise<void> {
  // Matches both app/services/**/*.rb (Rails) and lib/**/services/**/*.rb (a gem/script
  // with no app/ directory), since ProjectPatternIndexer.classifyPath now matches the
  // directory name anywhere in the path.
  const globs = [
    '{app,lib}/**/services/**/*.rb',
    '{app,lib}/**/queries/**/*.rb',
    '{app,lib}/**/forms/**/*.rb',
    '{app,lib}/**/policies/**/*.rb',
    '{app,lib}/**/decorators/**/*.rb',
    '{app,lib}/**/concerns/**/*.rb',
  ]

  for (const glob of globs) {
    const files = await vscode.workspace.findFiles(glob, '**/node_modules/**')
    for (const file of files) {
      const content = fs.readFileSync(file.fsPath, 'utf8')
      indexer.indexFile(file.fsPath, content)
    }
  }
  codeLensProvider.refresh()
  dependencyGraph.rebuild()
  refreshOpenDependencyDiagnostics(dependencyDiagnostics)
  relatedCodeLensProvider.refresh()
  semanticSearchIndex.pruneStale()
}

async function loadSpecFiles(relatedFilesIndex: RelatedFilesIndex, relatedCodeLensProvider: RelatedCodeLensProvider): Promise<void> {
  const files = await vscode.workspace.findFiles('spec/**/*_spec.rb', '**/node_modules/**')
  for (const file of files) {
    relatedFilesIndex.indexSpecFile(file.fsPath, fs.readFileSync(file.fsPath, 'utf8'))
  }
  const testFiles = await vscode.workspace.findFiles('test/**/*_test.rb', '**/node_modules/**')
  for (const file of testFiles) {
    relatedFilesIndex.indexSpecFile(file.fsPath, fs.readFileSync(file.fsPath, 'utf8'))
  }
  relatedCodeLensProvider.refresh()
}

function watchSpecFiles(context: vscode.ExtensionContext, relatedFilesIndex: RelatedFilesIndex, relatedCodeLensProvider: RelatedCodeLensProvider): void {
  const watcher = vscode.workspace.createFileSystemWatcher('**/{spec/**/*_spec.rb,test/**/*_test.rb}')
  const reindex = (uri: vscode.Uri): void => {
    if (fs.existsSync(uri.fsPath)) {
      relatedFilesIndex.indexSpecFile(uri.fsPath, fs.readFileSync(uri.fsPath, 'utf8'))
    } else {
      relatedFilesIndex.removeSpecFile(uri.fsPath)
    }
    relatedCodeLensProvider.refresh()
  }
  watcher.onDidChange(reindex)
  watcher.onDidCreate(reindex)
  watcher.onDidDelete(uri => {
    relatedFilesIndex.removeSpecFile(uri.fsPath)
    relatedCodeLensProvider.refresh()
  })
  context.subscriptions.push(watcher)
}

function watchPatternFiles(
  context: vscode.ExtensionContext,
  indexer: ProjectPatternIndexer,
  codeLensProvider: PatternCodeLensProvider,
  dependencyGraph: MinimalDependencyGraph,
  dependencyDiagnostics: DependencyDiagnosticsProvider,
  relatedCodeLensProvider: RelatedCodeLensProvider,
  semanticSearchIndex: SemanticSearchIndex,
): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/{app,lib}/**/{services,queries,forms,policies,decorators,concerns}/**/*.rb',
  )
  const reindex = (uri: vscode.Uri): void => {
    if (fs.existsSync(uri.fsPath)) {
      indexer.indexFile(uri.fsPath, fs.readFileSync(uri.fsPath, 'utf8'))
    } else {
      indexer.removeFile(uri.fsPath)
    }
    codeLensProvider.refresh()
    dependencyGraph.rebuild()
    refreshOpenDependencyDiagnostics(dependencyDiagnostics)
    relatedCodeLensProvider.refresh()
    semanticSearchIndex.pruneStale()
  }
  watcher.onDidChange(reindex)
  watcher.onDidCreate(reindex)
  watcher.onDidDelete(uri => {
    indexer.removeFile(uri.fsPath)
    codeLensProvider.refresh()
    dependencyGraph.rebuild()
    refreshOpenDependencyDiagnostics(dependencyDiagnostics)
    semanticSearchIndex.pruneStale()
    relatedCodeLensProvider.refresh()
  })
  context.subscriptions.push(watcher)
}

function refreshOpenDependencyDiagnostics(dependencyDiagnostics: DependencyDiagnosticsProvider): void {
  for (const doc of vscode.workspace.textDocuments) {
    dependencyDiagnostics.updateDiagnostics(doc)
  }
}

/**
 * Phase 13: after extracting a Service/Query, checks whether the exact same code was
 * copy-pasted elsewhere in the workspace and, if the developer opts in, replaces those
 * call sites too — added to the same WorkspaceEdit as the primary extraction so it's
 * one multi-file diff preview, not several separate edits.
 */
async function maybeReplaceDuplicateCallSites(
  edit: vscode.WorkspaceEdit,
  selection: string,
  replacementCall: string,
  excludeUri: vscode.Uri,
): Promise<void> {
  const files = await vscode.workspace.findFiles('{app,lib}/**/*.rb', '**/node_modules/**')
  const contents = new Map<string, string>()
  for (const file of files) {
    if (file.fsPath === excludeUri.fsPath) {continue}
    try {
      contents.set(file.fsPath, fs.readFileSync(file.fsPath, 'utf8'))
    } catch {
      // Unreadable file — skip it rather than aborting the whole search.
    }
  }

  const duplicates = findDuplicateCallSites(selection, contents, excludeUri.fsPath)
  if (duplicates.length === 0) {return}

  const choice = await vscode.window.showWarningMessage(
    `RailsForge: Found ${duplicates.length} other occurrence(s) of this exact code elsewhere in the workspace. Replace them too?`,
    'Replace All',
    'Just This One',
  )
  if (choice !== 'Replace All') {return}

  for (const dup of duplicates) {
    const doc = await vscode.workspace.openTextDocument(dup.filePath)
    const start = doc.positionAt(dup.index)
    const end = doc.positionAt(dup.index + dup.length)
    edit.replace(doc.uri, new vscode.Range(start, end), replacementCall)
  }
}

/**
 * Phase 13: generates a companion RSpec skeleton for a newly extracted Service/Query,
 * added to the same WorkspaceEdit — only when the workspace actually has a spec/
 * directory, and only if a spec for that file doesn't already exist.
 */
function maybeGenerateSpec(
  edit: vscode.WorkspaceEdit,
  extractedFilePath: string,
  root: string,
  kind: 'service' | 'query',
  className: string,
): void {
  if (!fs.existsSync(path.join(root, 'spec'))) {return}

  const specPath = specFilePathFor(extractedFilePath, root, kind)
  if (fs.existsSync(specPath)) {return}

  const specUri = vscode.Uri.file(specPath)
  edit.createFile(specUri, { ignoreIfExists: true })
  edit.insert(specUri, new vscode.Position(0, 0), buildRspecSkeleton(className, kind, 'call'))
}

/**
 * Merge-writes the `railsforge` entry into .cursor/mcp.json without clobbering any
 * other MCP servers the user already has configured there.
 */
function registerMcpServer(root: string, mcpServerPath: string): void {
  const mcpConfigPath = path.join(root, '.cursor', 'mcp.json')
  let config: { mcpServers?: Record<string, unknown> } = {}
  if (fs.existsSync(mcpConfigPath)) {
    try {
      config = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'))
    } catch {
      config = {}
    }
  }

  config.mcpServers = {
    ...config.mcpServers,
    railsforge: {
      command: 'node',
      args: [mcpServerPath],
      env: { RAILSFORGE_WORKSPACE_ROOT: root },
    },
  }

  fs.mkdirSync(path.dirname(mcpConfigPath), { recursive: true })
  fs.writeFileSync(mcpConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

function loadSchema(root: string, indexer: SchemaIndexer): void {
  const schemaPath = path.join(root, 'db', 'schema.rb')
  if (fs.existsSync(schemaPath)) {
    const content = fs.readFileSync(schemaPath, 'utf8')
    indexer.parseSchema(content)
  }
}

function loadRoutes(root: string, indexer: RoutesIndexer): void {
  const routesPath = path.join(root, 'config', 'routes.rb')
  if (fs.existsSync(routesPath)) {
    const content = fs.readFileSync(routesPath, 'utf8')
    indexer.parseRoutesTable(content)
  }
}

function watchProjectFiles(
  context: vscode.ExtensionContext,
  root: string,
  schemaIndexer: SchemaIndexer,
  routesIndexer: RoutesIndexer,
  migrationDiagnostics: MigrationDiagnostics,
): void {
  const schemaWatcher = vscode.workspace.createFileSystemWatcher('**/db/schema.rb')
  schemaWatcher.onDidChange(() => loadSchema(root, schemaIndexer))
  context.subscriptions.push(schemaWatcher)

  const routesWatcher = vscode.workspace.createFileSystemWatcher('**/config/routes.rb')
  routesWatcher.onDidChange(() => loadRoutes(root, routesIndexer))
  context.subscriptions.push(routesWatcher)

  const migrationWatcher = vscode.workspace.createFileSystemWatcher('**/db/migrate/*.rb')
  migrationWatcher.onDidChange(uri => {
    void vscode.workspace.openTextDocument(uri).then(doc => migrationDiagnostics.updateDiagnostics(doc))
  })
  context.subscriptions.push(migrationWatcher)
}

function registerCommands(
  context: vscode.ExtensionContext,
  mvc: MVCNavigator,
  routes: RoutesIndexer,
  rubocop: RuboCopProvider,
  brakeman: BrakemanProvider,
  bundlerAuditScanner: BundlerAuditScanner,
  strongMigrationsAnalyzer: StrongMigrationsAnalyzer,
  policyNavigator: PolicyNavigator,
  viewComponentResolver: ViewComponentResolver,
  _turboFrameNavigator: TurboFrameNavigator,
  refactoringMenu: RefactoringMenuProvider,
  patternDiagnostics: PatternDiagnosticsProvider,
  serviceExtractor: ServiceExtractor,
  queryExtractor: QueryExtractor,
  projectPatternIndexer: ProjectPatternIndexer,
  agent: RailsAgent,
  principleLinter: DesignPrincipleLinter,
  relatedFilesIndex: RelatedFilesIndex,
  dependencyGraph: MinimalDependencyGraph,
  persistentIndex: { manager: PersistentIndexManager | null },
  schemaIndexer: SchemaIndexer,
  env: ProjectEnvironment,
  semanticSearchIndex: SemanticSearchIndex,
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('railsforge.showDependencyCycles', async () => {
      const manager = persistentIndex.manager
      if (!manager) {
        vscode.window.showWarningMessage('RailsForge: The AST index is still starting up (or unavailable on this platform) — try again shortly.')
        return
      }
      const cycles = manager.dependencyGraph.findCycles()
      if (cycles.length === 0) {
        vscode.window.showInformationMessage('RailsForge: No circular dependencies found among indexed services/queries/policies.')
        return
      }
      const lines = cycles.map((cycle, i) => `${i + 1}. ${cycle.join(' → ')}`)
      const doc = await vscode.workspace.openTextDocument({
        content: `# RailsForge: Circular Dependencies\n\n${lines.join('\n')}\n`,
        language: 'markdown',
      })
      await vscode.window.showTextDocument(doc)
    }),
    vscode.commands.registerCommand('railsforge.findDuplicateMethods', async () => {
      const manager = persistentIndex.manager
      if (!manager) {
        vscode.window.showWarningMessage('RailsForge: The AST index is still starting up (or unavailable on this platform) — try again shortly.')
        return
      }
      const duplicates = manager.duplicateDetector.findDuplicates()
      if (duplicates.length === 0) {
        vscode.window.showInformationMessage('RailsForge: No near-duplicate methods found.')
        return
      }
      const items = duplicates.map(d => ({
        label: `${Math.round(d.similarity * 100)}% similar: ${d.a.name} ↔ ${d.b.name}`,
        description: `${vscode.workspace.asRelativePath(d.a.filePath)}:${d.a.startLine} ↔ ${vscode.workspace.asRelativePath(d.b.filePath)}:${d.b.startLine}`,
        pair: d,
      }))
      const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Near-duplicate methods (consider extracting a shared concern/method)' })
      if (!selected) {return}

      const doc = await vscode.workspace.openTextDocument(selected.pair.a.filePath)
      const editor = await vscode.window.showTextDocument(doc)
      const pos = new vscode.Position(Math.max(0, selected.pair.a.startLine - 1), 0)
      editor.selection = new vscode.Selection(pos, pos)
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter)
    }),
    vscode.commands.registerCommand('railsforge.exportCursorRules', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!root) {
        vscode.window.showWarningMessage('RailsForge: No workspace folder open.')
        return
      }

      const mcpServerPath = path.join(context.extensionPath, 'dist', 'mcp', 'server.js')
      const mcpServerAvailable = fs.existsSync(mcpServerPath)

      const content = buildCursorRulesContent({
        rubyVersion: env.rubyVersion,
        railsVersion: env.hasRails ? env.railsVersion : undefined,
        hasRails: env.hasRails,
        tables: schemaIndexer.getAllTables(),
        routes: routes.getAllRoutes(),
        patterns: projectPatternIndexer.getAllPatterns(),
        mcpServerAvailable,
      })

      const rulesDir = path.join(root, '.cursor', 'rules')
      fs.mkdirSync(rulesDir, { recursive: true })
      fs.writeFileSync(path.join(rulesDir, 'railsforge.mdc'), content, 'utf8')

      if (mcpServerAvailable) {
        registerMcpServer(root, mcpServerPath)
      }

      const doc = await vscode.workspace.openTextDocument(path.join(rulesDir, 'railsforge.mdc'))
      await vscode.window.showTextDocument(doc)
      vscode.window.showInformationMessage(
        mcpServerAvailable
          ? 'RailsForge: Exported .cursor/rules/railsforge.mdc and registered the railsforge MCP server in .cursor/mcp.json.'
          : 'RailsForge: Exported .cursor/rules/railsforge.mdc.',
      )
    }),
    vscode.commands.registerCommand('railsforge.applyAiFix', async (uri: vscode.Uri, range: vscode.Range, diagnosticMessage: string) => {
      const document = await vscode.workspace.openTextDocument(uri)
      const code = document.getText(range)

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'RailsForge AI: Generating fix…' },
        async () => {
          const fixed = await agent.suggestCodeFix(code, diagnosticMessage, {
            fileName: document.fileName,
            fileContent: document.getText(),
            selection: code,
            workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
          })

          if (!fixed) {
            vscode.window.showWarningMessage('RailsForge: AI fix unavailable (check that Ollama is running).')
            return
          }

          const edit = new vscode.WorkspaceEdit()
          edit.replace(uri, range, fixed)
          await vscode.workspace.applyEdit(edit)
          vscode.window.showInformationMessage('RailsForge: AI fix applied.')
        },
      )
    }),
    vscode.commands.registerCommand('railsforge.fixAllInFile', async (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri
      if (!targetUri) {return}
      const document = await vscode.workspace.openTextDocument(targetUri)
      const diagnostics = vscode.languages.getDiagnostics(targetUri).filter(d => d.source === 'RailsForge Principles')

      let applied = 0
      for (const diag of diagnostics) {
        const codeActionContext: vscode.CodeActionContext = { diagnostics: [diag], only: undefined, triggerKind: vscode.CodeActionTriggerKind.Invoke }
        const actions = principleLinter.provideCodeActions(document, diag.range, codeActionContext)
        const deterministic = actions.find(a => a.edit && !a.command)
        if (deterministic?.edit) {
          await vscode.workspace.applyEdit(deterministic.edit)
          applied++
        }
      }
      vscode.window.showInformationMessage(`RailsForge: Applied ${applied} deterministic fix(es). AI fixes must be applied individually via the lightbulb.`)
    }),
    vscode.commands.registerCommand('railsforge.showSimilarPatterns', async (filePath: string, line: number) => {
      const pattern = projectPatternIndexer.findPatternAt(filePath, line)
      if (!pattern) {
        vscode.window.showWarningMessage('RailsForge: No indexed pattern found at this location.')
        return
      }
      const similar = projectPatternIndexer.findSimilar(pattern)
      if (similar.length === 0) {
        vscode.window.showInformationMessage(`No similar ${pattern.type}s found elsewhere in this project.`)
        return
      }
      const items = similar.map(p => ({
        label: p.name,
        description: vscode.workspace.asRelativePath(p.filePath),
        detail: p.publicMethods.length > 0 ? `Public methods: ${p.publicMethods.join(', ')}` : undefined,
        pattern: p,
      }))
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Similar ${pattern.type}s to ${pattern.name} already in this project`,
        matchOnDescription: true,
        matchOnDetail: true,
      })
      if (selected) {
        const doc = await vscode.workspace.openTextDocument(selected.pattern.filePath)
        const editor = await vscode.window.showTextDocument(doc)
        const pos = new vscode.Position(Math.max(0, selected.pattern.lineStart - 1), 0)
        editor.selection = new vscode.Selection(pos, pos)
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter)
      }
    }),
    vscode.commands.registerCommand('railsforge.showRelatedFiles', async (name: string) => {
      const items: Array<{ label: string; description: string; filePath: string; line?: number }> = []

      const relations = relatedFilesIndex.getModelRelations(name)
      for (const [type, list] of Object.entries(relations.patternsByType)) {
        for (const p of list ?? []) {
          items.push({ label: `$(symbol-class) ${p.name}`, description: type, filePath: p.filePath, line: p.lineStart })
        }
      }

      for (const edge of dependencyGraph.getCollaborators(name)) {
        const collaborator = projectPatternIndexer.getAllPatterns().find(p => p.name === edge.to)
        if (collaborator) {
          items.push({ label: `$(arrow-right) ${edge.to}`, description: 'depends on', filePath: collaborator.filePath, line: collaborator.lineStart })
        }
      }
      for (const edge of dependencyGraph.getCallers(name)) {
        const caller = projectPatternIndexer.getAllPatterns().find(p => p.name === edge.from)
        if (caller) {
          items.push({ label: `$(arrow-left) ${edge.from}`, description: 'called by', filePath: caller.filePath, line: caller.lineStart })
        }
      }
      for (const specPath of relatedFilesIndex.getSpecFiles(name)) {
        items.push({ label: `$(beaker) ${vscode.workspace.asRelativePath(specPath)}`, description: 'spec', filePath: specPath })
      }

      if (items.length === 0) {
        vscode.window.showInformationMessage(`RailsForge: No related files indexed for ${name}.`)
        return
      }

      const selected = await vscode.window.showQuickPick(items, { placeHolder: `Files related to ${name}` })
      if (!selected) {return}

      const doc = await vscode.workspace.openTextDocument(selected.filePath)
      const editor = await vscode.window.showTextDocument(doc)
      if (selected.line) {
        const pos = new vscode.Position(Math.max(0, selected.line - 1), 0)
        editor.selection = new vscode.Selection(pos, pos)
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter)
      }
    }),
    vscode.commands.registerCommand('railsforge.semanticSearch', async () => {
      const query = await vscode.window.showInputBox({
        prompt: 'RailsForge Semantic Search — describe what you\'re looking for (e.g. "charge a card", "send a welcome email")',
        placeHolder: 'What are you looking for?',
      })
      if (!query) {return}

      const results = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'RailsForge: Searching…' },
        () => semanticSearchIndex.search(query),
      )

      if (results.length === 0) {
        vscode.window.showInformationMessage(`RailsForge: No matches found for "${query}".`)
        return
      }

      const items = results.map(r => ({
        label: `${r.matchedBy === 'semantic' ? '🧠' : '🔤'} ${r.pattern.name}`,
        description: `${r.pattern.type} · ${vscode.workspace.asRelativePath(r.pattern.filePath)}`,
        detail: r.pattern.preview.split('\n').find(l => l.trim().length > 0)?.trim(),
        result: r,
      }))

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `Results for "${query}" (🧠 semantic · 🔤 keyword fallback)`,
        matchOnDescription: true,
        matchOnDetail: true,
      })
      if (!selected) {return}

      const doc = await vscode.workspace.openTextDocument(selected.result.pattern.filePath)
      const editor = await vscode.window.showTextDocument(doc)
      const pos = new vscode.Position(Math.max(0, selected.result.pattern.lineStart - 1), 0)
      editor.selection = new vscode.Selection(pos, pos)
      editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter)
    }),
    vscode.commands.registerCommand('railsforge.scanWorkspaceArchitecture', () => {
      patternDiagnostics.scanWorkspace()
      vscode.window.showInformationMessage('🔍 RailsForge: Live workspace architecture & pattern scan completed.')
    }),
    vscode.commands.registerCommand('railsforge.refactorSelection', () => refactoringMenu.promptRefactoring()),
    vscode.commands.registerCommand('railsforge.goToModel', () => navigateCompanion(mvc, 'model')),
    vscode.commands.registerCommand('railsforge.goToController', () => navigateCompanion(mvc, 'controller')),
    vscode.commands.registerCommand('railsforge.goToSpec', () => navigateCompanion(mvc, 'spec')),
    vscode.commands.registerCommand('railsforge.searchRoutes', async () => {
      const allRoutes = routes.getAllRoutes()
      const items = allRoutes.map(r => ({
        label: `${r.verb} ${r.uriPattern}`,
        description: `${r.controller}#${r.action} (${r.helperName || ''})`,
      }))
      const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Search Rails routes...' })
      if (selected) {
        vscode.window.showInformationMessage(`Selected Route: ${selected.label} => ${selected.description}`)
      }
    }),
    vscode.commands.registerCommand('railsforge.rubocopAutocorrect', async (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri
      if (targetUri) {
        const success = await rubocop.autoCorrectFile(targetUri)
        if (success) {
          vscode.window.showInformationMessage('✓ RuboCop autocorrect completed.')
        }
      }
    }),
    vscode.commands.registerCommand('railsforge.runBrakeman', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!root) {return}
      const report = await brakeman.runScan(root)
      const formatted = brakeman.formatMarkdownReport(report)
      const doc = await vscode.workspace.openTextDocument({ content: formatted, language: 'markdown' })
      await vscode.window.showTextDocument(doc)
    }),
    vscode.commands.registerCommand('railsforge.runBundleAudit', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!root) {return}
      const report = await bundlerAuditScanner.runAudit(root)
      const formatted = bundlerAuditScanner.formatReport(report)
      const doc = await vscode.workspace.openTextDocument({ content: formatted, language: 'markdown' })
      await vscode.window.showTextDocument(doc)
    }),
    vscode.commands.registerCommand('railsforge.analyzeMigration', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {return}
      const code = editor.document.getText()
      const dangers = strongMigrationsAnalyzer.analyzeMigration(code)
      if (dangers.length === 0) {
        vscode.window.showInformationMessage('✓ Zero-downtime migration check passed! No dangerous operations found.')
        return
      }
      const summary = dangers.map(d => `[${d.severity.toUpperCase()}] Line ${d.line}: ${d.title}\nFix: ${d.recommendation}`).join('\n\n')
      const doc = await vscode.workspace.openTextDocument({ content: `# RailsForge Strong Migrations Report\n\n${summary}`, language: 'markdown' })
      await vscode.window.showTextDocument(doc)
    }),
    vscode.commands.registerCommand('railsforge.extractService', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {return}
      const selection = editor.document.getText(editor.selection)
      if (!selection) {
        vscode.window.showWarningMessage('Please select code to extract into a Service Object.')
        return
      }
      const name = await vscode.window.showInputBox({ prompt: 'Enter Service Object Name (e.g. ProcessOrder)' })
      if (!name) {return}
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
      const freeVars = serviceExtractor.detectFreeVariables(selection)
      const res = serviceExtractor.extractService(name, selection, freeVars, root)

      // Single WorkspaceEdit so VS Code shows one multi-file diff preview: only the
      // selected range in the original file changes, plus the new service file — nothing
      // else in the controller/model is touched (unless the developer opts into replacing
      // other exact duplicates of this same selection, below).
      const edit = new vscode.WorkspaceEdit()
      const serviceUri = vscode.Uri.file(res.serviceFilePath)
      edit.createFile(serviceUri, { ignoreIfExists: true })
      edit.insert(serviceUri, new vscode.Position(0, 0), res.serviceCode)
      edit.replace(editor.document.uri, editor.selection, res.replacementCall)

      await maybeReplaceDuplicateCallSites(edit, selection, res.replacementCall, editor.document.uri)
      maybeGenerateSpec(edit, res.serviceFilePath, root, 'service', res.replacementCall.split('.')[0])

      const applied = await vscode.workspace.applyEdit(edit)
      if (!applied) {
        vscode.window.showErrorMessage('RailsForge: Failed to apply Extract Service edit.')
        return
      }
      const doc = await vscode.workspace.openTextDocument(res.serviceFilePath)
      await vscode.window.showTextDocument(doc)
    }),
    vscode.commands.registerCommand('railsforge.extractQuery', async () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {return}
      const selection = editor.document.getText(editor.selection)
      if (!selection) {
        vscode.window.showWarningMessage('Please select an ActiveRecord query to extract.')
        return
      }
      const name = await vscode.window.showInputBox({ prompt: 'Enter Query Object Name (e.g. ActiveUsers)' })
      if (!name) {return}
      const model = await vscode.window.showInputBox({ prompt: 'Enter Base Model Name (e.g. User)' })
      if (!model) {return}
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''
      const res = queryExtractor.extractQuery(name, model, selection, [], root)

      const edit = new vscode.WorkspaceEdit()
      const queryUri = vscode.Uri.file(res.queryFilePath)
      edit.createFile(queryUri, { ignoreIfExists: true })
      edit.insert(queryUri, new vscode.Position(0, 0), res.queryCode)
      edit.replace(editor.document.uri, editor.selection, res.replacementCall)

      await maybeReplaceDuplicateCallSites(edit, selection, res.replacementCall, editor.document.uri)
      maybeGenerateSpec(edit, res.queryFilePath, root, 'query', res.replacementCall.split('.')[0])

      const applied = await vscode.workspace.applyEdit(edit)
      if (!applied) {
        vscode.window.showErrorMessage('RailsForge: Failed to apply Extract Query edit.')
        return
      }
      const doc = await vscode.workspace.openTextDocument(res.queryFilePath)
      await vscode.window.showTextDocument(doc)
    }),
    vscode.commands.registerCommand('railsforge.goToPolicy', () => {
      const editor = vscode.window.activeTextEditor
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!editor || !root) {return}
      const model = path.basename(editor.document.fileName, '.rb').replace(/(_controller|_spec)$/, '')
      const policyPath = policyNavigator.resolvePolicyPath(model, root)
      if (policyPath) {
        void vscode.workspace.openTextDocument(policyPath).then(doc => vscode.window.showTextDocument(doc))
      } else {
        vscode.window.showWarningMessage(`No policy found for ${model}`)
      }
    }),
    vscode.commands.registerCommand('railsforge.goToComponent', async () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!root) {return}
      const name = await vscode.window.showInputBox({ prompt: 'Enter Component Name (e.g. UserCardComponent)' })
      if (!name) {return}
      const comp = viewComponentResolver.resolveComponent(name, root)
      if (comp) {
        const doc = await vscode.workspace.openTextDocument(comp.classFile)
        await vscode.window.showTextDocument(doc)
      } else {
        vscode.window.showWarningMessage(`Component ${name} not found in app/components/`)
      }
    }),
    vscode.commands.registerCommand('railsforge.runSingleTest', (uri: vscode.Uri, line: number) => {
      const term = vscode.window.createTerminal('RailsForge Test')
      term.show()
      const isRSpec = uri.fsPath.includes('/spec/')
      const cmd = isRSpec
        ? `bundle exec rspec "${uri.fsPath}:${line}"`
        : `bundle exec rails test "${uri.fsPath}:${line}"`
      term.sendText(cmd)
    }),
    vscode.commands.registerCommand('railsforge.debugSingleTest', (uri: vscode.Uri, line: number) => {
      const term = vscode.window.createTerminal('RailsForge rdbg')
      term.show()
      const isRSpec = uri.fsPath.includes('/spec/')
      const cmd = isRSpec
        ? `rdbg -n -c -- bundle exec rspec "${uri.fsPath}:${line}"`
        : `rdbg -n -c -- bundle exec rails test "${uri.fsPath}:${line}"`
      term.sendText(cmd)
    }),
  )
}

function navigateCompanion(mvc: MVCNavigator, targetType: string): void {
  const editor = vscode.window.activeTextEditor
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (!editor || !root) {return}

  const paths = mvc.getCompanionPaths(editor.document.fileName, root)
  const targetPath = paths[targetType]
  if (targetPath && fs.existsSync(targetPath)) {
    void vscode.workspace.openTextDocument(targetPath).then(doc => vscode.window.showTextDocument(doc))
  } else {
    vscode.window.showWarningMessage(`Companion ${targetType} not found at ${targetPath}`)
  }
}

export function deactivate(): void {
  // Clean up
}
