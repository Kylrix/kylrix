# Finetune Permissions Proposal: Metadata-Driven Server SDK Architecture

## Overview
This proposal outlines the strategy for migrating and enforcing our three-tiered permission architecture across all Kylrix ecosystem features. The core philosophy dictates that **Appwrite database permissions will strictly remain `read-only`** (or completely private where applicable). All `update` and `delete` operations, as well as nuanced read access (like collaborator visibility), will be governed securely by Server Actions analyzing the `metadata` JSON field of the respective documents.

## The Three Tiers of Permission
1. **User CRUD:** The original creator/owner. 
2. **Collaborator CRUD:** Explicitly invited users or managers, whose access level (view, edit, admin) is defined in the `metadata` field.
3. **Public Access:** Toggled via a `make public` action, tracked in metadata (or top-level boolean where legacy schema dictates), allowing `read("any")` at the database level while restricting mutations to the server.

---

## Feature-by-Feature Implementation Strategy

### 1. Notes
- **User CRUD:** Creator has implicit full access via server validation of ownership (`userId`).
- **Collaborator CRUD:** `metadata.collaborators` (or `writeCollaborators`) array dictates who can trigger `updateNoteSecure` or `deleteNoteSecure`. The server checks this list before executing the `TablesDB` system call.
- **Public Access:** Toggling "make public" adds `read("any")` to the database permissions. Updates remain locked behind server-side metadata checks.

### 2. Tags, Passwords, and TOTP
- **Current Scope:** Strictly **User CRUD**.
- **Strategy:** These entities remain entirely private to the creator. The server action will strictly verify `actorId === resource.userId`. 
- **Future-Proofing:** No collaborator or public logic will be implemented at this time, but the architecture (Server Actions via `secure-ops`) ensures we can easily introduce Shared Keys (via metadata) later without altering the database permission structure.

### 3. Projects
- **User CRUD:** Creator has admin rights.
- **Collaborator CRUD:** Project access relies on `metadata.collaborators` (and their respective roles). The server gates adding/removing resources (like connecting notes or tasks) based on these metadata roles.
- **Public Access:** If `isPublic` is toggled, `read("any")` is granted. The server ensures external users cannot mutate the project structure.

### 4. Goals (Tasks)
- **User CRUD:** Creator owns the task.
- **Collaborator CRUD:** Assignees and observers are managed via metadata. When a task is updated (e.g., status changed to "Done"), the server verifies if the requester is an authorized assignee or manager in the metadata before applying the change.
- **Public Access:** Public task boards will grant `read("any")`, but status transitions remain mathematically tied to authorized users via Server Actions.

### 5. Forms
- **User CRUD:** Form creator holds absolute control.
- **Collaborator CRUD (Cascading Logic):** Adding a collaborator to a Form's metadata automatically grants them access to view/manage form responses. The server action fetching responses will check the parent Form's metadata first, eliminating the need to update permissions on thousands of individual response rows.
- **Public Access:** The form schema itself is public (`read("any")`) to allow submissions. Submissions (responses) are restricted; only the server can write them (via system SDK), and only authorized collaborators (checked via the Form's metadata) can read them.

### 6. Events
- **User CRUD:** Creator is the primary owner.
- **Collaborator CRUD (Event Managers):** Terminology shifts to "Event Managers." `metadata.managers` will define levels (e.g., `edit` or `admin`). The server gates actions like changing dates, canceling the event, or managing RSVPs based on this metadata hierarchy.
- **Public Access:** Public events grant `read("any")` for discovery. RSVP logic is handled entirely server-side, preventing client-side manipulation of guest lists.

### 7. Calls
- **User CRUD:** The initiator controls the call lifecycle.
- **Collaborator CRUD (Co-Hosts):** `metadata.coHosts` determines who can admit guests, mute participants, or end the call. The server action for call mutation checks this metadata before broadcasting state changes.
- **Public Access:** Public link sharing grants read access to the call state, but admission/joining is gated by server logic.

### 8. Messages & Groups
- **User CRUD:** Senders can edit/delete their own messages via server checks.
- **Collaborator CRUD (Group Members):** Group metadata defines membership and roles (e.g., admins). 
- **Decryption & Access:** By leaning entirely into the Server SDK, a user requesting to fetch messages or encryption keys for a group must pass a server-side check against the group's metadata. This means unauthorized users are mathematically blocked from even seeing the encrypted payload, vastly improving security over client-side permission evaluation.
- **Public Access:** Not applicable for secure messaging; strict adherence to metadata-defined membership.

---

## Execution Plan
1. **Audit:** Systematically review the API routes and Server Actions for each of the 8 categories above.
2. **Refactor Server Actions:** Ensure every mutation function (e.g., `updateProjectSecure`, `updateTaskSecure`, `manageEventSecure`) correctly parses the `metadata` JSON and enforces the 3-tiered roles before calling `TablesDB`.
3. **Database Permissions Sync:** Ensure the creation logic for all these entities strictly adheres to the rule: max permission is `read(user)` or `read(any)`. No `update` or `delete` permissions should be assigned.
4. **Validation:** Verify that client SDK operations attempting to update/delete these resources natively will correctly fail with `401 Unauthorized`, proving the server acts as the absolute gatekeeper.
