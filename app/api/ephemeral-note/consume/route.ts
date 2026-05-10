import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { verifyUser } from '@/lib/api/permission-updater';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { verifyCreatorDeletionProof } from '@/lib/ephemeral/ephemeral-proof';

/**
 * After the client imports ephemeral content into Note / Vault / Flow, call consume with the same
 * creator secret used for burn/delete to remove the ghost row (and Send ciphertext file).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const noteId = String(body?.noteId || '').trim();
    const claimSecret = String(body?.claimSecret || body?.deletionSecret || '').trim();
    if (!noteId || !claimSecret) {
      return NextResponse.json({ error: 'noteId and claimSecret are required' }, { status: 400 });
    }

    const { databases, storage } = createAdminClient();
    const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
    const collectionId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

    const doc = await databases.getDocument(dbId, collectionId, noteId).catch(() => null);
    if (!doc) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(String((doc as { metadata?: string }).metadata || '{}'));
    } catch {
      meta = {};
    }

    if (!meta.isGhost) {
      return NextResponse.json({ error: 'Not an ephemeral note' }, { status: 400 });
    }

    if (!verifyCreatorDeletionProof(meta, claimSecret)) {
      return NextResponse.json({ error: 'Invalid claim proof' }, { status: 403 });
    }

    const sendObj = meta.send_object as { kind?: string; bucketId?: string; fileId?: string } | undefined;
    if (sendObj?.kind === 'file' && !hasPaidKylrixPlan(user)) {
      return NextResponse.json(
        { error: 'Kylrix Pro is required to claim Send files into your library.', code: 'PRO_REQUIRED' },
        { status: 402 },
      );
    }

    if (sendObj?.kind === 'file' && sendObj.bucketId && sendObj.fileId) {
      await storage.deleteFile(sendObj.bucketId, sendObj.fileId).catch(() => undefined);
    }

    await databases.deleteDocument(dbId, collectionId, noteId);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[ephemeral-note/consume]', e);
    return NextResponse.json({ error: 'Failed to consume ephemeral note' }, { status: 500 });
  }
}
