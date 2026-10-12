import { NextResponse } from 'next/server';

/** No-op sink for sync-engine pagehide beacons — prevents 404 retry noise in dev/prod. */
export async function POST() {
  return new NextResponse(null, { status: 204 });
}
