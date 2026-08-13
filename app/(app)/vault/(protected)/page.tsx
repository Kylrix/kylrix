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
import { VaultPorterDrawer } from '@/components/import/VaultPorterDrawer';
import { TOTPPageContent } from './totp/page';

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
  const { requestSudo } = useSudo();
  const router = useRouter();
  const { openOverlay, closeOverlay } = useOverlay();
  const isDesktop = useIsDesktop();
  const { setActiveDetail } = useSection();
  
  // Master password modal — only auto-open when unlock-on-demand is off
  const [showMasterPassDrawer, setShowMasterPassDrawer] = useState(false);
  // Vault porter drawer state
  const [isDevMode, setIsDevMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'secrets' | 'totp'>('secrets');

  useEffect(() => {
    (async () => {
      try {
        const { account } = await import('@/lib/appwrite/client');
        const prefs = await account.getPrefs();
        if ((prefs as any)?.developerMode) setIsDevMode(true);
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
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isMultiDeleting, _setIsMultiDeleting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleToggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds([]);
  };

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

  const loadAllCredentials = useCallback(async (background = false) => {
    const activeUserId = user?.$id || (typeof window !== 'undefined' ? (getCurrentUserSnapshot()?.$id || '') : '');
    if (!activeUserId) { setLoading(false); return; }
    if (!background && allCredentials.length === 0) setLoading(true);
    try {
      // Unified path via LocalEngine — UI never hits backend directly; LocalEngine delegates to unified service
      const { LocalEngine } = await import('@/lib/services/LocalEngine');
      const { VaultService } = await import('@/lib/appwrite/vault-service');
      const cacheKey = `vault_credentials_${activeUserId}`;
      // LocalEngine.query handles cache-first + background refresh + manual force
      const credentials = await LocalEngine.query<Credentials[]>(cacheKey, async () => {
        const rows = await VaultService.listAllCredentials(activeUserId);
        return rows as any;
      }, { ttl: background ? 0 : undefined });
      const list = Array.isArray(credentials) ? credentials : (credentials as any)?.rows || [];
      console.log(`[Vault] Fetched ${list?.length ?? 0} credentials via LocalEngine+VaultService.`);
      if (Array.isArray(list) && list.length) {
        setAllCredentials(list as any);
      } else if (!background && allCredentials.length === 0) {
        // Don't wipe populated live copy with empty network — keep previous, like NotesContext merge
        // Only set empty if we truly have no local data
        setAllCredentials([]);
      } else if (Array.isArray(list) && !list.length && allCredentials.length) {
        // Keep existing live rows (encrypted-only RxDB cache stays, like notes)
        console.warn("[Vault] network empty but live copy populated — keeping live");
      }
    } catch (error: unknown) {
      console.error("[Vault] Failed to load via LocalEngine:", error);
      if (allCredentials.length === 0) toast.error(`Vault load error: ${error instanceof Error ? error.message : String(error)}`);
    } finally { setLoading(false); }
  }, [user, allCredentials.length]);

  const hydrateVaultData = useCallback(async () => {
    await loadAllCredentials();
  }, [loadAllCredentials]);

  useEffect(() => {
    void hydrateVaultData();
  }, [hydrateVaultData]);

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

  const sortedCredentials = useMemo(() => {
    return [...allCredentials].sort((a, b) => {
      const aPinned = isResourcePinned('credential', a.$id, a.userId, a.isPinned);
      const bPinned = isResourcePinned('credential', b.$id, b.userId, b.isPinned);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
    });
  }, [allCredentials, isResourcePinned]);

  const vaultGridClass =
    'grid gap-4 items-stretch [grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] xl:[grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]';

  const refreshCredentials = () => {
    if (!user?.$id) return;
    void loadAllCredentials();
  };

  const handleManualRefresh = useCallback(async () => {
    if (isRefreshing) return;
    if (user?.$id && !isVaultUnlocked()) {
      requireUnlock(() => {
        void (async () => {
          setIsRefreshing(true);
          try {
            await loadAllCredentials(true);
          } catch (error: unknown) {
            console.error('Manual secrets refresh failed:', error);
            toast.error('Could not refresh secrets. Try again.');
          } finally {
            setTimeout(() => setIsRefreshing(false), 600);
          }
        })();
      });
      return;
    }
    setIsRefreshing(true);
    try {
      await loadAllCredentials(true);
    } catch (error: unknown) {
      console.error('Manual secrets refresh failed:', error);
      toast.error('Could not refresh secrets. Try again.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [isRefreshing, user?.$id, isVaultUnlocked, loadAllCredentials, requireUnlock]);

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
                {isDevMode && (
                  <button
                    onClick={() => router.push('/vault/test')}
                    className="px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30"
                  >
                    Test (Raw)
                  </button>
                )}
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
                      {isSelectMode && selectedIds.length > 0 && (
                        <button
                          onClick={() => requestSudo({ onSuccess: () => handleDelete() })}
                          disabled={isMultiDeleting}
                          className="px-3 py-2 bg-[#FF453A]/10 text-[#FF453A] text-xs font-bold rounded-xl hover:bg-[#FF453A]/20 transition-colors"
                        >
                          {isMultiDeleting ? "Deleting..." : `Delete (${selectedIds.length})`}
                        </button>
                      )}
                      
                      <button
                        onClick={handleToggleSelectMode}
                        className={`px-3 py-2 border text-xs font-bold rounded-xl transition-colors ${
                          isSelectMode ? 'border-[#10B981] bg-[#10B981]/10 text-[#10B981]' : 'border-[#1C1A18] text-white/60 hover:text-white hover:bg-[#1C1A18]'
                        }`}
                      >
                        {isSelectMode ? 'Cancel' : 'Select'}
                      </button>

                      <button
                        onClick={() => void handleManualRefresh()}
                        disabled={isRefreshing}
                        className="p-2 border border-[#1C1A18] rounded-xl text-white/60 bg-[#161412] hover:text-white hover:bg-[#1C1A18] transition-colors disabled:opacity-40"
                        title="Refresh secrets list"
                        aria-label="Refresh secrets list"
                      >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#10B981]' : ''} />
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
                    ) : sortedCredentials.length === 0 ? (
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
                        {sortedCredentials.map((cred: Credentials) => (
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
