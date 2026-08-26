---
name: vscode-extension-builder-lawvable
description: Comprehensive super-skill for building VS Code extensions, Language Server Protocol (LSP) servers, Webview UI Toolkit interfaces, Custom File Editors, Model Context Protocol (MCP) servers, and Cursor Rules (.cursor/rules/*.mdc). Use when developing or refactoring VS Code/Cursor extensions, integrating AI agents, implementing LSP diagnostics/completions/Tree-sitter ASTs, designing native webviews, or authoring .mdc rules.
metadata:
  author: Antoine Louis (Lawvable) & AI Engineering
  license: AGPL-3.0
  version: 2026.02.21
---

# VS Code & Cursor Extension Master Skill

A consolidated, production-grade guide for developing VS Code extensions, Language Servers (LSP), Webview UI Toolkit frontends, Custom File Editors, Model Context Protocol (MCP) servers, and Cursor Rules (`.mdc`).

---

## Architecture Overview

VS Code and Cursor extensions operate across several interconnected execution environments:

1. **Extension Host (Node.js)**: Lifecycle management, workspace file access, commands, configuration, and VS Code API hooks.
2. **Language Server (LSP / Tree-sitter)**: Off-thread syntax analysis, incremental AST parsing, diagnostics, completions, and code actions.
3. **Webviews (Browser Sandbox)**: Isolated UI panels rendered with React, Vue, or `@vscode/webview-ui-toolkit`.
4. **Embedded MCP Server**: Standardized JSON-RPC/stdio server exposing workspace tools and AST resources to AI assistants.
5. **Cursor Rules / Agent Configs**: Domain-specific `.cursor/rules/*.mdc` rules instructing AI models on codebase conventions.

---

## Feature Matrix & Reference Guides

| Domain | Key Technologies | Deep-Dive Reference |
| :--- | :--- | :--- |
| **Extension Core & Commands** | `vscode.commands`, `context.subscriptions` | [api-reference.md](references/api-reference.md) |
| **Language Server Protocol (LSP)** | `vscode-languageserver`, `tree-sitter` | [lsp-and-treesitter-patterns.md](references/lsp-and-treesitter-patterns.md) |
| **Webview UI & Styling** | `@vscode/webview-ui-toolkit`, Codicons, CSP | [webview-toolkit-and-styling.md](references/webview-toolkit-and-styling.md) |
| **React/Vue Webviews** | Vite, React 19, PostMessage IPC | [webview-patterns.md](references/webview-patterns.md) |
| **Tree Views & Sidebars** | `vscode.TreeDataProvider`, TreeItem | [tree-view-patterns.md](references/tree-view-patterns.md) |
| **Custom File Editors** | `CustomTextEditorProvider`, undo/redo sync | [custom-editor-patterns.md](references/custom-editor-patterns.md) |
| **Model Context Protocol (MCP)** | `@modelcontextprotocol/sdk`, stdio | [mcp-server-architecture.md](references/mcp-server-architecture.md) |
| **Cursor Rules & MDC** | `.cursor/rules/*.mdc`, globs, prompt injection | [cursor-rules-and-mdc.md](references/cursor-rules-and-mdc.md) |
| **AI Agent File-Bridge** | Bidirectional JSON file IPC | [ai-integration.md](references/ai-integration.md) |
| **Packaging & Distribution** | `vsce package`, `.vscodeignore` | [build-config.md](references/build-config.md) |

---

## 1. Quick Start Workflow

1. **Scaffold / Select Template**: Use the appropriate template from `assets/` or reference documentation.
2. **Configure `package.json`**: Declare `contributes` (commands, views, configuration, menus).
3. **Implement Core Providers**:
   - Commands & Status Bars: `src/extension.ts`
   - Language Features / LSP: `src/server.ts` or Tree-sitter handlers
   - Webviews: `src/panels/` using `@vscode/webview-ui-toolkit`
   - MCP Server: `src/mcp/server.ts`
4. **Compile & Package**:
   ```bash
   pnpm run compile
   pnpm test
   vsce package --no-dependencies -o my-extension.vsix
   ```

---

## 2. Best Practices & Guardrails

- **Non-blocking Startup**: Never perform synchronous heavy disk I/O on extension activation. Use background workers or SQLite indexing.
- **Resource Cleanup**: Always push every disposable (`vscode.Disposable`, event listener, file watcher) to `context.subscriptions`.
- **Theme-Aware Styling**: Always bind CSS colors to `var(--vscode-*)` design tokens.
- **Strict Webview Security**: Always enforce nonced Content Security Policy (`script-src 'nonce-...'`).
- **Idempotent Settings**: When applying workspace configuration updates (e.g. `files.watcherExclude`), merge without erasing user custom keys.
