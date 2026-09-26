---
name: appwrite-typescript
description: Appwrite TypeScript SDK reference for client-side queries, authentication, real-time subscriptions, and server SDK operations.
---

# Appwrite TypeScript SDK Usage

## 1. Client SDK vs Server SDK
- **Client SDK (\`appwrite\`)**: Used in browser components for account sessions, client-side queries, and real-time event subscriptions.
- **Server SDK (\`node-appwrite\`)**: Used in Server Actions and server utilities for privileged data operations using Server API Keys.

## 2. Query Expressions
- Construct clean, indexed queries using SDK Query helpers: \`Query.equal\`, \`Query.contains\`, \`Query.orderDesc\`, \`Query.limit\`.
- Map queries properly through the unified database query abstraction layer.
