# Account Cleanup

Automated cross-ecosystem data scrub when a user deletes their account.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** `users.*.delete`

### Appwrite Scopes (Permissions)
- `users.read`
- `databases.read`
- `databases.write`
- `documents.read`
- `documents.write`

### Usage
This is a critical security and compliance function. It ensures that when a user leaves Kylrix, their data is removed from the Note, Vault, Flow, and Connect databases automatically.
