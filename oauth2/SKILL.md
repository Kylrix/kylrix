---
name: kylrix-oauth2
description: >-
  Integrate Sign in with Kylrix via Appwrite OAuth 2.1 / OIDC. Discovery URL,
  confidential vs public clients, authorization code + PKCE, token exchange,
  scopes, and calling /api/v1 with the access token. Install with:
  npx skills add kylrix/kylrix/oauth2
---

# Sign in with Kylrix (OAuth2 agent skill)

Kylrix is an **OAuth 2.1 / OpenID Connect provider**. Third-party apps register as clients, send users through consent on Kylrix, and receive tokens issued by Appwrite.

In-app docs: https://www.kylrix.space/docs/oauth2  
Register apps: https://www.kylrix.space/settings?tab=developers  
Consent screen: https://www.kylrix.space/oauth/consent

## Install

```bash
npx skills add kylrix/kylrix/oauth2
```

For HTTP API + personal access tokens (CLI / scripts), use the other skill instead:

```bash
npx skills add kylrix/kylrix/api
```

## Discovery

Point any OIDC-capable library at:

```text
https://fra.cloud.appwrite.io/v1/oauth2/67fe9627001d97e37ef3/.well-known/openid-configuration
```

That document lists authorize, token, userinfo, JWKS, revoke, and introspect.

## Register a client

1. Sign in on Kylrix → **Settings → Developers → Sign in with Kylrix → Set up**.
2. Create a **confidential** client (server holds `client_secret`) or **public** client (PKCE, no secret).
3. Add exact redirect URIs (HTTPS; loopback HTTP allowed in development).
4. Copy `client_id` and (confidential only) the secret — shown once.

Apps can also be created with the Appwrite Client SDK `apps` service while signed in.

## Authorization code flow

1. Send the browser to the authorize endpoint with `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, and PKCE (`code_challenge` / `S256`) for public clients.
2. Appwrite redirects to Kylrix consent (`/oauth/consent?grant_id=…`). The user signs in and approves.
3. Browser returns to your `redirect_uri` with `code` (+ `state`).
4. Exchange the code at the token endpoint (confidential: `client_secret`; public: `code_verifier`).
5. Receive `access_token`, `refresh_token`, and `id_token` when `openid` was granted.

## Scopes

Built-in: `openid` `profile` `email` `phone`.

Custom (API): `notes:read` `notes:write` `goals:read` `goals:write` `flows:read` `profile:read`.

Request only what you need. Call Kylrix APIs with:

```http
Authorization: Bearer <access_token>
```

against `https://www.kylrix.space/api/v1/...` — same routes as the PAT skill; scopes on the token are enforced.

## Tokens

- Access tokens are RS256 JWTs. Verify with JWKS from discovery.
- Refresh tokens rotate; reuse of an old refresh kills that client–user grant.
- Revoke via the revoke endpoint when the user disconnects.

## Do not

- Do not treat local Kylrix tables as the OAuth grant store — Appwrite owns clients, grants, and tokens.
- Do not put `client_secret` in browser or mobile binaries — use public + PKCE instead.
- Do not confuse this with “Sign in with Google” (OAuth **client** login). This skill is Kylrix as the **provider**.
