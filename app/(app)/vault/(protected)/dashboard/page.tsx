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
import CredentialSkeleton from '@/components/app/dashboard/CredentialSkeleton';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import CredentialDetail from '@/components/app/dashboard/CredentialDetail';
import SudoModal from '@/components/overlays/SudoModal';
import { useAI } from '@/context/AIContext';
import { useSudo } from '@/context/SudoContext';
import { useFAB } from '@/context/FABContext';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  useTheme,
  useMediaQuery,
  Stack,
  IconButton,
} from '@/lib/mui-tailwind/material';
import { alpha } from '@/lib/mui-tailwind/material';
import { ArrowLeft, Plus, Eye, EyeOff } from 'lucide-react';

function DashboardPageContent() {
  const { user, needsMasterPassword, isVaultUnlocked } = useAppwriteVault();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { registerCreateModal } = useAI();
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down('md'));
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
  const [selectedCredential, setSelectedCredential] = useState<Credentials | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#0A0908' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh', 
        pb: 10,
        bgcolor: '#0A0908',
        transition: 'filter 0.3s ease',
        filter: showMasterPassDrawer ? 'blur(8px)' : 'none',
        pointerEvents: showMasterPassDrawer ? 'none' : 'auto',
        opacity: showMasterPassDrawer ? 0.3 : 1,
        pt: { xs: 2, md: 4 }
      }}>
        <MultiSectionContainer panels={['note', 'totp', 'projects']}>
          <Box>
        {/* Header Section */}
        <Box sx={{ px: { xs: 2, md: 6 } }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 4 }}>
            <IconButton 
              onClick={() => router.back()} 
              sx={{ 
                color: '#fff', 
                bgcolor: '#161412',
                border: '1px solid #1C1A18',
                '&:hover': { bgcolor: '#1C1A18' }
              }}
            >
              <ArrowLeft size={20} />
            </IconButton>
            <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
              Secrets
            </Typography>
            <IconButton
              onClick={() => setIsBlurEnabled(!isBlurEnabled)}
              sx={{
                color: isBlurEnabled ? 'rgba(255,255,255,0.4)' : '#10B981',
                bgcolor: '#161412',
                border: '1px solid #1C1A18',
                '&:hover': { bgcolor: '#1C1A18' },
              }}
              size="small"
            >
              {isBlurEnabled ? <EyeOff size={16} /> : <Eye size={16} />}
            </IconButton>
          </Stack>

          {/* Credentials List */}
          <Stack spacing={1.5} sx={{ maxWidth: 800 }}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <CredentialSkeleton key={`skeleton-${i}`} />
              ))
            ) : allCredentials.length === 0 ? (
              <Paper elevation={0} sx={{ 
                p: 10, 
                textAlign: 'center', 
                borderRadius: '32px', 
                bgcolor: '#161412', 
                border: '1px dashed #1C1A18'
              }}>
                <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'var(--font-clash)' }}>
                  No Secrets Found
                </Typography>
                <Typography sx={{ color: '#9B9691', maxWidth: 320, mx: 'auto' }}>
                  Your secure vault is ready for its first secret.
                </Typography>
              </Paper>
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
          </Stack>
        </Box>

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

        <Dialog
          open={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          PaperProps={{
            sx: {
              borderRadius: '32px',
              bgcolor: '#161412',
              border: '1px solid #1C1A18',
              backgroundImage: 'none',
              boxShadow: '0 40px 80px rgba(0, 0, 0, 0.6)',
              p: 2
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.5rem', color: '#FF453A' }}>
            Delete Secret
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ color: '#9B9691', fontWeight: 500, lineHeight: 1.6 }}>
              Deleting <strong>{credentialToDelete?.name}</strong> will permanently remove this secret from your vault. This action is irreversible.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 1, gap: 2, flexDirection: 'column' }}>
            <Button 
              fullWidth 
              variant="contained" 
              onClick={() => requestSudo({ onSuccess: () => handleDelete() })}
              sx={{ 
                borderRadius: '16px', 
                fontWeight: 900,
                bgcolor: '#FF453A',
                color: '#000',
                py: 1.5,
                '&:hover': { bgcolor: alpha('#FF453A', 0.9) }
              }}
            >
              Confirm Deletion
            </Button>
            <Button 
              fullWidth 
              onClick={() => setIsDeleteModalOpen(false)}
              sx={{ borderRadius: '16px', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}
            >
              Cancel
            </Button>
          </DialogActions>
        </Dialog>

        <SudoModal
          isOpen={showMasterPassDrawer}
          app="vault"
          onSuccess={handleMasterPassSuccess}
          onCancel={() => { }}
        />
        </Box>
        </MultiSectionContainer>
      </Box>
    </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0A0908' }}>
          <CircularProgress color="primary" />
        </Box>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
