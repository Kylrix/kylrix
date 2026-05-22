# Server-Side SDK CRUD Architecture

## Purpose
This skill documents the architectural mandates, security models, and technical nuances for executing CRUD (Create, Read, Update, Delete) and Storage operations in the Kylrix ecosystem.

## Motivation
To eliminate the risk of malicious client-side manipulation (e.g., users altering document metadata, granting unauthorized access, or bypassing subscription gates), we migrated all mutation logic to the server. Client-side SDKs are strictly limited to querying and reading data. 

## The Security Model (The "Read-Only" Rule)
1. **Zero Write Permissions:** Appwrite Database and Storage resources are provisioned without `update`, `delete`, or `create` permissions at the client level.
2. **Read-Only:** The absolute maximum Appwrite-level permission ever granted to a user or role is `read` (e.g., `read("user:[ID]")` or `read("any")`).
3. **Server Authority:** All data mutations must pass through Next.js Server Actions (e.g., `lib/actions/secure-ops.ts`, `secure-upload.ts`). The server verifies identity (`getActor`), checks business logic, and uses the highly-privileged System/Admin Server SDK (`node-appwrite`) to perform the operation.

## Collaborators and Public Access
Because the underlying Appwrite database only uses `read` permissions, actual authorization for updates and deletions is strictly virtualized via document **metadata**:
- **Metadata Field:** A JSON `metadata` string on the document holds the access control lists (e.g., `writeCollaborators`, `viewers`, `role`).
- **Server Verification:** When a user requests an update, the Server Action intercepts the request, reads the current document's `metadata` using the system client, verifies if the user's ID exists in the allowed collaborator lists, and only then executes the update.
- **Public Access:** Public read access is granted by appending `read("any")` at creation or toggle. In the future, if editable public documents (like ghost notes) are introduced, the server action will check the metadata's `publicity` flags to permit anonymous/guest edits.

## Storage and Bucket Nuances
- **No Client Uploads:** `storage.createFile()` must never be called from the client using the web SDK. 
- **Secure Uploads:** Files are packaged into `FormData` and sent to server actions like `secureUploadFile`.
- **Business Logic Enforcement:** The server securely enforces plan limits (e.g., rejecting uploads to `notes_attachments` or `blog_media` if the user lacks a Pro subscription, while freely allowing `profile_pictures` and `voice` audio).

## Technical Implementation Nuances
1. **Object-Based Syntax Required:** When using the Server SDK's `TablesDB` (which replaced standard Document models with Row terminology), you **MUST** use object-based syntax.
   - ❌ **WRONG:** `tablesDB.createRow(dbId, tableId, rowId, data, permissions)` (Positional mapping is broken in the SDK and will drop permissions silently, causing 401s).
   - ✅ **RIGHT:** `tablesDB.createRow({ databaseId, tableId, rowId, data, permissions })`
2. **Never Add Legacy Permissions:** Never write `Permission.update()` or `Permission.delete()` into the codebase. They mathematically have no reason to exist under this architecture.
3. **Identity Verification:** Always extract the user context within the server action using `getActor(jwt)` before acting on the database.
