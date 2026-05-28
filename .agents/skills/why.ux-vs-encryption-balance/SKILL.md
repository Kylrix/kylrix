---
name: why.ux-vs-encryption-balance
description: Detail the balance between client-side end-to-end encryption and server-side encryption, highlighting why normal notes are server-side encrypted to prioritize real-world user experience (UX) over theoretical purity.
---

# Why: UX Priority & Client vs. Server Encryption Balance

In secure systems design, engineers often strive for "ideological perfection" by sealing every single field client-side using end-to-end encryption (E2EE). While highly secure, this introduces severe friction: users must input a password or master key every time they open the app, search their notes, or load a page. 

We address this by balancing **Client-Side vs. Server-Side Encryption** based on real-world user experience (UX).

---

## 1. The UX Trade-Off

If we forced a password challenge on every note access, users would abandon the platform for faster, simpler alternatives. We categorize resources based on risk and security requirements:

| Resource Type | Encryption Type | Rationale | UX Impact |
|---|---|---|---|
| **Vault Credentials** | **Client-Side E2EE** (AES-GCM via MasterPass) | High-risk credentials (passwords, secrets) must never be visible to the server or database admins. | Acceptable friction: Users only open the vault when managing secrets. |
| **Workspace Notes** | **Server-Side Encryption** (Appwrite Storage/DB Encryption) | Low-risk documents that users need to view and search quickly across multiple devices. | Zero friction: Note lists and editors render instantly. |

---

## 2. Server-Side Encryption & Agnostic Search

By storing normal notes with server-side encryption, we support fast global indexing and full-text search:

```typescript
// Agnostic, ultra-fast note searching on the server
export async function searchMyNotes(queryText: string, jwt: string) {
  const actor = await getActor(jwt);
  const database = Registry.getDatabase();
  
  return await database.listRows(NOTE_DB, NOTES_TABLE, [
    Query.equal('userId', actor.$id),
    Query.search('content', queryText), // Enabled by server-side search indexing
    Query.limit(20)
  ]);
}
```

If these notes were sealed client-side, the server could not search them. The client would have to download and decrypt *every single note* in their history to perform a search, destroying mobile performance and battery life.

---

## 3. High-Security Client-Side AES-GCM Sealing

For high-risk vault items, we switch to strict client-side encryption. This ensures that sensitive passwords and keys are sealed before they ever touch the network:

```typescript
// Client-side sealing
export async function sealCredential(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext)
  );
  
  return {
    ciphertext: Buffer.from(ciphertext).toString('base64'),
    iv: Buffer.from(iv).toString('base64')
  };
}
```

This hybrid approach ensures high security where it matters most, while keeping daily workspaces fast and pleasant to use.
