# Kylrix Architecture 🏴

## Overview
Kylrix is a **Sovereign Agentic Operating System** built for high-performance productivity and autonomous AI collaboration. It utilizes a **Zero-Knowledge (ZK)** security model, ensuring all sensitive data is end-to-end encrypted (E2EE) before ever leaving the client.

The ecosystem is partitioned into several specialized "Apps" (Note, Flow, Vault, Connect) that share a unified identity and security layer.

---

## 1. Security & Identity (The Core)

### Master Encryption Key (MEK)
- **Generation:** A random 256-bit AES-GCM key generated locally on the client.
- **Protection:** Protected by the **Master Password** using PBKDF2-HMAC-SHA256 (600,000 iterations).
- **Storage:** The raw MEK is **never stored in any database**. It exists only in RAM while the vault is unlocked.
- **Keychain:** A "Wrapped MEK" is stored in the database, encrypted with a key derived from the Master Password.

### Web Ecosystem Security Protocol (WESP)
The `EcosystemSecurity` layer (`lib/ecosystem/security.ts`) manages:
- **Identity Nodes:** Each device acts as a node in the security mesh.
- **X25519 Identities:** Every user has a cryptographic identity pair for P2P sharing and secure communication.
- **PIN Piggybacking:** An ephemeral session management system that allows "unlocking" with a short PIN by re-wrapping the MEK with a PIN-derived key stored in RAM (`sessionStorage`).

---

## 2. Data Infrastructure

### Appwrite Integration
Kylrix uses **Appwrite** as its primary BaaS (Backend-as-a-Service):
- **Databases:** Separate databases for `Vault`, `Note`, `Flow`, `Chat`, and `Ecosystem`.
- **Realtime:** Uses Appwrite Realtime (WebSocket) for live updates in Feed, Tasks, and Chat.
- **Functions:** Serverless logic for background cleanup, permission syncing, and complex orchestration.

### Local-First: Data Nexus
The `DataNexus` (`context/DataNexusContext.tsx`) is a high-performance caching layer:
- **Deduplication:** Prevents redundant inflight network requests.
- **Persistence:** Caches critical data in `localStorage` with a 30-minute TTL.
- **Background Refresh:** Non-blocking hydration of the UI.

---

## 3. The Unified Suite

### Kylrix Vault (Secrets & Tier 2 Data)
- **Zero-Knowledge Store:** Credentials and TOTP secrets are encrypted field-by-field before storage.
- **Sharing:** Uses X25519 Diffie-Hellman to safely transfer symmetric keys between users without the server being able to decrypt the payload.

### Kylrix Flow (Task Orchestration)
- **Collaborative Tasks:** Features a complex permission system supporting `read`, `write`, and `admin` roles.
- **Ecosystem Sync:** Integrates with Notes (cross-linking) and Calendars.

### Kylrix Note (Knowledge Management)
- **Markdown-First:** Secure, client-side encrypted knowledge base.
- **Ghost Notes:** Support for ephemeral or hidden content.

### Kylrix Connect (Communication)
- **E2EE Messaging:** Messages are encrypted using keys derived from the sender and recipient's X25519 identities.
- **WebRTC Calls:** Secure, real-time audio/video huddles managed via `WebRTCManager.ts`.

---

## 4. Design Philosophy: Muted Bold (V3)

Kylrix adheres to a strict "Deep Earth" aesthetic:
- **Surfaces:** Pitch black backgrounds (`#000000`) with deep ash/graphite surfaces.
- **Interactivity:** Drawer-first design for secondary actions, keeping the main workspace clean and focused.
- **Stacking Contexts:** A global "HUD" (Heads-Up Display) and Unified Drawer system ensure global actions are always accessible without losing context.

---

## 5. Technical Stack
- **Frontend:** Next.js 16 (Turbopack), React 19, TypeScript.
- **Backend:** Appwrite (Database, Auth, Storage, Functions).
- **Styling:** Vanilla CSS + Material UI (MUI) components with custom Muted V3 tokens.
- **Crypto:** Web Crypto API (SubtleCrypto) for all E2EE operations.

---

## 6. Directory Map
- `app/`: Next.js App Router (Routes & Pages).
- `lib/ecosystem/`: Centralized security, mesh, and identity logic.
- `lib/appwrite/`: Client-side SDK wrappers for database and vault operations.
- `context/`: React Context providers for global state (Auth, Tasks, Security).
- `components/ui/`: Shared Atomic design components.
- `functions/`: Appwrite serverless functions for ecosystem-wide sync.

**Kylrix is designed for ultimate sovereignty. Build freely. Work while you sleep.** 🌙
