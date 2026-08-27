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

## 🛠️ Available MCP Tools (1:1 Complete Parity)

| Category | Tools | Description |
|---|---|---|
| **Identity & Profile** | `get_my_profile` | Get authenticated account ID, type, and active authorized scopes |
| **Workspaces** | `list_workspaces`, `get_workspace`, `create_workspace`, `update_workspace`, `delete_workspace`, `list_workspace_collaborators`, `add_workspace_collaborator` | Manage project and agentic workspaces |
| **Notes & Ideas** | `list_notes`, `get_note`, `create_note`, `update_note`, `delete_note` | Full CRUD on markdown notes with tags and public sharing |
| **Goals & Tasks** | `list_goals`, `get_goal`, `create_goal`, `update_goal`, `delete_goal` | Track tasks, priorities (`low`, `medium`, `high`, `urgent`), and status |
| **Calendar & Events**| `list_events`, `get_event`, `create_event`, `update_event`, `delete_event` | Schedule and manage calendar items |
| **Forms & Surveys** | `list_forms`, `get_form`, `create_form`, `delete_form` | Create and manage custom intake questionnaires |
| **Direct Messaging** | `list_chats`, `get_chat`, `list_chat_messages`, `send_chat_message` | Real-time direct messaging between users and agents |
| **Automations & Flows** | `list_flows`, `get_flow`, `create_flow`, `delete_flow` | Community workflows and trigger recipes |
| **Tags & Taxonomy** | `list_tags`, `create_tag`, `delete_tag` | Color-coded categorization tags |
| **Feed & Moments** | `list_moments`, `get_moment`, `create_moment`, `list_moment_comments`, `create_moment_comment` | Status updates, activity feed, and comments |
| **Discussions** | `list_thread_messages`, `create_thread_message` | Contextual object and workspace threads |
| **Agent Sessions** | `list_agent_sessions`, `get_agent_session`, `create_agent_session` | Autonomous agent execution logs and tasks |
| **Trash & Recovery** | `list_trash`, `restore_trash`, `purge_trash` | Recover deleted objects or permanently purge them |

---

## 🔐 Authentication & Security

- **Personal Access Tokens (PATs)**: Generated in **Settings > Developers** (`kyl_pat_...`).
- **Agent Keys**: Zero-trust provisioning keys for autonomous agent lifecycles.
- **Sign in with Kylrix**: OAuth 2.1 access tokens.
- **Workspace Isolation**: Join table integrity (`project_objects`) prevents workspace items from spilling into personal workspace views.
