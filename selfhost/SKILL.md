---
name: selfhost
description: >-
  One-command bundled self-hosting for Kylrix: Docker Compose stack with local
  Appwrite, MariaDB, Redis, schema bootstrap, and env-driven configuration.
  Install with: npx skills add kylrix/kylrix --skill selfhost
---

# Kylrix self-host (agent skill)

**Start here:** [SELFHOST.md](../../SELFHOST.md) · installer: [selfhost.sh](../../selfhost.sh)

```bash
npx skills add kylrix/kylrix --skill selfhost
```

## Configure (shell exports)

Set what you need in the shell **before** install. Exports override minted values. Bootstrap-minted secrets (`APPWRITE_API_KEY`, existing `APPWRITE_PROJECT_ID`) are not overridden.

```bash
export SELFHOST_ADMIN_EMAIL=you@example.com
export SELFHOST_ADMIN_PASSWORD='your-secure-password'
# optional:
# export KYLRIX_PORT=5003
# export KYLRIX_APPWRITE_PORT=8080
# export AUTH_EMAIL_PASSWORD_SIGNUP=true
```

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

| Default | URL |
|---------|-----|
| App | `http://localhost:5003` |
| Appwrite API | `http://localhost:8080/v1` |

Without exports, admin login is auto-minted into `.env`.

### Common exports

| Variable | Purpose |
|----------|---------|
| `SELFHOST_ADMIN_EMAIL` | First admin account email |
| `SELFHOST_ADMIN_PASSWORD` | First admin password |
| `SELFHOST_ADMIN_NAME` | Bootstrap admin display name |
| `KYLRIX_PORT` | App port (default `5003`) |
| `KYLRIX_APPWRITE_PORT` | Bundled Appwrite port (default `8080`) |
| `KYLRIX_DOMAIN` | Public domain label (default `localhost`) |
| `KYLRIX_DIR` | Install directory |
| `AUTH_EMAIL_PASSWORD_SIGNUP` | Email/password signup (default `true` on self-host) |
| `KYLRIX_SKIP_SCHEMA=1` | Skip schema push on re-run |
| `KYLRIX_SKIP_GIT_PULL=1` | Skip `git pull` on update |

SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, …) — same `export` pattern.

## Re-runs

`selfhost.sh` detects cloud config bleed, container drift, and skips healthy bootstrap steps. Re-run anytime:

```bash
./selfhost.sh
```

## Dev clone

```bash
git clone https://github.com/Kylrix/kylrix.git && cd kylrix
cp env.sample .env
./selfhost.sh
```

## Agents on your instance

```bash
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
```

Self-hosted MCP: `http://localhost:5003/api/v1/mcp`
