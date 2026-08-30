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

## One command (defaults)

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

| Default | URL |
|---------|-----|
| App | `http://localhost:5003` |
| Appwrite API | `http://localhost:8080/v1` |

Admin login is minted into `.env` unless you pass credentials in the same shell (see below).

## Configure entirely via environment (no `.env` editing)

Prefix the install command. Shell exports **override** minted values. Bootstrap-minted secrets (`APPWRITE_API_KEY`, project ID when already bootstrapped) are **immune**.

```bash
SELFHOST_ADMIN_EMAIL=you@example.com \
SELFHOST_ADMIN_PASSWORD='your-secure-password' \
KYLRIX_PORT=5003 \
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

Pipe form (same effect):

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | \
  SELFHOST_ADMIN_EMAIL=you@example.com \
  SELFHOST_ADMIN_PASSWORD='your-secure-password' \
  bash
```

### Common overrides

| Variable | Purpose |
|----------|---------|
| `SELFHOST_ADMIN_EMAIL` | First admin account email |
| `SELFHOST_ADMIN_PASSWORD` | First admin password (vault masterpass defaults to same on signup) |
| `SELFHOST_ADMIN_NAME` | Display name for bootstrap admin |
| `KYLRIX_PORT` | App port (default `5003`) |
| `KYLRIX_APPWRITE_PORT` | Bundled Appwrite port (default `8080`) |
| `KYLRIX_DOMAIN` | Public domain label (default `localhost`) |
| `KYLRIX_DIR` | Install directory (default: repo you run from, else `~/kylrix-selfhost`) |
| `KYLRIX_TAIL_LOGS=1` | Follow `kylrix` container logs after install |
| `NEXT_PUBLIC_LOGGING_VERBOSE=true` | Verbose client logging |
| `AUTH_EMAIL_PASSWORD_SIGNUP` | Email/password signup (default `true` on self-host) |
| `KYLRIX_SKIP_SCHEMA=1` | Skip schema push on re-run |
| `KYLRIX_SKIP_GIT_PULL=1` | Skip `git pull` when updating an existing clone |

SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, …) can be set the same way when provided in the shell.

## Intelligent re-runs

`selfhost.sh` detects:

- Cloud dev config bleeding into bundled stack → remints local endpoints
- Running container vs `.env` drift → rebuilds client bundle
- Healthy Appwrite + verified API key → skips bootstrap
- Stale shell `APPWRITE_PROJECT_ID` exports → reloads from minted `.env` before compose

Re-run anytime to heal or upgrade:

```bash
./selfhost.sh
```

## Logs

```bash
docker compose logs -f kylrix
# or one-shot tail after install:
KYLRIX_TAIL_LOGS=1 ./selfhost.sh
```

## From a dev clone

```bash
git clone https://github.com/Kylrix/kylrix.git && cd kylrix
cp env.sample .env    # optional for cloud dev; selfhost.sh mints its own for bundled stack
./selfhost.sh
```

Make targets: `make install` (same as `selfhost.sh`), `make schema-push`, `make logs`.

## Connect agents after install

```bash
npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
```

Self-hosted MCP: `http://localhost:5003/api/v1/mcp` (swap host/port for your `KYLRIX_PORT`).
