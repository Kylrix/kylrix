import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  url.pathname = '/api/auth/oauth2/authorize';
  return NextResponse.redirect(url, 307);
}
