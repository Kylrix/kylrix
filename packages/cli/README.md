# `@kylrix/cli` (or `kylrix`)

Official Command-Line Interface (CLI), Model Context Protocol (MCP) Bridge, and Isomorphic SDK for **Kylrix** sovereign agentic workspaces.

---

## ⚡ Quick Start

### Run directly with `npx`
```bash
# Authenticate (Device QR / Browser Pairing, PAT, or Password)
npx kylrix login

# List accessible workspaces
npx kylrix workspaces list

# List notes & ideas
npx kylrix notes list

# Start stdio MCP Server for AI coding tools (Cursor, Claude Code, Windsurf)
npx kylrix mcp
```

### Install globally
```bash
npm install -g kylrix
# or
pnpm add -g kylrix
```

---

## 🤖 Model Context Protocol (MCP) Integration

You can plug Kylrix into any AI tool (Claude Desktop, Cursor, Windsurf, Claude Code, Antigravity) via stdio:

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "kylrix": {
      "command": "npx",
      "args": ["-y", "kylrix", "mcp"],
      "env": {
        "KYLRIX_API_KEY": "pat_..."
      }
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "kylrix": {
      "command": "npx",
      "args": ["-y", "kylrix", "mcp"],
      "env": {
        "KYLRIX_API_KEY": "pat_..."
      }
    }
  }
}
```

---

## 📋 CLI Commands Overview

### Authentication
* `kylrix login` - Interactive login (Device Pairing, PAT, or Email/Password)
* `kylrix pair` - Initiate RFC 8628 browser device pairing code
* `kylrix whoami` - Display currently authenticated user, email, and scopes
* `kylrix logout` - Remove stored local credentials

### Workspaces
* `kylrix workspaces list` - List workspaces
* `kylrix workspaces get <id>` - Get workspace details
* `kylrix workspaces create <name>` - Create a new workspace
* `kylrix workspaces delete <id>` - Delete a workspace

### Notes & Ideas
* `kylrix notes list [--workspace <id>]` - List notes
* `kylrix notes get <id>` - Display full note content
* `kylrix notes create <title> [--content <text>] [--workspace <id>]` - Create a note
* `kylrix notes update <id> [--title <title>] [--content <text>]` - Update a note
* `kylrix notes delete <id>` - Delete a note

### Goals & Habits
* `kylrix goals list [--status <status>]` - List goals
* `kylrix goals get <id>` - Get goal details
* `kylrix goals create <title> [--target <val>] [--unit <unit>]` - Create a goal
* `kylrix goals update <id> [--progress <val>] [--status <status>]` - Update goal progress
* `kylrix goals delete <id>` - Delete a goal

### Calendar Events
* `kylrix events list` - List events
* `kylrix events create <title> --start <ISO> --end <ISO>` - Create an event
* `kylrix events delete <id>` - Delete an event

### Forms & Flows
* `kylrix forms list` - List forms
* `kylrix forms get <id>` - Get form schema
* `kylrix flows list` - List workflow automations
* `kylrix flows create <title>` - Create a workflow

### Chats & Threads
* `kylrix chats list` - List direct conversations
* `kylrix chats messages <conversationId>` - View chat messages
* `kylrix chats send <message> [--conversation <id>]` - Send a message
* `kylrix threads list` - List object comment threads
* `kylrix threads send <threadId> <message>` - Post comment to thread

### Tags & Trash
* `kylrix tags list` - List tags
* `kylrix tags create <name> [--color <hex>]` - Create a tag
* `kylrix trash list` - List soft-deleted items
* `kylrix trash restore <kind> <id>` - Restore deleted item
* `kylrix trash purge <kind> <id>` - Permanently purge item

---

## 🌐 Environment Variables

| Variable | Description |
|---|---|
| `KYLRIX_API_URL` | Kylrix instance URL (defaults to `https://www.kylrix.space`) |
| `KYLRIX_API_KEY` or `KYLRIX_PAT` | Personal Access Token (PAT) or Agent Key |
| `KYLRIX_WORKSPACE_ID` | Default workspace ID for scoped operations |

---

## 💻 Isomorphic SDK Usage

You can also use the typed SDK in Node.js, Bun, Deno, browser, or edge workers:

```typescript
import { createKylrixClient } from 'kylrix';

const client = createKylrixClient({
  baseUrl: 'https://www.kylrix.space',
  token: 'pat_...',
});

// Fetch notes
const { items } = await client.notes.list();
console.log(items);

// Create a goal
const goal = await client.goals.create({
  title: 'Launch v1 CLI to npm',
  targetValue: 100,
  unit: '%',
});
```

---

## 📜 License

AGPL-3.0-or-later © Kylrix
