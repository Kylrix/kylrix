# Kylrix Model Context Protocol (MCP) Server

Connect Claude Desktop, Cursor, Claude Code, and autonomous AI agents directly to your Kylrix workspace over Streamable HTTP and Server-Sent Events (SSE).

---

## ⚡ Quick Connect

### 1. Claude Code
```bash
claude mcp add --transport http kylrix https://www.kylrix.space/api/v1/mcp \
  --header "Authorization: Bearer <YOUR_PAT_TOKEN>"
```

### 2. Claude Desktop (`claude_desktop_config.json`)
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

### 3. Cursor (Settings > Features > MCP Servers)
- **Name**: `kylrix`
- **Type**: `http`
- **URL**: `https://www.kylrix.space/api/v1/mcp`
- **Headers**:
  ```json
  {
    "Authorization": "Bearer <YOUR_PAT_TOKEN>"
  }
  ```

---

## 🛠️ Available MCP Tools

| Tool | Parameters | Description |
|---|---|---|
| `list_workspaces` | `limit?: number` | List all accessible workspaces / projects |
| `create_workspace` | `title: string, summary?: string, visibility?: string, isAgentic?: boolean` | Create a new workspace |
| `list_notes` | `workspaceId?: string, limit?: number` | List ideas and notes (workspace-filtered or personal) |
| `create_note` | `title: string, content?: string, workspaceId?: string, isPublic?: boolean` | Create an idea or markdown note |
| `get_note` | `id: string` | Retrieve note content and metadata |
| `update_note` | `id: string, title?: string, content?: string, isPublic?: boolean` | Update an existing note |
| `list_goals` | `workspaceId?: string, limit?: number` | List tasks and goals |
| `create_goal` | `title: string, description?: string, status?: string, workspaceId?: string` | Create a new task/goal |
| `update_goal` | `id: string, title?: string, description?: string, status?: string` | Update goal status or description |
| `list_chats` | `limit?: number` | List direct conversations |
| `send_chat_message` | `content: string, conversationId?: string, participantId?: string` | Send a direct message to a user or agent |
| `list_events` | `workspaceId?: string, limit?: number` | List calendar events |
| `create_event` | `title: string, startTime?: string, endTime?: string, location?: string, workspaceId?: string` | Create a calendar event |
| `list_forms` | `workspaceId?: string, limit?: number` | List created forms |

---

## 🔐 Authentication & Security

- **Personal Access Tokens (PATs)**: Generated in **Settings > Developers** (`kyl_pat_...`).
- **Agent Keys**: Zero-trust provisioning keys for autonomous agent lifecycles.
- **Sign in with Kylrix**: OAuth 2.1 access tokens.
- **Workspace Isolation**: Join table integrity (`project_objects`) prevents workspace items from spilling into personal workspace views.
