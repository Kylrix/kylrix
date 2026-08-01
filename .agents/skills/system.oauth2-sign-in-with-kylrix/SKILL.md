---
name: system.oauth2-sign-in-with-kylrix
description: >-
  Sign in with Kylrix via Appwrite OAuth 2.1 / OIDC server. Appwrite is SoT for
  clients, grants, and tokens. Consent page uses grant_id + oauth2.getGrant /
  approve / reject. Custom scopes stamp access tokens for /api/v1. Do not treat
  local oauth_* tables as the IdP grant store.
---

# Sign in with Kylrix (Appwrite OAuth2 Server)

## Architecture (official — do not reinvent)

Appwrite project = **authorization server**. Four pieces:

1. **Appwrite OAuth2 endpoints** — discovery, JWKS, authorize, approve/reject, token, userinfo, introspect, logout, revoke (+ PAR, device, dynamic registration).
2. **Clients** — registered via Console **Apps** tab or Client SDK **`apps`** service (`create` / `update` / secrets / `deleteTokens`). Confidential (secret) vs public (PKCE). Not our TablesDB as SoT.
3. **Consent screen we host** — Authorization URL in Console (e.g. `https://www.kylrix.space/oauth/consent`). Appwrite redirects here with **`grant_id`** (signed-in) or original authorize params (signed-out).
4. **Our APIs** — resource servers. Verify JWT (JWKS) or introspect; enforce **scopes** on `/api/v1`.

Discovery:

`https://fra.cloud.appwrite.io/v1/oauth2/<PROJECT_ID>/.well-known/openid-configuration`

### Consent flow (Authorization guide)

1. Client → Appwrite `/authorize` (`client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, PKCE if public).
2. Appwrite creates a **grant**; redirects to our Authorization URL with `grant_id`.
3. Consent page: ensure session → `oauth2.getGrant(grantId)` → show client branding + scopes → `oauth2.approve({ grantId, scope? })` or `reject` → navigate to returned `redirectUrl`.
4. Client exchanges code at Appwrite `/token` (secret or `code_verifier`).
5. Access token (JWT) carries granted `scope`; call userinfo / our APIs.

**Do not** store grants in `oauth_consent_requests` as the primary grant record. Appwrite owns grants. Local tables are optional overlays only (see below).

### Clients (Clients guide)

- Integrators use Client SDK `apps` (signed-in user) — self-serve developer platform on kylrix.space.
- Branding: `logoUri`, tagline, privacy/terms — for consent + marketplace.
- Secrets: `createSecret` shown once; multi-secret rotation.
- Labels (`official`, etc.): Server SDK + `apps.write` only.
- Dynamic registration: Appwrite `/register` (RFC 7591) for MCP-style clients.

### Tokens (Tokens guide)

- Access + refresh (+ ID if `openid`). Refresh **rotates**; reuse of old refresh kills that client–user OAuth identity.
- Validate access JWT via JWKS; ID token `aud` = client_id; access `aud` = project audience.
- Introspection for revocation-aware checks (`oauth2.read` API key on server).
- OAuth access tokens are **not** Appwrite sessions — they do not authorize general SDK calls.

### Scopes (Scopes guide)

Built-in (always on): `openid` `profile` `email` `phone`.

Custom scopes: define in Console / `updateOAuth2Server`. Align with PAT/API:

| Custom scope | API use |
|--------------|---------|
| `notes:read` / `notes:write` | `/api/v1/notes` |
| `goals:read` / `goals:write` | `/api/v1/goals` |
| `flows:read` | `/api/v1/flows` |
| `profile:read` | `/api/v1/me` (optional; OIDC profile/email cover identity) |

Max 100 scopes × 128 chars. Unknown scopes fail authorize. Enforcement is **our** job on `/api/v1`.

### Device flow (later)

Console + client `deviceFlow: true`; `verificationUrl` e.g. `https://www.kylrix.space/oauth/activate`; page uses `oauth2.createGrant({ userCode })` then approve/reject.

## Local TablesDB (`passwordManagerDb`) — overlay only

Created earlier for product UI. **Appwrite Apps/grants remain SoT.**

| Table | Allowed use | Forbidden use |
|-------|-------------|-----------------|
| `oauth_apps` | Optional cache / marketplace mirror of Appwrite apps — prefer SDK `apps.list` | Replacing Appwrite client registry |
| `oauth_app_installs` | Connected Apps UI cache of user↔client grants | Replacing Appwrite OAuth identities |
| `oauth_consent_requests` | **Deprecated for grant storage** — do not use instead of `grant_id` / `getGrant` | Acting as Appwrite grant DB |

Prefer building Developers “OAuth apps” and consent against **Appwrite Client SDK `apps` + `oauth2`**. Do not expand local tables as IdP core. Additive schema only (`system.appwrite-cli-ops`); never delete-table.

## Console checklist

1. Auth → OAuth2 server → **Enable**.
2. Authorization URL → `https://www.kylrix.space/oauth/consent`.
3. Custom scopes → add API scopes above (built-ins already merged).
4. Apps → register clients (or self-serve via SDK).
5. Token lifetimes: keep defaults unless product needs otherwise.
6. Later: device verification URL + `deviceFlow` on CLI/TV clients.

## Product surfaces to build next

1. `/oauth/consent` — grant_id / authorize params, getGrant, approve/reject.
2. Developers → OAuth apps — wrap Client SDK `apps` (+ secret reveal once).
3. Connected Apps — list/revoke via Appwrite (and optional install cache).
4. `/api/v1` — accept Bearer OAuth access JWT (JWKS/introspect) + existing PAT; enforce scopes.
