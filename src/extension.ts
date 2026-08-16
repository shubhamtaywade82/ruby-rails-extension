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
import { FormObjectExtractor } from './refactor/FormObjectExtractor'
import { ValueObjectExtractor } from './refactor/ValueObjectExtractor'
import { RefactoringMenuProvider } from './refactor/RefactoringMenuProvider'
import { RailsAgent } from './agent/RailsAgent'
import { RailsChatParticipant } from './chat/RailsChatParticipant'
import { RailsChatViewProvider } from './chat/RailsChatViewProvider'

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
  const agent = new RailsAgent(
    schemaIndexer,
    routesIndexer,
    {
      ollamaHost: config.get<string>('ollama.host', 'http://localhost:11434'),
      model: config.get<string>('ollama.model', 'qwen2.5-coder:14b'),
    },
    env,
    projectPatternIndexer,
  )

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

  // 2. Initial Indexing & Live Workspace Analysis
  if (workspaceRoot) {
    loadSchema(workspaceRoot, schemaIndexer)
    loadRoutes(workspaceRoot, routesIndexer)
    loadStimulusControllers(workspaceRoot, stimulusIndexer)
    factoryBotResolver.indexFactories(workspaceRoot)
    patternDiagnostics.scanWorkspace()
    void loadProjectPatterns(projectPatternIndexer, patternCodeLensProvider)
    watchProjectFiles(context, workspaceRoot, schemaIndexer, routesIndexer, migrationDiagnostics)
    watchPatternFiles(context, projectPatternIndexer, patternCodeLensProvider)
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
    vscode.languages.registerCompletionItemProvider(
      ['erb', 'html', 'ruby'],
      new StimulusCompletionProvider(stimulusIndexer),
      '"',
      '\'',
      '=',
    ),
    vscode.languages.registerCodeLensProvider({ language: 'ruby', scheme: 'file' }, new TestCodeLensProvider()),
    vscode.languages.registerCodeLensProvider({ language: 'ruby', scheme: 'file' }, patternCodeLensProvider),
    testExplorer.getController(),
    migrationDiagnostics,
    deprecationLinter,
    principleLinter,
    patternDiagnostics,
    rubocopProvider,
  )

  // 4. Live Document Watchers for Diagnostics & Design Pattern Suggestions
  vscode.workspace.onDidOpenTextDocument(doc => {
    testExplorer.discoverTestsInDocument(doc)
    migrationDiagnostics.updateDiagnostics(doc)
    deprecationLinter.updateDiagnostics(doc, env)
    principleLinter.updateDiagnostics(doc)
    patternDiagnostics.updateDiagnostics(doc)
  }, null, context.subscriptions)

  vscode.workspace.onDidChangeTextDocument(e => {
    migrationDiagnostics.updateDiagnostics(e.document)
    deprecationLinter.updateDiagnostics(e.document, env)
    principleLinter.updateDiagnostics(e.document)
    patternDiagnostics.updateDiagnostics(e.document)
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
): Promise<void> {
  const globs = [
    'app/services/**/*.rb',
    'app/queries/**/*.rb',
    'app/forms/**/*.rb',
    'app/policies/**/*.rb',
    'app/decorators/**/*.rb',
    'app/models/concerns/**/*.rb',
    'app/controllers/concerns/**/*.rb',
  ]

  for (const glob of globs) {
    const files = await vscode.workspace.findFiles(glob, '**/node_modules/**')
    for (const file of files) {
      const content = fs.readFileSync(file.fsPath, 'utf8')
      indexer.indexFile(file.fsPath, content)
    }
  }
  codeLensProvider.refresh()
}

function watchPatternFiles(
  context: vscode.ExtensionContext,
  indexer: ProjectPatternIndexer,
  codeLensProvider: PatternCodeLensProvider,
): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    '**/app/{services,queries,forms,policies,decorators,models/concerns,controllers/concerns}/**/*.rb',
  )
  const reindex = (uri: vscode.Uri): void => {
    if (fs.existsSync(uri.fsPath)) {
      indexer.indexFile(uri.fsPath, fs.readFileSync(uri.fsPath, 'utf8'))
    } else {
      indexer.removeFile(uri.fsPath)
    }
    codeLensProvider.refresh()
  }
  watcher.onDidChange(reindex)
  watcher.onDidCreate(reindex)
  watcher.onDidDelete(uri => {
    indexer.removeFile(uri.fsPath)
    codeLensProvider.refresh()
  })
  context.subscriptions.push(watcher)
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
): void {
  context.subscriptions.push(
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
      const res = serviceExtractor.extractService(name, selection, [], root)
      serviceExtractor.saveServiceFile(res.serviceFilePath, res.serviceCode)
      await editor.edit(edit => edit.replace(editor.selection, res.replacementCall))
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
      queryExtractor.saveQueryFile(res.queryFilePath, res.queryCode)
      await editor.edit(edit => edit.replace(editor.selection, res.replacementCall))
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
