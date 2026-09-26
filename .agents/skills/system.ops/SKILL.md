---
name: system.ops
description: System operations, dependency injection registry, Server SDK actions, query mappers, dead code cleanup, build troubleshooting, and relay sync.
---

# System Operations & Engineering Architecture

## 1. Hexagonal Dependency Injection Registry
- Dynamic DI registry with port/adapter decoupling for database, storage, and authentication services.
- Allows seamless switching between local, mock, and production backends during testing.

## 2. Server SDK Actions vs Admin SDK
- Server Actions encapsulate privileged business logic and TablesDB mutations safely.
- Query expressions map cleanly to underlying database drivers.

## 3. Build Troubleshooting & Code Hygiene
- Surgical fixes for Next.js App Router and TypeScript build issues.
- Knip-driven dead code elimination to keep repository footprint minimal.
- Chat relay sync and join request gating for community features.
