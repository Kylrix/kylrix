'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { databases } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query } from 'appwrite';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useSidebar } from '@/components/ui/SidebarContext';
import { useNativeSidebarOptional } from '@/context/RightRailContext';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useOverlay } from '@/components/ui/OverlayContext';
import { LocalEngine } from '@/lib/services/LocalEngine';
import {
  Trash2,
  ArrowLeft,
  Loader2 as SpinnerIcon,
  Clock,
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
  projectId?: string;
  isWorkspace?: boolean;
}

export default function TrashPage() {
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();
  const { isRightRailPushing } = useSidebar();
  const _nativeSidebar = useNativeSidebarOptional();
  const { openSidebar, closeSidebar } = useDynamicSidebar();
  const { openOverlay, closeOverlay } = useOverlay();
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 768px)');
    const h = () => setIsDesktop(m.matches);
    h();
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);

  const isCustomWorkspace = Boolean(activeWorkspace && !activeWorkspace.isPersonal);
  const workspaceId = isCustomWorkspace ? activeWorkspace!.id : 'personal';
  const cacheKeyAll = user?.$id ? `trash_all_${user.$id}` : null;
  const cacheKeyWs = user?.$id ? `trash_ws_${user.$id}_${workspaceId}` : null;

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
    { type: 'Form Response', db: APPWRITE_CONFIG.DATABASES.FLOW, table: APPWRITE_CONFIG.TABLES.FLOW.FORM_SUBMISSIONS, titleField: '$id', defaultTitle: 'Submission Response', userField: 'submitterId' },
    { type: 'Credential', db: APPWRITE_CONFIG.DATABASES.VAULT, table: APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS, titleField: 'name', defaultTitle: 'Untitled Credential', userField: 'userId' },
    { type: 'TOTP Secret', db: APPWRITE_CONFIG.DATABASES.VAULT, table: APPWRITE_CONFIG.TABLES.VAULT.TOTP_SECRETS, titleField: 'issuer', defaultTitle: 'Untitled TOTP Secret', userField: 'userId' },
    { type: 'Project', db: APPWRITE_CONFIG.DATABASES.CHAT, table: 'projects', titleField: 'title', defaultTitle: 'Untitled Project', userField: 'ownerId' },
    { type: 'File', db: APPWRITE_CONFIG.DATABASES.NOTE, table: 'objects', titleField: 'label', defaultTitle: 'Untitled File', userField: 'userId' },
    { type: 'GitHub Repository', db: APPWRITE_CONFIG.DATABASES.CONNECT, table: 'source_control', titleField: 'name', defaultTitle: 'Untitled Repository', userField: 'userId' },
  ], []);

  const fetchAllTrash = useCallback(async (force = false) => {
    if (!user?.$id || !cacheKeyAll) return;
    // 1. Paint local first — instant from LocalEngine (bloated safe)
    if (!force) {
      try {
        const cached = await LocalEngine.cacheGet<TrashItem[]>(cacheKeyAll);
        if (cached && cached.length) {
          setItemsAll(cached);
          setLoading(false);
        }
      } catch {}
    }
    if (!force) {
      const hasCache = await LocalEngine.cacheGet<TrashItem[]>(cacheKeyAll).then(v => !!(v && v.length)).catch(()=>false);
      if (hasCache) {
        // Background replenish without blocking paint — but still do it
      } else {
        setLoading(true);
      }
    } else {
      setLoading(true);
    }

    const trashList: TrashItem[] = [];
    const fetchOneTable = async (q: typeof queriesCfg[0]) => {
      let cursor: string | null = null;
      let totalFetched = 0;
      while (totalFetched < 500) {
        const queries: string[] = [
          Query.equal(q.userField, user.$id),
          Query.equal('isTrash', true),
          Query.limit(100),
          Query.orderDesc('$updatedAt'),
        ];
        if (cursor) queries.push(Query.cursorAfter(cursor));
        try {
          const res: any = await databases.listRows(q.db, q.table, queries);
          const rows: any[] = res?.rows || [];
          if (!rows.length) break;
          rows.forEach((row: any) => {
            const proj = row.projectId || row.project_id || undefined;
            const isWs = row.isWorkspace === true || Boolean(proj);
            trashList.push({
              id: row.$id,
              title: row[q.titleField] || q.defaultTitle,
              type: q.type,
              deletedAt: row.$updatedAt || new Date().toISOString(),
              databaseId: q.db,
              tableId: q.table,
              projectId: proj,
              isWorkspace: isWs,
            });
          });
          totalFetched += rows.length;
          if (rows.length < 100) break;
          cursor = rows[rows.length - 1].$id;
        } catch {
          break;
        }
      }
    };

    await Promise.all(queriesCfg.map(fetchOneTable));

    // Aging — 30 days, background cascade (fault-tolerant per why.cascade-delete-mechanic)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const expired = trashList.filter(i => new Date(i.deletedAt).getTime() < thirtyDaysAgo);
    if (expired.length) {
      void Promise.all(expired.map(it => databases.deleteRow(it.databaseId, it.tableId, it.id).catch(()=>null)));
    }
    const activeTrash = trashList.filter(i => new Date(i.deletedAt).getTime() >= thirtyDaysAgo)
      .sort((a,b)=> new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    // Merge into local copy — never wipe populated live set on failed pull
    try {
      const existing = (await LocalEngine.cacheGet<TrashItem[]>(cacheKeyAll)) || [];
      if (activeTrash.length === 0 && existing.length > 0) {
        // Keep existing if remote empty but local had data (failed pull guard)
        setItemsAll(existing);
      } else {
        const byId = new Map<string, TrashItem>();
        [...existing, ...activeTrash].forEach(it => byId.set(`${it.databaseId}:${it.tableId}:${it.id}`, it));
        // Prefer newer deletedAt
        activeTrash.forEach(it => byId.set(`${it.databaseId}:${it.tableId}:${it.id}`, it));
        const merged = Array.from(byId.values())
          .filter(i => new Date(i.deletedAt).getTime() >= thirtyDaysAgo)
          .sort((a,b)=> new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
        await LocalEngine.cacheSet(cacheKeyAll, merged);
        setItemsAll(merged);
      }
    } catch {
      setItemsAll(activeTrash);
      try { await LocalEngine.cacheSet(cacheKeyAll!, activeTrash); } catch {}
    }
    setLoading(false);
  }, [user?.$id, cacheKeyAll, queriesCfg]);

  useEffect(() => {
    if (!isAuthenticated) { openIDMWindow(); return; }
    if (user?.$id) fetchAllTrash(false);

    const onTrashUpdated = (e: Event) => {
      const item = (e as CustomEvent)?.detail?.item as TrashItem | undefined;
      if (item) {
        setItemsAll((prev) => [item, ...prev.filter((i) => i.id !== item.id)]);
      }
    };

    window.addEventListener('kylrix:trash-updated', onTrashUpdated);
    return () => {
      window.removeEventListener('kylrix:trash-updated', onTrashUpdated);
    };
  }, [isAuthenticated, user?.$id, fetchAllTrash, openIDMWindow]);

  // Workspace-aware via projects table + project_objects (entityId) — per workspace.projects-table
  const [workspaceEntityIds, setWorkspaceEntityIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isCustomWorkspace || !activeWorkspace?.id) { setWorkspaceEntityIds(new Set()); return; }
    const pid = activeWorkspace.id;
    void (async () => {
      try {
        const kinds = ['note','goal','task','event','form','credential','password','totp','project','file'];
        const sets = await Promise.all(kinds.map(async (k) => {
          try {
            const { projectObjectsKindCacheKey } = await import('@/lib/projects/projects-cache');
            const cached = await LocalEngine.cacheGet<any[]>(projectObjectsKindCacheKey(pid, k));
            return (cached || []).map((r:any)=> String(r.entityId)).filter(Boolean);
          } catch { return []; }
        }));
        const allIds = new Set<string>(sets.flat());
        // Also hydrates from remote in background (paginated merge handles bloated)
        try {
          const { ProjectsService } = await import('@/lib/appwrite/projects');
          await Promise.all(kinds.map(async (k) => {
            try {
              const res: any = await ProjectsService.listProjectObjectsByKind(pid, k);
              (res?.rows || []).forEach((r:any)=> { if (r.entityId) allIds.add(String(r.entityId)); });
            } catch {}
          }));
        } catch {}
        setWorkspaceEntityIds(allIds);
      } catch { setWorkspaceEntityIds(new Set()); }
    })();
  }, [isCustomWorkspace, activeWorkspace?.id]);

  // Workspace switch is local filter — no DB spike (local-first) — projectId OR project_objects entityId
  const items = useMemo(() => {
    if (!activeWorkspace) return itemsAll;
    if (activeWorkspace.isPersonal) {
      return itemsAll.filter(it => !it.isWorkspace || !it.projectId);
    }
    const pid = activeWorkspace.id;
    return itemsAll.filter(it => it.projectId === pid || workspaceEntityIds.has(it.id));
  }, [itemsAll, activeWorkspace, workspaceEntityIds]);

  useEffect(() => { setPage(1); }, [activeTab, workspaceId, items.length]);
  useEffect(() => {
    if (cacheKeyWs) { void LocalEngine.cacheSet(cacheKeyWs, items).catch(()=>{}); }
  }, [items, cacheKeyWs]);

  const handleRestore = async (item: TrashItem) => {
    try {
      toast.loading('Restoring item...', { id: `restore-${item.id}` });
      await databases.updateRow(item.databaseId, item.tableId, item.id, { isTrash: false });
      toast.success(`${item.type} restored!`, { id: `restore-${item.id}` });
      // Local-first: remove from local copy instantly
      const nextAll = itemsAll.filter(i => !(i.id===item.id && i.tableId===item.tableId));
      setItemsAll(nextAll);
      if (cacheKeyAll) await LocalEngine.cacheSet(cacheKeyAll, nextAll);
      // Background replenish
      void fetchAllTrash(true);
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
          // Use cascade where available, else direct
          try {
            const { executeCascadeDeleteSecure } = await import('@/lib/actions/cascade-delete');
            await (executeCascadeDeleteSecure as any)(item.databaseId, item.tableId, item.id).catch(async ()=> {
              await databases.deleteRow(item.databaseId, item.tableId, item.id);
            });
          } catch {
            await databases.deleteRow(item.databaseId, item.tableId, item.id);
          }
          toast.success('Deleted permanently!', { id: `del-${item.id}` });
          const nextAll = itemsAll.filter(i => !(i.id===item.id && i.tableId===item.tableId));
          setItemsAll(nextAll);
          if (cacheKeyAll) await LocalEngine.cacheSet(cacheKeyAll, nextAll);
        } catch (e: any) {
          toast.error(`Deletion failed: ${e.message}`, { id: `del-${item.id}` });
        }
      }
    });
  };

  const handleEmptyTrash = () => {
    const wsItems = items;
    if (wsItems.length === 0) return;
    openUnified('delete-confirm', {
      title: `Empty Trash for ${isCustomWorkspace ? activeWorkspace?.title : 'Personal'}?`,
      description: `This will permanently delete ${wsItems.length} trashed item(s) in this workspace. Irreversible.`,
      confirmLabel: 'Empty Trash',
      onConfirm: async () => {
        try {
          setPurging(true);
          toast.loading(`Emptying ${wsItems.length} items...`, { id: 'empty-trash' });
          // Parallel batch per cascade mechanic
          await Promise.all(wsItems.map(it => 
            (async () => {
              try {
                const { executeCascadeDeleteSecure } = await import('@/lib/actions/cascade-delete');
                await (executeCascadeDeleteSecure as any)(it.databaseId, it.tableId, it.id).catch(()=> databases.deleteRow(it.databaseId, it.tableId, it.id));
              } catch {
                await databases.deleteRow(it.databaseId, it.tableId, it.id).catch(()=>null);
              }
            })()
          ));
          toast.success('Trash emptied!', { id: 'empty-trash' });
          const remaining = itemsAll.filter(all => !wsItems.some(w=> w.id===all.id && w.tableId===all.tableId));
          setItemsAll(remaining);
          if (cacheKeyAll) await LocalEngine.cacheSet(cacheKeyAll, remaining);
        } catch {
          toast.error('Failed to empty trash.');
        } finally { setPurging(false); }
      }
    });
  };

  const openTrashDetail = useCallback((item: TrashItem) => {
    const Detail = (
      <div className="h-full flex flex-col bg-[#161412] overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center shrink-0">
              <Trash2 size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-white font-black text-base truncate font-clash">{item.title}</h2>
              <p className="text-white/40 text-xs font-bold">{item.type} • Deleted {new Date(item.deletedAt).toLocaleDateString()}</p>
            </div>
          </div>
          <button onClick={() => isDesktop ? closeSidebar() : closeOverlay()} className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 flex items-center justify-center">✕</button>
        </div>
        <div className="p-6 flex flex-col gap-4 flex-1 overflow-auto">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Workspace</p>
            <p className="text-sm font-bold text-white mt-1">{item.projectId ? item.projectId : isCustomWorkspace ? workspaceId : 'Personal'} {item.isWorkspace ? '• Workspace' : ''}</p>
          </div>
          <div className="flex gap-2 mt-auto">
            <button onClick={async () => { isDesktop ? closeSidebar() : closeOverlay(); await handleRestore(item); }} className="flex-1 h-10 rounded-xl bg-white text-black font-black text-xs hover:bg-white/90">Restore</button>
            <button onClick={async () => { isDesktop ? closeSidebar() : closeOverlay(); await handlePermanentDelete(item); }} className="flex-1 h-10 rounded-xl bg-[#EF4444] text-white font-black text-xs hover:bg-[#DC2626]">Delete forever</button>
          </div>
        </div>
      </div>
    );
    if (isDesktop) {
      openSidebar(Detail, `trash-${item.tableId}-${item.id}`, { hideHeader: true });
    } else {
      openOverlay(Detail);
    }
  }, [isDesktop, openSidebar, closeSidebar, openOverlay, closeOverlay, isCustomWorkspace, workspaceId]);

  const availableTypes = Array.from(new Set(items.map(i => i.type)));
  const tabs = ['All', 'Note', 'Goal', 'Event', 'Form', 'Credential', 'File', 'GitHub Repository', ...availableTypes.filter(t => !['Note','Goal','Event','Form','Credential','File','GitHub Repository'].includes(t))];
  const filteredItems = activeTab === 'All' ? items : items.filter(i => i.type === activeTab);
  const paginated = filteredItems.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filteredItems.length;

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const setSentinel = useCallback((node: HTMLDivElement | null) => { (sentinelRef as any).current = node; }, []);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    let ticking = false;
    const obs = new IntersectionObserver((entries) => {
      if (ticking) return;
      if (entries[0]?.isIntersecting) { ticking = true; setPage(p=>p+1); setTimeout(()=> ticking=false, 300); }
    }, { rootMargin: '400px', threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, filteredItems.length]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0908] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <SpinnerIcon className="animate-spin text-[#6366F1]" size={36} />
          <p className="text-white/40 text-sm font-semibold">Checking access — please sign in to continue</p>
        </div>
      </div>
    );
  }

  const wsLabel = isCustomWorkspace ? activeWorkspace?.title : 'Personal';

  return (
    <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-12 transition-all duration-300">
      {/* Header — fluid, right-rail aware */}
      <header className="flex flex-col gap-4 p-5 mb-6 bg-white/[0.01] border border-white/[0.06] rounded-[32px] shadow-2xl relative select-none overflow-hidden">
        <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#EF4444] to-transparent" />
        <div className={`flex gap-4 ${isRightRailPushing ? 'flex-col xl:flex-row xl:items-center xl:justify-between' : 'flex-col md:flex-row md:items-center md:justify-between'}`}>
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={() => router.back()} className="w-10 h-10 rounded-xl border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white/80 flex items-center justify-center transition-all cursor-pointer shrink-0">
              <ArrowLeft size={16} />
            </button>
            <div className="min-w-0">
              <h1 className="text-white font-black text-2xl tracking-tight leading-none font-mono flex items-center gap-2">
                <Trash2 size={24} className="text-[#EF4444] shrink-0" />
                <span>Trash</span>
                <span className="hidden sm:inline text-xs font-bold px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/50">{wsLabel}</span>
              </h1>
              <p className="text-white/40 text-xs font-semibold mt-1">
                Workspace: <span className="text-white/70">{wsLabel}</span> • {items.length} trashed • Auto-purge after 30 days • Local-first
              </p>
            </div>
          </div>
          <div className={`flex items-center gap-2 shrink-0 ${isRightRailPushing ? 'w-full xl:w-auto' : 'w-full md:w-auto'}`}>
            <button onClick={handleEmptyTrash} disabled={items.length===0 || purging} className="h-10 px-5 rounded-xl bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer flex-1 md:flex-none">
              <Trash size={14} />
              <span>Empty {isCustomWorkspace? 'Workspace ': ''}Trash</span>
            </button>
          </div>
        </div>
      </header>

      {/* Fluid canvas: vertical nav desktop + horizontal pills mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-8 items-start">
        <aside className="hidden lg:block sticky top-[96px] self-start">
          <nav className="flex flex-col gap-1.5 p-2 bg-[#161412] border border-white/5 rounded-2xl shadow-xl">
            {tabs.map(tab => {
              const count = tab==='All' ? items.length : items.filter(i=>i.type===tab).length;
              const isActive = activeTab===tab;
              return (
                <button key={tab} type="button" onClick={()=> setActiveTab(tab)} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left w-full cursor-pointer ${isActive ? 'bg-[#EF4444] text-white shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/[0.06] border border-transparent'}`}>
                  <span className="truncate">{tab}s</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${isActive ? 'bg-black/30 text-white' : 'bg-white/5 text-white/40'}`}>{count}</span>
                </button>
              );
            })}
          </nav>
          <div className="mt-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Workspace trash</p>
            <p className="text-xs text-white/50 leading-relaxed mt-1">Switch workspaces to see its trashed items. No extra DB reads — filtered locally.</p>
          </div>
        </aside>

        <div className="lg:hidden flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none snap-x snap-mandatory border-b border-white/5">
          {tabs.map(tab => {
            const count = tab==='All' ? items.length : items.filter(i=>i.type===tab).length;
            const isActive = activeTab===tab;
            return (
              <button key={tab} type="button" onClick={()=> setActiveTab(tab)} className={`h-9 px-4 rounded-xl text-xs font-mono font-bold flex items-center gap-2 shrink-0 snap-start cursor-pointer ${isActive ? 'bg-[#EF4444] text-white border border-[#EF4444] shadow-lg' : 'bg-white/[0.02] hover:bg-white/[0.05] text-white/60 border border-white/5'}`}>
                <span>{tab}s</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-black/30 text-white' : 'bg-white/5 text-white/40'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="min-w-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <SpinnerIcon className="animate-spin text-[#EF4444]" size={40} />
              <p className="text-white/40 text-sm font-semibold">Scanning trash via LocalEngine...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-6 border border-dashed border-white/10 rounded-[32px] bg-white/[0.01]">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 mb-4"><CheckCircle2 size={32} /></div>
              <h3 className="text-white font-black text-lg tracking-tight font-mono">{activeTab==='All' ? 'Trash is empty' : `No deleted ${activeTab}s`}</h3>
              <p className="text-white/30 text-xs font-semibold text-center mt-1 max-w-[320px]">No trashed items in <span className="text-white/50">{wsLabel}</span>. Switch workspace to see its trash.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              <div className={`grid gap-4 ${isRightRailPushing ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                {paginated.map(item => (
                  <div key={`${item.tableId}:${item.id}`} onClick={() => openTrashDetail(item)} className="p-5 bg-[#161412] border border-white/5 hover:border-white/10 rounded-[24px] flex flex-col justify-between gap-4 transition-all min-w-0 cursor-pointer hover:bg-[#1C1A18]">
                    <div className="min-w-0">
                      <h4 className="text-white font-black text-base truncate font-mono">{item.title}</h4>
                      <div className="flex items-center gap-1.5 mt-1 text-white/30 text-[10px] font-semibold">
                        <Clock size={11} />
                        <span>Deleted {new Date(item.deletedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-black uppercase tracking-wider">{item.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end" onClick={e => e.stopPropagation()}>
                      <button onClick={()=> handleRestore(item)} className="h-8 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-[11px] cursor-pointer">Restore</button>
                      <button onClick={()=> handlePermanentDelete(item)} className="h-8 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-[#EF4444] font-bold text-[11px] cursor-pointer">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && <div ref={setSentinel as any} className="h-8" />}
              <p className="text-center text-[11px] font-bold text-white/20">Showing {paginated.length} of {filteredItems.length} in {wsLabel} • Bloated-safe local pagination</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
