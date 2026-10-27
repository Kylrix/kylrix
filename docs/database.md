# Database Architecture & Persistence Layer

This document details the database architecture, schema mappings, repository patterns, identity resolution mechanisms, and caching rules within Kylrix.

---

## 🗄️ Single Source of Truth (`turso-schema.sql`)

The database architecture is built on top of **Turso (LibSQL / SQLite)**.

- **`turso-schema.sql`** is mandated as the absolute **single source of truth** for table structures, column definitions, constraints, and indexes.
- **Drizzle ORM (`lib/db/schema.ts`)** maps TypeScript entities to SQLite tables. Table aliases are maintained for backwards compatibility (e.g., `export const projects = workspaces` and `export const projectObjects = workspaceObjects`).

---

## 🔗 Table Schema & Aliases

| Logical Entity | Drizzle Export | Underlying SQLite Table | Key Columns |
|---|---|---|---|
| **Users** | `user` | `user` | `id`, `email`, `username`, `appwriteAccountId`, `twoFactorEnabled`, `isContributor` |
| **Accounts** | `account` | `account` | `id`, `userId`, `providerId`, `accountAccountId` |
| **Sessions** | `session` | `session` | `id`, `token`, `userId`, `expiresAt` |
| **Notes** | `notes` | `notes` | `id`, `userId`, `title`, `body`, `tags`, `isPublic`, `isGuest`, `projectId` |
| **Goals** | `goals` | `goals` | `id`, `userId`, `title`, `status`, `urgency`, `progress`, `milestones`, `projectId` |
| **Vault Credentials** | `vault` | `credentials` | `id`, `userId`, `title`, `type`, `encryptedData`, `account`, `metadata` |
| **TOTP Secrets** | `totp` | `totp_secrets` | `id`, `userId`, `title`, `encryptedSecret`, `account`, `issuer`, `period`, `digits` |
| **Keychain** | `keychain` | `keychain` | `id`, `userId`, `wrappedKey`, `salt`, `params`, `isArgon` |
| **Workspaces / Projects** | `workspaces` (`projects`) | `workspaces` | `id`, `creatorId`, `ownerId`, `title`, `summary`, `status`, `visibility`, `dek` |
| **Workspace Objects** | `workspaceObjects` (`projectObjects`) | `workspace_objects` | `id`, `projectId`, `entityKind`, `entityId`, `userId` |
| **Coupons** | `coupons` | `coupons` | `id`, `code`, `discountPercent`, `redemptionLimit`, `redemptionCount` |

---

## 🌉 Cross-Account Identity Resolution (`resolveAllUserIds`)

Users may sign in using multiple OAuth providers (GitHub, Discord, Telegram) or legacy Appwrite accounts. To ensure zero data loss or fragmentation across auth migrations:

1. **`resolveAllUserIds` (`lib/actions/turso-ops.ts`)** accepts an initial `userId` or normalized `email`.
2. It queries `schema.user` and `schema.account` by matching `id`, `appwriteAccountId`, and normalized `email`.
3. It returns an array of all associated user IDs (e.g., `['usr_123', 'appwrite_456']`).
4. Resource read queries (`listVaultItemsTurso`, `listTotpSecretsTurso`, `listNotesTurso`, `listGoalsTurso`, `listKeychainTurso`, `listFormsTurso`) perform `inArray(table.userId, resolvedUserIds)` to aggregate data across all identity variants.

---

## ⚡ Repository Pattern (`lib/db/repository.ts`)

`TursoDatabaseAdapter` implements the `DatabaseRepository` interface, providing a unified CRUD API across server actions, API routes, and MCP tools:

```typescript
import { db, q } from '@/lib/db';

// Querying notes using backend-agnostic expressions
const result = await repository.listRows('default', 'notes', [
  q.equal('userId', userId),
  q.equal('isPublic', true),
  q.orderDesc('createdAt'),
  q.limit(20)
]);
```

### Legacy Payload Normalization
When creating or updating rows (`createRow`, `updateRow`, `upsertVaultItemTurso`, `upsertTotpSecretTurso`), legacy properties from client payloads (e.g. `name`, `itemType`, `encrypted_data`, `password`, `secret`, `accountName`) are automatically mapped to standard schema columns (`title`, `type`, `encryptedData`, `account`, `encryptedSecret`) and packed into `metadata` JSON before execution. Unmapped keys are removed to prevent invalid column SQL insertion errors.

---

## ⚡ Performance Optimization & Caching Invalidation

1. **Atomic Upserts:**
   - Pre-write read queries are eliminated by utilizing native SQLite `.onConflictDoUpdate()` and `.onConflictDoNothing()` atomic statements in Drizzle.

2. **In-Memory Row Caching & Invalidation:**
   - `invalidateRowCache(rowId)` purges row records stored in the server's in-memory `rowCache` map.
   - `invalidateResourceCache(userId)` and `invalidateEntitlementCache(userId)` flush list and billing entitlement caches during entity mutations, preventing stale reads.
