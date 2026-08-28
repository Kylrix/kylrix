'use server';

import { generateAuthenticationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { createSystemClient, createSystemTablesDB } from '@/lib/appwrite-admin';
import { APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_KEYCHAIN_ID } from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query, ID, Permission, Role } from 'node-appwrite';
import { resolvePasskeyRpId } from '@/lib/passkey-webauthn-options';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';
import { withSystemTransaction } from '@/lib/services/internal/transaction';

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
      const { headers } = await import('next/headers');
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
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const secret = getAppwriteSecret();
    const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
    const challengeToken = `${payloadB64}.${sig}`;

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
        Query.equal('credentialId', authResp.id),
        Query.limit(1),
      ]
    );

    if (res.total === 0) {
      return { success: false, error: 'Credential not found' };
    }

    const row = res.rows[0];

    if (row.authPasskey === false) {
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
    const isSelfHosted = isSelfHostedDeployment();
    const systemClient = createSystemClient();
    const db = systemClient.databases;

    // 1. Find user by email
    const usersList = await systemClient.users.list([
      Query.equal('email', email),
      Query.limit(1)
    ]);

    if (usersList.total === 0) {
      return { success: true, exists: false, hasMasterpass: false, isSelfHosted };
    }

    const userId = usersList.users[0].$id;

    // 2. Strict check: masterpass enabled FOR LOGIN (authPass flag) — keychain only
    // New users or users without authPass must NOT see password input (OTP only in cloud)
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

    return { success: true, exists: true, hasMasterpass, userId, isSelfHosted };
  } catch (error: any) {
    console.error('Error checking email auth status action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a new user account with email and password on self-hosted instances.
 */
export async function selfHostedSignUpAction(payload: {
  email: string;
  password: string;
  name?: string;
}) {
  try {
    if (!isSelfHostedDeployment()) {
      return { success: false, error: 'Self-hosted email/password signup is disabled in cloud deployments.' };
    }

    const email = (payload.email || '').trim().toLowerCase();
    const password = payload.password;
    const name = (payload.name || '').trim() || email.split('@')[0];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters.' };
    }

    const systemClient = createSystemClient();
    const { users } = systemClient;

    // Check if user already exists
    const existing = await users.list([
      Query.equal('email', email),
      Query.limit(1)
    ]);

    if (existing.total > 0) {
      return { success: false, error: 'An account with this email already exists. Please log in.' };
    }

    const userId = ID.unique();
    const user = await users.create(
      userId,
      email,
      undefined,
      password,
      name
    );

    // Update preferences so hasPass is true and masterpass login is enabled
    try {
      await users.updatePrefs(userId, {
        hasPass: true,
        masterpass_for_login_enabled: true
      });
    } catch (prefErr) {
      console.warn('Failed to set initial user prefs on signup:', prefErr);
    }

    return { success: true, userId: user.$id };
  } catch (error: any) {
    console.error('Self-hosted signup error:', error);
    return { success: false, error: error.message || 'Failed to create user account' };
  }
}

/**
 * Initializes a user's vault, keychain, identity, and profile using atomic multi-table transaction.
 */
export async function initializeSelfHostedUserVaultAction(payload: {
  userId: string;
  keychain: {
    wrappedKey: string;
    salt: string;
    params?: string;
    isArgon?: boolean;
  };
  identity?: {
    publicKey: string;
    passkeyBlob: string;
  };
  profile?: {
    username: string;
    displayName: string;
  };
}) {
  try {
    if (!isSelfHostedDeployment()) {
      return { success: false, error: 'Self-hosted vault provisioning is not permitted in cloud.' };
    }

    const { userId, keychain, identity, profile } = payload;
    const now = new Date().toISOString();
    const tables: any = createSystemTablesDB();

    await withSystemTransaction(async (txId) => {
      // 1. Keychain Entry
      if (keychain?.wrappedKey && keychain?.salt) {
        await tables.createRow({
          databaseId: APPWRITE_CONFIG.DATABASES.VAULT,
          tableId: APPWRITE_CONFIG.TABLES.VAULT.KEYCHAIN,
          rowId: ID.unique(),
          data: {
            userId,
            type: 'password',
            authPass: true,
            wrappedKey: keychain.wrappedKey,
            salt: keychain.salt,
            params: keychain.params || JSON.stringify({ algo: 'Argon2id', memory: 65536, iterations: 3, parallelism: 4 }),
            isArgon: keychain.isArgon ?? true,
            isPending: false,
            createdAt: now,
            updatedAt: now
          },
          permissions: [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId))
          ],
          transactionId: txId
        });
      }

      // 2. Identity Entry
      if (identity?.publicKey && identity?.passkeyBlob) {
        await tables.createRow({
          databaseId: APPWRITE_CONFIG.DATABASES.PASSWORD_MANAGER,
          tableId: APPWRITE_CONFIG.TABLES.PASSWORD_MANAGER.IDENTITIES,
          rowId: ID.unique(),
          data: {
            userId,
            identityType: 'e2e_connect',
            label: 'Connect E2E Identity',
            publicKey: identity.publicKey,
            passkeyBlob: identity.passkeyBlob,
            createdAt: now,
            updatedAt: now
          },
          permissions: [
            Permission.read(Role.user(userId)),
            Permission.update(Role.user(userId)),
            Permission.delete(Role.user(userId))
          ],
          transactionId: txId
        });
      }

      // 3. User Profile
      if (profile?.username) {
        await tables.createRow({
          databaseId: APPWRITE_CONFIG.DATABASES.CHAT,
          tableId: APPWRITE_CONFIG.TABLES.CHAT.PROFILES,
          rowId: userId,
          data: {
            userId,
            username: profile.username.toLowerCase(),
            displayName: profile.displayName || profile.username,
            publicKey: identity?.publicKey || null,
            tier: 'FREE',
            createdAt: now,
            updatedAt: now
          },
          permissions: [
            Permission.read(Role.any()),
            Permission.update(Role.user(userId))
          ],
          transactionId: txId
        });
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error initializing self-hosted user vault transactionally:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Discovers enabled OAuth providers for the active Appwrite project.
 * On Cloud, defaults to ['google', 'github'].
 * On Self-Hosted, probes the Appwrite project OAuth provider configurations.
 */
export async function getEnabledOAuthProvidersAction(): Promise<{
  success: boolean;
  providers: string[];
}> {
  try {
    if (!isSelfHostedDeployment()) {
      return { success: true, providers: ['google', 'github'] };
    }

    const systemClient = createSystemClient();
    const endpoint = (process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://127.0.0.1/v1').replace(/\/+$/, '');
    const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '';
    const apiKey = process.env.APPWRITE_API || '';

    const discoveredProviders: string[] = [];

    // Probe supported OAuth providers against the Appwrite project
    const candidateProviders = ['google', 'github'];

    for (const provider of candidateProviders) {
      try {
        const testUrl = `${endpoint}/account/sessions/oauth2/${provider}?project=${projectId}`;
        const res = await fetch(testUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: apiKey ? { 'X-Appwrite-Key': apiKey } : {}
        });

        // If provider is configured in Appwrite, it redirects to the OAuth provider (301/302/307/308)
        // If not enabled/configured, Appwrite responds with 400 / 404 / 501 / error JSON
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location') || '';
          if (location && !location.includes('error=')) {
            discoveredProviders.push(provider);
          }
        } else if (res.status === 200) {
          discoveredProviders.push(provider);
        }
      } catch (err) {
        console.warn(`[OAuth Discovery] Probe failed for provider ${provider}:`, err);
      }
    }

    return { success: true, providers: discoveredProviders };
  } catch (error: any) {
    console.error('Error fetching enabled OAuth providers:', error);
    return { success: false, providers: [] };
  }
}
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


