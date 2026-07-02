import { NextRequest, NextResponse } from 'next/server';
import { getPasskeyLoginOptionsAction, verifyPasskeyLoginAction } from '@/lib/actions/auth-actions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, hostname } = body;
    const result = await getPasskeyLoginOptionsAction(email, hostname || 'localhost');
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { authResp, challengeToken, hostname, hostHeader } = body;
    
    const result = await verifyPasskeyLoginAction(
      authResp,
      challengeToken,
      hostname || 'localhost',
      hostHeader || 'localhost'
    );
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
