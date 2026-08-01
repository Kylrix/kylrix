---
name: system.oauth2-sign-in-with-kylrix
description: >-
  Appwrite OAuth2 Server (Sign in with Kylrix) schema and wiring. Tables
  oauth_apps, oauth_app_installs, oauth_consent_requests. Consent URL
  https://www.kylrix.space/oauth/consent. Use when changing OAuth IdP,
  Developers OAuth apps, or Connected Apps installs.
---

# Sign in with Kylrix (Appwrite OAuth2 Server)

Appwrite project acts as **OIDC / OAuth2 IdP**. Discovery:

`https://fra.cloud.appwrite.io/v1/oauth2/<projectId>/.well-known/openid-configuration`

Console: Auth → OAuth2 server → **Active**; Authorization URL → **`https://www.kylrix.space/oauth/consent`**; scopes `openid` `profile` `email` (+ later Kylrix custom from `lib/api/scopes.ts`).

## Tables (`passwordManagerDb`)

| Table | Role |
|-------|------|
| `oauth_apps` | Developer-registered clients (mirror / product UI). `clientId` unique. Confidential vs public (`clientType`). Secret stored as `clientSecretHash` only. |
| `oauth_app_installs` | User grants (“External apps”). Unique `(userId, appId)`. |
| `oauth_consent_requests` | Pending consent screen state (PKCE challenge, scopes, redirect, continue URL back into Appwrite authorize). |

### Additive columns (do not reshape)

**oauth_apps:** `clientType`, `description`, `homepageUrl`, `logoUrl`, `privacyPolicyUrl`, `termsUrl`, `contactEmail`, `grantTypes`, `tokenEndpointAuthMethod`, `updatedAt`, `lastUsedAt`

**oauth_app_installs:** `clientId`, `updatedAt`, `revokedAt`, `lastUsedAt`, `consentRequestId`

**oauth_consent_requests:** `clientId`, `userId`, `redirectUri`, `requestedScopes`, `state`, `nonce`, `codeChallenge`, `codeChallengeMethod`, `responseType`, `status` (pending|approved|denied|expired), `continueUrl`, `requestMeta`, `createdAt`, `expiresAt`, `decidedAt`

## Flow (product)

1. Client registers (Appwrite `/register` and/or Developers UI → `oauth_apps`).
2. Client hits Appwrite authorize → redirects to Kylrix consent.
3. Consent creates/updates `oauth_consent_requests`; on approve writes `oauth_app_installs` and continues Appwrite authorize.
4. Tokens issued by Appwrite (not stored in plaintext in our DB).

## Schema rules

Follow `system.appwrite-cli-ops`: additive only; **no** deprecated `string`; never push tables.
