---
name: why.presence-heartbeat-mesh
description: Deep dive into the real-time presence and typing indicators in Kylrix. Explains the ephemeral presence channels, table-scoped resource bindings, and broadcast lifecycles.
---

# Why: Ephemeral Real-Time Presence & State Mesh

In a collaborative space, users need to see who is active, who is currently typing a message, or who is editing a shared document. Storing these transient states in persistent database tables would cause massive write traffic, database bloat, and rendering lag.

We solve this using the **Presence Service** in `lib/services/presence.ts`.

## 1. Ephemeral Broadcasts (Zero-Database Write)

Instead of saving transient states (like typing indicators or cursor coordinates) to physical tables, we route these events through in-memory WebSockets using a real-time presence mesh:

```typescript
export type UserPresenceState = 'online' | 'away' | 'busy' | 'offline';

export const PresenceService = {
    broadcastState: async (channel: string, data: Partial<PresencePayload>) => {
        try {
            // Ephemeral broadcast to anyone subscribed to this channel
            return await realtime.setPresence(channel, data);
        } catch (err) {
            console.warn('[Presence] Broadcast failed:', err);
            return null;
        }
    },
};
```

This updates all active clients in milliseconds without writing a single line to the database disk.

## 2. Table-Scoped Presence Channels

To ensure that presence updates are restricted to the exact context a user is viewing, we construct channels scoped precisely by Database, Table, and Row:

```typescript
getResourceChannel: (databaseId: string, tableId: string, rowId: string) => {
    return `databases.${databaseId}.collections.${tableId}.documents.${rowId}`;
},
```

If multiple users are editing a specific Note (Row), they subscribe to that row's unique channel. This keeps WebSocket message traffic tightly localized and performant.

## 3. Dedicated Chat Presence

For conversations, we scope channels by Conversation ID to broadcast typing indicators:

```typescript
getChatChannel: (conversationId: string) => {
    return `chat.conversations.${conversationId}`;
}
```

This keeps chat interactions feeling fast and responsive.
