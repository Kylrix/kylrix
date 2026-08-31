"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import type { Credentials } from '@/lib/appwrite/types';
import { useAppwriteVault } from '@/context/appwrite-context';
import { getCurrentUserSnapshot } from '@/lib/appwrite/client';
import {
  deleteCredential} from '@/lib/appwrite';
import { useResourcePins } from '@/context/ResourcePinContext';
import toast from 'react-hot-toast';
import CredentialItem from '@/components/app/dashboard/CredentialItem';
import CredentialDetail from '@/components/app/dashboard/CredentialDetail';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import SudoModal from '@/components/overlays/SudoModal';
import { useSudo } from '@/context/SudoContext';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';
import { useOverlay } from '@/components/ui/OverlayContext';
import { ArrowLeft, Plus, Eye, EyeOff, ArrowUpDown, RefreshCw, Lock } from 'lucide-react';
import { useFAB } from '@/context/FABContext';
import { VaultPorterDrawer } from '@/components/import/VaultPorterDrawer';
import { TOTPPageContent } from './totp/page';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useWorkspaceFilteredItems } from '@/hooks/useWorkspaceFilteredItems';
import { HangoutTabTrigger } from '@/components/hangout/HangoutTabTrigger';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  return isDesktop;
}

function DashboardPageContent() {
  const { user, isVaultUnlocked, isVaultBlurEnabled, setVaultBlurEnabled } = useAppwriteVault();
  const { isPinned: isResourcePinned, togglePin, setLocalPin } = useResourcePins();
  const { activeWorkspace } = useWorkspace();
  const { requestSudo } = useSudo();
  const router = useRouter();
  const { openOverlay, closeOverlay } = useOverlay();
  const isDesktop = useIsDesktop();
  const { setActiveDetail } = useSection();
  const { setConfiguration, resetConfiguration } = useFAB();
  
  // Master password modal — only auto-open when unlock-on-demand is off
  const [showMasterPassDrawer, setShowMasterPassDrawer] = useState(false);
  const [showPorterDrawer, setShowPorterDrawer] = useState(false);
  const [_isDevMode, _setIsDevMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'secrets' | 'totp'>('secrets');

  useEffect(() => {
    (async () => {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const prefs = await account.getPrefs();
        if ((prefs as any)?.developerMode) _setIsDevMode(true);
      } catch {}
    })();
  }, []);
  
  // State for all credentials, fetched once
  const [allCredentials, setAllCredentials] = useState<Credentials[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<string>("login");
  const [editCredential, setEditCredential] = useState<Credentials | null>(null);
  const [dialogPrefill, setDialogPrefill] = useState<{ name?: string; url?: string } | undefined>(undefined);
  const [, setSelectedCredential] = useState<Credentials | null>(null);

  // Delete confirmation state
  const [credentialToDelete, setCredentialToDelete] = useState<Credentials | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Multi-select state
  const [isSelectMode, _setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };


  // Handlers
  const handleAdd = useCallback(() => {
    if (!isVaultUnlocked()) {
      requestSudo({
        onSuccess: () => {
          setEditCredential(null);
          setDialogType("login");
          setShowDialog(true);
        },
      });
      return;
    }
    setEditCredential(null);
    setDialogType("login");
    setShowDialog(true);
  }, [isVaultUnlocked, requestSudo]);

  useEffect(() => {
    if (activeTab === 'secrets') {
      setConfiguration({
        isVisible: true,
        mainColor: '#10B981',
        mainIcon: <Plus size={26} strokeWidth={2.5} />,
        onMainClick: handleAdd,
        actions: [
          { id: 'add-secret', label: 'ADD SECRET', icon: <Plus size={20} />, onClick: handleAdd }
        ]
      });
      return () => resetConfiguration();
    }
  }, [activeTab, handleAdd, setConfiguration, resetConfiguration]);

  const requireUnlock = useCallback(
    (onSuccess: () => void) => {
      if (isVaultUnlocked()) {
        onSuccess();
        return;
      }
      requestSudo({ onSuccess });
    },
    [isVaultUnlocked, requestSudo]
  );

  const openCredential = useCallback(
    (cred: Credentials) => {
      const open = () => {
        setSelectedCredential(cred);
        if (isDesktop) {
          setActiveDetail({ type: 'secret', id: cred.$id, data: cred });
        } else {
          openOverlay(
            <CredentialDetail
              credential={cred}
              onClose={() => closeOverlay()}
              isMobile
            />
          );
        }
      };
      requireUnlock(open);
    },
    [isDesktop, setActiveDetail, openOverlay, closeOverlay, requireUnlock],
  );

  const handleEdit = (cred: Credentials) => {
    requireUnlock(() => {
      setEditCredential(cred);
      setShowDialog(true);
    });
  };

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadAllCredentials = useCallback(async (background = false, cursorToUse: string | null = null) => {
    const activeUserId = user?.$id || (typeof window !== 'undefined' ? (getCurrentUserSnapshot()?.$id || '') : '');
    if (!activeUserId) { setLoading(false); return; }
    if (!background && !cursorToUse) setLoading(true);
    if (cursorToUse) setLoadingMore(true);

    const cacheKey = `vault_credentials_${activeUserId}`;

    // Instant local copy read on mount
    if (!cursorToUse) {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const cachedRows = await LocalEngine.cacheGet<any[]>(cacheKey);
        if (cachedRows && Array.isArray(cachedRows) && cachedRows.length > 0) {
          setAllCredentials(cachedRows);
          setLoading(false);
        }
      } catch {}
    }

    try {
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');

      if (!cursorToUse) {
        const rows = await LocalEngine.query<Credentials[]>(
          cacheKey,
          async () => {
            const { TablesDB, Client, Query } = await import('appwrite');
            const client = new Client()
              .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
              .setProject(APPWRITE_CONFIG.PROJECT_ID);
            const tablesDB = new TablesDB(client);
            const res = await tablesDB.listRows(
              APPWRITE_CONFIG.DATABASES.VAULT,
              APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
              [
                Query.equal('userId', activeUserId),
                Query.limit(50),
                Query.orderDesc('$updatedAt')
              ]
            );
            return (Array.isArray(res?.rows) ? res.rows : []) as unknown as Credentials[];
          },
          {
            ttl: 1000 * 60 * 5,
            realtimeChannel: `databases.${APPWRITE_CONFIG.DATABASES.VAULT}.collections.${APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS}.documents`
          }
        );

        setAllCredentials(rows);
        setHasMore(rows.length === 50);
        setNextCursor(rows.length === 50 && rows.length ? (rows[rows.length - 1] as any).$id : null);
      } else {
        const { TablesDB, Client, Query } = await import('appwrite');
        const client = new Client()
          .setEndpoint(APPWRITE_CONFIG.ENDPOINT)
          .setProject(APPWRITE_CONFIG.PROJECT_ID);
        const tablesDB = new TablesDB(client);
        const res = await tablesDB.listRows(
          APPWRITE_CONFIG.DATABASES.VAULT,
          APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
          [
            Query.equal('userId', activeUserId),
            Query.limit(50),
            Query.orderDesc('$updatedAt'),
            Query.cursorAfter(cursorToUse)
          ]
        );
        const rows = Array.isArray(res?.rows) ? res.rows : [];
        const batchHasMore = rows.length === 50;
        const newCursor = batchHasMore && rows.length ? rows[rows.length - 1].$id : null;
        setHasMore(batchHasMore);
        setNextCursor(newCursor);

        setAllCredentials((prev) => {
          const existingIds = new Set(prev.map((c) => c.$id));
          const freshUnique = (rows as unknown as Credentials[]).filter((r: any) => !existingIds.has(r.$id));
          const updated = [...prev, ...freshUnique] as Credentials[];
          void LocalEngine.cacheSet(cacheKey, updated);
          return updated;
        });
      }
    } catch (error: unknown) {
      console.error("[Vault] Failed to load credentials:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user?.$id]);

  const loadMoreCredentials = useCallback(() => {
    if (loadingMore || !hasMore || !nextCursor) return;
    void loadAllCredentials(true, nextCursor);
  }, [loadingMore, hasMore, nextCursor, loadAllCredentials]);

  const hydrateVaultData = useCallback(async () => {
    await loadAllCredentials();
  }, [loadAllCredentials]);

  useEffect(() => {
    void hydrateVaultData();
  }, [hydrateVaultData]);

  // Realtime live updates for credentials
  useEffect(() => {
    const activeUserId = user?.$id || (typeof window !== 'undefined' ? (getCurrentUserSnapshot()?.$id || '') : '');
    if (!activeUserId) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { LocalEngine } = await import('@/lib/services/LocalEngine');
        const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
        const credsChannel = `databases.${APPWRITE_CONFIG.DATABASES.VAULT}.tables.${APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS}.rows`;

        const cleanup = await LocalEngine.subscribeRealtime(credsChannel, (payload: any) => {
          if (!payload || !payload.$id || cancelled) return;
          const isOwn = !payload.userId || payload.userId === activeUserId;
          const isWorkspaceItem =
            Boolean(activeWorkspace) ||
            payload.isWorkspace === true ||
            Boolean(payload.projectId) ||
            (Array.isArray(payload.tags) && payload.tags.some((t: string) => t.startsWith('workspace:') || t.startsWith('project:')));

          if (!isOwn && !isWorkspaceItem) return;

          const isDeleted = payload.isDeleted === true || payload.isTrash === true;
          if (isDeleted) {
            setAllCredentials(prev => prev.filter(c => c.$id !== payload.$id));
            return;
          }

          setAllCredentials(prev => {
            const idx = prev.findIndex(c => c.$id === payload.$id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], ...payload };
              return updated;
            }
            return [payload, ...prev];
          });
        });
        if (cancelled) cleanup();
        else unsub = cleanup;
      } catch {}
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [user?.$id]);

  const openDeleteModal = (cred: Credentials) => {
    requireUnlock(() => {
      setCredentialToDelete(cred);
      setIsDeleteModalOpen(true);
    });
  };

  const handleDelete = async () => {
    if (!user?.$id || !credentialToDelete) return;

    try {
      await deleteCredential(credentialToDelete.$id);
      setAllCredentials((prev) =>
        prev.filter((c) => c.$id !== credentialToDelete.$id));
      toast.success("Secret deleted successfully.");
    } catch (error: unknown) {
      toast.error("Failed to delete secret. Please try again.");
      console.error("Failed to delete credential:", error);
    } finally {
      setIsDeleteModalOpen(false);
      setCredentialToDelete(null);
    }
  };

  const handleTogglePin = async (id: string) => {
    const credential = allCredentials.find((c) => c.$id === id);
    if (!credential || !user?.$id) return;
    const ownerId = credential.userId || user.$id;
    const currentlyPinned = isResourcePinned('credential', id, ownerId, credential.isPinned);
    const isOwner = user.$id === ownerId;

    try {
      const nextPinned = await togglePin({
        resourceType: 'credential',
        resourceId: id,
        ownerId,
        rowIsPinned: credential.isPinned,
        setOwnerRowPin: async (pinned) => {
          const { setCredentialPinned } = await import('@/lib/appwrite');
          await setCredentialPinned(id, pinned);
        }});
      if (isOwner) {
        setAllCredentials((prev) => prev.map((c) => (c.$id === id ? { ...c, isPinned: nextPinned } : c)));
      }
      toast.success(nextPinned ? 'Pinned to top' : 'Unpinned');
    } catch (_error: unknown) {
      if (!isOwner) {
        setLocalPin('credential', id, currentlyPinned);
      }
      toast.error('Failed to toggle pin');
    }
  };

  const handleMasterPassSuccess = useCallback(() => {
    setShowMasterPassDrawer(false);
    void hydrateVaultData();
  }, [hydrateVaultData]);

  // Eagerly pull custom workspace credentials into local state when switching workspaces
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.isPersonal) return;
    const wsId = activeWorkspace.id;
    let cancelled = false;

    void (async () => {
      try {
        const { ProjectsService } = await import('@/lib/appwrite/projects');
        const tagged = await ProjectsService.listTaggedResources(wsId).catch(() => null);
        if (tagged?.credentials && Array.isArray(tagged.credentials) && tagged.credentials.length > 0 && !cancelled) {
          setAllCredentials((prev) => {
            const byId = new Map(prev.map((c) => [c.$id, c]));
            tagged.credentials.forEach((c: any) => {
              const id = c.$id || c.id;
              if (id) byId.set(id, { ...byId.get(id), ...c, $id: id, projectId: wsId, isWorkspace: true });
            });
            return Array.from(byId.values());
          });
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?.id]);

  const sortedCredentials = useMemo(() => {
    return [...allCredentials].sort((a, b) => {
      const aPinned = isResourcePinned('credential', a.$id, a.userId, a.isPinned);
      const bPinned = isResourcePinned('credential', b.$id, b.userId, b.isPinned);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      const timeA = new Date((a as any).$updatedAt || (a as any).updatedAt || (a as any).$createdAt || (a as any).createdAt || 0).getTime();
      const timeB = new Date((b as any).$updatedAt || (b as any).updatedAt || (b as any).$createdAt || (b as any).createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [allCredentials, isResourcePinned]);

  const { filteredItems: workspaceScopedCredentials } = useWorkspaceFilteredItems(sortedCredentials, 'credential');

  const vaultGridClass =
    'grid gap-4 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]';

  const refreshCredentials = () => {
    if (!user?.$id) return;
    void loadAllCredentials();
  };

  const handleCopy = (value: string) => {
    if (!isVaultUnlocked()) {
      requireUnlock(() => {
        void hydrateVaultData().then(() => {
          toast.success('Unlocked — tap copy again');
        });
      });
      return;
    }
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard!");
  };

  const { isAuthReady } = useAppwriteVault();

  if (!isAuthReady || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-10 bg-[#0A0908] pt-4 md:pt-8 relative">
      <div 
        className="flex-1 flex flex-col transition-opacity duration-300"
        style={{
          pointerEvents: showMasterPassDrawer ? 'none' : 'auto',
          opacity: showMasterPassDrawer ? 0.3 : 1
        }}
      >
        <MultiSectionContainer panels={['note', 'totp', 'projects']}>
          <div>
            {/* Tab Switcher */}
            <div className="px-4 md:px-12 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
                <button
                  onClick={() => setActiveTab('secrets')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'secrets'
                      ? 'bg-[#10B981] text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Secrets
                </button>
                <button
                  onClick={() => setActiveTab('totp')}
                  className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all ${
                    activeTab === 'totp'
                      ? 'bg-[#10B981] text-white shadow-[0_4px_12px_rgba(16,185,129,0.25)]'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`}
                >
                  TOTP
                </button>
              </div>

              <div className="flex items-center gap-2">
                <HangoutTabTrigger />
              </div>
            </div>

            {activeTab === 'secrets' ? (
              <div>
                {/* Header Section */}
                <div className="px-4 md:px-12">
                  <div className="flex items-center gap-3.5 mb-8">
                    <button 
                      onClick={() => router.back()} 
                      className="p-2 text-white bg-[#161412] border border-[#1C1A18] rounded-xl hover:bg-[#1C1A18] transition-colors"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-2xl font-black font-clash text-white">
                      Secrets
                    </h1>
                    
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={handleAdd}
                        className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-black font-black rounded-xl transition-colors text-xs shadow-[0_4px_12px_rgba(16,185,129,0.25)]"
                      >
                        <Plus size={16} />
                        Add Secret
                      </button>

                      <button
                        onClick={() => setVaultBlurEnabled(!isVaultBlurEnabled)}
                        className={`p-2 border border-[#1C1A18] rounded-xl transition-colors ${
                          isVaultBlurEnabled ? 'text-white/40 bg-[#161412]' : 'text-[#10B981] bg-[#161412]'
                        } hover:bg-[#1C1A18]`}
                        title="Toggle secret blur visibility"
                      >
                        {isVaultBlurEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>

                      <button
                        onClick={() => setShowPorterDrawer(true)}
                        className="p-2 border border-[#1C1A18] rounded-xl text-white/60 bg-[#161412] hover:text-white hover:bg-[#1C1A18] transition-colors"
                        title="Import/Export Vault Data"
                      >
                        <ArrowUpDown size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Credentials — goals-style desktop grid + pinned section (UI-only) */}
                  <div className="flex flex-col gap-8 w-full max-w-none">
                    {loading ? (
                      <div className={vaultGridClass}>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <CredentialItem key={`skeleton-${i}`} credential={{ $id: `skeleton-${i}`, name: 'Loading...', username: '', type: 'password' } as any} onCopy={() => {}} onEdit={() => {}} onDelete={() => {}} />
                        ))}
                      </div>
                    ) : workspaceScopedCredentials.length === 0 ? (
                      <div className="p-16 text-center rounded-[32px] bg-[#161412] border border-dashed border-[#1C1A18] flex flex-col items-center justify-center">
                        <Lock className="h-12 w-12 text-white/10 mb-4" />
                        <h2 className="text-xl font-black text-white mb-2 font-clash">
                          No Secrets Found
                        </h2>
                        <p className="text-[#9B9691] max-w-xs mx-auto mb-6 text-sm">
                          Your secure vault is empty. Store passwords, logins, or cards safely.
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={handleAdd}
                            className="inline-flex items-center gap-2 px-6 h-12 bg-[#10B981] hover:bg-[#059669] text-black font-black rounded-2xl transition-colors"
                          >
                            <Plus size={18} />
                            Add Secret
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const { VaultService } = await import('@/lib/appwrite/vault-service');
                                VaultService.clearVaultCaches();
                                const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
                                const db = await getRxDB().catch(() => null);
                                if (db && user?.$id) {
                                  await db.cache.findOne(`vault_credentials_${user.$id}`).remove().catch(() => {});
                                }
                              } catch {}
                              void loadAllCredentials();
                            }}
                            className="inline-flex items-center gap-2 px-4 h-12 bg-[#161412] hover:bg-[#1C1A18] text-white/70 hover:text-white border border-[#1C1A18] font-bold rounded-2xl text-xs transition-colors"
                          >
                            <RefreshCw size={15} />
                            Sync Remote
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                      <div className={vaultGridClass}>
                        {workspaceScopedCredentials.map((cred: Credentials) => (
                          <CredentialItem
                            key={cred.$id}
                            credential={cred}
                            onCopy={handleCopy}
                            onEdit={() => handleEdit(cred)}
                            onDelete={() => openDeleteModal(cred)}
                            onTogglePin={() => handleTogglePin(cred.$id)}
                            isBlurEnabled={isVaultBlurEnabled}
                            isSelectMode={isSelectMode}
                            isSelected={selectedIds.includes(cred.$id)}
                            onToggleSelect={() => toggleSelection(cred.$id)}
                            onShared={(id) => {
                              setAllCredentials(prev =>
                                prev.map(c => c.$id === id ? { ...c, isPublic: true, isGuest: true } : c)
                              );
                            }}
                            onClick={() => openCredential(cred)}
                          />
                        ))}
                      </div>
                      {hasMore && (
                        <div className="flex justify-center mt-8">
                          <button
                            onClick={loadMoreCredentials}
                            disabled={loadingMore}
                            className="px-6 py-2.5 rounded-xl bg-[#161412] hover:bg-[#1C1A18] border border-[#1C1A18] text-xs font-bold text-white/80 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                          >
                            {loadingMore ? (
                              <>
                                <RefreshCw size={14} className="animate-spin text-emerald-500" />
                                Loading older secrets...
                              </>
                            ) : (
                              'Load More Secrets'
                            )}
                          </button>
                        </div>
                      )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <TOTPPageContent isTabMode={true} />
            )}
          </div>
        </MultiSectionContainer>
      </div>

      {showDialog && (
        <CredentialDialog
          open={showDialog}
          onClose={() => {
            setShowDialog(false);
            setDialogPrefill(undefined);
          }}
          initial={editCredential}
          prefill={dialogPrefill}
          defaultType={dialogType}
          onSaved={async (saved: any) => {
            // Optimistic live-engine first — instant paint like notes/goals
            if (saved && (saved as any).$id) {
              setAllCredentials(prev => {
                const exists = prev.find(c => c.$id === (saved as any).$id);
                if (exists) return prev.map(c => c.$id === (saved as any).$id ? saved as any : c);
                return [saved as any, ...prev];
              });
              // also warm LocalEngine cache via unified path
              try { const { LocalEngine } = await import('@/lib/services/LocalEngine'); await LocalEngine.cacheSet(`vault_credentials_${user?.$id}`, [saved as any, ...allCredentials] as any); } catch {}
            }
            await refreshCredentials();
          }}
        />
      )}

      {/* Custom Tailwind Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="w-full max-w-md p-6 rounded-[32px] bg-[#161412] border border-[#1C1A18] shadow-[0_40px_80px_rgba(0,0,0,0.6)] animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black font-clash text-[#FF453A] mb-4">
              Delete Secret
            </h3>
            <div className="mb-6">
              <p className="text-[#9B9691] font-medium leading-relaxed">
                Deleting <strong>{credentialToDelete?.name}</strong> will permanently remove this secret from your vault. This action is irreversible.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => requestSudo({ onSuccess: () => handleDelete() })}
                className="w-full py-3.5 px-6 font-black rounded-2xl bg-[#FF453A] text-black hover:bg-[#FF453A]/90 transition-colors"
              >
                Confirm Deletion
              </button>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-3 px-6 font-semibold rounded-2xl text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMasterPassDrawer && (
        <SudoModal
          isOpen={showMasterPassDrawer}
          app="vault"
          onSuccess={handleMasterPassSuccess}
          onCancel={() => { }}
        />
      )}

      <VaultPorterDrawer
        isOpen={showPorterDrawer}
        onClose={() => setShowPorterDrawer(false)}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
