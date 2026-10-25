'use server';

import { generateAuthenticationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { ulid } from '@/lib/utils/ulid';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { resolvePasskeyRpId } from '@/lib/passkey-webauthn-options';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';
import {
  isEmailPasswordSignupEnabled,
  getAuthMethodPolicy,
} from '@/lib/config/auth-methods';

function getAppwriteSecret(): string {
  return process.env.APPWRITE_API || process.env.BETTER_AUTH_SECRET || 'secret-key-fallback';
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
    } catch {}
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

export async function getPasskeyLoginOptionsAction(email?: string, hostname?: string) {
  try {
    let allowCredentials: { id: string; type: 'public-key' }[] = [];

    if (email) {
      const usersList = await db.select().from(schema.user).where(eq(schema.user.email, email.trim().toLowerCase())).limit(1);

      if (usersList.length > 0) {
        const userId = usersList[0].id;
        const keychainRows = await db
          .select()
          .from(schema.keychain)
          .where(and(eq(schema.keychain.userId, userId), eq(schema.keychain.type, 'passkey')));

        allowCredentials = keychainRows.map((k) => {
          let meta: any = {};
          try { meta = typeof k.metadata === 'string' ? JSON.parse(k.metadata) : (k.metadata || {}); } catch {}
          const credId = meta.credentialId || k.account;
          return {
            id: credId,
            type: 'public-key' as const,
          };
        }).filter((c) => Boolean(c.id));
      }
    }

    const { rpID } = await resolveOrigin(hostname);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred'});

    const exp = Date.now() + 300000;
    const payload = JSON.stringify({ c: options.challenge, e: exp });
    const payloadB64 = Buffer.from(payload).toString('base64url');
    const secret = getAppwriteSecret();
    const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
    const challengeToken = `${payloadB64}.${sig}`;

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

export async function listAccountLogsSecure(jwt?: string) {
  try {
    const { getActor } = await import('./secure-ops/shared');
    const actor = await getActor(jwt);
    if (!actor || !actor.$id) {
      return { success: true, logs: [] };
    }

    const allLogs: any[] = [];

    try {
      const tursoLogs = await db
        .select()
        .from(schema.activityLog)
        .where(eq(schema.activityLog.userId, actor.$id))
        .orderBy(desc(schema.activityLog.createdAt))
        .limit(100);

      if (tursoLogs && tursoLogs.length > 0) {
        for (const l of tursoLogs) {
          allLogs.push({
            $id: l.id,
            event: l.action,
            eventType: l.action,
            userId: l.userId,
            ip: '127.0.0.1',
            geo: '',
            clientName: l.resourceType || 'Kylrix System',
            deviceType: 'desktop',
            time: l.createdAt,
            $createdAt: l.createdAt,
          });
        }
      }

      const sessions = await db
        .select()
        .from(schema.session)
        .where(eq(schema.session.userId, actor.$id))
        .orderBy(desc(schema.session.createdAt))
        .limit(10);

      for (const s of sessions) {
        const createdAtIso = s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString();
        if (!allLogs.some(l => l.$id === `sess-log-${s.id}`)) {
          allLogs.push({
            $id: `sess-log-${s.id}`,
            event: 'account.sessions.create',
            eventType: 'account.sessions.create',
            userId: actor.$id,
            ip: s.ipAddress || '127.0.0.1',
            geo: '',
            clientName: s.userAgent || 'Web Browser',
            deviceType: /mobile|android|iphone/i.test(s.userAgent || '') ? 'mobile' : 'desktop',
            time: createdAtIso,
            $createdAt: createdAtIso,
          });
        }
      }
    } catch (err: any) {
      console.warn('[listAccountLogsSecure] Turso activityLog query warning:', err.message);
    }

    allLogs.sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
    return { success: true, logs: allLogs };
  } catch (error: any) {
    console.error('Error fetching account activity logs:', error);
    return { success: true, logs: [] };
  }
}

export async function verifyPasskeyLoginAction(
  authResp: any, 
  challengeToken: string, 
  hostname?: string, 
  hostHeader?: string
) {
  try {
    let row: any = null;

    try {
      const keychainRows = await db
        .select()
        .from(schema.keychain)
        .where(eq(schema.keychain.type, 'passkey'));

      for (const k of keychainRows) {
        let meta: any = {};
        try {
          meta = typeof k.metadata === 'string' ? JSON.parse(k.metadata) : (k.metadata || {});
        } catch {}
        const credId = meta.credentialId || (k.account !== 'passkey' && k.account !== 'masterpass' ? k.account : null);
        if (credId === authResp.id) {
          row = {
            $id: k.id,
            userId: k.userId,
            credentialId: credId,
            publicKey: meta.publicKey,
            params: k.nonce || meta.params || null,
            authPasskey: meta.authPasskey !== false,
            wrappedKey: k.encryptedPayload,
            fromTurso: true,
          };
          break;
        }
      }
    } catch (tursoErr) {
      console.warn('[verifyPasskeyLoginAction] Turso keychain lookup warning:', tursoErr);
    }

    if (!row) {
      return { success: false, error: 'Credential not found' };
    }

    if (row.authPasskey === false) {
      return { success: false, error: 'This passkey is not authorized for login' };
    }

    const { rpID, origin } = await resolveOrigin(hostname, hostHeader);

    const challengeCheck = verifyChallengeToken(challengeToken);
    if (!challengeCheck.valid) {
      return { success: false, error: challengeCheck.expired ? 'Login session expired. Please retry.' : 'Invalid challenge token' };
    }

    const expectedChallenge = challengeCheck.challenge;

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
      const { authenticationInfo } = verification;
      if (row.params) {
        try {
          const paramsObj = JSON.parse(row.params);
          paramsObj.counter = authenticationInfo.newCounter;
          await db
            .update(schema.keychain)
            .set({ nonce: JSON.stringify(paramsObj), updatedAt: new Date().toISOString() })
            .where(eq(schema.keychain.id, row.$id));
        } catch (e) {
          console.warn('Failed to update passkey counter:', e);
        }
      }

      const { cookies } = await import('next/headers');
      const userRows = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.id, row.userId))
        .limit(1);

      if (userRows.length === 0) {
        await db.insert(schema.user).values({
          id: row.userId,
          name: 'User',
          email: `${row.userId}@kylrix.local`,
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const sessionToken = ulid();
      const sessionId = ulid();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await db.insert(schema.session).values({
        id: sessionId,
        userId: row.userId,
        token: sessionToken,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const cookieStore = await cookies();
      cookieStore.set('better-auth.session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });

      const fallbackSeed = createHmac('sha256', getAppwriteSecret())
        .update(row.credentialId + row.userId)
        .digest('base64');

      return {
        success: true,
        verified: true,
        token: sessionToken,
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

export async function getPasskeyRegisterFallbackSeedAction(credentialId: string) {
  try {
    const { getActor } = await import('./secure-ops/shared');
    const actor = await getActor();
    if (!actor?.$id) throw new Error('Unauthorized');

    const fallbackSeed = createHmac('sha256', getAppwriteSecret())
      .update(credentialId + actor.$id)
      .digest('base64');

    return { success: true, seed: fallbackSeed };
  } catch (error: any) {
    console.error('Error generating fallback seed action:', error);
    return { success: false, error: error.message };
  }
}

export type EmailAuthStatusResult =
  | ({
      success: true;
      exists: boolean;
      hasMasterpass: boolean;
      userId?: string;
    } & ReturnType<typeof getAuthMethodPolicy>)
  | { success: false; error: string };

export async function checkEmailAuthStatusAction(email: string): Promise<EmailAuthStatusResult> {
  try {
    const authPolicy = getAuthMethodPolicy();
    const cleanEmail = email.trim().toLowerCase();

    const usersList = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, cleanEmail))
      .limit(1);

    if (usersList.length === 0) {
      return { success: true, exists: false, hasMasterpass: false, ...authPolicy };
    }

    const userId = usersList[0].id;
    let hasMasterpass = false;

    try {
      const keychainRows = await db
        .select()
        .from(schema.keychain)
        .where(and(eq(schema.keychain.userId, userId), eq(schema.keychain.type, 'password')));

      if (keychainRows.length > 0) {
        hasMasterpass = true;
      }
    } catch (e) {
      console.warn('Error checking keychain table for masterpass:', e);
    }

    return { success: true, exists: true, hasMasterpass, userId, ...authPolicy };
  } catch (error: any) {
    console.error('Error checking email auth status action:', error);
    return { success: false, error: error.message };
  }
}

export async function selfHostedSignUpAction(payload: {
  email: string;
  password: string;
  name?: string;
}) {
  try {
    if (!isEmailPasswordSignupEnabled()) {
      return { success: false, error: 'Email/password signup is disabled on this instance.' };
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

    const existing = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'An account with this email already exists. Please log in.' };
    }

    const userId = ulid();
    const now = new Date();

    await db.insert(schema.user).values({
      id: userId,
      email,
      name,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, userId };
  } catch (error: any) {
    console.error('Self-hosted signup error:', error);
    return { success: false, error: error.message || 'Failed to create user account' };
  }
}

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

    if (keychain?.wrappedKey && keychain?.salt) {
      await db.insert(schema.keychain).values({
        id: ulid(),
        userId,
        account: 'masterpass',
        type: 'password',
        encryptedPayload: keychain.wrappedKey,
        nonce: keychain.salt,
        metadata: keychain.params || JSON.stringify({ algo: 'Argon2id', memory: 65536, iterations: 3, parallelism: 4 }),
        createdAt: now,
        updatedAt: now,
      });
    }

    if (profile?.username) {
      await db.insert(schema.profiles).values({
        id: ulid(),
        userId,
        username: profile.username.toLowerCase(),
        displayName: profile.displayName || profile.username,
        publicKey: identity?.publicKey || null,
        status: 'FREE',
        createdAt: now,
        updatedAt: now,
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error initializing self-hosted user vault transactionally:', error);
    return { success: false, error: error.message };
  }
}

export async function getEnabledOAuthProvidersAction(): Promise<{
  success: boolean;
  providers: string[];
}> {
  return { success: true, providers: ['google', 'github'] };
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
