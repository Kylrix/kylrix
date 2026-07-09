'use client';

/**
 * IdeaPageClient — Smart permission-aware wrapper for /idea/[id]
 *
 * Access resolution (server-authoritative, not gameable client-side):
 *   owner           → full NoteDetailSidebar (edit/delete/share)
 *   write-collab    → NoteDetailSidebar, readOnly=false, no delete/share-toggle
 *   read-collab     → NoteDetailSidebar, readOnly=true (preview only)
 *   guest           → note.isGuest=true; NoteDetailSidebar readOnly=true
 *   public          → note.isPublic=true; NoteDetailSidebar readOnly=true
 *   none            → Beautiful no-access screen
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { NoteDetailSidebar, NoteAccessRole } from '@/components/ui/NoteDetailSidebar';
import { NoteContentRenderer } from '@/components/NoteContentRenderer';
import type { Notes } from '@/types/appwrite';
import {
  realtime,
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLE_ID_NOTES,
  isNoteEditableByAnyone,
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { resolveResourceOwnerId } from '@/lib/utils/resource-ids';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { decryptGhostData } from '@/lib/encryption/ghost-crypto';
import { Lock, ArrowLeft, LogIn, Globe, AlertTriangle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface IdeaPageClientProps {
  noteId: string;
  decryptionKey?: string;
}

type AccessResult =
  | { role: 'owner' | 'write-collab' | 'read-collab' | 'guest' | 'public'; note: Notes }
  | { role: 'none'; reason: 'not-found' | 'no-access' | 'expired' }
  | { role: 'loading' };

// ─── Helpers ─────────────────────────────────────────────────────────────────



function parseNoteMeta(note: Notes) {
  try {
    return JSON.parse(note.metadata || '{}');
  } catch {
    return {};
  }
}

async function decryptNoteIfNeeded(note: Notes, key?: string): Promise<Notes> {
  const meta = parseNoteMeta(note);
  const isT4 = meta.isEncrypted && meta.encryptionVersion === 'T4';
  const isGhost = !!meta.isGhost;

  if (!isT4 && !isGhost) return note;
  if (!key) throw new Error('This note is encrypted and requires a decryption key.');

  const keyBuffer = ecosystemSecurity.decodeBase64(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer as any,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt']
  );

  if (isT4) {
    return {
      ...note,
      title: await ecosystemSecurity.decryptWithKey(meta.encryptedTitle || note.title || '', cryptoKey),
      content: await ecosystemSecurity.decryptWithKey(note.content || '', cryptoKey),
      metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
    };
  }

  return {
    ...note,
    title: await decryptGhostData(note.title || '', key),
    content: await decryptGhostData(note.content || '', key),
    metadata: JSON.stringify({ ...meta, clientDecrypted: true }),
  };
}

function resolveCollaboratorRole(note: Notes, userId: string): 'write-collab' | 'read-collab' | null {
  const collabs = Array.isArray(note.collaborators) ? note.collaborators : [];
  for (const c of collabs) {
    try {
      const parsed = typeof c === 'string' ? JSON.parse(c) : c;
      if (parsed?.userId === userId) {
        return parsed?.permission === 'write' ? 'write-collab' : 'read-collab';
      }
    } catch {}
  }
  return null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IdeaPageClient({ noteId, decryptionKey }: IdeaPageClientProps) {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { getCachedData, setCachedData, invalidate } = useDataNexus();

  const [access, setAccess] = useState<AccessResult>({ role: 'loading' });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const CACHE_KEY = useMemo(() => `idea_page_note_${noteId}`, [noteId]);

  // ── Permission Resolution ─────────────────────────────────────────────────
  const resolveAccess = useCallback(async (forceRefresh = false): Promise<void> => {
    if (authLoading) return;

    if (!forceRefresh) {
      const cached = getCachedData<Notes>(CACHE_KEY);
      if (cached) {
        // Resolve role from cache quickly
        try {
          const decrypted = await decryptNoteIfNeeded(cached, decryptionKey);
          const role = computeRole(decrypted, user?.$id);
          if (role !== 'none') {
            setAccess({ role: role as any, note: decrypted });
            // Still fetch fresh in background — fall through
          }
        } catch {}
      }
    }

    try {
      const { getSharedNoteData } = await import('@/lib/actions/client-ops');
      const raw = await getSharedNoteData(noteId);

      if (!raw) {
        setAccess({ role: 'none', reason: 'not-found' });
        return;
      }

      // Ghost expiry check
      const meta = parseNoteMeta(raw);
      if (meta.isGhost && meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
        setAccess({ role: 'none', reason: 'expired' });
        return;
      }

      // Decrypt if needed
      let note: Notes;
      try {
        note = await decryptNoteIfNeeded(raw, decryptionKey);
      } catch {
        // Encrypted but no key — still let owner/collab in; they can see raw
        note = raw;
      }

      const role = computeRole(note, user?.$id);

      if (role === 'none') {
        setAccess({ role: 'none', reason: 'no-access' });
        return;
      }

      setCachedData(CACHE_KEY, note, 1000 * 60 * 30);
      setAccess({ role: role as any, note });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('not found') || msg.includes('404')) {
        setAccess({ role: 'none', reason: 'not-found' });
      } else {
        setAccess({ role: 'none', reason: 'no-access' });
      }
    }
  }, [authLoading, user?.$id, noteId, decryptionKey, CACHE_KEY, getCachedData, setCachedData]);

  function computeRole(note: Notes, userId?: string): NoteAccessRole | 'none' {
    const ownerId = resolveResourceOwnerId(note as Record<string, unknown>);

    // Owner
    if (userId && ownerId && userId === ownerId) return 'owner';

    // Collaborator
    if (userId) {
      const collabRole = resolveCollaboratorRole(note, userId);
      if (collabRole) return collabRole;
    }

    // Legacy editableByAnyone → treat as write-collab if authenticated
    if (userId && isNoteEditableByAnyone(note)) return 'write-collab';

    // Guest access (any authenticated user allowed if isGuest=true)
    if ((note as any).isGuest === true) return 'guest';

    // Public access
    if (note.isPublic === true) return 'public';

    return 'none';
  }

  useEffect(() => {
    resolveAccess();
  }, [resolveAccess]);

  // Realtime subscription — updates note when modified by owner/collab
  useEffect(() => {
    if (!noteId) return;
    if (access.role === 'loading' || access.role === 'none') return;

    const channel = `databases.${APPWRITE_DATABASE_ID}.tables.${APPWRITE_CONFIG.DATABASES.NOTE}.notes.rows.${noteId}`;
    const sub = realtime.subscribe(channel, (response: any) => {
      const isUpdate = response.events.some((e: string) => e.endsWith('.update'));
      const isDelete = response.events.some((e: string) => e.endsWith('.delete'));

      if (isDelete) {
        setAccess({ role: 'none', reason: 'not-found' });
        invalidate(CACHE_KEY);
        return;
      }

      if (isUpdate) {
        const payload = response.payload as Notes;
        void (async () => {
          try {
            const decrypted = await decryptNoteIfNeeded(payload, decryptionKey);
            const role = computeRole(decrypted, user?.$id);
            if (role !== 'none') {
              setAccess((prev) =>
                prev.role !== 'loading' && prev.role !== 'none'
                  ? { role: prev.role, note: decrypted }
                  : prev
              );
              setCachedData(CACHE_KEY, decrypted);
            }
          } catch {}
        })();
      }
    });

    return () => {
      if (typeof sub === 'function') (sub as any)();
      else if (sub && typeof (sub as any).unsubscribe === 'function') (sub as any).unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, access.role, CACHE_KEY]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleNoteUpdate = useCallback((updated: Notes) => {
    setAccess((prev) => {
      if (prev.role === 'loading' || prev.role === 'none') return prev;
      return { role: prev.role, note: updated };
    });
    setCachedData(CACHE_KEY, updated);
  }, [CACHE_KEY, setCachedData]);

  const handleNoteDelete = useCallback((_noteId: string) => {
    router.push('/app');
  }, [router]);

  const handleBack = useCallback(() => {
    if (window.history.length > 2) router.back();
    else router.push('/app');
  }, [router]);

  // ── Render states ─────────────────────────────────────────────────────────

  // Loading
  if (access.role === 'loading' || authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1] animate-spin" />
          <p className="text-white/40 text-sm font-semibold">Loading note…</p>
        </div>
      </div>
    );
  }

  // No access
  if (access.role === 'none') {
    const isExpired = (access as any).reason === 'expired';
    const isNotFound = (access as any).reason === 'not-found';
    const needsLogin = !isAuthenticated && !isExpired && !isNotFound;

    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Icon */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 bg-[#6366F1]/10 rounded-2xl blur-xl" />
            <div className="relative w-20 h-20 rounded-2xl bg-[#161412] border border-white/8 flex items-center justify-center">
              {isExpired ? (
                <AlertTriangle className="w-8 h-8 text-amber-400/70" />
              ) : isNotFound ? (
                <Globe className="w-8 h-8 text-white/30" />
              ) : (
                <Lock className="w-8 h-8 text-[#6366F1]/60" />
              )}
            </div>
          </div>

          {/* Text */}
          <div className="space-y-2">
            <h1 className="text-white text-2xl font-black tracking-tight font-clash">
              {isExpired
                ? 'Note has expired'
                : isNotFound
                ? 'Note not found'
                : 'Access restricted'}
            </h1>
            <p className="text-white/45 text-sm font-semibold leading-relaxed">
              {isExpired
                ? 'This temporary note is no longer available. It was set to expire automatically.'
                : isNotFound
                ? "This note doesn't exist or has been deleted by the owner."
                : needsLogin
                ? 'This note is private. Sign in to check if you have access.'
                : "You don't have permission to view this note. Ask the owner to share it with you."}
            </p>
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/8 text-white/70 hover:text-white hover:bg-white/10 text-sm font-bold transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Go back
            </button>
            {needsLogin && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    router.push(
                      `/accounts/login?source=${encodeURIComponent(window.location.href)}`
                    );
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#6366F1]/90 text-white text-sm font-bold transition-all"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Access granted — determine readOnly
  const { role, note } = access;
  const isReadOnly = role === 'read-collab' || role === 'guest' || role === 'public';
  const showDelete = role === 'owner';
  const showExpand = false; // page layout — no expand button needed

  return (
    <div className="min-h-screen bg-[#0A0908] flex flex-col">
      <NoteDetailSidebar
        note={note}
        onUpdate={handleNoteUpdate}
        onDelete={handleNoteDelete}
        onBack={handleBack}
        layout="page"
        showExpandButton={showExpand}
        showHeaderDeleteButton={showDelete}
        readOnly={isReadOnly}
        accessRole={role}
      />
    </div>
  );
}
