import { NextRequest, NextResponse } from 'next/server';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';
import { dispatchUnorganicEmails, type UnorganicEmailEventType, type UnorganicEmailSource } from '@/lib/unorganic-email-api';

type EmailApiBody = {
  eventType?: UnorganicEmailEventType | string;
  sourceApp?: UnorganicEmailSource | string;
  actorName?: string;
  actorId?: string;
  recipientIds?: string[] | string;
  recipientEmails?: string[] | string;
  resourceId?: string;
  resourceTitle?: string;
  resourceType?: string;
  rightsLabel?: string;
  templateKey?: string;
  ctaUrl?: string;
  ctaText?: string;
  verificationMode?: 'error' | 'silent';
  dryRun?: boolean;
  metadata?: Record<string, unknown>;
};

function normalizeList(input: unknown) {
  if (Array.isArray(input)) {
    return input.map((value) => String(value || '').trim()).filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  return [];
}

async function authorize(req: NextRequest) {
  const expectedSecret = process.env.KYLRIX_INTERNAL_EMAIL_SECRET?.trim();
  const presentedSecret = req.headers.get('x-kylrix-email-secret')?.trim();

  if (expectedSecret && presentedSecret && expectedSecret === presentedSecret) {
    return true;
  }

  const user = await verifyUser(req).catch(() => null);
  return Boolean(user);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-kylrix-email-secret',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const authorized = await authorize(req);
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = (await req.json()) as EmailApiBody;
    const eventType = String(body.eventType || '').trim() as UnorganicEmailEventType;
    const sourceApp = String(body.sourceApp || '').trim() as UnorganicEmailSource;
    const recipientIds = normalizeList(body.recipientIds);
    const recipientEmails = normalizeList(body.recipientEmails);

    const result = await dispatchUnorganicEmails({
      eventType,
      sourceApp,
      actorName: body.actorName?.trim() || null,
      actorId: body.actorId?.trim() || null,
      recipientIds,
      recipientEmails,
      resourceId: body.resourceId?.trim() || null,
      resourceTitle: body.resourceTitle?.trim() || null,
      resourceType: body.resourceType?.trim() || null,
      rightsLabel: body.rightsLabel?.trim() || null,
      templateKey: body.templateKey?.trim() || null,
      ctaUrl: body.ctaUrl?.trim() || null,
      ctaText: body.ctaText?.trim() || null,
      verificationMode: body.verificationMode === 'error' ? 'error' : 'silent',
      metadata: body.metadata || null,
      dryRun: Boolean(body.dryRun),
    });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Emails API] Error:', error);
    const status = error?.code === 'UNVERIFIED_RECIPIENT' || Number(error?.status) === 403 ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || 'Failed to dispatch email notification' },
      { status, headers: corsHeaders },
    );
  }
}
