# Proposal: Dedicated Local Ghost Partition & Sync Lifecycle

This proposal outlines the integration of account-free sharing (`/send`) as a seamless edge-case of the existing sync engine, utilizing a dedicated local storage partition instead of relying solely on `userId: null`.

## 1. Storage Partitioning (RxDB)
Instead of mixing guest notes with other system collections sharing `userId: null` (such as default discussions or general system layouts), we define a dedicated RxDB collection: `ghost_notes`.

- **Isolation**: Prevents namespace collisions and accidental data leaks between guest sharing and native system-level account-free tables.
- **Local Schema**: Identical structure to the standard `notes` collection, but residing in its own database partition.

## 2. Sync Lifecycle
Ghost objects will leverage the same autonomic sync engine but route their payloads differently based on their partition:

- **No User ID**: Payloads from the `ghost_notes` partition are synchronized with the Appwrite database without a `userId` field (or with an empty string/anonymous identifier).
- **Flagging**: Automatically flagged with `isGhost: true` on the database level.
- **The 7-Day Window**: The server enforces the 7-day auto-clearing TTL.

## 3. Claim & Escalation Path
When a user signs in, the local client triggers the claim flow:
1. **Verification**: Validates the `ghostSecret` stored in the client's local Spark stash.
2. **Transfer**: Moves the document from the local `ghost_notes` partition to the primary `notes` partition.
3. **Escalation**: Promotes the Appwrite row by assigning the new authenticated `userId` and sets `isGhost: false`, removing it from the automatic cleanup sweep.
