# Sign in with Kylrix (OAuth 2.1 / OIDC)

Integrate third-party applications and services with Kylrix using the OpenID Connect (OIDC) and OAuth 2.1 protocol with Authorization Code Flow + Proof Key for Code Exchange (PKCE).

---

## 🧭 Discovery & Endpoints

| Resource | URI |
|---|---|
| **OIDC Discovery URL** | `https://www.kylrix.space/.well-known/openid-configuration` |
| **Authorization Endpoint** | `https://www.kylrix.space/oauth/authorize` |
| **Token Endpoint** | `https://www.kylrix.space/api/v1/oauth/token` |
| **JWKS Keyset** | `https://www.kylrix.space/.well-known/jwks.json` |
| **Userinfo Endpoint** | `https://www.kylrix.space/api/v1/oauth/userinfo` |

---

## 🔒 Authorization Flow with PKCE

1. **Generate PKCE Parameters**:
   - `code_verifier`: 43–128 char cryptographic random string.
   - `code_challenge`: `BASE64URL(SHA256(code_verifier))`.
   - `code_challenge_method`: `S256`.

2. **Redirect User to Authorization Screen**:
   ```
   https://www.kylrix.space/oauth/authorize?
     response_type=code
     &client_id=YOUR_CLIENT_ID
     &redirect_uri=https://your-app.com/callback
     &scope=openid profile email notes:read notes:write
     &state=xyz123
     &code_challenge=CODE_CHALLENGE
     &code_challenge_method=S256
   ```

3. **Exchange Code for Scoped Access Token**:
   ```bash
   curl -X POST https://www.kylrix.space/api/v1/oauth/token \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=authorization_code" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "code=AUTHORIZATION_CODE" \
     -d "redirect_uri=https://your-app.com/callback" \
     -d "code_verifier=ORIGINAL_CODE_VERIFIER"
   ```

4. **Call Protected Kylrix APIs**:
   Pass the returned `access_token` in the `Authorization: Bearer <access_token>` header on any `/api/v1/*` or `/api/v1/mcp` endpoint.
