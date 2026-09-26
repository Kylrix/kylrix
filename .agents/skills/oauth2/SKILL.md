---
name: oauth2
description: Sign in with Kylrix OAuth 2.1 / OIDC identity provider, authorization code flow with PKCE, consent management, and token exchange.
---

# Kylrix OAuth 2.1 / OIDC Provider

## 1. Identity Provider Architecture
- Appwrite OAuth 2.1 server acts as the source of truth for applications, consent grants, and token issuance.
- Supports both Confidential and Public clients with Authorization Code Flow + PKCE.

## 2. Consent & Token Scopes
- Consent screens allow users to approve granular resource access before issuing access tokens.
- Issued tokens authenticate against the \`/api/v1\` API surface with matching scopes.
