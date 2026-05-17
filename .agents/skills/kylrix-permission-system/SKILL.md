---
name: kylrix-permission-system
description: Procedural guide for the Kylrix privileged permission system. Explains the relationship between the Actor ID, JWT auth fail-safe, and the Admin SDK adapter. Use when modifying access control logic or debugging authorization failures.
---

# Kylrix Permission System

This skill documents the high-privilege architecture used to manage resource access securely in the Kylrix ecosystem.

## 1. The Core Actor Helper (`getActor`)
All privileged Server Actions must use the `getActor(jwt?: string)` helper in `secure-ops.ts`.
- **Identity Source**: Strictly derives user ID from `cookies()` (primary) or an explicit `JWT` (fail-safe).
- **Validation**: Calls Appwrite's `account.get()` server-side to ensure the session is active and verified by the provider.
- **Role**: Establish **Authorization**.

## 2. The Identity Pass Pattern (Privileged Adapter)
Internal services (like `permissionsInternal`) must be decoupled from session discovery to prevent 'Unauthorized' errors in complex calling contexts.
- **Step 1**: The Server Action establishes the `actorId` via `getActor()`.
- **Step 2**: The `actorId` is passed explicitly to the service.
- **Step 3**: The service uses the **Admin SDK** (Full privilege API key) to execute the mutation.
- **Benefit**: Mathematically bypasses the unreliable "forwarding" of session cookies through multiple layers of server logic.

## 3. Permission Level Mapping
Kylrix maps its human-readable levels to Appwrite primitives as follows:

| Kylrix Level | Appwrite Role | Functional Access |
| :--- | :--- | :--- |
| **Viewer** | `read` | Can only view the document. |
| **Editor** | `update` (+ `read`) | Can view and modify content. |
| **Admin** | `delete` (+ `update`, `read`) | Full lifecycle control. |

## 4. Single Source of Truth: $permissions
Collaborator listing must NEVER rely on a duplicate database column (like a `collaborators` string array). 
- **The Rule**: If a user is named in the Appwrite `$permissions` array, they are a collaborator.
- **Extraction**: User IDs are parsed from raw strings like `read("user:67fe...")` using the `extractCollaboratorsFromPermissions` regex.
- **Hydration**: Profiles are fetched by ID on-demand in the UI (Note Detail or Share Drawer) to ensure zero data desynchronization.

## 5. Security Guardrails
- **ID Overwrite**: Client-provided user IDs are ignored; the verified `actorId` from the session is always injected as the source of authority.
- **Silent Updates**: Administrative permission changes (upgrading an editor, removing a collaborator) must be **silent** (no emails sent). Emails are only for first-time invitations.
