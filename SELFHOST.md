# Self-Hosting Kylrix

Run a **fully isolated** Kylrix instance with bundled Appwrite, MariaDB, and Redis. No cloud Appwrite dependency — project ID and API keys are minted locally on first boot.

---

## Quick Start (1 command)

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

Defaults:
- **Kylrix app:** `http://localhost:5003`
- **Appwrite API:** `http://localhost:8080/v1` (lean stack — API only, no console container)
- **Project + API key:** auto-minted into `.env`

Admin credentials are written to `.env` as `SELFHOST_ADMIN_EMAIL` / `SELFHOST_ADMIN_PASSWORD`.

## Authentication policy

Independent of `SELFHOSTED` — enable per deployment:

```env
AUTH_EMAIL_PASSWORD_SIGNUP=true   # new accounts via email + password
AUTH_PASSKEY_SIGNUP=false         # passkey signup (UI wiring incremental)
AUTH_PASSWORDLESS_MODE=false      # when true, disables all password auth
APPWRITE_UNSTABLE=false           # true → Appwrite 2.0.0-rc.1 (dogfood only)
APPWRITE_IMAGE=appwrite/appwrite:1.9.6
```

Self-host `mint-env.sh` sets `AUTH_EMAIL_PASSWORD_SIGNUP=true` by default.

**Sign-in flow:** password submit always tries login first. A new account is created only when login fails with invalid credentials *and* `AUTH_EMAIL_PASSWORD_SIGNUP=true`.

### Appwrite version

| Mode | Env | Image |
|------|-----|-------|
| Stable (default) | `APPWRITE_UNSTABLE=false` | `appwrite/appwrite:1.9.6` |
| Unstable dogfood | `APPWRITE_UNSTABLE=true` | `appwrite/appwrite:2.0.0-rc.1` |

Upgrading from an older bundled Appwrite (e.g. 1.6.x) requires a fresh data volume:

```bash
docker compose down -v
APPWRITE_UNSTABLE=true make up   # or set in .env before make up
```

---

```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
cp env.sample .env
make up          # mint env → start Appwrite → bootstrap project → build Kylrix
make schema-push # provision tables/indexes/buckets from appwrite.config.json
```

---

## What gets started

| Service | Purpose | Default port |
|---------|---------|--------------|
| `kylrix` | Next.js app | `5003` |
| `appwrite` | Local BaaS API (`1.9.6` stable; `2.0.0-rc.1` when `APPWRITE_UNSTABLE=true`) | `8080` |
| `mariadb` | Appwrite database | internal |
| `redis` | Appwrite cache | internal |
| `caddy` | Optional HTTPS (`--profile production`) | `80`/`443` |

---

## App-only mode (bring your own Appwrite)

If you already run Appwrite elsewhere:

```bash
cp env.sample .env
# Set APPWRITE_ENDPOINT + APPWRITE_PROJECT_ID + APPWRITE_API_KEY to your instance
make app-only
```

---

## Local AI

Set in `.env` before `make up`:

```env
GOOGLE_API_KEY=...
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3:latest
```

---

## Updates

```bash
cd ~/kylrix-selfhost
git pull origin master
docker compose up -d --build
```

---

## Troubleshooting

- **Re-bootstrap Appwrite credentials:** `make bootstrap`
- **Re-provision schema:** `make schema-push`
- **Nuclear reset:** `make clean` (destroys volumes)
