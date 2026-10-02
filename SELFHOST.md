# Self-Hosting Kylrix (Turso / libSQL Stack)

Run a **fully isolated**, ultra-lightweight Kylrix instance using the modern **Turso / libSQL (`sqld`)** and **Better Auth** stack.

Zero BaaS bloat: no MariaDB, no Redis, no Appwrite. Boots in under 2 seconds and runs in under 100 MB of RAM.

---

## ⚡ Quick Start (1 Command)

```bash
curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
```

— or from a local clone —

```bash
git clone https://github.com/Kylrix/kylrix.git
cd kylrix
./selfhost.sh
```

**Defaults:**
- **Application:** `http://localhost:5003`
- **Turso Database API:** `http://localhost:8080` (open-source `sqld` libSQL engine)
- **Database File:** Stored at `/var/lib/sqld/kylrix.db` in `turso_data` Docker volume.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│  Kylrix Web Application (Next.js + Better Auth)        │
│  - Serves UI, HTTP REST API (/api/v1), and MCP Server  │
└──────────────────────────┬─────────────────────────────┘
                           │ Hrana / HTTP Wire Protocol
┌──────────────────────────▼─────────────────────────────┐
│  Turso libSQL Server (sqld container)                  │
│  - Exact same engine & format as Turso Cloud           │
│  - Relational tables: ideas, goals, workspaces, auth   │
│  - Single SQLite database file: /var/lib/sqld/kylrix.db│
└────────────────────────────────────────────────────────┘
```

| Service | Image | Purpose | Port | RAM Usage |
|---------|-------|---------|------|-----------|
| `kylrix` | Node.js (Next.js standalone) | Application, Better Auth, UI, API | `5003` | ~70 MB |
| `turso` | `ghcr.io/tursodatabase/libsql-server:latest` | libSQL relational database server | `8080` | ~15 MB |
| `caddy` | `caddy:2-alpine` (optional) | Automated Let's Encrypt SSL proxy | `80`/`443` | ~10 MB |

---

## 🚀 Environment Configuration

Key configuration parameters (stored in `.env`):

```env
APP_PORT=5003
TURSO_PORT=8080
DOMAIN=localhost
NEXT_PUBLIC_APP_URL=http://localhost:5003
BETTER_AUTH_SECRET=your_32_byte_cryptographic_secret
BETTER_AUTH_URL=http://localhost:5003
TURSO_DATABASE_URL=http://turso:8080
NEXT_PUBLIC_DATABASE_PROVIDER=turso
```

---

## ☁️ App-Only Mode (Turso Cloud)

If you already use hosted Turso Cloud (`libsql://...`), you can bypass the local `turso` container completely:

1. In `.env`:
   ```env
   TURSO_DATABASE_URL=libsql://your-db-org.turso.io
   TURSO_AUTH_TOKEN=your-turso-auth-token
   ```

2. Run with app-only override:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.app-only.yml up -d
   ```

---

## 🔒 Automated Production SSL (Caddy)

For automated Let's Encrypt HTTPS on a custom domain or VPS:

```bash
export DOMAIN=kylrix.yourdomain.com
docker compose --profile production up -d
```

---

## 💾 Instant Sovereign Backups

Because the entire backend is defined as a pure libSQL/SQLite database, backups are instantaneous:

```bash
# 1. Direct SQLite dump
docker compose exec turso sqlite3 /var/lib/sqld/kylrix.db .dump > backup_$(date +%F).sql

# 2. Or snapshot copy
docker compose cp turso:/var/lib/sqld/kylrix.db ./backup.db
```
