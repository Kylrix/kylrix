---
name: security.sudo-mode-gate
description: Privacy-respecting confirmation window for sensitive actions in the open source productivity suite Kylrix. Transient confirmation for private note and vault workflows.
---

# Sudo Mode — Respectful Confirmation for Sensitive Actions

Kylrix is an open source productivity suite that respects user privacy with an optional privacy module for private notes and secure hangouts. Some actions — like exporting vault content or managing private spaces — benefit from a brief confirmation window.

We use a friendly **Sudo Mode** check in `lib/sudo-mode.ts` to keep the experience thoughtful.

## 1. Transient Confirmation Window

Instead of persisting sensitive confirmation in cookies or storage, Sudo Mode keeps a short-lived confirmation **only in transient memory**:

```typescript
export const SUDO_WINDOW_MS = 5 * 60 * 1000; // 5 minute window
let lastSudoTimestamp = 0;

export const markSudoActive = () => {
    lastSudoTimestamp = Date.now();
};

export const resetSudo = () => {
    lastSudoTimestamp = 0;
};

export const isSudoActive = () => {
    return Date.now() - lastSudoTimestamp < SUDO_WINDOW_MS;
};
```

Because it lives in active JS execution memory:
- Reloading the page or closing the tab instantly resets the sudo authorization state.
- After 5 minutes, the authorization expires automatically.

## 2. Thoughtful Privacy Design

By keeping this confirmation transient, the app respects user privacy and avoids persisting sensitive state. After the window closes, the user is simply asked to confirm again.

## 3. Friendly Confirmation Flow

When the user requests a sensitive action (e.g., exporting vault content), the app checks `isSudoActive()`. If needed, it shows a gentle confirmation prompt. Once confirmed, a brief window allows the action to complete comfortably.
