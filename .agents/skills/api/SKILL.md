---
name: api
description: Kylrix HTTP API (/api/v1), Personal Access Tokens (PATs), rate limiting, developer scopes, and programmatic resource access.
---

# Kylrix HTTP API & Developer Platform (/api/v1)

## 1. Authentication & Scopes
- All programmatic requests authenticate via Personal Access Tokens (PATs) using Bearer auth: \`Authorization: Bearer kyl_pat_...\`.
- Scopes are enforced per endpoint (\`notes:read\`, \`notes:write\`, \`goals:read\`, \`workspaces:read\`, \`vault:read\`, etc.).

## 2. Dogfooding & Local API Base
- When autonomous agents or internal integrations dogfood the platform, they MUST target the local instance at \`http://localhost:3005/api/v1\`.
- Entities created via API inherit the authenticated human user account (\`userId\`).

## 3. Endpoints & Resource Coverage
- Complete REST coverage for notes, goals, workspaces, events, forms, moments, threads, feeds, and tokens.
