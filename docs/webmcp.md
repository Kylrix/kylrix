# WebMCP (Web Model Context Protocol) in Kylrix

Kylrix natively implements the **W3C Web Model Context Protocol (WebMCP)** standard, exposing rich workspace tools directly to AI browsing agents inside the client session.

Zero backend setup. Zero credentials to paste. Visiting agents interact directly with the web application via `navigator.modelContext` and `document.modelContext`.

---

## ⚡ How It Works

Instead of relying on fragile DOM scraping or vision-based screenshot clicking, WebMCP allows Kylrix to expose structured, schema-validated JavaScript tools directly to visiting AI models:

```mermaid
graph LR
  A[AI Agent / ChatGPT / Chrome] -->|navigator.modelContext.listTools()| B[Kylrix Web App]
  A -->|executeTool('kylrix_create_note', args)| B
  B -->|Secure LocalEngine & Client Operations| C[Encrypted Database & Reactive Store]
  B -->|Returns JSON Schema Result| A
```

---

## 🚀 Testing WebMCP in Your Browser

### 1. In Google Chrome (W3C Standard Testing)
1. Open Chrome Canary or Dev.
2. Navigate to: `chrome://flags/#enable-webmcp-testing`
3. Set the flag to **Enabled** and restart Chrome.
4. Open [kylrix.space](https://www.kylrix.space) — tools are immediately discoverable by Chrome's built-in AI.

### 2. In ChatGPT In-App Browser
Open Kylrix in ChatGPT's browsing environment. ChatGPT queries `navigator.modelContext.listTools()` automatically to discover and invoke tools with your active session permissions.

### 3. In-App WebMCP Inspector & Diagnostics
Navigate to **Settings → Developers** or click the **WebMCP Status Badge** in the top bar to open the live interactive playground:
- Inspect all registered tool schemas.
- Execute tools interactively with live JSON input validation.
- Review real-time invocation latency, payloads, and response logs.

---

## 🛠️ Tool Catalog Exposed via WebMCP

| Tool Name | Category | Description |
| :--- | :--- | :--- |
| `kylrix_get_app_context` | `system` | Retrieves active workspace, route location, and client capabilities. |
| `kylrix_list_notes` | `notes` | Searches and lists notes in the active workspace. |
| `kylrix_create_note` | `notes` | Creates a new note with markdown content and tags. |
| `kylrix_get_note` | `notes` | Retrieves full note details and markdown body. |
| `kylrix_update_note` | `notes` | Modifies existing note title, body, or tags. |
| `kylrix_delete_note` | `notes` | Moves a note to trash. |
| `kylrix_list_goals` | `goals` | Lists tracked goals and progress milestones. |
| `kylrix_create_goal` | `goals` | Creates a new tracked goal. |
| `kylrix_list_workspaces` | `workspaces` | Lists user workspaces and projects. |
| `kylrix_create_workspace` | `workspaces` | Creates a new workspace. |
| `kylrix_switch_workspace` | `workspaces` | Switches the active workspace in the browser session. |
| `kylrix_list_events` | `events` | Lists scheduled calendar events and deadlines. |
| `kylrix_create_event` | `events` | Schedules a calendar event. |
| `kylrix_list_flows` | `flows` | Lists visual automation workflows. |
| `kylrix_post_thread_message` | `chat` | Posts messages to any object's discussion thread. |
| `kylrix_navigate_ui` | `navigation` | Navigates the user to specific pages or actions. |

---

## 💻 Programmatic Browser Usage

You can test WebMCP in the browser console on any Kylrix page:

```javascript
// 1. List available tools
const tools = await navigator.modelContext.listTools();
console.log(tools);

// 2. Create a note through WebMCP
const res = await navigator.modelContext.executeTool('kylrix_create_note', {
  title: 'WebMCP Agent Briefing',
  content: 'Captured live via browser modelContext invocation.',
  tags: ['webmcp', 'w3c', 'hackathon']
});
console.log(res);
```

---

## 🏆 WebMCP Challenge Alignment

- **Browser-Native Synergy:** Eliminates external bridge servers; human and agent collaborate seamlessly inside the same browser session.
- **Local-First & E2EE Aware:** WebMCP executions run directly in the client context with the user's unlocked session state.
- **W3C & Standard Aligned:** Conforms to `navigator.modelContext` / `document.modelContext` specifications.
