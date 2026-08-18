/**
 * RailsChatParticipant - Native VS Code and Cursor Chat Participant for @rails
 */

import * as vscode from 'vscode'
import { RailsAgent } from '../agent/RailsAgent'
import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'
import { Logger } from '../util/Logger'

export class RailsChatParticipant {
  private static instance: RailsChatParticipant | undefined
  private participant?: vscode.ChatParticipant

  static getInstance(): RailsChatParticipant {
    return (RailsChatParticipant.instance ??= new RailsChatParticipant())
  }

  register(
    context: vscode.ExtensionContext,
    agent: RailsAgent,
    schemaIndexer: SchemaIndexer,
    routesIndexer: RoutesIndexer,
  ): void {
    if (typeof vscode.chat?.createChatParticipant !== 'function') {
      Logger.debug('vscode.chat.createChatParticipant is unavailable in this host environment.')
      return
    }

    try {
      this.participant = vscode.chat.createChatParticipant(
        'railsforge.agent',
        async (request, _chatContext, stream) => {
          Logger.info(`[@rails] Chat prompt received: "${request.prompt}" (command: /${request.command ?? 'default'})`)
          await this.handleRequest(request, stream, agent, schemaIndexer, routesIndexer)
        },
      )
      context.subscriptions.push(this.participant)
      Logger.info('Registered @rails chat participant.')
    } catch (err) {
      Logger.warn('Failed to register @rails chat participant:', err)
    }
  }

  private async handleRequest(
    request: vscode.ChatRequest,
    stream: vscode.ChatResponseStream,
    agent: RailsAgent,
    schemaIndexer: SchemaIndexer,
    _routesIndexer: RoutesIndexer,
  ): Promise<void> {
    const command = request.command
    const prompt = request.prompt.trim()
    const editor = vscode.window.activeTextEditor
    const fullText = editor?.document.getText()
    const selection = editor?.document.getText(editor.selection)

    stream.progress('RailsForge AI is analyzing...')

    if (command === 'optimize') {
      stream.markdown('### Analyzing Query Performance & N+1 Risks...\n')
      const tables = schemaIndexer.getAllTables()
      stream.markdown(`- Active Tables Indexed: **${tables.length}**\n`)
      stream.markdown('- Best practice: Use `.includes(:association)` to prevent N+1 queries.\n')
    } else if (command === 'migrate') {
      stream.markdown('### Generating Safe ActiveRecord Migration...\n')
    }

    const result = await agent.run(prompt, {
      fileContent: fullText,
      selection,
      fileName: editor?.document.fileName,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    })

    if (result.success) {
      Logger.info('[@rails] Response generated successfully.')
    } else {
      Logger.warn(`[@rails] Response generation failed: ${result.response}`)
    }

    stream.markdown(result.response)
  }
}
