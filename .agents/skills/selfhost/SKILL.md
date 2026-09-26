---
name: selfhost
description: Bundled single-command Docker Compose self-hosting, Appwrite container stack, MariaDB, Redis, and schema bootstrap.
---

# Kylrix Self-Hosting Architecture

## 1. Docker Compose Stack
- Single-command self-hosting via \`./selfhost.sh\` deploying Next.js frontend, bundled Appwrite, MariaDB, and Redis.
- Optional backend mode: \`BACKEND=false\` runs standalone local-first mode without local Appwrite containers.

## 2. Schema Bootstrapping & Env Configuration
- Automated schema bootstrap initializes tables, indexes, and storage buckets upon initial launch.
