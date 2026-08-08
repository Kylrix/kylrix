---
name: security.permission-system
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

## 3. Permission Level Mapping (Read-Only ACL + Collaborators Table)
Kylrix enforces **read-only Appwrite ACLs**. At `create`, the creator (and any initial collaborators) receive **only** `read("user:<id>")`. No `update`/`delete`/`create` is ever granted via ACL. Write levels are virtualized:

| Kylrix Level | Appwrite ACL | Functional Access (checked via `collaborators` table + `verifyResourcePermissionSecure`) |
| :--- | :--- | :--- |
| **Viewer** | `read` | Can only view (read via client SDK). |
| **Editor** | `read` (ACL) + `permission='editor'` row in `Collaborators` table | Can view and modify (server checks `editor`/`admin`). |
| **Admin** | `read` (ACL) + `permission='admin'` row | Full lifecycle control (server checks `admin`). |

Public sharing uses `isPublic`/`isGuest` columns as server-side escape hatches, not `read("any")` ACL (except optional read-any for public notes where needed for direct client reads).

## 4. Single Source of Truth: `collaborators` table + `isPublic`/`isGuest`
Collaborator listing must NEVER rely on `$permissions` array.
- **The Rule**: `read` in `$permissions` only tells “has access”. **Which kind** of access lives in the `collaborators` table (`resourceId`, `userId`, `permission='viewer'|'editor'|'admin'`) and legacy `metadata.collaborators` fallback.
- **Extraction**: Roles are read from `Collaborators` table via `listRowsSecure` filtered by `resourceId`+`userId`, not from `$permissions` regex.
- **Hydration**: Profiles are fetched by ID on-demand in the UI to ensure zero desynchronization.
- **Reads via client SDK**: `listRows`/`getRow` use client SDK directly (frequent path); writes via `createRowSecure`/`updateRowSecure`/`deleteRowSecure` with `actor` JWT + `forceSystem` and `verifyResourcePermissionSecure` checks.

## 5. Security Guardrails
- **ID Overwrite**: Client-provided user IDs are ignored; the verified `actorId` from the session is always injected as the source of authority.
- **Silent Updates**: Administrative permission changes (upgrading an editor, removing a collaborator) must be **silent** (no emails sent). Emails are only for first-time invitations.
