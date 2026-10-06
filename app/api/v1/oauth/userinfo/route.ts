import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/better-auth';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = '/api/auth/oauth2/userinfo';
  const newReq = new NextRequest(url.toString(), {
    method: 'GET',
    headers: req.headers,
  });
  return auth.handler(newReq);
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = '/api/auth/oauth2/userinfo';
  const newReq = new NextRequest(url.toString(), {
    method: 'POST',
    headers: req.headers,
    body: req.body,
    duplex: 'half',
  } as any);
  return auth.handler(newReq);
}
