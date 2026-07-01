"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Credentials } from '@/lib/appwrite/types';
import { useAppwriteVault } from '@/context/appwrite-context';
import {
  deleteCredential,
  listAllCredentials,
} from '@/lib/appwrite';
import { useResourcePins } from '@/context/ResourcePinContext';
import toast from 'react-hot-toast';
import CredentialItem from '@/components/app/dashboard/CredentialItem';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import SudoModal from '@/components/overlays/SudoModal';
import { useAI } from '@/context/AIContext';
import { useSudo } from '@/context/SudoContext';
import { useFAB } from '@/context/FABContext';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';
import { ArrowLeft, Plus, Eye, EyeOff, ArrowUpDown } from 'lucide-react';
import { Box, Typography, Paper, Button, IconButton, Avatar, CircularProgress, Tooltip, alpha } from '@/lib/openbricks/primitives';
import { VaultPorterDrawer } from '@/components/import/VaultPorterDrawer';
import { TOTPPageContent } from './totp/page';

function DashboardPageContent() {
  const { user, needsMasterPassword, isVaultUnlocked, isVaultBlurEnabled, setVaultBlurEnabled } = useAppwriteVault();
  const { isPinned: isResourcePinned, togglePin, setLocalPin } = useResourcePins();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { registerCreateModal } = useAI();
  const { requestSudo } = useSudo();
  const { setConfiguration, resetConfiguration } = useFAB();
  const { setActiveDetail } = useSection();
  
  // Master password modal state
  const [showMasterPassDrawer, setShowMasterPassDrawer] = useState(needsMasterPassword || !isVaultUnlocked());
  // Vault porter drawer state
  const [showPorterDrawer, setShowPorterDrawer] = useState(false);
  const [activeTab, setActiveTab] = useState<'secrets' | 'totp'>('secrets');
  
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
  const [isMultiDeleting, setIsMultiDeleting] = useState(false);

  const handleToggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleMultiDelete = async () => {
    if (!user?.$id || selectedIds.length === 0) return;
    setIsMultiDeleting(true);
    try {
      await Promise.all(selectedIds.map(id => deleteCredential(id)));
      setAllCredentials(prev => prev.filter(c => !selectedIds.includes(c.$id)));
      toast.success(`${selectedIds.length} secret(s) deleted successfully.`);
      setIsSelectMode(false);
      setSelectedIds([]);
    } catch (error: unknown) {
      toast.error("Failed to delete some secrets.");
      console.error("Multi-delete error:", error);
    } finally {
      setIsMultiDeleting(false);
    }
  };

  // Handlers
  const handleAdd = useCallback(() => {
    setEditCredential(null);
    setDialogType("login");
    setShowDialog(true);
  }, []);

  const loadAllCredentials = useCallback(async () => {
    setLoading(true);
    try {
      if (!user?.$id) {
        // Load ghost credentials from localStorage
        const historyRaw = typeof window !== 'undefined' ? localStorage.getItem('kylrix_ghost_notes_v2') : null;
        const ghostCreds: Credentials[] = [];
        if (historyRaw) {
          try {
            const history = JSON.parse(historyRaw);
            if (Array.isArray(history)) {
              const { decryptGhostData } = await import('@/lib/encryption/ghost-crypto');
              for (const item of history) {
                const meta = (() => {
                  try { return JSON.parse(item.metadata || '{}'); } catch { return {}; }
                })();
                if (meta?.send_object?.kind === 'password' || meta?.send_object?.kind === 'totp') {
                  const decryptedContent = (item.content && item.decryptionKey)
                    ? await decryptGhostData(item.content, item.decryptionKey)
                    : (item.content || '');
                  const payload = (() => {
                    try { return JSON.parse(decryptedContent); } catch { return null; }
                  })();
                  if (payload) {
                    ghostCreds.push({
                      $id: item.id,
                      $createdAt: item.createdAt,
                      $updatedAt: item.createdAt,
                      userId: 'ghost',
                      itemType: meta.send_object.kind === 'password' ? 'login' : 'totp',
                      name: item.title,
                      url: null,
                      notes: null,
                      totpId: meta.send_object.kind === 'password' ? payload.totpSecret : payload.secret,
                      username: meta.send_object.kind === 'password' ? payload.username : null,
                      password: meta.send_object.kind === 'password' ? payload.password : null,
                      cardNumber: null,
                      cardholderName: null,
                      cardExpiry: null,
                      cardCVV: null,
                      cardPIN: null,
                      cardType: null,
                      folderId: null,
                      tags: [],
                      customFields: null,
                      faviconUrl: null,
                      isFavorite: false,
                      isDeleted: false,
                      deletedAt: null,
                      lastAccessedAt: null,
                      passwordChangedAt: null,
                      createdAt: item.createdAt,
                      updatedAt: item.createdAt,
                      attachments: null,
                      isPinned: false,
                      isPublic: false,
                      isGuest: false,
                    } as any);
                  }
                }
              }
            }
          } catch (e) {
            console.error(e);
          }
        }
        setAllCredentials(ghostCreds);
        return;
      }
      const credentials = await listAllCredentials(user.$id);
      setAllCredentials(credentials);
    } catch (error: unknown) {
      toast.error("Failed to load secrets. Please try again.");
      console.error("Failed to load credentials:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const hydrateVaultData = useCallback(async () => {
    if (!user?.$id) {
      await loadAllCredentials();
      return;
    }
    if (!isVaultUnlocked()) return;
    await loadAllCredentials();
  }, [user, isVaultUnlocked, loadAllCredentials]);

  useEffect(() => {
    if (user?.$id) return;
    const handleStorage = () => {
      void loadAllCredentials();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [user?.$id, loadAllCredentials]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      console.log('[Vault] Network connection restored. Hydrating vault data...');
      void hydrateVaultData();
    };

    const handleGhostClaimed = () => {
      console.log('[Vault] Ghost items claimed. Hydrating vault data...');
      void hydrateVaultData();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('kylrix:ghost-claimed', handleGhostClaimed);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('kylrix:ghost-claimed', handleGhostClaimed);
    };
  }, [hydrateVaultData]);

  // Effects
  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#10B981',
      mainIcon: <Plus size={32} strokeWidth={3} />,
      onMainClick: () => handleAdd(),
      actions: [
        { id: 'add', label: 'ADD SECRET', icon: <Plus size={20} />, onClick: () => handleAdd() }]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, handleAdd]);

  useEffect(() => {
    const action = searchParams?.get('action');
    if (action && ['add-login', 'add-card'].includes(action)) {
      setEditCredential(null);
      setDialogType(action.split('-')[1]);
      setShowDialog(true);
      
      const params = new URLSearchParams(searchParams.toString());
      params.delete('action');
      const newPath = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      router.replace(newPath);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (needsMasterPassword || !isVaultUnlocked()) {
      setShowMasterPassDrawer(true);
    } else {
      setShowMasterPassDrawer(false);
    }
  }, [needsMasterPassword, isVaultUnlocked]);

  useEffect(() => {
    registerCreateModal((prefill) => {
      setEditCredential(null);
      setDialogType("login");
      setDialogPrefill(prefill);
      setShowDialog(true);
    });
  }, [registerCreateModal]);

  useEffect(() => {
    if (user?.$id && isVaultUnlocked()) {
      void hydrateVaultData();
    }
  }, [user, isVaultUnlocked, hydrateVaultData]);

  const handleEdit = (cred: Credentials) => {
    setEditCredential(cred);
    setShowDialog(true);
  };

  const openDeleteModal = (cred: Credentials) => {
    setCredentialToDelete(cred);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!user?.$id || !credentialToDelete) return;

    try {
      await deleteCredential(credentialToDelete.$id);
      setAllCredentials((prev) =>
        prev.filter((c) => c.$id !== credentialToDelete.$id),
      );
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
          const { databases } = await import('@/lib/appwrite/client');
          const { APPWRITE_CONFIG } = await import('@/lib/appwrite/config');
          await databases.updateRow(
            APPWRITE_CONFIG.DATABASES.VAULT,
            APPWRITE_CONFIG.TABLES.VAULT.CREDENTIALS,
            id,
            { isPinned: pinned },
          );
        },
      });
      if (isOwner) {
        setAllCredentials((prev) => prev.map((c) => (c.$id === id ? { ...c, isPinned: nextPinned } : c)));
      }
      toast.success(nextPinned ? 'Pinned to top' : 'Unpinned');
    } catch (error: unknown) {
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

  const refreshCredentials = () => {
    if (!user?.$id) return;
    loadAllCredentials();
  };

  const handleCopy = (value: string) => {
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
        className="flex-1 flex flex-col transition-[filter,opacity] duration-300"
        style={{
          filter: showMasterPassDrawer ? 'blur(8px)' : 'none',
          pointerEvents: showMasterPassDrawer ? 'none' : 'auto',
          opacity: showMasterPassDrawer ? 0.3 : 1,
        }}
      >
        <MultiSectionContainer panels={['note', 'totp', 'projects']}>
          <div>
            {/* Tab Switcher */}
            <div className="px-4 md:px-12 mb-6">
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

                  {/* Credentials List */}
                  <div className="flex flex-col gap-3.5 max-w-3xl">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <CredentialItem key={`skeleton-${i}`} credential={{ $id: `skeleton-${i}`, name: 'Loading...', username: '', type: 'password' } as any} onCopy={() => {}} onEdit={() => {}} onDelete={() => {}} />
                      ))
                    ) : allCredentials.length === 0 ? (
                      <div className="p-24 text-center rounded-[32px] bg-[#161412] border border-dashed border-[#1C1A18]">
                        <h2 className="text-xl font-black text-white mb-2 font-clash">
                          No Secrets Found
                        </h2>
                        <p className="text-[#9B9691] max-w-xs mx-auto">
                          Your secure vault is ready for its first secret.
                        </p>
                      </div>
                    ) : (
                      sortedCredentials.map((cred: Credentials) => (
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
                          onClick={() => {
                            setSelectedCredential(cred);
                            setActiveDetail({ type: 'secret', id: cred.$id, data: cred });
                          }}
                        />
                      ))
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
          onSaved={refreshCredentials}
        />
      )}

      {/* Custom Tailwind Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
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
