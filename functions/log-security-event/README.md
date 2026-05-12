# Log Security Event

System-wide security auditing for sensitive actions across the Kylrix ecosystem.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** Event-based
  - `databases.[VAULT_DB].collections.security_logs.documents.create`
  - `users.*.sessions.create`

### Appwrite Scopes (Permissions)
- `databases.write`
- `documents.write`

### Usage
Records sensitive activity (decryption, login attempts) to a central `system_audit` collection for review and security monitoring.
