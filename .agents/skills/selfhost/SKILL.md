---
name: selfhost
description: Ultra-lightweight Docker Compose self-hosting, Turso libSQL container (sqld), Better Auth, and relational schema bootstrap.
---

# Kylrix Self-Hosting Architecture

## 1. Docker Compose Stack
- Single-command self-hosting via `./selfhost.sh` deploying the Next.js frontend and bundled Turso libSQL engine (`sqld`).
- Ultra-lightweight footprint: ~80MB RAM total, <2s cold boot, zero BaaS bloat (no MariaDB, no Redis, no Appwrite).
- App-only mode: `docker compose -f docker-compose.yml -f docker-compose.app-only.yml up -d` targeting external Turso Cloud (`libsql://...`).

## 2. Relational Schema Bootstrapping & Format Equivalence
- Automated schema bootstrap initializes Better Auth, ideas, goals, workspaces, forms, and vault items into the libSQL database (`kylrix.db`).
- Format equivalence: Uses the exact same libSQL/Hrana format as Turso Cloud. Backups are instantaneous via SQLite dump (`sqlite3 /var/lib/sqld/kylrix.db .dump > backup.sql`).
