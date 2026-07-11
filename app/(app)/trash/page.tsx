'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { databases } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query } from 'appwrite';
import {
  Trash2,
  ArrowLeft,
  Loader2 as SpinnerIcon,
  RefreshCw,
  Clock,
  ShieldAlert,
  Info,
  CheckCircle2,
  Trash
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface TrashItem {
  id: string;
  title: string;
  type: string;
  deletedAt: string;
  databaseId: string;
  tableId: string;
}

export default function TrashPage() {
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const router = useRouter();

  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrash = useCallback(async () => {
    if (!user?.$id) return;
    try {
      setLoading(true);
      const trashList: TrashItem[] = [];

      // Query config mapping
      const queries = [
        {
          type: 'Note',
          db: APPWRITE_CONFIG.DATABASES.NOTE,
          table: APPWRITE_CONFIG.TABLES.NOTE.NOTES,
          titleField: 'title',
          defaultTitle: 'Untitled Note',
          userField: 'userId'
        },
        {
          type: 'Tag',
          db: APPWRITE_CONFIG.DATABASES.NOTE,
          table: APPWRITE_CONFIG.TABLES.NOTE.TAGS,
          titleField: 'name',
          defaultTitle: 'Untitled Tag',
          userField: 'userId'
        },
        {
          type: 'Goal',
          db: APPWRITE_CONFIG.DATABASES.FLOW,
          table: APPWRITE_CONFIG.TABLES.FLOW.TASKS,
          titleField: 'title',
          defaultTitle: 'Untitled Goal',
          userField: 'userId'
        },
        {
          type: 'Event',
          db: APPWRITE_CONFIG.DATABASES.FLOW,
          table: APPWRITE_CONFIG.TABLES.FLOW.EVENTS,
          titleField: 'title',
          defaultTitle: 'Untitled Event',
          userField: 'userId'
        },
        {
          type: 'Form',
          db: APPWRITE_CONFIG.DATABASES.FLOW,
          table: APPWRITE_CONFIG.TABLES.FLOW.FORMS,
          titleField: 'title',
          defaultTitle: 'Untitled Form',
          userField: 'userId'
        },
        {
          type: 'Form Response',
          db: APPWRITE_CONFIG.DATABASES.FLOW,
          table: APPWRITE_CONFIG.TABLES.FLOW.FORM_SUBMISSIONS,
          titleField: '$id',
          defaultTitle: 'Submission Response',
          userField: 'submitterId'
        },
        {
          type: 'Credential',
          db: APPWRITE_CONFIG.DATABASES.VAULT,
          table: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
          titleField: 'name',
          defaultTitle: 'Untitled Credential',
          userField: 'userId'
        },
        {
          type: 'TOTP Secret',
          db: APPWRITE_CONFIG.DATABASES.VAULT,
          table: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS,
          titleField: 'issuer',
          defaultTitle: 'Untitled TOTP Secret',
          userField: 'userId'
        },
        {
          type: 'Project',
          db: APPWRITE_CONFIG.DATABASES.CHAT,
          table: 'projects',
          titleField: 'title',
          defaultTitle: 'Untitled Project',
          userField: 'ownerId'
        }
      ];

      // Run parallel calls per table
      await Promise.all(
        queries.map(async (q) => {
          try {
            const res = await databases.listRows(q.db, q.table, [
              Query.equal(q.userField, user.$id),
              Query.equal('isTrash', true),
              Query.limit(100)
            ]);
            res.rows.forEach((row: any) => {
              trashList.push({
                id: row.$id,
                title: row[q.titleField] || q.defaultTitle,
                type: q.type,
                deletedAt: row.$updatedAt || new Date().toISOString(),
                databaseId: q.db,
                tableId: q.table
              });
            });
          } catch (e) {
            console.warn(`Failed to fetch trash for ${q.type}`, e);
          }
        })
      );

      // Trigger automatic aging cleanup (items > 30 days) under the hood in the background
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const expiredItems = trashList.filter(item => new Date(item.deletedAt).getTime() < thirtyDaysAgo);
      if (expiredItems.length > 0) {
        // Asynchronously delete expired items in background
        void Promise.all(
          expiredItems.map(item =>
            databases.deleteRow(item.databaseId, item.tableId, item.id).catch(() => null)
          )
        );
      }

      setItems(trashList.filter(item => new Date(item.deletedAt).getTime() >= thirtyDaysAgo).sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()));
    } catch (e: any) {
      toast.error('Failed to load trash contents.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      openIDMWindow();
      return;
    }
    if (user?.$id) {
      fetchTrash();
    }
  }, [isAuthenticated, user, fetchTrash, openIDMWindow]);

  const handleRestore = async (item: TrashItem) => {
    try {
      toast.loading('Restoring item...', { id: `restore-${item.id}` });
      await databases.updateRow(item.databaseId, item.tableId, item.id, { isTrash: false });
      toast.success(`${item.type} restored successfully!`, { id: `restore-${item.id}` });
      await fetchTrash();
    } catch (e: any) {
      toast.error(`Failed to restore: ${e.message}`, { id: `restore-${item.id}` });
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    openUnified('delete-confirm', {
      title: `Permanently Delete ${item.type}?`,
      description: `Are you sure you want to permanently delete "${item.title}"? This cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      onConfirm: async () => {
        try {
          toast.loading('Deleting permanently...', { id: `del-${item.id}` });
          await databases.deleteRow(item.databaseId, item.tableId, item.id);
          toast.success('Deleted permanently!', { id: `del-${item.id}` });
          await fetchTrash();
        } catch (e: any) {
          toast.error(`Deletion failed: ${e.message}`, { id: `del-${item.id}` });
        }
      }
    });
  };

  const handleEmptyTrash = () => {
    if (items.length === 0) return;
    openUnified('delete-confirm', {
      title: 'Empty Trash Bin?',
      description: 'WARNING: This will permanently delete all items currently in your trash bin. This action is completely irreversible. Proceed?',
      confirmLabel: 'Empty Trash',
      onConfirm: async () => {
        try {
          setPurging(true);
          toast.loading('Emptying trash...', { id: 'empty-trash' });
          await Promise.all(
            items.map(item => databases.deleteRow(item.databaseId, item.tableId, item.id).catch(() => null))
          );
          toast.success('Trash bin emptied!', { id: 'empty-trash' });
          await fetchTrash();
        } catch (e: any) {
          toast.error('Failed to empty trash entirely.');
        } finally {
          setPurging(false);
        }
      }
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrash();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <SpinnerIcon className="animate-spin text-[#6366F1]" size={36} />
          <p className="text-white/40 text-sm font-semibold">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Categorize items by object type
  const categorized = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, TrashItem[]>);

  return (
    <div className="min-h-screen bg-[#0A0908] text-white p-4 md:p-8">
      <div className="max-w-[1200px] mx-auto w-full">
        <MultiSectionContainer panels={['note', 'huddles', 'projects']}>
          {/* Header */}
          <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 mb-8 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative select-none">
            <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#EF4444] to-transparent" />
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="w-10 h-10 rounded-xl border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white/80 flex items-center justify-center transition-all cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h1 className="text-white font-black text-2xl tracking-tight leading-none font-mono flex items-center gap-2">
                  <Trash2 size={24} className="text-[#EF4444]" />
                  <span>Trash bin</span>
                </h1>
                <p className="text-white/40 text-xs font-semibold mt-1">
                  Items in trash are automatically aged and permanently deleted after 30 days.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-stretch md:self-auto">
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="h-10 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <button
                onClick={handleEmptyTrash}
                disabled={items.length === 0 || purging}
                className="h-10 px-5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer"
              >
                <Trash size={14} />
                <span>Empty Trash</span>
              </button>
            </div>
          </header>

          {/* Main content */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <SpinnerIcon className="animate-spin text-[#EF4444]" size={40} />
              <p className="text-white/40 text-sm font-semibold">Scanning trash archives...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 border border-dashed border-white/10 rounded-[32px] bg-white/[0.01]">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-white font-black text-lg tracking-tight font-mono">Trash is empty</h3>
              <p className="text-white/30 text-xs font-semibold text-center mt-1 max-w-[280px]">
                No recently deleted items were found. When you delete notes, vault keys, or flow details, they will appear here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-10">
              {Object.entries(categorized).map(([category, catItems]) => (
                <div key={category} className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                    <span className="text-xs font-black text-[#EF4444] tracking-widest uppercase font-mono">
                      {category}s
                    </span>
                    <span className="bg-white/5 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/40 font-mono">
                      {catItems.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {catItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-5 bg-[#161412] border border-white/5 hover:border-white/10 rounded-[24px] flex flex-col justify-between gap-4 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-white font-black text-base truncate font-mono">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-1 text-white/30 text-[10px] font-semibold">
                              <Clock size={11} />
                              <span>Deleted {new Date(item.deletedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => handleRestore(item)}
                            className="h-8 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] transition-all cursor-pointer"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(item)}
                            className="h-8 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[#EF4444] font-bold text-[11px] transition-all cursor-pointer"
                          >
                            Delete Permanently
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </MultiSectionContainer>
      </div>
    </div>
  );
}
