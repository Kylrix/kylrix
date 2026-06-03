"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Credentials } from '@/lib/appwrite/types';
import { useAppwriteVault } from '@/context/appwrite-context';
import {
  deleteCredential,
  listAllCredentials,
  toggleCredentialPin,
} from '@/lib/appwrite';
import toast from 'react-hot-toast';
import CredentialItem from '@/components/app/dashboard/CredentialItem';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import SudoModal from '@/components/overlays/SudoModal';
import { useAI } from '@/context/AIContext';
import { useSudo } from '@/context/SudoContext';
import { useFAB } from '@/context/FABContext';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';
import { ArrowLeft, Plus, Eye, EyeOff } from 'lucide-react';

function DashboardPageContent() {
  const { user, needsMasterPassword, isVaultUnlocked } = useAppwriteVault();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { registerCreateModal } = useAI();
  const { requestSudo } = useSudo();
  const { setConfiguration, resetConfiguration } = useFAB();
  const { setActiveDetail } = useSection();
  
  // Master password modal state
  const [showMasterPassDrawer, setShowMasterPassDrawer] = useState(needsMasterPassword || !isVaultUnlocked());
  
  // State for all credentials, fetched once
  const [allCredentials, setAllCredentials] = useState<Credentials[]>([]);
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<string>("login");
  const [editCredential, setEditCredential] = useState<Credentials | null>(null);
  const [dialogPrefill, setDialogPrefill] = useState<{ name?: string; url?: string } | undefined>(undefined);
  const [, setSelectedCredential] = useState<Credentials | null>(null);

  // Delete confirmation state
  const [credentialToDelete, setCredentialToDelete] = useState<Credentials | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Handlers
  const handleAdd = useCallback(() => {
    setEditCredential(null);
    setDialogType("login");
    setShowDialog(true);
  }, []);

  const loadAllCredentials = useCallback(async () => {
    if (!user?.$id) return;
    setLoading(true);
    try {
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
    if (!user?.$id || !isVaultUnlocked()) return;
    await loadAllCredentials();
  }, [user, isVaultUnlocked, loadAllCredentials]);

  // Effects
  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#10B981',
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
      
      const params = new URLSearchParams(window.location.search);
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
    try {
      const newPinned = await toggleCredentialPin(id);
      setAllCredentials(prev => prev.map(c => c.$id === id ? { ...c, isPinned: newPinned } : c));
      toast.success(newPinned ? "Pinned to top" : "Unpinned");
    } catch (error: unknown) {
      toast.error("Failed to toggle pin");
    }
  };

  const handleMasterPassSuccess = useCallback(() => {
    setShowMasterPassDrawer(false);
    void hydrateVaultData();
  }, [hydrateVaultData]);

  const sortedCredentials = useMemo(() => {
    return [...allCredentials].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
    });
  }, [allCredentials]);

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
                <button
                  onClick={() => setIsBlurEnabled(!isBlurEnabled)}
                  className={`p-2 border border-[#1C1A18] rounded-xl transition-colors ${
                    isBlurEnabled ? 'text-white/40 bg-[#161412]' : 'text-[#10B981] bg-[#161412]'
                  } hover:bg-[#1C1A18]`}
                >
                  {isBlurEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Credentials List */}
              <div className="flex flex-col gap-3.5 max-w-3xl">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <CredentialItem key={`skeleton-${i}`} credential={{ $id: `skeleton-${i}`, name: 'Loading...', username: '', type: 'password' } as any} />
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
                      isBlurEnabled={isBlurEnabled}
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

