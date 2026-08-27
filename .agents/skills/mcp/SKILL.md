---
name: mcp
description: >-
  Connect AI tools, Claude Code, Cursor, and autonomous agents to Kylrix via the
  Model Context Protocol (MCP) server. Provides stateless JSON-RPC over Streamable HTTP
  with full 1:1 parity for workspaces, notes, goals, calendar, forms, flows, chats, moments, and agent sessions.
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

## Available MCP Tools (Full 1:1 Parity)

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

## Architecture & Hosting
- **Native Streamable HTTP & SSE**: Built directly into Next.js App Router (`/api/v1/mcp`, `/api/mcp`, `/mcp`).
- **Unified Security Boundary**: Validates Personal Access Tokens (`kyl_pat_...`) and OAuth 2.1 tokens natively with automatic workspace isolation.
- **Output Schemas & Annotations**: Compliant with standard MCP specifications for high quality score, deterministic outputs, and client ergonomics.
- **Zero Cold Starts**: Direct in-process execution via `ApiResources`.
