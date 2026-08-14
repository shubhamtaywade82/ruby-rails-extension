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
import { RailsAgent } from './agent/RailsAgent'
import { RailsChatParticipant } from './chat/RailsChatParticipant'

export function activate(context: vscode.ExtensionContext): void {
  const schemaIndexer = new SchemaIndexer()
  const routesIndexer = new RoutesIndexer()
  const mvcNavigator = new MVCNavigator()
  const rubocopProvider = new RuboCopProvider()
  const brakemanProvider = new BrakemanProvider()
  const serviceExtractor = new ServiceExtractor()
  const queryExtractor = new QueryExtractor()

  const config = vscode.workspace.getConfiguration('railsForge')
  const agent = new RailsAgent(schemaIndexer, routesIndexer, {
    ollamaHost: config.get<string>('ollama.host', 'http://localhost:11434'),
    model: config.get<string>('ollama.model', 'qwen2.5-coder:14b'),
  })

  // 1. Initial Indexing
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
  if (workspaceRoot) {
    loadSchema(workspaceRoot, schemaIndexer)
    loadRoutes(workspaceRoot, routesIndexer)
    watchProjectFiles(context, workspaceRoot, schemaIndexer, routesIndexer)
  }

  // 2. Register Providers
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'ruby', scheme: 'file' }, new SchemaHoverProvider(schemaIndexer)),
    vscode.languages.registerCodeActionsProvider({ language: 'ruby', scheme: 'file' }, rubocopProvider),
  )

  // 3. Register Commands
  registerCommands(context, mvcNavigator, routesIndexer, rubocopProvider, brakemanProvider, serviceExtractor, queryExtractor)

  // 4. Register Chat Participant
  RailsChatParticipant.getInstance().register(context, agent, schemaIndexer, routesIndexer)

  // 5. Status Bar
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)
  statusBar.text = '$(ruby) RailsForge'
  statusBar.tooltip = 'RailsForge: Active'
  statusBar.show()
  context.subscriptions.push(statusBar)
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
): void {
  const schemaWatcher = vscode.workspace.createFileSystemWatcher('**/db/schema.rb')
  schemaWatcher.onDidChange(() => loadSchema(root, schemaIndexer))
  context.subscriptions.push(schemaWatcher)

  const routesWatcher = vscode.workspace.createFileSystemWatcher('**/config/routes.rb')
  routesWatcher.onDidChange(() => loadRoutes(root, routesIndexer))
  context.subscriptions.push(routesWatcher)
}

function registerCommands(
  context: vscode.ExtensionContext,
  mvc: MVCNavigator,
  routes: RoutesIndexer,
  rubocop: RuboCopProvider,
  brakeman: BrakemanProvider,
  serviceExtractor: ServiceExtractor,
  queryExtractor: QueryExtractor,
): void {
  context.subscriptions.push(
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
