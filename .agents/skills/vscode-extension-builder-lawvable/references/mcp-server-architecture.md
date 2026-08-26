# Model Context Protocol (MCP) Server Architecture

Expose VS Code extension capabilities, workspace ASTs, and development tools to external AI agents (Claude Code, Cursor, Antigravity, Cline) using the Model Context Protocol (MCP).

---

## 1. Architecture Overview

```
┌──────────────────────────────────────┐           stdio (JSON-RPC)           ┌────────────────────────────────┐
│   AI Agent (Claude / Cursor / AGY)   │ ◄──────────────────────────────────► │     Embedded MCP Server        │
│   (Requests tools, resources, hints) │                                      │ (Exposes Rails / IDE tools)    │
└──────────────────────────────────────┘                                      └────────────────────────────────┘
```

An MCP server can run:
1. **Standalone CLI executable (`dist/mcp/server.js`)**: Spawns via stdio when an external AI agent runs.
2. **In-process Bridge**: Shares state directly with the active extension via local SQLite / shared IPC file.

---

## 2. MCP Server Implementation (`src/mcp/server.ts`)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'railsforge-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// 1. Expose Tools to AI Agent
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_schema_table',
        description: 'Returns the ActiveRecord schema columns, types, and indexes for a database table.',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: { type: 'string', description: 'Name of the database table (e.g., users, orders)' },
          },
          required: ['tableName'],
        },
      },
      {
        name: 'find_route',
        description: 'Looks up the controller and action matching a URL path or route helper.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Path or helper name (e.g., /api/v1/users or users_path)' },
          },
          required: ['query'],
        },
      },
    ],
  };
});

// 2. Handle Tool Invocations
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params;

  if (name === 'get_schema_table') {
    const tableName = String(args?.tableName);
    // Fetch schema details from workspace index / sqlite cache
    const tableInfo = await queryTableSchema(tableName);
    return {
      content: [{ type: 'text', text: JSON.stringify(tableInfo, null, 2) }],
    };
  }

  if (name === 'find_route') {
    const query = String(args?.query);
    const routes = await queryRoutes(query);
    return {
      content: [{ type: 'text', text: JSON.stringify(routes, null, 2) }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// 3. Expose Static Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'railsforge://schema/full',
        name: 'Full Database Schema',
        mimeType: 'application/json',
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  console.error('MCP Server error:', err);
  process.exit(1);
});
```

---

## 3. Auto-Registering MCP Server in Cursor & Claude Configs

You can write helper functions in your extension to export Cursor and Claude MCP configs automatically:

### Register in `.cursor/mcp.json` / Claude Config:
```typescript
import * as fs from 'fs';
import * as path from 'path';

export function exportMcpConfig(workspaceRoot: string, extensionPath: string) {
  const serverPath = path.join(extensionPath, 'dist', 'mcp', 'server.js');
  const mcpConfig = {
    mcpServers: {
      railsforge: {
        command: 'node',
        args: [serverPath],
        env: {
          RAILSFORGE_WORKSPACE: workspaceRoot,
        },
      },
    },
  };

  const cursorDir = path.join(workspaceRoot, '.cursor');
  if (!fs.existsSync(cursorDir)) fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify(mcpConfig, null, 2));
}
```
