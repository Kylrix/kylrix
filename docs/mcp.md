# Kylrix Model Context Protocol (MCP) Server

Connect Claude Desktop, Cursor, Claude Code, and autonomous AI agents to your Kylrix ecosystem via the native Model Context Protocol (MCP).

---

## ⚡ Quick Connect

### 1. Claude Code
```bash
claude mcp add --transport http kylrix https://www.kylrix.space/api/v1/mcp \
  --header "Authorization: Bearer kyl_pat_YOUR_TOKEN"
```

### 2. Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "kylrix": {
      "type": "http",
      "url": "https://www.kylrix.space/api/v1/mcp",
      "headers": {
        "Authorization": "Bearer kyl_pat_YOUR_TOKEN"
      }
    }
  }
}
```

### 3. Cursor
Add to **Cursor Settings > Features > MCP Servers**:
- **Name**: `kylrix`
- **Type**: `http` / `sse`
- **URL**: `https://www.kylrix.space/api/v1/mcp`
- **Headers**:
  ```json
  {
    "Authorization": "Bearer kyl_pat_YOUR_TOKEN"
  }
  ```

---

## 🛠️ Available MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `list_workspaces` | `limit?: number` | List all accessible workspaces / projects |
| `create_workspace` | `title: string, summary?: string, visibility?: string, isAgentic?: boolean` | Create a new workspace |
| `list_notes` | `workspaceId?: string, limit?: number` | List ideas and notes (workspace filtered or personal) |
| `create_note` | `title: string, content?: string, workspaceId?: string, isPublic?: boolean` | Create an idea or markdown note |
| `get_note` | `id: string` | Retrieve note content and metadata |
| `update_note` | `id: string, title?: string, content?: string, isPublic?: boolean` | Update an existing note |
| `list_goals` | `workspaceId?: string, limit?: number` | List tasks and goals |
| `create_goal` | `title: string, description?: string, status?: string, workspaceId?: string` | Create a new task/goal |
| `update_goal` | `id: string, title?: string, description?: string, status?: string` | Update goal status or title |
| `list_chats` | `limit?: number` | List direct conversations |
| `send_chat_message` | `content: string, conversationId?: string, participantId?: string` | Send a direct message to a user or agent |
| `list_events` | `workspaceId?: string, limit?: number` | List calendar events |
| `create_event` | `title: string, startTime?: string, endTime?: string, location?: string, workspaceId?: string` | Create a calendar event |
| `list_forms` | `workspaceId?: string, limit?: number` | List created forms |

---

## 🔐 Authentication

### Personal Access Tokens (PATs)
Generate a token under **Settings > Developers > Personal Access Tokens** or use an Agent Provisioning Token:
- Pass via header: `Authorization: Bearer kyl_pat_...`
- Scopes are enforced per tool call (`notes:read`, `notes:write`, `goals:read`, `goals:write`, `workspaces:read`, `workspaces:write`, `chats:read`, `chats:write`, etc.).

### OAuth 2.1 (Sign in with Kylrix)
Supports RFC 6749 / 7636 (Authorization Code Flow with PKCE) for one-click browser-based integrations with Claude.ai directory connectors.
- Authorization Endpoint: `https://www.kylrix.space/oauth/authorize`
- Token Endpoint: `https://www.kylrix.space/api/v1/oauth/token`
