import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/appwrite-admin';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

function sha256HexUtf8(message: string): string {
  return createHash('sha256').update(message, 'utf8').digest('hex');
}

function timingSafeHexEqual(expectedHex: string, computedHex: string): boolean {
  try {
    const a = Buffer.from(expectedHex, 'hex');
    const b = Buffer.from(computedHex, 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Burns an ephemeral ghost / Send row (+ Send file blob) using a per-note deletion secret
 * (SHA-256 stored in metadata). Document rows are created read-only for Role.any().
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const noteId = String(body?.noteId || '').trim();
    const deletionSecret = String(body?.deletionSecret || '').trim();
    if (!noteId || !deletionSecret) {
      return NextResponse.json({ error: 'noteId and deletionSecret are required' }, { status: 400 });
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

    const expectedHash = String(meta.creatorDeletionProofHash || '').trim().toLowerCase();
    if (!expectedHash) {
      return NextResponse.json({ error: 'This note cannot be burned remotely (created before burn keys existed)' }, { status: 400 });
    }

    const computed = sha256HexUtf8(deletionSecret).toLowerCase();
    if (!timingSafeHexEqual(expectedHash, computed)) {
      return NextResponse.json({ error: 'Invalid deletion proof' }, { status: 403 });
    }

    const sendObj = meta.send_object as { kind?: string; bucketId?: string; fileId?: string } | undefined;
    if (sendObj?.kind === 'file' && sendObj.bucketId && sendObj.fileId) {
      await storage.deleteFile(sendObj.bucketId, sendObj.fileId).catch(() => undefined);
    }

    await databases.deleteDocument(dbId, collectionId, noteId);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error('[ephemeral-note/delete]', e);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
