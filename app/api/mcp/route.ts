import { NextRequest } from 'next/server';
import { GET as canonicalGet, POST as canonicalPost, OPTIONS as canonicalOptions } from '../v1/mcp/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return canonicalGet(req);
}

export async function POST(req: NextRequest) {
  return canonicalPost(req);
}

export async function OPTIONS() {
  return canonicalOptions();
}
