# Search Users

Securely search the Appwrite Auth user database for cross-app discovery via email or name.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** HTTP / Execution API (On-demand)

### Appwrite Scopes (Permissions)
- `users.read`

### Payload Format
```json
{
  "query": "user@example.com"
}
```
