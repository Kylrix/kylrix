'use client';

import React, { useEffect, useState } from 'react';
import { Pin, Globe, RefreshCw } from 'lucide-react';
import { useSection } from '@/context/SectionContext';

export default function IdeasPage() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { setActiveDetail } = useSection();

  const fetchNotesBarebones = async () => {
    setLoading(true);
    setError(null);

    try {
      const { Query, Client, TablesDB } = await import('appwrite');
      const { account, databases } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      const user = await account.get().catch(() => null);
      if (!user?.$id) {
        setError('Unauthenticated user session');
        setLoading(false);
        return;
      }

      const dbId = APPWRITE_CONFIG.DATABASES.NOTE;
      const tableId = APPWRITE_CONFIG.TABLES.NOTE.NOTES;

      const client = new Client()
        .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
        .setProject(APPWRITE_CONFIG.PROJECT_ID);
      const tablesDB = new TablesDB(client);

      const res = await tablesDB.listRows(dbId, tableId, [
        Query.equal('userId', user.$id),
        Query.limit(50),
        Query.orderDesc('$updatedAt')
      ]).catch(async () => {
        return await (databases as any).listDocuments(dbId, tableId, [
          Query.equal('userId', user.$id),
          Query.limit(50),
          Query.orderDesc('$updatedAt')
        ]);
      });

      const rows = Array.isArray(res?.rows) ? res.rows : Array.isArray(res?.documents) ? res.documents : [];

      // Read local pins state directly from ResourcePinContext storage key
      let pinnedMap: Record<string, boolean> = {};
      try {
        const storedPins = localStorage.getItem(`kylrix_resource_pins_${user.$id}`);
        if (storedPins) {
          const parsed = JSON.parse(storedPins);
          if (Array.isArray(parsed)) {
            parsed.forEach((id: string) => { pinnedMap[id] = true; });
          }
        }
      } catch {}

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
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotesBarebones();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto text-white space-y-8">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h1 className="text-xl font-bold text-white">Ideas</h1>
        <button
          onClick={() => void fetchNotesBarebones()}
          className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-black font-bold rounded-xl transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-white/40">Loading ideas...</div>
      ) : notes.length === 0 ? (
        <div className="p-8 text-center text-white/40">No ideas found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map((n) => {
            const isPinned = Boolean(n.isPinned);
            const isPublic = Boolean(n.isPublic);
            const isShared = Boolean(n.isGuest || (n.$permissions && n.$permissions.some((p: string) => p.includes('user:') && !p.includes(`user:${n.userId}`))));
            return (
              <div
                key={n.$id}
                className="p-4 bg-[#161412] border border-white/10 rounded-2xl space-y-2 relative cursor-pointer hover:border-white/20 transition-all"
                onClick={() => setActiveDetail({ type: 'note', id: n.$id, data: n })}
              >
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold truncate max-w-[220px] text-sm">{n.title || 'Untitled Idea'}</p>
                  <div className="flex items-center gap-1.5">
                    <Pin
                      size={14}
                      className={isPinned ? 'text-[#EC4899] fill-[#EC4899]/20' : 'text-white/20'}
                      aria-label={isPinned ? 'Pinned' : 'Unpinned'}
                    />
                    <Globe
                      size={14}
                      className={isPublic || isShared ? 'text-emerald-400' : 'text-white/20'}
                      aria-label={isPublic || isShared ? 'Shared/Public' : 'Private'}
                    />
                  </div>
                </div>
                <p className="text-white/60 text-xs line-clamp-2">{n.content || ''}</p>
                {Array.isArray(n.tags) && n.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {n.tags.slice(0, 4).map((tag: string, i: number) => (
                      <span key={i} className="px-2 py-0.5 rounded-lg bg-white/5 text-white/40 text-[10px] font-mono">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
