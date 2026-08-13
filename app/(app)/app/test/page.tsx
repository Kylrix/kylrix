'use client';

import React, { useEffect, useState } from 'react';
import { Pin, Lock, Globe, RefreshCw, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AppTestPage() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<any[]>([]);
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const log = (msg: string) => {
    console.log(`[AppTest] ${msg}`);
    setRawLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  };

  const fetchNotesBarebones = async () => {
    setLoading(true);
    setError(null);
    setRawLogs([]);

    try {
      log('Initializing direct Client SDK fetch for notes...');
      const { Query, Client, TablesDB } = await import('appwrite');
      const { account, databases } = await import('@/lib/appwrite/client');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      const user = await account.get().catch(() => null);
      if (!user?.$id) {
        log('No active authenticated user session.');
        setError('Unauthenticated user session');
        setLoading(false);
        return;
      }

      log(`Active user ID: ${user.$id}`);
      log(`Querying notes table (${APPWRITE_CONFIG.TABLES.NOTE.NOTES})...`);

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
      log(`Fetched ${rows.length} raw notes from Appwrite.`);

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
      log(`Successfully sorted ${sorted.length} notes (pinned first, then newest updatedAt).`);
    } catch (err: any) {
      log(`ERROR CAUGHT: ${err?.message || String(err)}`);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDiagnostics = () => {
    const redactedNotes = notes.map((n) => ({
      $id: n.$id,
      userId: n.userId,
      creatorId: n.creatorId ?? null,
      title: n.title ? '[REDACTED_TITLE]' : '',
      content: n.content ? '[REDACTED_CONTENT]' : '',
      tags: Array.isArray(n.tags) ? n.tags : [],
      isPinned: n.isPinned ?? null,
      isPublic: n.isPublic ?? null,
      isGuest: n.isGuest ?? null,
      isTrash: n.isTrash ?? null,
      permissions: n.$permissions || [],
      $createdAt: n.$createdAt,
      $updatedAt: n.$updatedAt,
    }));

    const report = {
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
      error: error || null,
      logs: rawLogs,
      notesCount: notes.length,
      notes: redactedNotes,
    };

    const text = JSON.stringify(report, null, 2);
    navigator.clipboard.writeText(text);
    toast.success('Diagnostics copied to clipboard (titles/contents redacted)');
  };

  useEffect(() => {
    void fetchNotesBarebones();
  }, []);

  return (
    <div className="p-8 max-w-5xl mx-auto text-white space-y-8 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-bold text-pink-400 font-clash">/app/test (Ideas Diagnostic Reference)</h1>
          <p className="text-white/50 text-xs">Bare-bones Client SDK listRows + client-side pin sorting + shared icons.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopyDiagnostics}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors border border-indigo-400/30 flex items-center gap-2"
          >
            <Copy size={14} />
            Copy Redacted Diagnostics
          </button>
          <button
            onClick={() => void fetchNotesBarebones()}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-black font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Re-Fetch Notes
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl text-red-300">
          <p className="font-bold text-sm mb-1">Direct Fetch Exception:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Execution Logs */}
      <div className="p-4 bg-black/60 border border-white/10 rounded-2xl space-y-1">
        <p className="text-pink-400 font-bold mb-2">Execution Logs:</p>
        {rawLogs.map((l, i) => (
          <div key={i} className="text-white/70">{l}</div>
        ))}
      </div>

      {/* Raw Notes List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          Notes / Ideas ({notes.length})
        </h2>
        {loading ? (
          <div className="p-8 text-center text-white/40">Loading raw notes...</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl text-white/40">
            Zero notes returned directly by Appwrite Client SDK.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {notes.map((n) => {
              const isShared = n.isPublic || n.isGuest || (n.$permissions && n.$permissions.some((p: string) => p.includes('Role.any') || p.includes('user:')));
              return (
                <div key={n.$id} className="p-4 bg-[#161412] border border-white/10 rounded-2xl space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <p className="text-pink-400 font-bold truncate max-w-[200px]">{n.title || 'Untitled Idea'}</p>
                    <div className="flex items-center gap-2">
                      {n.isPinned && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] flex items-center gap-1">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                      {isShared && (
                        <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-[10px] flex items-center gap-1">
                          <Globe size={10} /> Shared
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-white/70 line-clamp-2">{n.content || 'Empty note content'}</p>
                  <div className="text-[10px] text-white/40 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span>$id: {n.$id}</span>
                    <span>updated: {new Date(n.$updatedAt || n.updatedAt || 0).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
