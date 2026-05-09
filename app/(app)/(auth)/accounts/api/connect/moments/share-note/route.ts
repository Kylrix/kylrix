import { NextRequest, NextResponse } from 'next/server';
import { ID, Permission, Role } from 'node-appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { createAdminClient } from '@/lib/appwrite-admin';
import { getCorsHeaders, verifyUser } from '@/lib/api/permission-updater';
import { InternalKylrixTokenService } from '@/lib/services/internal/kylrix-token';

function hasWriteAccess(note: any, actorId: string) {
  const ownerId = String(note?.userId || '').trim();
  if (ownerId && ownerId === actorId) return true;

  const collaborators = Array.isArray(note?.collaborators) ? note.collaborators : [];
  const collaboratorIds = collaborators
    .map((entry: any) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') return entry.userId || entry.id || '';
      return '';
    })
    .filter(Boolean);

  try {
    const metadata = JSON.parse(note?.metadata || '{}');
    const writeCollaborators = Array.isArray(metadata?.writeCollaborators) ? metadata.writeCollaborators : [];
    collaboratorIds.push(...writeCollaborators.filter(Boolean));
  } catch {}

  return Array.from(new Set(collaboratorIds)).includes(actorId);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': req.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);
  try {
    const actor = await verifyUser(req);
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const noteId = String(body?.noteId || '').trim();
    const text = String(body?.text || '').trim();
    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400, headers: corsHeaders });
    }

    const { databases } = createAdminClient();
    const note = await databases.getDocument(
      APPWRITE_CONFIG.DATABASES.NOTE,
      APPWRITE_CONFIG.TABLES.NOTE.NOTES,
      noteId,
    );

    if (!Boolean(note?.isPublic)) {
      return NextResponse.json({ error: 'Only public notes can be shared as moments' }, { status: 403, headers: corsHeaders });
    }

    if (!hasWriteAccess(note, actor.$id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
    }

    const noteTitle = String(note?.title || 'Untitled Note').trim();
    const composed = text;
    const metadata = {
      type: 'post',
      attachments: [{ type: 'note', id: noteId }],
    };
    const now = new Date().toISOString();

    const moment = await databases.createDocument(
      APPWRITE_CONFIG.DATABASES.CHAT,
      APPWRITE_CONFIG.TABLES.CHAT.MOMENTS,
      ID.unique(),
      {
        userId: actor.$id,
        caption: composed,
        type: 'image',
        momentKind: 'post',
        sourceId: null,
        searchTitle: noteTitle,
        fileId: JSON.stringify(metadata),
        createdAt: now,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      [
        Permission.read(Role.user(actor.$id)),
        Permission.update(Role.user(actor.$id)),
        Permission.delete(Role.user(actor.$id)),
      ],
    );

    let tokenMint: Record<string, unknown> = { accepted: false, reason: 'TOKEN_NOT_INITIALIZED' };
    try {
      tokenMint = await InternalKylrixTokenService.mintForActivity({
        userId: actor.$id,
        idempotencyKey: `mint:share_public_note_moment:${moment.$id}`,
        activityType: 'share_public_note_moment',
        uniqueActors: 1,
        trustScore: 85,
        sourceType: 'moment_share_note',
        sourceId: moment.$id,
        metadata: {
          noteId,
          momentId: moment.$id,
        },
      });
    } catch (error: any) {
      if (String(error?.message || '') !== 'TOKEN_NOT_INITIALIZED') {
        console.warn('[share-note-moment] token mint failed', error);
        tokenMint = { accepted: false, reason: 'MINT_FAILED' };
      }
    }

    return NextResponse.json({ moment, tokenMint }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[share-note-moment] failed', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to share note as moment' },
      { status: 400, headers: corsHeaders },
    );
  }
}
