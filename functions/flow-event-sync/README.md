# Flow Event Sync

Surgical synchronization of Flow event guests and real-time invitations.

### Configuration
- **Runtime:** Node.js (18.0+)
- **Trigger:** `databases.whisperrflow.collections.eventGuests.documents.*.create`

### Appwrite Scopes (Permissions)
- `messaging.write`
- `databases.read`
- `documents.read`

### Usage
Triggers whenever a guest is added to an event in `flow`, sending a push notification and ensuring the event is mirrored to their personal schedule.
