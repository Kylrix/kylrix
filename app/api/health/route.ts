import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'kylrix',
    timestamp: new Date().toISOString(),
  }, { status: 200 });
}
