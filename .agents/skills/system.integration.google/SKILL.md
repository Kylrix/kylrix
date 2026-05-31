---
name: system.integration.google
description: Architectural blueprint and tracking manifest for the Google Workspace integration suite. Covers the 11 supported services, authentication boundaries, and modular service patterns.
---

# Google Workspace Integration Suite

This skill defines the architectural boundaries and supported services for integrating Google Workspace into the Kylrix ecosystem.

## 🏗️ Architectural Mandate

1.  **Strict Authentication Separation**: The Google integration relies on a **secondary, client-side OAuth pipeline** powered by Firebase (`lib/integrations/google/auth.ts`). This is entirely separate from the core Kylrix Appwrite authentication engine. The Appwrite OAuth is *not* used here because it does not expose raw provider access tokens to the client.
2.  **Modular Services**: Integration logic is decoupled into dedicated, single-responsibility TypeScript classes under `lib/integrations/google/services/`. Monolithic files are strictly prohibited.
3.  **Client-Side Execution**: To respect zero-knowledge principles and reduce server load, data synchronization (e.g., pulling tasks, creating docs) happens directly from the user's browser to Google's APIs using the cached `accessToken`.

## 📦 Supported Integrations (11 Services)

The following services have had their foundational API wrappers established. They are ready to be wired into active synchronization pipelines or UI hubs.

1.  **Google Keep** (`keep.ts`):
    *   *Purpose*: Two-way sync with Kylrix Notes.
    *   *Capabilities*: List notes, create notes, delete notes.
2.  **Google Tasks** (`tasks.ts`):
    *   *Purpose*: Mirror Kylrix Flow items.
    *   *Capabilities*: List task lists, list tasks, create/update/delete tasks.
3.  **Google Calendar** (`calendar.ts`):
    *   *Purpose*: Sync tasks and project events.
    *   *Capabilities*: List upcoming events.
4.  **Google Drive** (`drive.ts`):
    *   *Purpose*: Cloud storage asset integration.
    *   *Capabilities*: Query files by MIME type, retrieve file metadata, execute multipart file uploads.
5.  **Google Docs** (`docs.ts`):
    *   *Purpose*: Document migration and automated reporting.
    *   *Capabilities*: List documents, fetch document content, create new documents, execute batch updates.
6.  **Google Sheets** (`sheets.ts`):
    *   *Purpose*: Data ingestion and tabular reporting.
    *   *Capabilities*: List spreadsheets, fetch cell values, create spreadsheets, append rows, update specific cell ranges.
7.  **Google Slides** (`slides.ts`):
    *   *Purpose*: Presentation generation.
    *   *Capabilities*: List presentations, fetch presentation details, create new blank presentations.
8.  **Google Forms** (`forms.ts`):
    *   *Purpose*: External data collection routing.
    *   *Capabilities*: List available forms, fetch form schema details, retrieve form submission responses.
9.  **Google Meet** (`meet.ts`):
    *   *Purpose*: Instant communication bridging.
    *   *Capabilities*: Create new meeting spaces, retrieve space details.
10. **Gmail** (`gmail.ts`):
    *   *Purpose*: Communication routing and automated dispatch.
    *   *Capabilities*: List labels, search messages, fetch full message threads, send raw RFC 2822 emails, trash messages.
11. **Google Picker** (UI Integration Pending):
    *   *Purpose*: Direct attachment of cloud storage assets to Kylrix chats and notes via the native Google Drive UI widget.
    *   *Status*: Architectural intent established; requires client-side loading of the `gapi.picker` library using the obtained `accessToken`.

## 🔄 Next Steps for Agents

When tasked with building a specific sync flow (e.g., "Import my Keep notes"):
1.  Verify the user is connected via `GoogleIntegrationDrawer`.
2.  Retrieve the token using `GoogleAuthAdapter.getAccessToken()`.
3.  Instantiate the specific service (e.g., `new GoogleKeepService(token)`).
4.  Execute the migration logic on the client, transforming Google's proprietary data structures into Kylrix's sovereign formats (e.g., Markdown for notes, JSON for tasks) before saving them to the Appwrite database.
