---
name: oauth2
description: Sign in with Kylrix OAuth 2.1 / OIDC identity provider, authorization code flow with PKCE, consent management, and token exchange.
---

# Kylrix OAuth 2.1 / OIDC Provider

## 1. Identity Provider Architecture
- Better Auth OAuth 2.1 / OIDC server backed by Turso libSQL acts as the identity provider for applications, client registration, consent grants, and token issuance.
- Native RFC 8414 and OIDC discovery endpoints at `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server`.
- Supports both Confidential and Public clients with Authorization Code Flow + PKCE (`S256`).

## 2. Consent & Token Scopes
- Comprehensive scope catalog supporting the full range of workspace operations (`PAT_SCOPES` from `@/lib/api/scopes`), plus standard OIDC scopes (`openid`, `profile`, `email`, `offline_access`, `phone`).
- User consent screens at `/oauth/consent` allow approval and granular scope filtering.
- Issued tokens authenticate against the `/api/v1` API surface and `/api/v1/mcp` endpoints with matching scoped permissions.
