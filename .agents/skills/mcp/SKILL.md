---
name: mcp
description: >-
  Connect AI tools, Claude Code, Cursor, and autonomous agents to Kylrix via the
  Model Context Protocol (MCP) server. Provides stateless JSON-RPC over Streamable HTTP
  with tools for workspaces, notes, goals, and agent execution.
---

# Kylrix Model Context Protocol (MCP)

Install the skill:
```bash
npx skills add kylrix/kylrix/mcp
```

## Quick Start: Connecting AI Clients

### 1. Claude Code
```bash
claude mcp add --transport http kylrix https://6a8f212e003d1f3518db.appwrite.run
```

### 2. Cursor / Claude Desktop
Add to your `mcp.json` or `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "kylrix": {
      "url": "https://6a8f212e003d1f3518db.appwrite.run"
    }
  }
}
```

### 3. Optional Bearer Authentication
When `MCP_AUTH_MODE=bearer` is enabled on the server, include the Authorization header:
```json
{
  "mcpServers": {
    "kylrix": {
      "url": "https://6a8f212e003d1f3518db.appwrite.run",
      "headers": {
        "Authorization": "Bearer <YOUR_SECRET_TOKEN>"
      }
    }
  }
}
```

## Available MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `list_workspaces` | `limit: int = 25` | List all active human and agent workspaces |
| `create_note` | `title: str, content: str, workspace_id: str` | Create a note/idea inside a workspace |
| `list_notes` | `workspace_id: str, limit: int = 25` | List notes with optional workspace filter |
| `create_goal` | `title: str, description: str, status: str` | Create a goal or task in Kylrix |
| `list_goals` | `limit: int = 25` | List goals and task statuses |

## Architecture & Hosting
- **Serverless MCP Engine**: Hosted directly on Appwrite Functions (`runtime: python-3.14`).
- **Streamable HTTP Transport**: Implements both protocol `2025-06-18` (legacy handshake) and `2026-07-28` (stateless).
- **Zero Infrastructure Friction**: Employs Appwrite Function dynamic credentials to query `passwordManagerDb` with zero key leakage.
