'use server';

import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createSystemClient } from '@/lib/appwrite-admin';
import { APPWRITE_DATABASE_ID, APPWRITE_COLLECTION_KEYCHAIN_ID } from '@/lib/appwrite';
import { Query } from 'node-appwrite';
import { resolvePasskeyRpId } from '@/lib/passkey-webauthn-options';
import { cookies } from 'next/headers';
import { createHmac } from 'node:crypto';

/**
 * Generates WebAuthn login options (assertion options) for passkey sign-in.
 */
export async function getPasskeyLoginOptionsAction(email?: string, hostname: string = 'localhost') {
  try {
    const systemClient = createSystemClient();
    const db = systemClient.databases;

    let queries: any[] = [
      Query.equal('type', 'passkey'),
      Query.equal('authPasskey', true),
    ];

    if (email) {
      // Find the user ID by email first
      const usersList = await systemClient.users.list([
        Query.equal('email', email),
        Query.limit(1)
      ]);
      if (usersList.total > 0) {
        queries.push(Query.equal('userId', usersList.users[0].$id));
      } else {
        queries.push(Query.equal('userId', 'non-existent-user-id'));
      }
    }

    const res = await db.listRows(
      APPWRITE_DATABASE_ID,
      APPWRITE_COLLECTION_KEYCHAIN_ID,
      queries
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

    // Request PRF extension with our static salt
    (options.extensions as any) = {
      ...options.extensions,
      prf: {
        eval: {
          first: new TextEncoder().encode('kylrix-unified-salt-v1'),
        },
      },
    };

    // Store the generated challenge in a secure cookie to verify against it
    const cookieStore = await cookies();
    cookieStore.set('passkey_login_challenge', options.challenge, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 300, // 5 minutes
      path: '/'
    });

    // Serialize options to JSON-friendly format for RSC/Actions transport
    return { success: true, options: JSON.parse(JSON.stringify(options)) };
  } catch (error: any) {
    console.error('Error generating passkey options action:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifies WebAuthn assertion response and returns an Appwrite custom token.
 */
export async function verifyPasskeyLoginAction(authResp: any, hostname: string = 'localhost', hostHeader: string = 'localhost') {
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
    
    // Support http for localhost dev, https for production
    const protocol = hostname === 'localhost' || hostname.startsWith('127.') ? 'http' : 'https';
    const origin = `${protocol}://${hostHeader}`;

    // Read stored challenge
    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('passkey_login_challenge')?.value;
    if (!expectedChallenge) {
      return { success: false, error: 'Login session expired. Please retry.' };
    }

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
      // Clear login challenge cookie
      cookieStore.delete('passkey_login_challenge');

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
      const fallbackSeed = createHmac('sha256', process.env.APPWRITE_API || 'fallback-dev-secret')
        .update(row.credentialId + row.userId)
        .digest('base64');

      return {
        success: true,
        verified: true,
        token: token.phrase,
        userId: row.userId,
        wrappedKey: row.wrappedKey,
        fallbackSeed,
      };
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
    const { account } = createServerClient();
    const user = await account.get();

    const fallbackSeed = createHmac('sha256', process.env.APPWRITE_API || 'fallback-dev-secret')
      .update(credentialId + user.$id)
      .digest('base64');

    return { success: true, seed: fallbackSeed };
  } catch (error: any) {
    console.error('Error generating fallback seed action:', error);
    return { success: false, error: error.message };
  }
}
