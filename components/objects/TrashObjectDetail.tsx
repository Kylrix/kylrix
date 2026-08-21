'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { databases } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query } from 'appwrite';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import {
  Trash2,
  X,
  Loader2 as SpinnerIcon,
  Clock,
  Trash,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface TrashItem {
  id: string;
  title: string;
  type: string;
  deletedAt: string;
  databaseId: string;
  tableId: string;
  projectId?: string;
  isWorkspace?: boolean;
  parentFormId?: string;
  parentFormTitle?: string;
  responseCount?: number;
  childResponseIds?: string[];
}

interface TrashObjectDetailProps {
  onClose?: () => void;
  embedded?: boolean;
}

export function TrashObjectDetail({ onClose }: TrashObjectDetailProps) {
  const { user, isAuthenticated } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { activeWorkspace } = useWorkspace();
  const { closeSidebar } = useDynamicSidebar();
  const { closeOverlay } = useOverlay();

  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const workspaceId = isCustomWorkspace ? activeWorkspace!.id : 'personal';
  const cacheKeyAll = user?.$id ? `trash_all_${user.$id}` : null;

  const [itemsAll, setItemsAll] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('All');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const queriesCfg = useMemo(() => [
    { type: 'Note', db: APPWRITE_CONFIG.DATABASES.NOTE, table: APPWRITE_CONFIG.TABLES.NOTE.NOTES, titleField: 'title', defaultTitle: 'Untitled Note', userField: 'userId' },
    { type: 'Tag', db: APPWRITE_CONFIG.DATABASES.NOTE, table: APPWRITE_CONFIG.TABLES.NOTE.TAGS, titleField: 'name', defaultTitle: 'Untitled Tag', userField: 'userId' },
    { type: 'Goal', db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.TASKS, titleField: 'title', defaultTitle: 'Untitled Goal', userField: 'userId' },
    { type: 'Event', db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.EVENTS, titleField: 'title', defaultTitle: 'Untitled Event', userField: 'userId' },
    { type: 'Form', db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.FORMS, titleField: 'title', defaultTitle: 'Untitled Form', userField: 'userId' },
    { type: 'Credential', db: APPWRITE_CONFIG.DATABASES.VAULT, table: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS, titleField: 'name', defaultTitle: 'Untitled Credential', userField: 'userId' },
    { type: 'TOTP Secret', db: APPWRITE_CONFIG.DATABASES.VAULT, table: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, titleField: 'issuer', defaultTitle: 'Untitled TOTP Secret', userField: 'userId' },
    { type: 'Project', db: APPWRITE_CONFIG.DATABASES.CHAT, table: 'projects', titleField: 'title', defaultTitle: 'Untitled Project', userField: 'ownerId' },
    { type: 'File', db: APPWRITE_CONFIG.DATABASES.NOTE, table: 'objects', titleField: 'label', defaultTitle: 'Untitled File', userField: 'userId' },
    { type: 'GitHub Repository', db: APPWRITE_CONFIG.DATABASES.CONNECT, table: 'source_control', titleField: 'name', defaultTitle: 'Untitled Repository', userField: 'userId' },
  ], []);

  const fetchAllTrash = useCallback(async (force = false) => {
    if (!user?.$id || !cacheKeyAll) return;
    if (!force) {
      try {
        const cached = await LocalEngine.cacheGet<TrashItem[]>(cacheKeyAll);
        if (cached && cached.length) {
          setItemsAll(cached);
          setLoading(false);
        }
      } catch {}
    }

    try {
      const results: TrashItem[] = [];
      const fetchPromises = queriesCfg.map(async (cfg) => {
        try {
          const res = await databases.listRows(cfg.db, cfg.table, [
            Query.equal('isTrash', true),
            Query.equal(cfg.userField, user.$id),
            Query.limit(50),
            Query.orderDesc('$updatedAt'),
          ]);
          const docs = (res as any).rows || (res as any).documents || [];
          return docs.map((doc: any) => ({
            id: doc.$id,
            title: doc[cfg.titleField] || cfg.defaultTitle,
            type: cfg.type,
            deletedAt: doc.$updatedAt || doc.$createdAt,
            databaseId: cfg.db,
            tableId: cfg.table,
            projectId: doc.projectId || undefined,
            isWorkspace: Boolean(doc.isWorkspace || doc.projectId),
          }));
        } catch {
          return [];
        }
      });

      const chunkResults = await Promise.all(fetchPromises);
      chunkResults.forEach((arr) => results.push(...arr));

      results.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
      setItemsAll(results);
      await LocalEngine.cacheSet(cacheKeyAll, results).catch(() => {});
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.$id, cacheKeyAll, queriesCfg]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchAllTrash();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchAllTrash]);

  // Listen to trash update events
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleTrashUpdated = () => {
      void fetchAllTrash(true);
    };
    window.addEventListener('kylrix:trash-updated', handleTrashUpdated);
    return () => window.removeEventListener('kylrix:trash-updated', handleTrashUpdated);
  }, [fetchAllTrash]);

  const items = useMemo(() => {
    return itemsAll.filter((it) => {
      if (activeTab === 'All') return true;
      if (activeTab === 'Notes') return it.type === 'Note';
      if (activeTab === 'Goals') return it.type === 'Goal';
      if (activeTab === 'Forms') return it.type === 'Form';
      if (activeTab === 'Vault') return it.type === 'Credential' || it.type === 'TOTP Secret';
      if (activeTab === 'Workspaces') return it.type === 'Project';
      return it.type === activeTab;
    });
  }, [itemsAll, activeTab]);

  const visibleItems = useMemo(() => items.slice(0, page * PAGE_SIZE), [items, page]);
  const hasMore = visibleItems.length < items.length;

  const handleRestore = async (item: TrashItem) => {
    try {
      const remaining = itemsAll.filter((it) => !(it.id === item.id && it.tableId === item.tableId));
      setItemsAll(remaining);
      if (cacheKeyAll) await LocalEngine.cacheSet(cacheKeyAll, remaining).catch(() => {});

      await databases.updateRow(item.databaseId, item.tableId, item.id, { isTrash: false });
      toast.success(`Restored "${item.title}"`);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kylrix:trash-updated'));
      }
    } catch (err: any) {
      toast.error(`Restore failed: ${err.message}`);
      void fetchAllTrash(true);
    }
  };

  const handlePermanentDelete = (item: TrashItem) => {
    openUnified('delete-confirm', {
      title: `Permanently delete "${item.title}"?`,
      description: 'This operation is permanent and irreversible. All associated sub-records will be wiped.',
      confirmLabel: 'Delete Forever',
      onConfirm: async () => {
        try {
          const remaining = itemsAll.filter((it) => !(it.id === item.id && it.tableId === item.tableId));
          setItemsAll(remaining);
          if (cacheKeyAll) await LocalEngine.cacheSet(cacheKeyAll, remaining).catch(() => {});

          const { executeCascadeDeleteSecure } = await import('@/lib/actions/cascade-delete');
          await (executeCascadeDeleteSecure as any)(item.databaseId, item.tableId, item.id).catch(() =>
            databases.deleteRow(item.databaseId, item.tableId, item.id).catch(() => null)
          );

          toast.success('Deleted permanently');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kylrix:trash-updated'));
          }
        } catch (err: any) {
          toast.error(`Deletion failed: ${err.message}`);
          void fetchAllTrash(true);
        }
      },
    });
  };

  const handleEmptyTrash = () => {
    if (items.length === 0) return;
    openUnified('delete-confirm', {
      title: `Empty ${items.length} item(s) from Trash?`,
      description: 'This will permanently erase all trashed items and their attached relations. Irreversible.',
      confirmLabel: 'Empty Trash',
      onConfirm: async () => {
        try {
          setPurging(true);
          const toDelete = [...items];
          const remaining = itemsAll.filter((all) => !toDelete.some((w) => w.id === all.id && w.tableId === all.tableId));
          setItemsAll(remaining);
          if (cacheKeyAll) await LocalEngine.cacheSet(cacheKeyAll, remaining).catch(() => {});

          await Promise.all(
            toDelete.map((it) =>
              (async () => {
                try {
                  const { executeCascadeDeleteSecure } = await import('@/lib/actions/cascade-delete');
                  await (executeCascadeDeleteSecure as any)(it.databaseId, it.tableId, it.id).catch(() =>
                    databases.deleteRow(it.databaseId, it.tableId, it.id).catch(() => null)
                  );
                } catch {
                  await databases.deleteRow(it.databaseId, it.tableId, it.id).catch(() => null);
                }
              })()
            )
          );

          toast.success('Trash emptied');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('kylrix:trash-updated'));
          }
        } catch {
          toast.error('Failed to empty trash');
        } finally {
          setPurging(false);
        }
      },
    });
  };

  const handleClose = () => {
    onClose?.();
    closeSidebar();
    closeOverlay();
  };

  return (
    <div className="h-full flex flex-col bg-[#161412] text-white overflow-hidden select-none">
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-white/6 flex items-center justify-between gap-3 shrink-0 bg-[#161412]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0A0908] text-[#EF4444] flex items-center justify-center shrink-0">
            <Trash2 size={16} />
          </div>
          <div className="min-w-0">
            <h2 className="text-white font-black text-lg font-clash tracking-tight truncate">
              Trash
            </h2>
            <p className="text-white/50 text-xs font-satoshi truncate">
              {items.length} trashed item(s) • Auto-purged after 90 days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleEmptyTrash}
              disabled={purging}
              className="px-3 py-1.5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 text-white font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash size={13} />
              <span>Empty</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/8 text-white/50 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 border-b border-white/4 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-[#161412]">
        {['All', 'Notes', 'Goals', 'Forms', 'Vault', 'Workspaces'].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === tab
                ? 'bg-white text-black font-extrabold'
                : 'bg-[#0A0908] border border-white/6 text-white/60 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-white/40">
            <SpinnerIcon size={24} className="animate-spin text-[#EF4444]" />
            <span className="text-xs font-satoshi">Loading trash...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-white/40 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0A0908] border border-white/6 flex items-center justify-center text-white/20">
              <Trash2 size={22} />
            </div>
            <p className="text-sm font-bold text-white/60 font-satoshi">Trash is empty</p>
            <p className="text-xs text-white/40 max-w-xs font-satoshi">
              Deleted items will appear here for 90 days before being automatically purged.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {visibleItems.map((item) => (
              <div
                key={`${item.tableId}-${item.id}`}
                className="p-3.5 rounded-2xl bg-[#0A0908] border border-white/6 flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-extrabold text-white font-clash truncate">
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-white/40 font-satoshi">
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 font-mono text-[10px]">
                      {item.type}
                    </span>
                    <span>Deleted {new Date(item.deletedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRestore(item)}
                    title="Restore"
                    className="p-2 rounded-xl bg-[#161412] border border-white/6 text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentDelete(item)}
                    title="Delete permanently"
                    className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    <Trash size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
