import { NextRequest } from 'next/server';
import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider';
import { auth } from '@/lib/auth/better-auth';

const handler = oauthProviderAuthServerMetadata(auth);

export async function GET(req: NextRequest) {
  return handler(req);
}
