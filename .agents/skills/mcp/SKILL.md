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
claude mcp add --transport http kylrix https://www.kylrix.space/api/v1/mcp \
  --header "Authorization: Bearer <YOUR_PAT_TOKEN>"
```

### 2. Cursor / Claude Desktop
Add to your `mcp.json` or `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "kylrix": {
      "type": "http",
      "url": "https://www.kylrix.space/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_PAT_TOKEN>"
      }
    }
  }
}
```

## Available MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `list_workspaces` | `limit: number` | List all active human and agent workspaces |
| `create_workspace` | `title: string, summary?: string, visibility?: string, isAgentic?: boolean` | Create a new workspace |
| `list_notes` | `workspaceId?: string, limit?: number` | List notes with optional workspace filter |
| `create_note` | `title: string, content?: string, workspaceId?: string, isPublic?: boolean` | Create a note/idea inside a workspace |
| `get_note` | `id: string` | Retrieve note content and metadata |
| `update_note` | `id: string, title?: string, content?: string, isPublic?: boolean` | Update an existing note |
| `list_goals` | `workspaceId?: string, limit?: number` | List goals and task statuses |
| `create_goal` | `title: string, description?: string, status?: string, workspaceId?: string` | Create a goal or task |
| `update_goal` | `id: string, title?: string, description?: string, status?: string` | Update goal status or description |
| `list_chats` | `limit?: number` | List direct conversations |
| `send_chat_message` | `content: string, conversationId?: string, participantId?: string` | Send a direct message |
| `list_events` | `workspaceId?: string, limit?: number` | List calendar events |
| `create_event` | `title: string, startTime?: string, endTime?: string, location?: string` | Create a calendar event |
| `list_forms` | `workspaceId?: string, limit?: number` | List created forms |

## Architecture & Hosting
- **Native Streamable HTTP & SSE**: Built directly into Next.js App Router (`/api/v1/mcp`, `/api/mcp`, `/mcp`).
- **Unified Security Boundary**: Validates Personal Access Tokens (`kyl_pat_...`) and OAuth 2.1 tokens natively with automatic workspace isolation.
- **Zero Cold Starts**: Direct in-process execution via `ApiResources`.

