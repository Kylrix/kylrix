# Sync User Profile

Syncs Appwrite Auth users to the Global Directory (`chat.users`) to ensure ecosystem-wide discoverability.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** `users.*.create` (Event-based)

### Appwrite Scopes (Permissions)
- `users.read`
- `databases.write`
- `documents.write`

### Environment Variables
- `DATABASE_ID_CHAT`: (Default: `chat`)
- `COLLECTION_ID_USERS`: (Default: `users`)

### Behavior
- Creates the global profile row on `users.*.create`.
- Sends the `Welcome to Kylrix` email directly through Appwrite Messaging the first time a user is synced.
- Persists a `welcomeEmailSent` preference flag so retries do not resend the email.
