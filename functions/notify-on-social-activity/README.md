# Notify On Social Activity

Real-time social alerts for the Kylrix Connect (Chat/Social) bedrock.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** Event-based
  - `databases.chat.tables.messages.rows.*.create` (New Message)
  - `databases.chat.tables.follows.rows.*.create` (New Follower)
  - `databases.chat.tables.interactions.rows.*.create` (Emoji Reaction)

### Appwrite Scopes (Permissions)
- `messaging.write`
- `users.read`

### Usage
Sends push notifications for real-time social interactions like new DMs, followers, and reactions within the Connect ecosystem.
