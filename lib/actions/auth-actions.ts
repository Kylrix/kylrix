import { generateAuthenticationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_KEYCHAIN_ID } from '@/lib/appwrite';
import { Query } from 'node-appwrite';
import { resolvePasskeyRpId } from '@/lib/passkey-webauthn-options';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { headers } from 'next/headers';

function getAppwriteSecret(): string {
  const secret = process.env.APPWRITE_API;
  if (!secret) {
    throw new Error('FATAL: APPWRITE_API environment variable is not defined.');
  }
  return secret;
}

async function resolveOrigin(overrideHostname?: string, overrideHostHeader?: string): Promise<{ rpID: string; origin: string }> {
  let hostname = overrideHostname;
  let host = overrideHostHeader;

  if (!hostname || !host) {
    try {
      const headerStore = await headers();
      const headerHost = headerStore.get('host');
      if (headerHost) {
        host = headerHost;
        hostname = headerHost.split(':')[0];
      }
    } catch {
      // Fallback if headers() is unavailable
    }
  }

  hostname = hostname || 'localhost';
  host = host || 'localhost';

  const rpID = resolvePasskeyRpId(hostname);
  const protocol = hostname === 'localhost' || hostname.startsWith('127.') ? 'http' : 'https';

  return { rpID, origin: `${protocol}://${host}` };
}

function verifyChallengeToken(challengeToken: string): { valid: boolean; challenge?: string; expired?: boolean } {
  const parts = challengeToken.split('.');
  if (parts.length !== 2) return { valid: false };

  const [payloadB64, sig] = parts;
  let secret: string;
  try {
    secret = getAppwriteSecret();
  } catch {
    return { valid: false };
  }

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');

  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');

  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (Date.now() > payload.e) {
      return { valid: false, expired: true };
    }
    return { valid: true, challenge: payload.c };
  } catch {
    return { valid: false };
  }
}

/**
 * Generates WebAuthn login options (assertion options) for passkey sign-in.
 */
export async function getPasskeyLoginOptionsAction(email?: string, hostname?: string) {
  try {
    const systemClient = createSystemClient();
    const db = systemClient.databases;

    let allowCredentials: { id: string; type: 'public-key' }[] = [];

    if (email) {
      const usersList = await systemClient.users.list([
        Query.equal('email', email),
        Query.limit(1)
      ]);

      if (usersList.total > 0) {
        const res = await db.listRows(
          APPWRITE_DATABASE_ID,
          APPWRITE_COLLECTION_KEYCHAIN_ID,
          [
            Query.equal('type', 'passkey'),
            Query.equal('authPasskey', true),
            Query.equal('userId', usersList.users[0].$id)
          ]
        );
        allowCredentials = res.rows.map((row: any) => ({
          id: row.credentialId,
          type: 'public-key' as const
        }));
      }
    }

    const { rpID } = await resolveOrigin(hostname);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred'});

    // Generate stateless challenge token using our APPWRITE_API secret
    const exp = Date.now() + 300000; // 5 minutes
    const payload = JSON.stringify({ c: options.challenge, e: exp });
    const secret = getAppwriteSecret();
    const sig = createHmac('sha256', secret).update(payload).digest('base64url');
    const challengeToken = Buffer.from(payload).toString('base64url') + '.' + sig;

    // Serialize options to JSON-friendly format for RSC/Actions transport
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
export async function verifyPasskeyLoginAction(
  authResp: any, 
  challengeToken: string, 
  hostname?: string, 
  hostHeader?: string
) {
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

    const { rpID, origin } = await resolveOrigin(hostname, hostHeader);

    // Verify stateless challenge token with timing-safe comparison
    const challengeCheck = verifyChallengeToken(challengeToken);
    if (!challengeCheck.valid) {
      return { success: false, error: challengeCheck.expired ? 'Login session expired. Please retry.' : 'Invalid challenge token' };
    }

    const expectedChallenge = challengeCheck.challenge;

    // 2. Verify Authentication Response
    const verification = await verifyAuthenticationResponse({
      response: authResp,
      expectedChallenge: expectedChallenge!,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: row.credentialId,
        publicKey: Uint8Array.from(Buffer.from(row.publicKey, 'base64')),
        counter: row.params ? (JSON.parse(row.params).counter || 0) : 0}});

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
          console.warn('Failed to update passkey counter:', e);
        }
      }

      // 3. Mint Appwrite Custom Token
      const token = await systemClient.users.createToken(row.userId);

      // Generate secure HMAC fallback seed for clients lacking WebAuthn PRF
      const fallbackSeed = createHmac('sha256', getAppwriteSecret())
        .update(row.credentialId + row.userId)
        .digest('base64');

      return {
        success: true,
        verified: true,
        token: token.phrase || token.secret,
        userId: row.userId,
        wrappedKey: row.wrappedKey,
        fallbackSeed};
    }

    return { success: false, error: 'Invalid WebAuthn assertion' };
  } catch (error: any) {
    console.error('Error verifying passkey action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Returns a server-signed fallback seed for registering passkeys in browsers without PRF support.
 */
export async function getPasskeyRegisterFallbackSeedAction(credentialId: string) {
  try {
    const { createServerClient } = await import('@/lib/appwrite/server');
    const { account } = await createServerClient();
    const user = await account.get();

    const fallbackSeed = createHmac('sha256', getAppwriteSecret())
      .update(credentialId + user.$id)
      .digest('base64');

    return { success: true, seed: fallbackSeed };
  } catch (error: any) {
    console.error('Error generating fallback seed action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Checks if a user exists by email and if they have a master password.
 */
export async function checkEmailAuthStatusAction(email: string) {
  try {
    const systemClient = createSystemClient();
    const db = systemClient.databases;

    // 1. Find user by email
    const usersList = await systemClient.users.list([
      Query.equal('email', email),
      Query.limit(1)
    ]);

    if (usersList.total === 0) {
      return { success: true, exists: false, hasMasterpass: false };
    }

    const userId = usersList.users[0].$id;

    // 2. Strict check: masterpass enabled FOR LOGIN (authPass flag) — keychain only
    // New users or users without authPass must NOT see password input (OTP only)
    let hasMasterpass = false;
    try {
      const keychainRows = await db.listRows(
        APPWRITE_DATABASE_ID,
        APPWRITE_COLLECTION_KEYCHAIN_ID,
        [
          Query.equal('userId', userId),
          Query.equal('type', 'password'),
          Query.equal('authPass', true),
          Query.limit(1)
        ]
      );
      if (keychainRows.total > 0) {
        hasMasterpass = true;
      }
    } catch (e) {
      console.warn('Error checking keychain table for authPass:', e);
    }

    return { success: true, exists: true, hasMasterpass, userId };
  } catch (error: any) {
    console.error('Error checking email auth status action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifies a passkey registration response on the server and returns the correct COSE public key.
 */
export async function verifyPasskeyRegistrationAction(
  registrationResponse: any,
  expectedChallenge: string,
  hostname?: string,
  hostHeader?: string
) {
  try {
    const { rpID, origin } = await resolveOrigin(hostname, hostHeader);

    const verification = await verifyRegistrationResponse({
      response: registrationResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID});

    if (verification.verified && verification.registrationInfo) {
      const regInfo = verification.registrationInfo as any;
      const credentialPublicKey = regInfo.credential?.publicKey || regInfo.credentialPublicKey;
      if (!credentialPublicKey) {
        return { success: false, error: 'Registration returned empty public key' };
      }
      const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64');
      return { success: true, publicKey: publicKeyBase64 };
    }
    console.error('Registration verification failed. Response detail:', verification);
    return { success: false, error: 'Registration verification failed on verification constraints' };
  } catch (error: any) {
    console.error('Error verifying passkey registration:', error);
    return { success: false, error: error.message };
  }
}


