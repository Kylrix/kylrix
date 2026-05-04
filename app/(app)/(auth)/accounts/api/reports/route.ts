import { NextRequest, NextResponse } from 'next/server';
import { ID, Permission, Query, Role } from 'node-appwrite';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';

const CHAT_DB_ID = APPWRITE_CONFIG.DATABASES.CHAT;
const EVENTS_TABLE_ID = APPWRITE_CONFIG.TABLES.CHAT.ACCOUNT_EVENTS;

function normalizeUserIds(input: unknown) {
  const ids = Array.isArray(input) ? input : typeof input === 'string' ? [input] : [];
  return Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
}

function normalizeReason(input: unknown) {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ');
}

function serializeMetadata(metadata: unknown) {
  if (metadata === undefined || metadata === null) return null;
  if (typeof metadata === 'string') return metadata;
  try {
    return JSON.stringify(metadata);
  } catch {
    return JSON.stringify({ value: String(metadata) });
  }
}

function buildReportPayload(input: {
  reporterId: string;
  targetUserId: string;
  reason: string;
  contextType?: string | null;
  contextId?: string | null;
  contextUrl?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return {
    userId: input.targetUserId,
    type: 'report',
    actorId: input.reporterId,
    relatedUserId: input.targetUserId,
    status: 'pending',
    delta: null,
    discountPercent: null,
    expiresAt: null,
    metadata: serializeMetadata({
      ...(input.metadata || {}),
      report: {
        reporterId: input.reporterId,
        targetUserId: input.targetUserId,
        reason: input.reason,
        contextType: input.contextType || null,
        contextId: input.contextId || null,
        contextUrl: input.contextUrl || null,
        notes: input.notes || null,
        reviewState: 'unverified',
      },
    }),
  };
}

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status');
    const { databases } = createAdminClient();
    const queries = [
      Query.equal('type', 'report'),
      Query.or([
        Query.equal('actorId', user.$id),
        Query.equal('userId', user.$id),
      ]),
    ];
    if (statusFilter) {
      queries.push(Query.equal('status', statusFilter.toLowerCase()));
    }
    const result = await databases.listDocuments(CHAT_DB_ID, EVENTS_TABLE_ID, queries);
    const reports = result.documents;

    return NextResponse.json({ success: true, reports }, { headers: corsHeaders });
  } catch (error: any) {
    const message = error?.message || 'Failed to load reports';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Reports API] GET error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const targetUserIds = normalizeUserIds(body?.targetUserIds || body?.userIds || body?.targetUserId || body?.userId);
    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: 'At least one target userId is required' }, { status: 400, headers: corsHeaders });
    }

    const reason = normalizeReason(body?.reason || body?.message || body?.description);
    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400, headers: corsHeaders });
    }

    const contextType = typeof body?.contextType === 'string' ? body.contextType.trim().toLowerCase() : null;
    const contextId = typeof body?.contextId === 'string' ? body.contextId.trim() : null;
    const contextUrl = typeof body?.contextUrl === 'string' ? body.contextUrl.trim() : null;
    const notes = typeof body?.notes === 'string' ? body.notes.trim() : null;
    const metadata = typeof body?.metadata === 'object' && body.metadata ? body.metadata : null;

    if (metadata && (metadata as any).delta !== undefined) {
      throw new Error('Reports cannot directly affect reputation');
    }

    if (targetUserIds.includes(user.$id)) {
      return NextResponse.json({ error: 'Self reports are not allowed' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const created: any[] = [];

    for (const targetUserId of targetUserIds) {
      const payload = buildReportPayload({
        reporterId: user.$id,
        targetUserId,
        reason,
        contextType,
        contextId,
        contextUrl,
        notes,
        metadata: {
          ...(metadata || {}),
          source: 'accounts.reports',
          sourceApp: typeof body?.sourceApp === 'string' ? body.sourceApp.trim() : null,
        },
      });

      const row = await databases.createDocument(
        CHAT_DB_ID,
        EVENTS_TABLE_ID,
        ID.unique(),
        payload,
        [
          Permission.read(Role.user(user.$id)),
        ],
      );
      created.push(row);
    }

    return NextResponse.json(
      {
        success: true,
        count: created.length,
        reports: created,
      },
      { headers: corsHeaders },
    );
  } catch (error: any) {
    const message = error?.message || 'Failed to create report';
    const status = message.startsWith('Forbidden') ? 403 : 400;
    console.error('[Reports API] POST error:', error);
    return NextResponse.json({ error: message }, { status, headers: corsHeaders });
  }
}
