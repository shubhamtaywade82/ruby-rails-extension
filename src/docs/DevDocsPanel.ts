/**
 * DevDocsPanel - `RailsForge: Open DevDocs` opens a single reusable webview panel
 * embedding devdocs.io (offline-capable, unified Ruby/Rails/RSpec/JS docs) in an
 * iframe. devdocs.io sets no X-Frame-Options / frame-ancestors, so embedding is
 * allowed; it also reads a `#q=<term>` hash fragment on load to pre-run a search,
 * which is what both the initial navigation and every subsequent
 * `railsforge.openDevDocs` invocation use.
 *
 * Message passing: the extension posts `{ type: 'search', term }` to the webview;
 * the webview's own script (not devdocs.io's, which runs in the iframe's separate
 * browsing context) updates the iframe's `src` in response. This lets repeated
 * invocations of the command re-target an already-open panel without recreating
 * the webview or losing DevDocs' own client-side state.
 */

import * as vscode from 'vscode'

export class DevDocsPanel {
  public static currentPanel: DevDocsPanel | undefined

  private readonly panel: vscode.WebviewPanel
  private readonly disposables: vscode.Disposable[] = []

  static createOrShow(devDocsBaseUrl: string, openBesideActiveEditor: boolean, term?: string): void {
    const column = openBesideActiveEditor
      ? vscode.ViewColumn.Beside
      : vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One

    if (DevDocsPanel.currentPanel) {
      DevDocsPanel.currentPanel.panel.reveal(column)
      if (term) {DevDocsPanel.currentPanel.search(term)}
      return
    }

    const panel = vscode.window.createWebviewPanel(
      'railsforge.devdocs',
      'DevDocs',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    )
    DevDocsPanel.currentPanel = new DevDocsPanel(panel, devDocsBaseUrl, term)
  }

  private constructor(panel: vscode.WebviewPanel, private readonly baseUrl: string, initialTerm?: string) {
    this.panel = panel
    this.panel.webview.html = this.getHtml(initialTerm)
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables)
  }

  public search(term: string): void {
    void this.panel.webview.postMessage({ type: 'search', term })
  }

  private dispose(): void {
    DevDocsPanel.currentPanel = undefined
    while (this.disposables.length) {
      this.disposables.pop()?.dispose()
    }
    this.panel.dispose()
  }

  private getHtml(initialTerm?: string): string {
    const nonce = getNonce()
    const frameOrigin = new URL(this.baseUrl).origin
    const initialSrc = initialTerm ? `${this.baseUrl}/#q=${encodeURIComponent(initialTerm)}` : this.baseUrl

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${frameOrigin}; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DevDocs</title>
  <style>
    html, body { height: 100%; margin: 0; padding: 0; }
    iframe { border: none; width: 100%; height: 100%; display: block; }
  </style>
</head>
<body>
  <iframe id="devdocs-frame" src="${escapeHtmlAttribute(initialSrc)}" title="DevDocs" allow="clipboard-write"></iframe>
  <script nonce="${nonce}">
    const baseUrl = ${JSON.stringify(this.baseUrl)};
    const frame = document.getElementById('devdocs-frame');
    window.addEventListener('message', event => {
      const message = event.data;
      if (message && message.type === 'search' && typeof message.term === 'string') {
        frame.src = message.term ? baseUrl + '/#q=' + encodeURIComponent(message.term) : baseUrl;
      }
    });
  </script>
</body>
</html>`
  }
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}
