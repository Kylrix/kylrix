import { NextRequest } from 'next/server';
import { oauthProviderOpenIdConfigMetadata } from '@better-auth/oauth-provider';
import { auth } from '@/lib/auth/better-auth';

const handler = oauthProviderOpenIdConfigMetadata(auth);

export async function GET(req: NextRequest) {
  return handler(req);
}
