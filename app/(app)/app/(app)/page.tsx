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
          {notes.map((note) => (
            <NoteObjectRow key={note.$id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
