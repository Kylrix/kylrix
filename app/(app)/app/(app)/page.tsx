'use client';

import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { NoteObjectRow } from '@/components/ui/NoteObjectRow';
import { useNotes } from '@/context/NotesContext';

export default function IdeasPage() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { upsertNote } = useNotes();

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

      // Stamp isPinned and isGuest from local data, then feed into NotesContext
      // so NoteCard's liveNote lookup finds the correctly stamped object
      const stamped = sorted.map((n: any) => {
        const isShared = Boolean(n.isGuest || (n.$permissions && n.$permissions.some((p: string) => p.includes('user:') && !p.includes(`user:${n.userId}`))));
        return {
          ...n,
          isPinned: Boolean(n.isPinned || pinnedMap[n.$id]),
          isGuest: Boolean(n.isGuest || isShared),
        };
      });

      // Feed into NotesContext so NoteCard's liveNote resolves correctly
      stamped.forEach((n: any) => upsertNote(n));

      setNotes(stamped);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotesBarebones();
  }, []);

  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

  const tags = React.useMemo(() => {
    const allTags = notes.flatMap((n: any) => n.tags || []).filter(Boolean);
    return Array.from(new Set(allTags)).slice(0, 8);
  }, [notes]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const displayPinned = selectedTag ? pinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : pinnedNotes;
  const displayUnpinned = selectedTag ? unpinnedNotes.filter((n: any) => n.tags?.includes(selectedTag)) : unpinnedNotes;

  return (
    <div className="p-8 max-w-5xl mx-auto text-white space-y-8">
      {/* Header Bar */}
      <header className="flex items-center justify-between p-5 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight font-mono tracking-tighter">
            Ideas
          </h1>
          <button
            onClick={() => void fetchNotesBarebones()}
            disabled={loading}
            className="w-9 h-9 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 flex items-center justify-center transition-all duration-300 disabled:opacity-40"
            title="Refresh Ideas"
          >
            <RefreshCw size={15} className={`transition-all ${loading ? 'animate-spin text-[#EC4899]' : 'text-white/60'}`} />
          </button>
        </div>

        <p className="text-white/40 text-xs font-semibold leading-normal font-sans">
          <span className="font-mono font-bold text-[#EC4899]">{notes.length}</span> {notes.length === 1 ? 'idea' : 'ideas'}
        </p>
      </header>

      {/* Tags Filter Row */}
      {tags.length > 0 && (
        <div className="overflow-x-auto scrollbar-none p-2 bg-white/[0.01] border border-white/5 rounded-[24px] flex items-center gap-2 select-none">
          {tags.map((tag: string, index: number) => (
            <button
              key={index}
              aria-pressed={selectedTag === tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                selectedTag === tag 
                  ? 'bg-[#EC4899] border-[#EC4899] text-white shadow-[0_4px_12px_rgba(236,72,153,0.2)]' 
                  : 'bg-white/3 border-white/8 text-white/60 hover:text-white hover:border-white/15'
              }`}
            >
              {tag}
            </button>
          ))}
          {selectedTag && (
            <button
              onClick={() => setSelectedTag(null)}
              className="ml-2 px-3 py-1.5 text-xs text-[#EC4899] hover:text-[#f472b6] font-mono font-bold tracking-wider"
            >
              Clear
            </button>
          )}
        </div>
      )}

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
        <div className="space-y-8">
          {/* Pinned Section */}
          {displayPinned.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-mono font-bold text-white/40 uppercase tracking-wider px-1">
                Pinned ({displayPinned.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayPinned.map((note) => (
                  <NoteObjectRow key={note.$id} note={note} />
                ))}
              </div>
            </div>
          )}

          {/* All Ideas Section */}
          {displayUnpinned.length > 0 && (
            <div className="space-y-3">
              {displayPinned.length > 0 && (
                <h2 className="text-xs font-mono font-bold text-white/40 uppercase tracking-wider px-1 pt-2">
                  All Ideas ({displayUnpinned.length})
                </h2>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {displayUnpinned.map((note) => (
                  <NoteObjectRow key={note.$id} note={note} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
