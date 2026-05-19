"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Credentials, Folders as FolderDoc } from '@/lib/appwrite/types';
import { useAppwriteVault } from '@/context/appwrite-context';
import {
  deleteCredential,
  listAllCredentials,
  listFolders,
  listRecentCredentials,
  listTotpSecrets,
  createFolder,
  updateCredential,
} from '@/lib/appwrite';
import toast from 'react-hot-toast';
import CredentialItem from '@/components/app/dashboard/CredentialItem';
import CredentialSkeleton from '@/components/app/dashboard/CredentialSkeleton';
import PaginationControls from '@/components/app/dashboard/PaginationControls';
import SearchBar from '@/components/app/dashboard/SearchBar';
import CredentialDialog from '@/components/app/dashboard/CredentialDialog';
import CredentialDetail from '@/components/app/dashboard/CredentialDetail';
import SudoModal from '@/components/overlays/SudoModal';
import { useAI } from '@/context/AIContext';
import { useSudo } from '@/context/SudoContext';
import { useFAB } from '@/context/FABContext';
import { 
  Box, 
  Typography, 
  Button, 
  Container, 
  Grid, 
  Paper, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Chip,
  Divider,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
  Stack,
  IconButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import { LayoutGrid, List as ListIcon, ShieldCheck, Plus, Sparkles } from 'lucide-react';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography 
      variant="overline" 
      sx={{ 
        display: 'block',
        fontWeight: 900, 
        color: '#10B981', 
        mb: 2, 
        letterSpacing: '0.12em',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem'
      }}
    >
      {children}
    </Typography>
  );
}

function DashboardPageContent() {
  const { user, needsMasterPassword, isVaultUnlocked } = useAppwriteVault();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { analyze, registerCreateModal } = useAI();
  const theme = useTheme();
  const isMobileView = useMediaQuery(theme.breakpoints.down('md'));
  
  // Master password modal state
  const [showMasterPassDrawer, setShowMasterPassDrawer] = useState(needsMasterPassword || !isVaultUnlocked());
  
  // State for all credentials, fetched once
  const [allCredentials, setAllCredentials] = useState<Credentials[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<string>("login");
  const [editCredential, setEditCredential] = useState<Credentials | null>(
    null,
  );
  // Add state for prefilling dialog
  const [dialogPrefill, setDialogPrefill] = useState<{ name?: string; url?: string } | undefined>(undefined);

  // Handle action query param
  useEffect(() => {
    const action = searchParams?.get('action');
    if (action && ['add-login', 'add-card'].includes(action)) {
      setEditCredential(null);
      setDialogType(action.split('-')[1]);
      setShowDialog(true);
      
      // Clean up URL
      const params = new URLSearchParams(window.location.search);
      params.delete('action');
      const newPath = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      router.replace(newPath);
    }
  }, [searchParams, router]);

  const { setConfiguration, resetConfiguration } = useFAB();

  useEffect(() => {
    setConfiguration({
      isVisible: true,
      mainColor: '#10B981',
      actions: [
        { id: 'add', label: 'ADD PASSWORD', icon: <Plus size={20} />, onClick: () => handleAdd() },
        { id: 'organize', label: 'AI ORGANIZE', icon: <Sparkles size={20} />, onClick: () => handleSmartOrganize() },
      ]
    });
    return () => resetConfiguration();
  }, [setConfiguration, resetConfiguration, handleSmartOrganize]);

  // Update master password drawer state when auth state changes
  useEffect(() => {
    if (needsMasterPassword || !isVaultUnlocked()) {
      setShowMasterPassDrawer(true);
    }
  }, [needsMasterPassword, isVaultUnlocked]);

  const [selectedCredential, setSelectedCredential] =
    useState<Credentials | null>(null);

  // Register the modal opener
  useEffect(() => {
    registerCreateModal((prefill) => {
      setEditCredential(null);
      setDialogType("login");
      setDialogPrefill(prefill);
      setShowDialog(true);
    });
  }, [registerCreateModal]);

  const [showDetail, setShowDetail] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Folder state
  const [folders, setFolders] = useState<FolderDoc[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [folderAnchorEl, setFolderAnchorEl] = useState<null | HTMLElement>(null);

  // Recent credentials state
  const [recentCredentials, setRecentCredentials] = useState<Credentials[]>([]);
  const [_decryptedTotpSecrets, setDecryptedTotpSecrets] = useState<any[]>([]);

  // Delete confirmation state
  const [credentialToDelete, setCredentialToDelete] =
    useState<Credentials | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { requestSudo } = useSudo();

  // AI Organization State
  const [organizing, setOrganizing] = useState(false);

  // Fetch all credentials once
  const loadAllCredentials = useCallback(async () => {
    if (!user?.$id) return;
    setLoading(true);
    try {
      const credentials = await listAllCredentials(user.$id);
      setAllCredentials(credentials);
    } catch (error: unknown) {
      toast.error("Failed to load credentials. Please try again.");
      console.error("Failed to load credentials:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // AI Smart Organization Handler
  const handleSmartOrganize = useCallback(async () => {
    if (!user?.$id || organizing) return;

    setOrganizing(true);
    const toastId = toast.loading("AI is analyzing your vault structure...");

    try {
      const analysisResult = (await analyze('VAULT_ORGANIZE', allCredentials)) as { [folderName: string]: string[] };

      if (!analysisResult || Object.keys(analysisResult).length === 0) {
        toast.error("AI couldn't find a better organization structure.", { id: toastId });
        return;
      }

      toast.success("Organization plan ready! Please review.", { id: toastId });

      const confirmMsg = `AI suggests creating/merging into ${Object.keys(analysisResult).length} folders. Proceed?`;
      if (window.confirm(confirmMsg)) {
        await applyOrganizationChanges(analysisResult);
      }

    } catch (error: unknown) {
      console.error("Smart Organize Failed:", error);
      toast.error("Failed to organize vault.", { id: toastId });
    } finally {
      setOrganizing(false);
    }
  }, [user?.$id, organizing, allCredentials, applyOrganizationChanges]);

  const applyOrganizationChanges = async (plan: { [folderName: string]: string[] }) => {
    const toastId = toast.loading("Applying changes...");
    try {
      const currentFolders = await listFolders(user!.$id);
      const folderMap = new Map(currentFolders.map(f => [f.name.toLowerCase(), f.$id]));

      for (const [folderName, credentialIds] of Object.entries(plan)) {
        let folderId = folderMap.get(folderName.toLowerCase());

        if (!folderId) {
          const newFolder = await createFolder({
            name: folderName,
            userId: user!.$id,
            parentFolderId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          folderId = newFolder.$id;
          if (folderId) folderMap.set(folderName.toLowerCase(), folderId);
        }

        await Promise.all(credentialIds.map(async (credId) => {
          const cred = allCredentials.find(c => c.$id === credId);
          if (cred && cred.folderId !== folderId) {
            await updateCredential(credId, { folderId });
          }
        }));
      }

      toast.success("Vault organized successfully!", { id: toastId });
      window.location.reload();
    } catch (error: unknown) {
      console.error("Failed to apply changes", error);
      toast.error("Partial failure during organization.", { id: toastId });
    }
  };

  const hydrateVaultData = useCallback(async () => {
    if (!user?.$id || !isVaultUnlocked()) return;

    await loadAllCredentials();

    void listFolders(user.$id)
      .then(setFolders)
      .catch((err: unknown) => {
        console.error("Failed to fetch folders:", err);
      });

    void listRecentCredentials(user.$id)
      .then(setRecentCredentials)
      .catch((err: unknown) => {
        console.error("Failed to fetch recent credentials:", err);
      });

    void listTotpSecrets(user.$id)
      .then(setDecryptedTotpSecrets)
      .catch((err: unknown) => {
        console.error("Failed to fetch TOTP secrets:", err);
      });
  }, [user, isVaultUnlocked, loadAllCredentials]);

  useEffect(() => {
    if (user?.$id && isVaultUnlocked()) {
      void hydrateVaultData();
    }
  }, [user, isVaultUnlocked, hydrateVaultData]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard!");
  };

  const handleAdd = () => {
    setEditCredential(null);
    setDialogType("login");
    setShowDialog(true);
  };

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
      toast.success("Credential deleted successfully.");
    } catch (error: unknown) {
      toast.error("Failed to delete credential. Please try again.");
      console.error("Failed to delete credential:", error);
    } finally {
      setIsDeleteModalOpen(false);
      setCredentialToDelete(null);
    }
  };

  const refreshCredentials = () => {
    if (!user?.$id) return;
    loadAllCredentials();
    listRecentCredentials(user.$id)
      .then(setRecentCredentials)
      .catch(console.error);
  };

  const { isAuthReady } = useAppwriteVault();

  const filteredCredentials = useMemo(() => {
    let source = allCredentials;

    if (selectedFolder) {
      source = source.filter((c) => c.folderId === selectedFolder);
    }

    if (searchTerm.trim()) {
      const normalizedTerm = searchTerm.trim().toLowerCase();
      source = source.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const username = (c.username || "").toLowerCase();
        const url = (c.url || "").toLowerCase();
        const notes = (c.notes || "").toLowerCase();
        return (
          name.includes(normalizedTerm) ||
          username.includes(normalizedTerm) ||
          url.includes(normalizedTerm) ||
          notes.includes(normalizedTerm)
        );
      });
    }

    return source;
  }, [allCredentials, searchTerm, selectedFolder]);

  const paginatedCredentials = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCredentials.slice(startIndex, startIndex + pageSize);
  }, [filteredCredentials, currentPage, pageSize]);

  if (!isAuthReady || !user) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: '#0A0908' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const isSearching = !!searchTerm.trim();
  const effectiveTotal = filteredCredentials.length;
  const totalPages = Math.ceil(effectiveTotal / pageSize) || 1;

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
        opacity: showMasterPassDrawer ? 0.3 : 1
      }}>
        {/* Header Section */}
        <Box sx={{ 
          px: { xs: 2, md: 6 }, 
          py: { xs: 4, md: 5 }, 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'flex-end' },
          justifyContent: 'space-between',
          gap: 4,
          mb: 4,
          borderBottom: '1px solid #1C1A18'
        }}>
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
                <Box sx={{ p: 1, borderRadius: '12px', bgcolor: alpha('#10B981', 0.1), color: '#10B981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    <ShieldCheck size={20} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.03em', color: '#fff' }}>
                    Vault Dashboard
                </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: '#9B9691', fontWeight: 500, fontSize: '1rem' }}>
              {effectiveTotal} items secured with advanced privacy protections
            </Typography>
          </Box>

          <Stack direction="row" spacing={2} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <Box sx={{ width: { xs: '100%', md: 400 } }}>
                <SearchBar onSearch={handleSearch} onSmartOrganize={handleSmartOrganize} />
              </Box>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                {/* Space maintained, but FAB handles addition now */}
              </Box>
          </Stack>
        </Box>

        {/* Main Content Area */}
        <Container maxWidth="xl" sx={{ px: { xs: 2, md: 6 } }}>
          {/* Filters & Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 6, gap: 3, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<FolderIcon sx={{ fontSize: 18 }} />}
              endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              onClick={(e) => setFolderAnchorEl(e.currentTarget)}
              sx={{ 
                borderRadius: '14px', 
                bgcolor: '#161412',
                borderColor: '#1C1A18',
                color: '#fff',
                fontWeight: 800,
                px: 3,
                py: 1.2,
                textTransform: 'none',
                '&:hover': { bgcolor: '#1C1A18', borderColor: '#34322F' }
              }}
            >
              {selectedFolder ? folders.find((f) => f.$id === selectedFolder)?.name : "Root Explorer"}
            </Button>
            
            <Menu
              anchorEl={folderAnchorEl}
              open={Boolean(folderAnchorEl)}
              onClose={() => setFolderAnchorEl(null)}
              PaperProps={{
                sx: {
                  mt: 1,
                  borderRadius: '20px',
                  bgcolor: '#161412',
                  border: '1px solid #1C1A18',
                  backgroundImage: 'none',
                  minWidth: '240px',
                  boxShadow: '0 32px 64px rgba(0, 0, 0, 0.6)'
                }
              }}
            >
              <MenuItem onClick={() => { setSelectedFolder(null); setCurrentPage(1); setFolderAnchorEl(null); }} sx={{ fontWeight: 800, py: 1.5, px: 2.5 }}>
                All Documents
              </MenuItem>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />
              {folders.map((folder) => (
                <MenuItem 
                  key={folder.$id} 
                  onClick={() => { setSelectedFolder(folder.$id); setCurrentPage(1); setFolderAnchorEl(null); }}
                  sx={{ fontWeight: 700, py: 1.5, px: 2.5 }}
                >
                  {folder.name}
                </MenuItem>
              ))}
            </Menu>

            {isSearching && (
              <Chip 
                label={`Matching Items: ${effectiveTotal}`}
                onDelete={() => handleSearch("")}
                sx={{ 
                  borderRadius: '12px', 
                  bgcolor: alpha('#10B981', 0.1), 
                  color: '#10B981',
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  height: 32
                }}
              />
            )}
          </Box>

          <Grid container spacing={6}>
            <Grid item xs={12} lg={8.5}>
                {/* Recent Section */}
                {!isSearching && !selectedFolder && recentCredentials.length > 0 && (
                    <Box sx={{ mb: 8 }}>
                    <SectionTitle>Recently Accessed</SectionTitle>
                    <Grid container spacing={2}>
                        {recentCredentials.slice(0, 3).map((cred) => (
                        <Grid item xs={12} key={`recent-${cred.$id}`}>
                            <CredentialItem
                            credential={cred}
                            onCopy={handleCopy}
                            onEdit={() => handleEdit(cred)}
                            onDelete={() => openDeleteModal(cred)}
                            onClick={() => {
                                setSelectedCredential(cred);
                                setShowDetail(true);
                            }}
                            />
                        </Grid>
                        ))}
                    </Grid>
                    </Box>
                )}

                {/* All Items Section */}
                <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <SectionTitle>
                    {isSearching ? "Search Index" : selectedFolder ? folders.find(f => f.$id === selectedFolder)?.name : "Main Index"}
                    </SectionTitle>
                    
                    {!loading && effectiveTotal > 0 && (
                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={effectiveTotal}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                    />
                    )}
                </Box>

                {/* Credentials List */}
                <Stack spacing={1.5}>
                    {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                        <CredentialSkeleton key={`skeleton-${i}`} />
                    ))
                    ) : paginatedCredentials.length === 0 ? (
                    <Paper elevation={0} sx={{ 
                        p: 10, 
                        textAlign: 'center', 
                        borderRadius: '32px', 
                        bgcolor: '#161412', 
                        border: '1px dashed #1C1A18'
                    }}>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'var(--font-clash)' }}>
                            {isSearching ? "Zero Results" : "Secure Repository Empty"}
                        </Typography>
                        <Typography sx={{ color: '#9B9691', maxWidth: 320, mx: 'auto' }}>
                            {isSearching
                            ? `No encrypted records matching "${searchTerm}" were found in this node.`
                            : "Your decentralized vault is ready for its first record."}
                        </Typography>
                    </Paper>
                    ) : (
                    paginatedCredentials.map((cred: Credentials) => (
                        <CredentialItem
                            key={cred.$id}
                            credential={cred}
                            onCopy={handleCopy}
                            onEdit={() => handleEdit(cred)}
                        onDelete={() => openDeleteModal(cred)}
                        onClick={() => {
                            setSelectedCredential(cred);
                            setShowDetail(true);
                        }}
                        />
                    ))
                    )}
                </Stack>

                {/* Bottom Pagination */}
                {!loading && effectiveTotal > pageSize && (
                    <Box sx={{ mt: 8, display: 'flex', justifyContent: 'center' }}>
                    <PaginationControls
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={effectiveTotal}
                        pageSize={pageSize}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                    />
                    </Box>
                )}
            </Grid>

            {/* Visual Sidebar for Stats/Identity */}
            {!isMobileView && (
                <Grid item lg={3.5}>
                    <Stack spacing={4}>
                        <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', bgcolor: '#161412', border: '1px solid #1C1A18', backgroundImage: 'none' }}>
                            <Typography sx={{ fontWeight: 900, mb: 3, fontSize: '1.1rem' }}>Node Health</Typography>
                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1 }}>Security Level</Typography>
                                    <Box sx={{ height: 6, borderRadius: 3, bgcolor: '#0A0908', overflow: 'hidden' }}>
                                        <Box sx={{ width: '94%', height: '100%', bgcolor: '#10B981' }} />
                                    </Box>
                                    <Typography variant="caption" sx={{ color: '#10B981', fontWeight: 900, mt: 0.5, display: 'block' }}>Optimal</Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 800, textTransform: 'uppercase', display: 'block', mb: 1 }}>Sync Relay</Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 800 }}>Kylrix-Nexus-East</Typography>
                                </Box>
                            </Stack>
                        </Paper>

                        <Paper elevation={0} sx={{ p: 4, borderRadius: '32px', bgcolor: alpha('#10B981', 0.03), border: '1px solid rgba(16, 185, 129, 0.1)', backgroundImage: 'none' }}>
                            <Typography variant="h6" sx={{ fontWeight: 900, mb: 1.5 }}>Your Privacy</Typography>
                            <Typography variant="body2" sx={{ color: '#9B9691', lineHeight: 1.6 }}>
                                Your password never leaves your device. Everything is kept private and secure in your own personal space.
                            </Typography>
                        </Paper>
                    </Stack>
                </Grid>
            )}
          </Grid>
        </Container>

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
            Destroy Record
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ color: '#9B9691', fontWeight: 500, lineHeight: 1.6 }}>
              Deleting <strong>{credentialToDelete?.name}</strong> will permanently remove the record from your node. This action is irreversible.
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
              Confirm Destruction
            </Button>
            <Button 
              fullWidth 
              onClick={() => setIsDeleteModalOpen(false)}
              sx={{ borderRadius: '16px', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}
            >
              Abort
            </Button>
          </DialogActions>
        </Dialog>

        {showDetail && selectedCredential && (
          <CredentialDetail
            credential={selectedCredential}
            onClose={() => setShowDetail(false)}
            isMobile={isMobileView}
          />
        )}

        <SudoModal
          isOpen={showMasterPassDrawer}
          app="vault"
          onSuccess={() => {
            setShowMasterPassDrawer(false);
            void hydrateVaultData();
          }}
          onCancel={() => { }}
        />
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
