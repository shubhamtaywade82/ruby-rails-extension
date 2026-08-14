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
import { FormObjectExtractor } from './refactor/FormObjectExtractor'
import { ValueObjectExtractor } from './refactor/ValueObjectExtractor'
import { RefactoringMenuProvider } from './refactor/RefactoringMenuProvider'
import { RailsAgent } from './agent/RailsAgent'
import { RailsChatParticipant } from './chat/RailsChatParticipant'

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
  )

  // 1. Initial Indexing
  if (workspaceRoot) {
    loadSchema(workspaceRoot, schemaIndexer)
    loadRoutes(workspaceRoot, routesIndexer)
    loadStimulusControllers(workspaceRoot, stimulusIndexer)
    factoryBotResolver.indexFactories(workspaceRoot)
    watchProjectFiles(context, workspaceRoot, schemaIndexer, routesIndexer, migrationDiagnostics)
  }

  // 2. Activity Bar Tree Views
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
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, principleLinter),
    vscode.languages.registerCompletionItemProvider(
      ['erb', 'html', 'ruby'],
      new StimulusCompletionProvider(stimulusIndexer),
      '"',
      '\'',
      '=',
    ),
    vscode.languages.registerCodeLensProvider({ language: 'ruby', scheme: 'file' }, new TestCodeLensProvider()),
    testExplorer.getController(),
    migrationDiagnostics,
    deprecationLinter,
    principleLinter,
    rubocopProvider,
  )

  // 4. Document Watchers for Test Explorer, Migrations, Principles, Deprecations
  vscode.workspace.onDidOpenTextDocument(doc => {
    testExplorer.discoverTestsInDocument(doc)
    migrationDiagnostics.updateDiagnostics(doc)
    deprecationLinter.updateDiagnostics(doc, env)
    principleLinter.updateDiagnostics(doc)
  }, null, context.subscriptions)

  vscode.workspace.onDidChangeTextDocument(e => {
    migrationDiagnostics.updateDiagnostics(e.document)
    deprecationLinter.updateDiagnostics(e.document, env)
    principleLinter.updateDiagnostics(e.document)
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
    serviceExtractor,
    queryExtractor,
  )

  // 5. Register Chat Participant
  RailsChatParticipant.getInstance().register(context, agent, schemaIndexer, routesIndexer)

  // 6. Status Bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBar.text = '$(ruby) RailsForge'
  statusBar.tooltip = 'RailsForge: Active'
  statusBar.show()
  context.subscriptions.push(statusBar)
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
  serviceExtractor: ServiceExtractor,
  queryExtractor: QueryExtractor,
): void {
  context.subscriptions.push(
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
