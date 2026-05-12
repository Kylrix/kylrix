# Notify On Share

Unified notification service for shared items across the Kylrix ecosystem.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** Event-based
  - `databases.[NOTE_DB].collections.collaborators.documents.create`
  - `databases.[VAULT_DB].collections.share.documents.create`

### Appwrite Scopes (Permissions)
- `messaging.write`
- `users.read`

### Usage
Automatically sends a push notification and email to the recipient whenever a new share record is created.
