import { NextRequest, NextResponse } from 'next/server';
import {
  internalJobsConfigured,
  readJobsBearer,
  timingSafeBearerMatchesConfiguredSecret,
} from '@/lib/runtime-functions/job-auth';
import { executeSystemRuntimeJob, isSystemRuntimeJobId } from '@/lib/runtime-functions/system-jobs';

/**
 * Ecosystem / project-scoped jobs — **never** callable from the browser.
 * Requires `KYLRIX_INTERNAL_JOBS_SECRET` (min 32 chars) as Bearer or `x-kylrix-jobs-secret` header.
 * Schedule via Vercel Cron, worker, or infra — not user sessions.
 */
export async function POST(req: NextRequest) {
  if (!internalJobsConfigured()) {
    return NextResponse.json({ error: 'Internal jobs not configured' }, { status: 503 });
  }

  const presented = readJobsBearer(req.headers.get('authorization'), req.headers.get('x-kylrix-jobs-secret'));
  if (!timingSafeBearerMatchesConfiguredSecret(presented)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const job = typeof body?.job === 'string' ? body.job.trim() : '';
  if (!isSystemRuntimeJobId(job)) {
    return NextResponse.json({ error: 'Unknown job' }, { status: 400 });
  }

  const payload =
    body?.payload && typeof body.payload === 'object' && body.payload !== null
      ? (body.payload as { batchSize?: number; sweepLimit?: number })
      : undefined;

  try {
    const result = await executeSystemRuntimeJob(job, payload);
    return NextResponse.json({ ok: true, result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Job failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
