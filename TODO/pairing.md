# Pairing Flow Investigation: Valid Code Reported Missing or Expired

## Status

The pairing flow is currently unresolved. The user reports that opening a valid
URL such as `http://localhost:3005/pair?code=.......` produces:

```text
Pairing code not found or expired.
```

The code may be valid and within the 15-minute pairing window. Account/profile
resolution in the browser appears to be the timing-sensitive part of the report:
the top-bar profile icon has not finished appearing while the sync UI is still
visible, and the browser flow is completing before or during account resolution.

No claim should be made that the underlying pairing API is broken until the
browser session and actual requested code are reproduced together.

## Problem Statement

A user initiates device pairing from a CLI or another client. The client creates
a pairing session and opens a browser URL containing the generated user code.
The browser should be able to:

1. Load the `/pair` page.
2. Verify the user code through the public pairing verification API.
3. Resolve whether the browser has a logged-in account.
4. Display the client and requested scopes.
5. Require a logged-in browser account to approve the pairing.
6. Create a user-scoped PAT/punch token for the approved account.
7. Let the original client exchange its device code for that token.

The browser currently reports the code as missing or expired even when the API
test confirms the code exists. This indicates a possible mismatch or race
between:

- The browser request and the Next.js server process handling it.
- The pairing request endpoint and verification endpoint.
- Browser account resolution and page initialization.
- The URL/host used to generate the verification link.
- In-memory pairing state across server route/module instances or hot reload.
- The code sent to verification, including normalization and URL encoding.

## Architecture

The pairing API is handled by
`app/api/v1/[...path]/route.ts`, which routes `/api/v1/pairing/*` to
`lib/api/v1/pairing-handler.ts`.

The relevant methods are in `lib/services/pairing.ts`:

- `requestPairing()` creates a device code and human-readable user code.
- `lookupByUserCode()` verifies a user code.
- `decidePairing()` approves or denies a pairing request.
- `exchangeDeviceCode()` returns a punch token after approval.

The browser UI is `app/(app)/pair/page.tsx`.

The browser verification call is:

```text
GET /api/v1/pairing/verify?code=<encoded-code>
```

The browser approval call is:

```text
POST /api/v1/pairing/approve
```

Approval is user-dependent because it creates a PAT for `userId`:

```text
PatService.create({ userId, name, scopes, keyCategory: 'punch_token' })
```

The CLI flow starts pairing from `packages/cli/src/commands/auth.ts`.
The pairing SDK client starts the same flow from `sdk/pairing-client.ts`.

## Observed Behavior

The browser page currently uses `account.get()` to resolve the logged-in account
and separately looks up the code in `useEffect`.

The user reports that the pairing code lookup can show:

```text
Pairing code not found or expired.
```

while the browser session/account UI is still resolving. The top-bar profile
icon and other account-dependent UI have not necessarily appeared by the time
this code error is shown.

## Live API Test

On 2026-11-22, the local Next.js server was tested at `localhost:3005`.

### 1. Pairing request

The following endpoint was called:

```text
POST http://localhost:3005/api/v1/pairing/request
```

It returned:

- HTTP 200
- `ok: true`
- generated user code: `CNEP-4X8Q`
- generated device code:
  `dev_mY3JRs9h3JGdbVBVte7mTGciykENkY_E`
- status: `pending`
- expiry: 900 seconds

### 2. Pairing verification

The generated code was immediately verified:

```text
GET http://localhost:3005/api/v1/pairing/verify?code=CNEP-4X8Q
```

The response was:

```json
{
  "ok": true,
  "data": {
    "found": true,
    "session": {
      "id": "01M818GY556KV2P052GSJRVY7W",
      "clientName": "Kylrix API Flow Test",
      "clientType": "cli",
      "status": "pending"
    }
  }
}
```

This proves that, for the tested code and live server instance, the pairing
request and verification routes work and the code is preserved in the current
memory store.

### 3. Device exchange while pending

The test device code was polled while pending:

```text
POST http://localhost:3005/api/v1/pairing/exchange
```

The response was:

```json
{
  "ok": false,
  "error": {
    "code": "authorization_pending",
    "message": "Authorization pending user approval"
  }
}
```

This confirms that the API can associate the device code with the pending
pairing session and can distinguish a pending state from a missing/expired one.

## Existing Implementation and Findings

### Pairing service

`lib/services/pairing.ts` originally stored sessions only in module-local Maps:

- `memorySessionsByUserCode`
- `memorySessionsByDeviceCode`

This is not durable storage. It is process/module-instance state. Session
persistence depends on which server process or route-module bundle handles each
request.

The service now also stores the Maps on `globalThis` under
`__kylrix_pairing_memory_store__`. This helps routes and hot-reload module
instances share state inside the same process, but it does not provide:

- Cross-process persistence.
- Durable Turso/database storage.
- Cluster/load-balancer consistency.
- Persistence across full server restart.

The live API test passed after this change, but it may not reproduce separate
server contexts or a real deployed/browser environment.

### User-code normalization

`normalizeUserCode()` trims, uppercases, removes whitespace, and adds a hyphen
if it receives an eight-character code. It also preserves legacy `KYL-`-prefix
codes for backward compatibility.

Tests exist for:

- eight characters without a hyphen,
- hyphenated codes,
- lowercase codes,
- whitespace,
- legacy `KYL-` codes,
- wildcard scope normalization.

The browser sends the code from `useSearchParams()`, uppercases it, and encodes
it in the verification URL. This is compatible with the service's current
normalization.

### Host URL construction

The pairing request endpoint constructs its verification URL from:

```text
req.nextUrl.protocol
req.nextUrl.host
```

The live API test generated:

```text
http://0.0.0.0:3005/pair?code=CNEP-4X8Q
```

The user was attempting to open `localhost:3005`. This host mismatch is a real
issue that can affect callback/login behavior in some environments. It should
be corrected to derive the public browser origin explicitly or to use the
request Origin/Host in a validated way.

The CLI also derives its browser URL from the API URL:

```text
env.apiUrl.replace(/\/api\/v1$/, '')
```

This can diverge from the URL returned by `verificationUriComplete`.

### Account-resolution timing

The original pair page performed account resolution and pairing verification
through separate effects:

- one effect called `account.get()`;
- another effect called `lookupCode(initialCode)`.

This creates no direct dependency between account resolution and code lookup,
which is the behavior that should remain for verification.

A later attempted patch added `accountResolved` and deliberately made the initial
code lookup wait until `account.get()` finished. That patch was conceptually
wrong: verification is public and does not require a browser account.

The patch was subsequently reversed so that verification can run immediately.
Account resolution is now retried at approval time if not already available.

This change does not explain or fix all possible missing-code errors, but it
does remove account resolution as a gate for public code verification.

### Browser approval

`handleDecide()` should require a logged-in browser account for approval.
The verification endpoint should remain public.

The browser currently sends `userId` in the approval body, but the API handler
is designed to override it with its own account resolution:

1. Web-session actor via `getActor()`
2. API actor via `resolveApiActor(req)`
3. Body `userId` only as a fallback

Even though the browser fallback exists, approval should rely on the server-side
authenticated actor rather than accepting a client-supplied `userId`.

## Changes Already Attempted

### Attempt 1: Process-global pairing store

Commit: `82ff91a`

The `memorySessionsByUserCode` and `memorySessionsByDeviceCode` Maps were moved
from module-local constants to a `globalThis`-backed store.

Goal: allow pairing request and verification routes to share session state even
if Turbopack/HMR loads the pairing module in more than one route-module instance.

### Attempt 2: Wait for account resolution before verification

Commit: `82eb925`

An `accountResolved` state was added. The initial code lookup was gated behind
`account.get()`.

This was later recognized as a race-prone coupling: account resolution is not
needed to verify whether a code exists.

### Attempt 3: Decouple verification from account resolution

Commit: `1f56b92`

The `accountResolved` gate was removed.

The code lookup now runs immediately when the `/pair` page receives `initialCode`.
Account resolution remains in the background and is retried in `handleDecide()`
before approving or denying.

No build or lint was run for these changes.

## What Is Not Proven

The live API test did not reproduce the browser's logged-in session flow.
It did not approve a code through the browser session.
It did not test the exact code from the user's reported browser URL.
It did not test a full server restart or separate server worker.
It did not test the deployed domain versus localhost.
It did not inspect the browser network request and response for the exact failing
code.

The API test proves that this implementation can verify a code in a simple
same-server flow. It does not prove that the real user's browser code is present
in the specific server/module instance serving `/pair`.

## Most Likely Remaining Causes

1. The pairing code was created in one server process or route module instance
   and verified in another.
2. The Next.js server lost or replaced in-memory pairing state due to restart,
   hot reload, worker isolation, or route bundle/module duplication.
3. The browser is opening a different origin/host than the server that created
   the code.
4. The generated `verificationUriComplete` contains `0.0.0.0:3005` instead of
   `localhost:3005`, causing origin mismatches or wrong server routing.
5. The browser's actual code differs by character, case, URL encoding, or
   whitespace from the code displayed or created in the CLI.
6. The code has genuinely expired after 900 seconds.
7. The browser request is not reaching the same backend session that handled
   `requestPairing()`.
8. The browser account is not resolved, but approval—not verification—is being
   affected by that state.

## Required Diagnostic Work

Before another code change, capture:

- The exact user code generated by the CLI.
- The exact verification URL opened.
- Browser request URL to
  `/api/v1/pairing/verify?code=...`.
- Browser response status and JSON body.
- Server timestamp and request host.
- Server/worker identifier if available.
- Whether the code also fails through `curl` immediately after creation.
- Whether HMR, Next.js restart, or route recompilation occurred between request
  and verification.
- Whether the browser account endpoint resolved successfully:
  `account.get()`.

## Durable Fix Required

The robust fix is to persist pairing sessions in Turso/database-backed storage
rather than in process memory.

At minimum, create a pairing sessions table with:

- user code
- device code
- client ID/name/type
- requested scopes
- status
- created timestamp
- expiry timestamp
- approved user ID
- granted scopes
- punched PAT ID/token reference
- exchange timestamp

Lookup, approval, and exchange must use the same durable record.

Use indexed, normalized user-code lookup and device-code lookup. Mark expired
states and prevent repeated approval/exchange. Do not store raw secrets or bearer
tokens in browser-visible fields or logs.

## Temporary Mitigations

Until durable storage exists:

- Keep the verification lookup immediate and independent of account loading.
- Generate browser URLs using the validated public application origin.
- Do not generate verification URLs with `0.0.0.0`.
- Return enough diagnostic server state to distinguish missing, expired, denied,
  and already-approved sessions.
- Require approval only after an authenticated browser actor is resolved.
- Keep the original client polling so it can report pending separately from
  missing/expired.

## Conclusion

The account-resolution hypothesis is real on the approval side, but it is not
the correct reason to gate verification. A public pairing code should be
verified without waiting for `account.get()`.

The live API test shows that request, verification, and pending exchange all
work within one local server instance. The unresolved report is therefore most
likely session continuity across browser/backend context or host/module
isolation, not user-code normalization alone.
