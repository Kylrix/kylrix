# Kylrix Passkey Authentication Flow & Diagnostics

This document outlines the end-to-end flow of the "Continue with Passkey" login mechanism in Kylrix, detailing the client-side logic, API endpoints, server actions, and active debugging context for the `a.get is not a function` error.

---

## 1. Client-Side Trigger: `LoginDrawer`
The entry point of the passkey flow resides inside `components/overlays/LoginDrawer.tsx`. When a user clicks **"Continue with Passkey"**, `handlePasskeyLogin()` is executed:

```typescript
  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    try {
      const hostname = window.location.hostname;
      const hostHeader = window.location.host;
      
      // 1. Fetch options via API Route
      const optionsResponse = await fetch('/api/auth/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: undefined, hostname })
      });
      if (!optionsResponse.ok) {
        throw new Error('Failed to fetch authentication options');
      }
      const optionsRes = await optionsResponse.json();
      if (!optionsRes.success || !optionsRes.options || !optionsRes.challengeToken) {
        throw new Error(optionsRes.error || 'Failed to generate passkey options');
      }

      const authResp = await performNativePasskeyAuthentication(optionsRes.options);

      // 2. Verify assertion response via API Route
      const verifyResponse = await fetch('/api/auth/passkey', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authResp,
          challengeToken: optionsRes.challengeToken,
          hostname,
          hostHeader
        })
      });
      if (!verifyResponse.ok) {
        throw new Error('Passkey verification failed');
      }
      const verifyRes = await verifyResponse.json();

      if (!verifyRes.success || !verifyRes.token) {
        throw new Error(verifyRes.error || 'Passkey verification failed');
      }

      // Complete Appwrite session creation using the minted token
      await account.createSession({ userId: verifyRes.userId, secret: verifyRes.token });
      
      localStorage.setItem('kylrix_last_auth_method', 'passkey');
      localStorage.setItem(`kylrix_has_passkey_${verifyRes.userId}`, 'true');

      toast.success('Authenticated via Passkey!');
      await refreshUser(true);
      close();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        // User cancelled or timed out
        return;
      }
      console.error('Passkey login failed:', err);
      console.log('VERBOSE STACK:', err.stack);
      toast.error(`Passkey login failed: ${err.message}\nStack: ${err.stack?.slice(0, 150)}`);
    } finally {
      setPasskeyLoading(false);
    }
  };
```

---

## 2. WebAuthn Native Client Layer: `webauthn-utils.ts`
To bypass third-party library overhead and proxy issues, native browser WebAuthn API is called inside `lib/webauthn-utils.ts`. 

```typescript
// Sanitization block to clear broken password manager extensions on PublicKeyCredential prototype
if (typeof window !== 'undefined' && (window as any).PublicKeyCredential && (window as any).PublicKeyCredential.prototype.toJSON) {
  try {
    delete (window as any).PublicKeyCredential.prototype.toJSON;
  } catch (e) {
    console.error("Failed to clean up WebAuthn prototype bindings:", e);
  }
}

export function bufferToBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBuffer(base64url: string) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function isWebAuthnGetAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'credentials' in navigator &&
    typeof navigator.credentials?.get === 'function'
  );
}

/** Native WebAuthn assertion (login only — vault unlock uses separate flows). */
export async function performNativePasskeyAuthentication(
  options: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isWebAuthnGetAvailable()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const publicKey: Record<string, unknown> = { ...options };
  publicKey.challenge = base64UrlToBuffer(options.challenge as string);

  const allowCreds = options.allowCredentials;
  if (Array.isArray(allowCreds) && allowCreds.length > 0) {
    publicKey.allowCredentials = allowCreds.map((c: Record<string, unknown>) => ({
      ...c,
      id: base64UrlToBuffer(c.id as string),
    }));
  } else {
    delete publicKey.allowCredentials;
  }

  const assertion = await navigator.credentials.get({
    publicKey: publicKey as unknown as PublicKeyCredentialRequestOptions,
  });
  if (!assertion) {
    throw new Error('Authentication was not completed');
  }

  const credential = assertion as PublicKeyCredential;
  const response = credential.response as AuthenticatorAssertionResponse;

  const cleanPayload = {
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bufferToBase64Url(response.authenticatorData),
      clientDataJSON: bufferToBase64Url(response.clientDataJSON),
      signature: bufferToBase64Url(response.signature),
      userHandle: response.userHandle ? bufferToBase64Url(response.userHandle) : null,
    },
    authenticatorAttachment: credential.authenticatorAttachment || null,
  };

  return cleanPayload as unknown as Record<string, unknown>;
}
```

---

## 3. Server API Layer: `/api/auth/passkey`
To bypass Next.js Server Action argument serialization bottlenecks client-side, the drawer calls the standard API endpoint at `app/api/auth/passkey/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPasskeyLoginOptionsAction, verifyPasskeyLoginAction } from '@/lib/actions/auth-actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, hostname } = body;
    const result = await getPasskeyLoginOptionsAction(email, hostname || 'localhost');
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { authResp, challengeToken, hostname, hostHeader } = body;
    
    const result = await verifyPasskeyLoginAction(
      authResp,
      challengeToken,
      hostname || 'localhost',
      hostHeader || 'localhost'
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

---

## 4. Backend Cryptographic Verification: `auth-actions.ts`
The underlying verification is handled inside `lib/actions/auth-actions.ts` using `@simplewebauthn/server`:

```typescript
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_KEYCHAIN_ID } from '@/lib/appwrite';
import { Query } from 'node-appwrite';
import { resolvePasskeyRpId } from '@/lib/passkey-webauthn-options';
import { createHmac } from 'node:crypto';

/**
 * Generates WebAuthn login options (assertion options) for passkey sign-in.
 */
export async function getPasskeyLoginOptionsAction(email?: string, hostname: string = 'localhost') {
  try {
    const systemClient = createSystemClient();
    const db = systemClient.databases;

    const res = await db.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      email
        ? [Query.equal('type', 'passkey'), Query.equal('userEmail', email)]
        : [Query.equal('type', 'passkey')]
    );

    const allowCredentials = res.rows.map((row: any) => ({
      id: row.credentialId,
      type: 'public-key' as const,
    }));

    const rpID = resolvePasskeyRpId(hostname);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Generate stateless challenge token using our APPWRITE_API secret
    const exp = Date.now() + 300000; // 5 minutes
    const payload = JSON.stringify({ c: options.challenge, e: exp });
    const secret = process.env.APPWRITE_API || 'fallback-dev-secret';
    const sig = createHmac('sha256', secret).update(payload).digest('base64url');
    const challengeToken = Buffer.from(payload).toString('base64url') + '.' + sig;

    return { 
      success: true, 
      options: JSON.parse(JSON.stringify(options)),
      challengeToken
    };
  } catch (error: any) {
    console.error('Error generating passkey options action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifies WebAuthn assertion response and returns an Appwrite custom token.
 */
export async function verifyPasskeyLoginAction(authResp: any, challengeToken: string, hostname: string = 'localhost', hostHeader: string = 'localhost') {
  try {
    const systemClient = createSystemClient();
    const db = systemClient.databases;

    // 1. Find the credential entry in DB
    const res = await db.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      [
        Query.equal('type', 'passkey'),
        Query.equal('credentialId', authResp.id),
        Query.limit(1),
      ]
    );

    if (res.total === 0) {
      return { success: false, error: 'Credential not found' };
    }

    const row = res.rows[0];

    if (!row.authPasskey) {
      return { success: false, error: 'This passkey is not authorized for login' };
    }

    const rpID = resolvePasskeyRpId(hostname);
    
    const protocol = hostname === 'localhost' || hostname.startsWith('127.') ? 'http' : 'https';
    const origin = `${protocol}://${hostHeader}`;

    // Verify stateless challenge token
    const parts = challengeToken.split('.');
    if (parts.length !== 2) {
      return { success: false, error: 'Malformed challenge token' };
    }
    const payloadJson = Buffer.from(parts[0], 'base64url').toString();
    const sig = parts[1];
    const secret = process.env.APPWRITE_API || 'fallback-dev-secret';
    const expectedSig = createHmac('sha256', secret).update(payloadJson).digest('base64url');

    if (sig !== expectedSig) {
      return { success: false, error: 'Invalid challenge signature' };
    }

    const parsed = JSON.parse(payloadJson);
    if (Date.now() > parsed.e) {
      return { success: false, error: 'Login session expired. Please retry.' };
    }
    const expectedChallenge = parsed.c;

    // 2. Verify Authentication Response
    const verification = await verifyAuthenticationResponse({
      response: authResp,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: row.credentialId,
        publicKey: new Uint8Array(Buffer.from(row.publicKey, 'base64')),
        counter: row.params ? (JSON.parse(row.params).counter || 0) : 0,
      },
    });

    if (verification.verified) {
      // Update credential counter in DB if updated
      const { authenticationInfo } = verification;
      if (row.params) {
        try {
          const paramsObj = JSON.parse(row.params);
          paramsObj.counter = authenticationInfo.newCounter;
          await db.updateRow(
            APPWRITE_DATABASE_ID,
            APPWRITE_COLLECTION_KEYCHAIN_ID,
            row.$id,
            { params: JSON.stringify(paramsObj) }
          );
        } catch (e) {
          console.warn('Failed to parse/update credential counter params:', e);
        }
      }

      // Mint a session token for the user
      const users = systemClient.users;
      const sessionToken = await users.createToken(row.userId);

      return {
        success: true,
        verified: true,
        userId: row.userId,
        token: sessionToken.secret,
        wrappedKey: row.wrappedKey || null,
        fallbackSeed: row.fallbackSeed || null
      };
    } else {
      return { success: false, error: 'Passkey signature verification failed' };
    }
  } catch (error: any) {
    console.error('Error verifying passkey action:', error);
    return { success: false, error: error.message };
  }
}
```
