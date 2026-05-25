# Kylrix Presence System — Architectural Standards

## Overview

The Kylrix Presence System leverages Appwrite's 2026 Presence API to provide real-time visibility into user activity across the ecosystem. It is designed to be **on-demand**, **privacy-first**, and **high-velocity**.

## Core Mandates

- **On-Demand Activation:** Presence monitoring for a resource (Note, Project, Flow) must only activate if there is at least one collaborator and more than one user is actively viewing the resource.
- **Privacy First:** Users can opt-out of global presence (online status) via their settings. This is controlled by the `isOnlineVisible` flag in the `chat.profiles` table.
- **Ephemeral State:** Interaction indicators (typing, cursor movement) must use the Presence API's ephemeral broadcasting to avoid unnecessary database writes.

## Palette & Visuals (Muted V3)

| State | Color | Meaning |
| :--- | :--- | :--- |
| Online | `#10B981` (Emerald) | User is active and connected |
| Away | `#F59E0B` (Amber) | Connected but inactive for >5 mins |
| Offline | `#34322F` (Graphite) | Disconnected |
| Busy/DND | `#EC4899` (Pink) | User manually set focus mode |

## Implementation Patterns

### 1. Subscription Channel Strategy

- **Global Presence:** `presence.users` (Limited to mutual contacts/collaborators).
- **Resource Presence:** `databases.[DB_ID].collections.[COLLECTION_ID].documents.[DOC_ID].presence`.
- **Chat Activity:** `databases.chat.collections.messages.presence`.

### 2. Service Logic (`lib/services/presence.ts`)

```typescript
export const PresenceService = {
    // Broadcast ephemeral interaction
    broadcastState: (channel: string, data: object) => {
        return realtime.setPresence(channel, data);
    },
    
    // Subscribe to live activity
    subscribeToPresence: (channel: string, callback: (payload: any) => void) => {
        return realtime.subscribe(`presence.${channel}`, callback);
    }
};
```

### 3. Presence Component Standards

- **Online Indicator:** 8px solid emerald dot with `#161412` hairline border.
- **Typing Indicator:** Technical monospace text: `[ USER_NAME ] IS_TYPING...` in `#9B9691`.
- **Collaborator HUD:** Displayed in Topbar or Project Header; show first 3 avatars + count.

## Prohibited Patterns

- **No Database Heartbeats:** Never use `setInterval` to update an `updatedAt` field for presence. Use the native `presence` channel.
- **No Global Broadcasts:** Do not broadcast presence to users who do not share a common resource or contact link.
- **No Laggy Updates:** UI must react within <100ms to presence events. Use `startTransition` for state updates to maintain frame stability.
