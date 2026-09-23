import { NextRequest } from 'next/server';
import { GET as agentGet, OPTIONS as agentOptions } from '../agent.json/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  return agentGet(req);
}

export async function OPTIONS() {
  return agentOptions();
}
