import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/api/permission-updater';
import { executeSessionRuntimeJob, isSessionRuntimeJobId } from '@/lib/runtime-functions/session-jobs';

/**
 * Session-scoped privileged maintenance (current user only — no target userId in body).
 */
export async function POST(req: NextRequest) {
  const user = await verifyUser(req);
  if (!user?.$id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const job = typeof body?.job === 'string' ? body.job.trim() : '';
  if (!isSessionRuntimeJobId(job)) {
    return NextResponse.json({ error: 'Unknown or forbidden job' }, { status: 400 });
  }

  try {
    const result = await executeSessionRuntimeJob(job, user.$id);
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Job failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
