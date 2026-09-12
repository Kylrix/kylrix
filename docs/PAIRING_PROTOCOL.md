# Kylrix Pairing Protocol & Punch Grant Specification (RFC 8628)

## Overview
The **Kylrix Pairing Protocol** is an RFC 8628-inspired device authorization and punch-grant authentication mechanism. It enables seamless, user-scoped authentication for:
1. **CLI Tools** (e.g. `kylrix auth login` from headless terminal environments).
2. **Self-Hosted Replication** (one-click punch pairing between self-hosted Kylrix instances and Kylrix Cloud without copy-pasting PATs).
3. **Mobile Companion Apps** (fast QR/short-code pairing).

---

## Architectural Flow

```
+----------------+                               +--------------------+
|  Client (CLI/  |                               |    Kylrix Node     |
|  Self-Hosted)  |                               |      (Cloud)       |
+----------------+                               +--------------------+
        |                                                   |
        | 1. POST /api/v1/pairing/request                   |
        |-------------------------------------------------->|
        |                                                   | (Creates pending session in
        |                                                   |  oauth_consent_requests)
        | 2. Returns userCode, deviceCode, verificationUri  |
        |<--------------------------------------------------|
        |                                                   |
        | [User visits verificationUri on browser]          |
        | [User signs in and confirms scopes]               |
        |                                                   |
        | 3. POST /api/v1/pairing/exchange (poll)           |
        |-------------------------------------------------->|
        |    (HTTP 428: authorization_pending)              |
        |<--------------------------------------------------|
        |                                                   |
        |    (User approves -> mints kyl_punch_ token)      |
        |                                                   |
        | 4. POST /api/v1/pairing/exchange (poll)           |
        |-------------------------------------------------->|
        |    (HTTP 200: access_token = kyl_punch_...)       |
        |<--------------------------------------------------|
```

---

## Endpoints

### 1. Request Pairing
- **Endpoint**: `POST /api/v1/pairing/request`
- **Auth**: Public / Unauthenticated
- **Payload**:
  ```json
  {
    "clientName": "CLI Terminal (macOS)",
    "clientType": "cli",
    "requestedScopes": ["notes:read", "notes:write", "goals:read", "goals:write"]
  }
  ```
- **Response**:
  ```json
  {
    "ok": true,
    "data": {
      "id": "req_...",
      "deviceCode": "dev_...",
      "userCode": "KYL-8F29",
      "verificationUri": "https://www.kylrix.space/pair",
      "verificationUriComplete": "https://www.kylrix.space/pair?code=KYL-8F29",
      "expiresIn": 900,
      "interval": 5,
      "clientName": "CLI Terminal (macOS)",
      "clientType": "cli",
      "requestedScopes": ["notes:read", "notes:write", "goals:read", "goals:write"],
      "status": "pending"
    }
  }
  ```

### 2. Verify Pairing Code (Web)
- **Endpoint**: `GET /api/v1/pairing/verify?code=KYL-8F29`
- **Auth**: Authenticated via Web Session
- **Response**:
  ```json
  {
    "ok": true,
    "data": {
      "found": true,
      "session": {
        "id": "req_...",
        "clientName": "CLI Terminal (macOS)",
        "clientType": "cli",
        "requestedScopes": ["notes:read", "notes:write", "goals:read", "goals:write"],
        "status": "pending",
        "expiresAt": "2026-09-12T16:00:00Z"
      }
    }
  }
  ```

### 3. Approve Pairing (Web)
- **Endpoint**: `POST /api/v1/pairing/approve`
- **Auth**: Authenticated via Web Session
- **Payload**:
  ```json
  {
    "userCode": "KYL-8F29",
    "action": "approve",
    "grantedScopes": ["notes:read", "notes:write"]
  }
  ```
- **Result**: Mints a user-scoped punch token (`kyl_punch_...`) and saves it to the session record.

### 4. Exchange Device Code
- **Endpoint**: `POST /api/v1/pairing/exchange`
- **Auth**: Public / Secret Device Code
- **Payload**:
  ```json
  {
    "device_code": "dev_..."
  }
  ```
- **Pending Response (HTTP 428)**:
  ```json
  {
    "ok": false,
    "error": {
      "code": "authorization_pending",
      "message": "Authorization pending user approval"
    }
  }
  ```
- **Approved Response (HTTP 200)**:
  ```json
  {
    "ok": true,
    "data": {
      "access_token": "kyl_punch_pfx_secret",
      "token_type": "Bearer",
      "user_id": "usr_...",
      "scopes": ["notes:read", "notes:write"]
    }
  }
  ```

---

## Token Format
Punch tokens are minted under the `punch_token` category and use the prefix:
```
kyl_punch_<prefix>_<secret>
```
They are fully recognized by the API Gateway (`withApiGuard`), have sliding refresh capability, and are bound strictly to the user's personal account.

---

## TypeScript SDK Usage

```typescript
import { PairingClient } from '@/sdk';

// 1. Initiate pairing
const pairing = new PairingClient('https://www.kylrix.space/api/v1');
const session = await pairing.requestPairing({
  clientName: 'My CLI Tool',
  clientType: 'cli',
});

console.log(`Visit ${session.verificationUri} and enter: ${session.userCode}`);

// 2. Poll for punch token
const { token, userId } = await pairing.pollExchange(session.deviceCode);
console.log(`Authenticated as user ${userId}! Access Token: ${token}`);
```
