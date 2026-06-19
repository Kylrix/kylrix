# Kylrix Developer Documentation 🏴

Welcome to the official Kylrix Developer Documentation. This documentation site details the core security frameworks, hybrid data synchronization logic, SDK primitives, and system mechanics powering the Kylrix ecosystem.

Every system and architectural choice inside Kylrix is designed with one central question: **Why?**

---

## 🗺️ Visual Architecture Map

The diagrams below map out the visual shell structures, application domains, and database interactions within Kylrix.

```mermaid
graph TD
    UI[Client Browser UI] -->|HTTPS Requests| Cloudflare[Cloudflare Edge Gateway]
    Cloudflare -->|Routing & Rate Limit| Next[Next.js App Server]
    
    subgraph Client-Side Context (Data Nexus)
        UI -->|Reads| Tier1[Tier 1: Tab-scoped JS Map]
        UI -->|Reads & Replication| Tier2[Tier 2: RxDB / IndexedDB Local Storage]
        UI -->|Writes (Proxy Interceptor)| Proxy[JS SDK Proxy Wrapper]
    end
    
    subgraph Server-Side Security Gateways
        Proxy -->|Mutates (Server Actions)| Actions[secure-ops.ts Action Gatekeeper]
        Next -->|Authenticates Actor| Auth[Appwrite User Auth Session]
        Actions -->|Elevated Admin Context| AdminSDK[Appwrite Admin Client & TablesDB API]
    end
    
    subgraph Data Substrate
        AdminSDK -->|Write Mutates| Database[(Appwrite Database Tables)]
        Tier2 <-->|Bidirectional Sync| Database
    end
```

---

## 🏗️ Core Mandates & Constraints

Before contributing or modifying any files, you must align with the foundational parameters defined in [AGENTS.md](file:///home/nathfavour/code/kylrix/kylrix/AGENTS.md):

*   **Immutable HTTP Endpoint Rule**: No new HTTP API routes/endpoints (`app/api/*`, `route.ts`) are allowed for in-app data mutations or user operations. Instead, you must use secure, internal, in-process functions, **Server Actions**, or database mutations routed through our verified escalation proxies.
*   **Zero-Knowledge Key Privacy**: Master keys and decryption contexts must stay local to tab-scoped JavaScript RAM. Plaintext keys or Master Encryption Keys must **never** be saved to disk, `localStorage`, `sessionStorage`, cookies, or remote databases.
*   **Zero-Gradient UI Chrome Policy**: Gradients or translucent/opaque layers are prohibited on the primary product chrome to maximize responsiveness and preserve visual simplicity.
*   **Strict Terminology Mandate**: You must use **"Table"** instead of "Collection" and **"Row"** instead of "Document" across all code comments, logs, variables, methods, and documentation files. Standard Appwrite nomenclature ("collection" / "document") is deprecated within our codebase.

---

## 📚 Documentation Sections

Explore specific aspects of the Kylrix codebase architecture:

1.  **[Encryption & Security Infrastructure](encryption.md)**: PBKDF2 stretching, Argon2id keys, Zero-Knowledge RAM isolation, Sudo Gates, and Row-Level Security.
2.  **[Wallet & Multichain Integration](wallet.md)**: Mnemonic derivation, HD keys, EVM, Solana, Bitcoin, and Sui chain adapters.
3.  **[Hybrid Data Nexus](nexus.md)**: Offline-first architecture, 3-tier caching hierarchy, RxDB CRDT replication, client-side Proxy interceptors, and reload storm defense mechanisms.
4.  **[Economy & Token Substrate](token.md)**: The `$KYLRIX` token economy, contract policies, thermal activity rewards, and minting/ledger operations.
5.  **[Appwrite Serverless Functions](functions.md)**: Automated tasks, context aggregators, ghost cleanup, and permission management.

---

## 🛠️ Unified SDK Facade

To isolate UI components from underlying Appwrite configurations, all major features interact through our unified SDK layer in [lib/sdk/](file:///home/nathfavour/code/kylrix/kylrix/lib/sdk/):

*   **[KylrixSecurity](file:///home/nathfavour/code/kylrix/kylrix/lib/sdk/security.ts)**: Core encryption and decryption primitives.
*   **[KylrixVault](file:///home/nathfavour/code/kylrix/kylrix/lib/sdk/vault.ts)**: Encrypted credential sync and master settings retrieval.
*   **[KylrixFlow](file:///home/nathfavour/code/kylrix/kylrix/lib/sdk/flow.ts)**: Tasks, focus sessions, and scheduler operations.
*   **[KylrixConnect](file:///home/nathfavour/code/kylrix/kylrix/lib/sdk/connect.ts)**: Secure user-to-user messaging relay.
*   **[KylrixToken](file:///home/nathfavour/code/kylrix/kylrix/lib/sdk/token/client.ts)**: Token ledger interactions and reward claiming.
*   **[Wallet Integration](file:///home/nathfavour/code/kylrix/kylrix/lib/sdk/wallet/index.ts)**: HD Key derivation and multichain address formats.
