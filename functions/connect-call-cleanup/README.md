# Connect Call Cleanup

Cleans up active communication links and archives call metadata when a call ends or a link expires.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** `databases.chat.tables.call_links.rows.*.delete`

### Appwrite Scopes (Permissions)
- `databases.write`
- `tables.write`
- `rows.write`
- `documents.write`

### Usage
Triggers automatically whenever a call link is deleted from the `chat` database, ensuring that a persistent log is created and any temporary call-active states are cleared.
