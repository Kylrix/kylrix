# Sync Subscription Status

Unified tier and premium status management across all Kylrix apps.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** Event-based
  - `databases.[NOTE_DB].collections.subscriptions.documents.*.create`
  - `databases.[NOTE_DB].collections.subscriptions.documents.*.update`

### Appwrite Scopes (Permissions)
- `users.read`
- `users.write` (to update Labels)

### Usage
Whenever a subscription is updated in the Note app, this function applies a **User Label** (e.g., `pro`, `premium`) to the account. Every app in the ecosystem can then instantly check `user.labels` to grant feature access.
