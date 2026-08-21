# Language Server Protocol (LSP) & Tree-sitter Patterns

This guide covers building Language Server Protocol (LSP) servers, client integration, and Tree-sitter AST parsing in VS Code extensions.

---

## 1. LSP Architecture Overview

VS Code extensions communicate with language servers via JSON-RPC over stdio, IPC, or sockets.

```
┌─────────────────────────────────┐           JSON-RPC           ┌────────────────────────────────┐
│      VS Code Extension Host     │ ◄──────────────────────────► │     Language Server Process    │
│  (LanguageClient / Language API)│           (stdio)            │ (vscode-languageserver / Ruby) │
└─────────────────────────────────┘                              └────────────────────────────────┘
```

- **Client (`vscode-languageclient`)**: Runs inside the extension host, forwards document events to server, and registers UI providers.
- **Server (`vscode-languageserver`)**: Separate Node.js or native process that parses code, computes diagnostics, hover info, completions, and definition jumps.

---

## 2. Language Client Setup (`src/client.ts`)

```typescript
import * as path from 'path';
import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'));

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'ruby' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.rb'),
    },
  };

  client = new LanguageClient('myLangServer', 'My Language Server', serverOptions, clientOptions);
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop();
}
```

---

## 3. Language Server Implementation (`src/server.ts`)

```typescript
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  Diagnostic,
  DiagnosticSeverity,
  CompletionItem,
  CompletionItemKind,
  Hover,
  MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: { resolveProvider: true, triggerCharacters: ['.', ':', '>'] },
      hoverProvider: true,
      definitionProvider: true,
    },
  };
});

documents.onDidChangeContent(change => {
  validateDocument(change.document);
});

async function validateDocument(textDocument: TextDocument): Promise<void> {
  const text = textDocument.getText();
  const diagnostics: Diagnostic[] = [];

  // Example: detect hardcoded API keys or syntax issues
  const pattern = /SECRET_KEY\s*=\s*['"][^'"]+['"]/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(match.index),
        end: textDocument.positionAt(match.index + match[0].length),
      },
      message: 'Hardcoded secret detected. Use environment credentials.',
      source: 'SecurityLinter',
    };
    diagnostics.push(diagnostic);
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Autocomplete Provider
connection.onCompletion((_pos): CompletionItem[] => {
  return [
    { label: 'has_many', kind: CompletionItemKind.Snippet, insertText: 'has_many :${1:items}, dependent: :destroy' },
    { label: 'belongs_to', kind: CompletionItemKind.Snippet, insertText: 'belongs_to :${1:model}' },
  ];
});

// Hover Provider
connection.onHover((params): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: '**ActiveRecord Association**\n\nDefines a one-to-many relationship.',
    },
  };
});

documents.listen(connection);
connection.listen();
```

---

## 4. Tree-sitter AST Parsing in VS Code

Tree-sitter provides high-performance, incremental, and fault-tolerant syntax parsing.

### Installation
```bash
pnpm add tree-sitter tree-sitter-ruby
```

### Parsing AST and Traversing Nodes

```typescript
import Parser from 'tree-sitter';
import Ruby from 'tree-sitter-ruby';

const parser = new Parser();
parser.setLanguage(Ruby);

export function parseRubyAst(sourceCode: string) {
  const tree = parser.parse(sourceCode);
  const rootNode = tree.rootNode;

  const classNames: string[] = [];

  function traverse(node: Parser.SyntaxNode) {
    if (node.type === 'class') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        classNames.push(nameNode.text);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) traverse(child);
    }
  }

  traverse(rootNode);
  return { tree, classNames };
}
```

### Incremental Parsing on Document Edit

```typescript
// Reuse previous tree for sub-millisecond updates
let previousTree: Parser.Tree | null = null;

export function updateAst(newCode: string, editRange?: Parser.Edit) {
  if (previousTree && editRange) {
    previousTree.edit(editRange);
    previousTree = parser.parse(newCode, previousTree);
  } else {
    previousTree = parser.parse(newCode);
  }
  return previousTree;
}
```
