"use client";

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function IdeasPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotesBarebones = useCallback(async (cursorToUse: string | null = null) => {
    const activeUserId = user?.$id;
    if (!activeUserId) {
      setLoading(false);
      return;
    }

    if (!cursorToUse && notes.length === 0) setLoading(true);
    if (cursorToUse) setLoadingMore(true);

    try {
      const { Query, Client, TablesDB } = await import('appwrite');
      const { databases } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
      const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

      const client = new Client()
        .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
        .setProject(APPWRITE_CONFIG.PROJECT_ID);
      const tablesDB = new TablesDB(client);

      const queryList = [
        Query.equal('userId', activeUserId),
        Query.limit(50),
        Query.orderDesc('$updatedAt')
      ];

      if (cursorToUse) {
        queryList.push(Query.cursorAfter(cursorToUse));
      }

      const res = await tablesDB.listRows(dbId, tableId, queryList).catch(async () => {
        return await (databases as any).listDocuments(dbId, tableId, queryList);
      });

      const rows = Array.isArray(res?.rows) ? res.rows : Array.isArray(res?.documents) ? res.documents : [];
      const batchHasMore = rows.length === 50;
      const newCursor = batchHasMore && rows.length ? rows[rows.length - 1].$id : null;

      setHasMore(batchHasMore);
      setNextCursor(newCursor);

      // Read local pins state directly from ResourcePinContext storage key
      let pinnedMap: Record<string, boolean> = {};
      try {
        const storedPins = localStorage.getItem(`kylrix_resource_pins_${activeUserId}`);
        if (storedPins) {
          const parsed = JSON.parse(storedPins);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => { pinnedMap[id] = true; });
          }
        }
      } catch {}

      if (cursorToUse) {
        setNotes((prev) => {
          const existingIds = new Set(prev.map((c) => c.$id));
          const freshUnique = rows.filter((r: any) => !existingIds.has(r.$id));
          const updated = [...prev, ...freshUnique];

          // Pure client-side sort: Pinned first, then newest updatedAt
          return [...updated].sort((a: any, b: any) => {
            const aPinned = Boolean(a.isPinned || pinnedMap[a.$id]);
            const bPinned = Boolean(b.isPinned || pinnedMap[b.$id]);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            const aTime = new Date(a.$updatedAt || a.updatedAt || a.$createdAt || 0).getTime();
            const bTime = new Date(b.$updatedAt || b.updatedAt || b.$createdAt || 0).getTime();
            return bTime - aTime;
          });
        });
      } else {
        // Pure client-side sort: Pinned first, then newest updatedAt
        const sorted = [...rows].sort((a: any, b: any) => {
          const aPinned = Boolean(a.isPinned || pinnedMap[a.$id]);
          const bPinned = Boolean(b.isPinned || pinnedMap[b.$id]);
          if (aPinned && !bPinned) return -1;
          if (!aPinned && bPinned) return 1;
          const aTime = new Date(a.$updatedAt || a.updatedAt || a.$createdAt || 0).getTime();
          const bTime = new Date(b.$updatedAt || b.updatedAt || b.$createdAt || 0).getTime();
          return bTime - aTime;
        });
        setNotes(sorted);
      }
    } catch (err: any) {
      console.error('[IdeasPage] Failed to fetch notes:', err);
      setError(err?.message || String(err));
      toast.error(`Ideas load error: ${err?.message || String(err)}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.$id, notes.length]);

  const loadMoreNotes = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    void fetchNotesBarebones(nextCursor);
  }, [loadingMore, hasMore, nextCursor, fetchNotesBarebones]);

  useEffect(() => {
    if (user?.$id) {
      void fetchNotesBarebones();
    }
  }, [user?.$id]);

  const gridClass =
    'grid gap-4 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]';

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-[#0A0908] pt-4 md:pt-8 relative px-4 md:px-12">
      <header className="flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px] mb-6 shadow-2xl relative select-none">
        <div>
          <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
            Ideas
          </h1>
          <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
            Direct Client SDK fetch • Pinned items sorted to top
          </p>
        </div>
        <button
          onClick={() => void fetchNotesBarebones()}
          disabled={loading}
          className="w-10 h-10 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all disabled:opacity-40"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin text-[#EC4899]' : ''} />
        </button>
      </header>

      {error && (
        <div className="p-4 mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className={gridClass}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="p-6 rounded-[28px] bg-[#161412] border border-white/5 animate-pulse min-h-[140px]" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="p-16 text-center rounded-[32px] bg-[#161412] border border-dashed border-[#1C1A18] flex flex-col items-center justify-center">
          <h2 className="text-xl font-black text-white mb-2 font-clash">No Ideas Found</h2>
          <p className="text-[#9B9691] max-w-xs mx-auto text-sm">Your ideas collection is empty.</p>
        </div>
      ) : (
        <>
          <div className={gridClass}>
            {notes.map((note) => (
              <NoteObjectRow
                key={note.$id}
                note={note}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={loadMoreNotes}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl bg-[#161412] hover:bg-[#1C1A18] border border-[#1C1A18] text-xs font-bold text-white/80 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-[#EC4899]" />
                    Loading older ideas...
                  </>
                ) : (
                  'Load More Ideas'
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
