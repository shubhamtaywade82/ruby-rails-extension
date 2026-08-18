/**
 * RailsChatViewProvider - Dedicated Sidebar Webview Chat Interface for RailsForge
 * Provides interactive chat, streaming responses, schema grounding, and 1-click code insertion.
 */

import * as vscode from 'vscode'
import { RailsAgent } from '../agent/RailsAgent'
import { SchemaIndexer } from '../rails/SchemaIndexer'
import { RoutesIndexer } from '../rails/RoutesIndexer'
import { Logger } from '../util/Logger'

interface WebviewMessage {
  type: string
  prompt?: string
  code?: string
  action?: string
  mode?: 'replace' | 'insert' | 'create'
  fileName?: string
  includeContext?: boolean
}

export class RailsChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'railsforge.chatView'
  private view?: vscode.WebviewView

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly agent: RailsAgent,
    private readonly schemaIndexer: SchemaIndexer,
    private readonly routesIndexer: RoutesIndexer,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    }
    webviewView.webview.html = this.getHtml()
    webviewView.webview.onDidReceiveMessage((msg: WebviewMessage) => this.handleMessage(msg))

    void this.postStatus()
  }

  public async sendExternalPrompt(prompt: string): Promise<void> {
    await vscode.commands.executeCommand('railsforge.chatView.focus')
    await this.processPrompt(prompt, true)
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'webviewReady':
      case 'refreshStatus':
        await this.postStatus()
        break
      case 'sendPrompt':
        if (message.prompt) {
          await this.processPrompt(message.prompt, Boolean(message.includeContext))
        }
        break
      case 'applyCode':
        if (message.code) {
          await this.applyCode(message.code, message.mode ?? 'replace', message.fileName)
        }
        break
    }
  }

  private async postStatus(): Promise<void> {
    const isOnline = await this.agent.healthCheck()
    const editor = vscode.window.activeTextEditor
    const currentFile = editor ? vscode.workspace.asRelativePath(editor.document.uri) : 'No file open'

    void this.view?.webview.postMessage({
      type: 'statusUpdate',
      isOnline,
      currentFile,
      tablesCount: this.schemaIndexer.getAllTables().length,
      routesCount: this.routesIndexer.getAllRoutes().length,
    })
  }

  private async processPrompt(prompt: string, includeContext: boolean): Promise<void> {
    const editor = vscode.window.activeTextEditor
    let activeCode = ''
    let fileName = ''
    let selection = ''

    if (includeContext && editor) {
      activeCode = editor.document.getText()
      fileName = editor.document.fileName
      selection = editor.document.getText(editor.selection)
    }

    void this.view?.webview.postMessage({
      type: 'appendMessage',
      sender: 'user',
      text: prompt,
    })

    void this.view?.webview.postMessage({ type: 'startStreaming' })

    Logger.info(`[Sidebar Chat] Processing prompt: "${prompt}"`)

    const result = await this.agent.run(prompt, {
      fileContent: activeCode,
      fileName,
      selection,
      workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    })

    if (result.success) {
      Logger.info('[Sidebar Chat] Response received successfully.')
    } else {
      Logger.warn(`[Sidebar Chat] Response error: ${result.response}`)
    }

    void this.view?.webview.postMessage({
      type: 'appendMessage',
      sender: 'assistant',
      text: result.response,
      success: result.success,
    })
    void this.view?.webview.postMessage({ type: 'stopStreaming' })
  }

  private async applyCode(code: string, mode: 'replace' | 'insert' | 'create', fileName?: string): Promise<void> {
    if (mode === 'create') {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!root) {return}
      const targetName = fileName || await vscode.window.showInputBox({ prompt: 'Enter relative file path (e.g. app/services/my_service.rb)' })
      if (!targetName) {return}
      const fullPath = vscode.Uri.file(`${root}/${targetName}`)
      await vscode.workspace.fs.writeFile(fullPath, Buffer.from(code, 'utf8'))
      const doc = await vscode.workspace.openTextDocument(fullPath)
      await vscode.window.showTextDocument(doc)
      vscode.window.showInformationMessage(`Created ${targetName}`)
      return
    }

    const editor = vscode.window.activeTextEditor
    if (!editor) {
      vscode.window.showWarningMessage('No active editor to insert code.')
      return
    }

    await editor.edit(editBuilder => {
      if (mode === 'replace' && !editor.selection.isEmpty) {
        editBuilder.replace(editor.selection, code)
      } else {
        editBuilder.insert(editor.selection.active, code)
      }
    })
    vscode.window.showInformationMessage('✓ Applied code to active editor.')
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RailsForge AI Chat</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --card-bg: var(--vscode-sideBar-background);
      --accent: #e11d48;
      --accent-hover: #be123c;
      --border: var(--vscode-widget-border, #334155);
      --code-bg: var(--vscode-textCodeBlock-background, #0f172a);
      --input-bg: var(--vscode-input-background);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, system-ui, sans-serif);
      font-size: 13px;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .header {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--card-bg);
    }
    .title-group { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .status-pill {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }
    .status-pill.offline {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .quick-actions {
      padding: 8px 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
    }
    .pill-btn {
      background: var(--card-bg);
      color: var(--fg);
      border: 1px solid var(--border);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .pill-btn:hover { border-color: var(--accent); color: var(--accent); }
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .message {
      padding: 10px 12px;
      border-radius: 8px;
      line-height: 1.45;
      max-width: 95%;
      word-break: break-word;
    }
    .message.user {
      align-self: flex-end;
      background: var(--accent);
      color: white;
    }
    .message.assistant {
      align-self: flex-start;
      background: var(--card-bg);
      border: 1px solid var(--border);
    }
    .message pre {
      background: var(--code-bg);
      padding: 8px;
      border-radius: 6px;
      margin: 8px 0;
      overflow-x: auto;
      position: relative;
    }
    .code-actions {
      margin-top: 6px;
      display: flex;
      gap: 6px;
    }
    .code-actions button {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--fg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
    }
    .input-container {
      padding: 10px 12px;
      border-top: 1px solid var(--border);
      background: var(--card-bg);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .context-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #94a3b8;
    }
    .input-box {
      width: 100%;
      min-height: 55px;
      max-height: 120px;
      background: var(--input-bg);
      color: var(--fg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 8px;
      resize: vertical;
      font-family: inherit;
      font-size: 12px;
    }
    .input-box:focus { outline: none; border-color: var(--accent); }
    .send-btn {
      align-self: flex-end;
      background: var(--accent);
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 500;
      cursor: pointer;
    }
    .send-btn:hover { background: var(--accent-hover); }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <span>💎 RailsForge AI</span>
    </div>
    <div id="statusPill" class="status-pill">
      <span class="status-dot"></span>
      <span id="statusText">Checking...</span>
    </div>
  </div>

  <div class="quick-actions">
    <button class="pill-btn" onclick="sendAction('/service')">⚡ Service Object</button>
    <button class="pill-btn" onclick="sendAction('/form')">📝 Form Object</button>
    <button class="pill-btn" onclick="sendAction('/optimize')">🚀 Optimize N+1</button>
    <button class="pill-btn" onclick="sendAction('/spec')">🧪 Generate Spec</button>
    <button class="pill-btn" onclick="sendAction('/migrate')">🛡️ Safe Migration</button>
    <button class="pill-btn" onclick="sendAction('/explain')">🔍 Explain Code</button>
  </div>

  <div class="messages" id="messagesContainer">
    <div class="message assistant">
      👋 Welcome to <strong>RailsForge AI</strong>. I am your grounded Rails assistant. How can I help refactor, optimize, or scaffold your code today?
    </div>
  </div>

  <div class="input-container">
    <div class="context-row">
      <label><input type="checkbox" id="includeContext" checked> Include active file context</label>
      <span id="activeFileLabel">Active File</span>
    </div>
    <textarea id="promptInput" class="input-box" placeholder="Ask @rails anything... (Enter to send, Shift+Enter for newline)"></textarea>
    <button class="send-btn" id="sendBtn" onclick="handleSend()">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const messagesContainer = document.getElementById('messagesContainer');
    const promptInput = document.getElementById('promptInput');
    const includeContext = document.getElementById('includeContext');
    const statusPill = document.getElementById('statusPill');
    const statusText = document.getElementById('statusText');
    const activeFileLabel = document.getElementById('activeFileLabel');

    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.type) {
        case 'statusUpdate':
          statusPill.className = 'status-pill ' + (msg.isOnline ? '' : 'offline');
          statusText.textContent = msg.isOnline ? 'Ollama Online' : 'Ollama Offline';
          activeFileLabel.textContent = msg.currentFile;
          break;
        case 'appendMessage':
          appendMessage(msg.sender, msg.text);
          break;
      }
    });

    function sendAction(cmd) {
      promptInput.value = cmd + ' ';
      promptInput.focus();
    }

    function handleSend() {
      const text = promptInput.value.trim();
      if (!text) return;
      vscode.postMessage({
        type: 'sendPrompt',
        prompt: text,
        includeContext: includeContext.checked
      });
      promptInput.value = '';
    }

    promptInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    function appendMessage(sender, text) {
      const div = document.createElement('div');
      div.className = 'message ' + sender;
      
      const pattern = new RegExp('\\x60\\x60\\x60([a-zA-Z0-9_-]*)\\\\n([\\\\s\\\\S]*?)\\x60\\x60\\x60', 'g');
      const formatted = text.replace(pattern, function(match, lang, code) {
        const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const encoded = encodeURIComponent(code);
        return '<pre><code>' + escaped + '</code><div class="code-actions">' +
          '<button onclick="copyCode(\\'' + encoded + '\\')">📋 Copy</button>' +
          '<button onclick="insertCode(\\'' + encoded + '\\')">📥 Insert</button>' +
        '</div></pre>';
      }).replace(/\\n/g, '<br/>');

      div.innerHTML = formatted;
      messagesContainer.appendChild(div);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function copyCode(encoded) {
      navigator.clipboard.writeText(decodeURIComponent(encoded));
    }

    function insertCode(encoded) {
      vscode.postMessage({
        type: 'applyCode',
        code: decodeURIComponent(encoded),
        mode: 'insert'
      });
    }

    vscode.postMessage({ type: 'webviewReady' });
  </script>
</body>
</html>`
  }
}
