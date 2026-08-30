# selfhost/

Bundled self-hosting automation for Kylrix.

## Files

| File | Purpose |
|------|---------|
| `mint-env.sh` | Non-interactive `.env` minting (project ID, secrets, ports) |
| `bootstrap.sh` | Start Appwrite, register admin, create project + API key |
| `provision-schema.sh` | Push `appwrite.config.json` schema via Appwrite REST API |
| `setup.sh` | Interactive wizard (optional) |
| `Caddyfile` | Optional HTTPS reverse proxy (`--profile production`) |

## Typical flow

```bash
make mint        # generate .env secrets + local project id
make bootstrap   # start Appwrite + mint project/api key
make up          # build + start Kylrix
make schema-push # tables, indexes, buckets
```

Or use `./selfhost.sh` for the all-in-one installer.
