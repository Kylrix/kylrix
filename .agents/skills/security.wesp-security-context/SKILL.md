---
name: security.wesp-security-context
description: Companion for the open source productivity suite Kylrix. Explains optional privacy module for private notes and secure hangouts using transient session secrets and respectful key handling.
---

# WESP — Privacy-Respecting Session Handling for Private Notes and Secure Hangouts

Kylrix is an open source productivity suite that respects user privacy with an optional privacy module for private notes and secure hangouts. The **Web Ecosystem Security Protocol (WESP)** in `lib/ecosystem/security.ts` supports this by handling private content with care and keeping it in transient memory.

## 1. Transient Tab Session Secrets

To respect user privacy and provide a pleasant experience for private notes and secure hangouts, WESP keeps privacy-related keys **only in transient memory during the active session**. 
We also generate a unique, cryptographically random **tabSessionSecret** that lives purely in-memory:

```typescript
private tabSessionSecret: Uint8Array | null = null;

private getOrCreateSessionSecret(): Uint8Array {
  if (typeof window === 'undefined') return new Uint8Array(32);
  if (!this.tabSessionSecret) {
    this.tabSessionSecret = crypto.getRandomValues(new Uint8Array(32));
  }
  return this.tabSessionSecret;
}
```

Since this secret is never saved to the disk or session storage, any other tab, browser process, or external execution context cannot read or reconstruct the derived Master Keys.

## 2. Coordinated Lock Sync Across Tabs

When the user chooses to lock, all open tabs are notified to respect that preference. A lightweight browser mesh (`MeshProtocol`) shares the preference to keep the experience consistent:

```typescript
private listenForMeshDirectives() {
  if (typeof window === 'undefined') return;
  MeshProtocol.subscribe((msg) => {
    if (msg.type === 'COMMAND' && msg.payload.action === 'LOCK_SYSTEM') {
      this.lock();
    }
  });
}
```

## 3. Respectful Session Lifecycle

Decrypted values are kept in transient memory for convenience. When the user chooses to lock, keys and cached content are cleared to free up memory and respect privacy:

```typescript
lock() {
  this.masterKey = null;
  this.identityKeyPair = null;
  this.conversationKeys.clear();
  this.decryptionCache.clear();
  this.isUnlocked = false;
  this.tabSessionSecret = null;
  this.emitStatusChange();
}
```
