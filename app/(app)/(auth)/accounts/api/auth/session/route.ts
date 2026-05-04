import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { normalizeMfaFactors, sessionNeedsTotpMfa } from '@/lib/mfa-session';
import { Account, Client } from 'node-appwrite';

async function getAuthenticatedUser(req: NextRequest) {
  const client = new Client()
    .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
    .setProject(APPWRITE_CONFIG.PROJECT_ID);

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    client.setJWT(authHeader.split(' ')[1]);
  } else {
    return null;
  }

  try {
    const account = new Account(client);
    return await account.get();
  } catch (error) {
    console.error('[Session API Auth Error]', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const client = new Client()
      .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
      .setProject(APPWRITE_CONFIG.PROJECT_ID);

    if (authHeader?.startsWith('Bearer ')) {
      client.setJWT(authHeader.split(' ')[1]);
    }

    const account = new Account(client);
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [session, factors] = await Promise.all([
      account.getSession('current').catch(() => null),
      account.listMfaFactors().catch(() => null),
    ]);

    if (sessionNeedsTotpMfa({
      session,
      availableFactors: normalizeMfaFactors(factors),
    })) {
      return NextResponse.json(
        { error: 'user_more_factors_required' },
        { status: 409 }
      );
    }

    const { users } = createAdminClient();
    const sessionToken = await users.createToken(user.$id);

    return NextResponse.json({
      userId: user.$id,
      secret: sessionToken.secret,
      expire: sessionToken.expire,
    });
  } catch (error: any) {
    console.error('[Session API Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
