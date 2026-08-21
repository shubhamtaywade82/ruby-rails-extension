# Webview UI Toolkit & Styling Guide

Build native-looking VS Code Webviews using `@vscode/webview-ui-toolkit`, CSS variables, and modern secure communication patterns.

---

## 1. Webview UI Toolkit Components

The `@vscode/webview-ui-toolkit` provides web components that automatically match the active VS Code theme (Dark, Light, High Contrast).

### Installation
```bash
pnpm add @vscode/webview-ui-toolkit @vscode/codicons
```

### Registration in Webview Entry (`src/webview/main.ts`)
```typescript
import {
  provideVSCodeDesignSystem,
  vsCodeButton,
  vsCodeTextField,
  vsCodeDropdown,
  vsCodeOption,
  vsCodeDataGrid,
  vsCodeDataGridCell,
  vsCodeDataGridRow,
  vsCodeBadge,
  vsCodeProgressRing,
} from '@vscode/webview-ui-toolkit';

provideVSCodeDesignSystem().register(
  vsCodeButton(),
  vsCodeTextField(),
  vsCodeDropdown(),
  vsCodeOption(),
  vsCodeDataGrid(),
  vsCodeDataGridCell(),
  vsCodeDataGridRow(),
  vsCodeBadge(),
  vsCodeProgressRing(),
);
```

### HTML Template Usage
```html
<vscode-button appearance="primary" id="btn-run">Run Analysis</vscode-button>
<vscode-text-field placeholder="Filter routes..." id="route-filter"></vscode-text-field>
<vscode-badge>3 Issues</vscode-badge>
<vscode-dropdown id="env-select">
  <vscode-option value="development">Development</vscode-option>
  <vscode-option value="production">Production</vscode-option>
</vscode-dropdown>
```

---

## 2. VS Code Theme Colors & CSS Variables

Always use built-in CSS variables instead of hardcoded hex colors:

```css
body {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  padding: 16px;
}

.card {
  background: var(--vscode-sideBar-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 4px;
  padding: 12px;
}

.error-text {
  color: var(--vscode-errorForeground);
}

.success-badge {
  background-color: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.interactive-item:hover {
  background-color: var(--vscode-list-hoverBackground);
}
```

---

## 3. Strict Content Security Policy (CSP)

Protect webviews against XSS and remote code injection by generating a per-session `nonce`:

```typescript
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = getNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'));
  const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'codicon.css'));

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      img-src ${webview.cspSource} https: data:;
      style-src ${webview.cspSource} 'unsafe-inline';
      font-src ${webview.cspSource};
      script-src 'nonce-${nonce}';
    ">
    <link href="${styleUri}" rel="stylesheet" />
    <link href="${codiconsUri}" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
```

---

## 4. Typed Two-Way IPC Messaging

### Message Contracts (`src/common/messages.ts`)
```typescript
export type ExtensionToWebviewMsg =
  | { type: 'setRoutes'; payload: { path: string; controller: string; action: string }[] }
  | { type: 'loading'; payload: boolean };

export type WebviewToExtensionMsg =
  | { command: 'openFile'; filePath: string; line: number }
  | { command: 'refreshRoutes' };
```

### Extension Host Side (`src/panels/RouteViewerPanel.ts`)
```typescript
panel.webview.onDidReceiveMessage((msg: WebviewToExtensionMsg) => {
  switch (msg.command) {
    case 'openFile':
      void vscode.workspace.openTextDocument(msg.filePath).then(doc => {
        void vscode.window.showTextDocument(doc, {
          selection: new vscode.Range(msg.line, 0, msg.line, 0),
        });
      });
      break;
    case 'refreshRoutes':
      void loadRoutes().then(routes => {
        void panel.webview.postMessage({ type: 'setRoutes', payload: routes });
      });
      break;
  }
});
```
