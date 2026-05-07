"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import VaultGuard from '@/components/layout/VaultGuard';
import CredentialDetail from '@/components/app/dashboard/CredentialDetail';
import SudoModal from '@/components/overlays/SudoModal';
import { useAI } from '@/context/AIContext';
import { useSudo } from '@/context/SudoContext';
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
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography 
      variant="overline" 
      sx={{ 
        display: 'block',
        fontWeight: 800, 
        color: '#10B981', 
        mb: 2, 
        letterSpacing: '0.15em',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem'
      }}
    >
      {children}
    </Typography>
  );
}

export default function DashboardPage() {
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
  // Remove unused organizationPreview state
  // const [organizationPreview, setOrganizationPreview] = useState<{...} | null>(null);

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
  const handleSmartOrganize = async () => {
    if (!user?.$id || organizing) return;

    setOrganizing(true);
    const toastId = toast.loading("AI is analyzing your vault structure...");

    try {
      // 1. Get credentials that are NOT in a folder yet (or just all credentials to reorganize everything?)
      // Let's focus on uncategorized items first for safety, or let user decide.
      // For V1, let's reorganize everything to ensure a clean state.
      // Passing all credentials to the sanitizer (it strips secrets).

      const analysisResult = (await analyze('VAULT_ORGANIZE', allCredentials)) as { [folderName: string]: string[] };

      // Expected result: { "Finance": ["id1", "id2"], "Social": ["id3"] }
      if (!analysisResult || Object.keys(analysisResult).length === 0) {
        toast.error("AI couldn't find a better organization structure.", { id: toastId });
        return;
      }

      // setOrganizationPreview(analysisResult); 
      toast.success("Organization plan ready! Please review.", { id: toastId });
      // Note: We need a UI to confirm these changes. Using a simple native confirm for now or a custom modal in future.
      // For better UX, we'll auto-apply or show a summary dialog. 
      // Let's implement the application logic here directly for the hackathon MVP speed,
      // but ideally this should be a "Review Changes" modal.

      // Triggering the confirmation modal
      // (We'll reuse the delete modal state structure or add a new one if time permits, 
      // but for now let's just use window.confirm to be safe and fast)

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
  };

  const applyOrganizationChanges = async (plan: { [folderName: string]: string[] }) => {
    const toastId = toast.loading("Applying changes...");
    try {
      // 1. Refresh current folders to avoid duplicates
      const currentFolders = await listFolders(user!.$id);
      const folderMap = new Map(currentFolders.map(f => [f.name.toLowerCase(), f.$id]));

      // 2. Process each proposed folder
      for (const [folderName, credentialIds] of Object.entries(plan)) {
        let folderId = folderMap.get(folderName.toLowerCase());

        // Create folder if it doesn't exist
        if (!folderId) {
          const newFolder = await createFolder({
            name: folderName,
            userId: user!.$id,
            parentFolderId: null, // flattened structure for now
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          folderId = newFolder.$id;
          if (folderId) folderMap.set(folderName.toLowerCase(), folderId);
        }

        // 3. Move credentials to folder
        // We do this in parallel batches to speed it up
        await Promise.all(credentialIds.map(async (credId) => {
          // Check if credential actually exists and needs moving
          const cred = allCredentials.find(c => c.$id === credId);
          if (cred && cred.folderId !== folderId) {
            await updateCredential(credId, { folderId });
          }
        }));
      }

      toast.success("Vault organized successfully!", { id: toastId });
      // Refresh UI
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
      // Remove from the main list
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

  // Refresh all data from server
  const refreshCredentials = () => {
    if (!user?.$id) return;
    loadAllCredentials();
    listRecentCredentials(user.$id)
      .then(setRecentCredentials)
      .catch(console.error);
  };

  const { isAuthReady } = useAppwriteVault();

  // Client-side filtering and search
  const filteredCredentials = useMemo(() => {
    let source = allCredentials;

    // 1. Filter by folder
    if (selectedFolder) {
      source = source.filter((c) => c.folderId === selectedFolder);
    }

    // 2. Filter by search term (if any)
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

  // Client-side pagination logic
  const paginatedCredentials = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCredentials.slice(startIndex, startIndex + pageSize);
  }, [filteredCredentials, currentPage, pageSize]);

  if (!isAuthReady || !user) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', bgcolor: 'background.default' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  const isSearching = !!searchTerm.trim();
  const effectiveTotal = filteredCredentials.length;
  const totalPages = Math.ceil(effectiveTotal / pageSize) || 1;

  return (
    <VaultGuard>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh', 
        pb: 10,
        transition: 'filter 0.3s ease',
        filter: showMasterPassDrawer ? 'blur(4px)' : 'none',
        pointerEvents: showMasterPassDrawer ? 'none' : 'auto',
        opacity: showMasterPassDrawer ? 0.5 : 1
      }}>
        {/* Header Section */}
        <Box sx={{ 
          px: { xs: 2, md: 4 }, 
          py: 3, 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          gap: 3,
          mb: 2
        }}>
          <Box sx={{ flexShrink: 0 }}>
            <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.04em' }}>
              Vault
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              {effectiveTotal} items secured
            </Typography>
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <SearchBar onSearch={handleSearch} onSmartOrganize={handleSmartOrganize} />
          </Box>

          <Button 
            variant="contained" 
            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
            onClick={handleAdd}
            sx={{ 
              borderRadius: '14px', 
              px: 3, 
              py: 1.2, 
              fontWeight: 800,
              bgcolor: '#10B981',
              color: '#000',
              boxShadow: '0 1px 0 rgba(0, 0, 0, 0.4)',
              '&:hover': { bgcolor: alpha('#10B981', 0.8) }
            }}
          >
            Add Password
          </Button>
        </Box>

        {/* Main Content Area */}
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
          {/* Filters & Actions */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<FolderIcon sx={{ fontSize: 18 }} />}
              endIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
              onClick={(e) => setFolderAnchorEl(e.currentTarget)}
              sx={{ 
                borderRadius: '12px', 
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                borderColor: 'rgba(255, 255, 255, 0.05)',
                color: 'text.primary',
                fontWeight: 700,
                px: 2,
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.2)' }
              }}
            >
              {selectedFolder ? folders.find((f) => f.$id === selectedFolder)?.name : "All Folders"}
            </Button>
            
            <Menu
              anchorEl={folderAnchorEl}
              open={Boolean(folderAnchorEl)}
              onClose={() => setFolderAnchorEl(null)}
              PaperProps={{
                sx: {
                  mt: 1,
                  borderRadius: '16px',
                  bgcolor: '#161412',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  backgroundImage: 'none',
                  minWidth: '200px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
                }
              }}
            >
              <MenuItem onClick={() => { setSelectedFolder(null); setCurrentPage(1); setFolderAnchorEl(null); }} sx={{ fontWeight: 700 }}>
                All Folders
              </MenuItem>
              {folders.map((folder) => (
                <MenuItem 
                  key={folder.$id} 
                  onClick={() => { setSelectedFolder(folder.$id); setCurrentPage(1); setFolderAnchorEl(null); }}
                  sx={{ fontWeight: 600 }}
                >
                  {folder.name}
                </MenuItem>
              ))}
            </Menu>

            {isSearching && (
              <Chip 
                label={`${effectiveTotal} results for "${searchTerm}"`}
                onDelete={() => handleSearch("")}
                sx={{ 
                  borderRadius: '10px', 
                  bgcolor: alpha('#10B981', 0.1), 
                  color: '#10B981',
                  fontWeight: 800,
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}
              />
            )}
          </Box>

          {/* Recent Section */}
          {!isSearching && !selectedFolder && recentCredentials.length > 0 && (
            <Box sx={{ mb: 6 }}>
              <SectionTitle>Recent Items</SectionTitle>
              <Grid container spacing={2}>
                {recentCredentials.map((cred) => (
                  <Grid size={{ xs: 12 }} key={`recent-${cred.$id}`}>
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
              {isSearching ? "Search Results" : "All Items"}
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <CredentialSkeleton key={`skeleton-${i}`} />
              ))
            ) : paginatedCredentials.length === 0 ? (
              <Paper sx={{ 
                p: 8, 
                textAlign: 'center', 
                borderRadius: '32px', 
                bgcolor: 'rgba(255, 255, 255, 0.01)', 
                border: '1px dashed', 
                borderColor: 'rgba(255, 255, 255, 0.1)' 
              }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  {isSearching
                    ? `No credentials found matching "${searchTerm}"`
                    : "Your vault is empty. Add your first password to get started!"}
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
          </Box>

          {/* Bottom Pagination */}
          {!loading && effectiveTotal > pageSize && (
            <Box sx={{ mt: 6, display: 'flex', justifyContent: 'center' }}>
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

          {/* Delete Confirmation Dialog */}
        <Dialog
          open={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          PaperProps={{
            sx: {
              borderRadius: '24px',
              bgcolor: '#161412',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              backgroundImage: 'none',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 1px 0 rgba(0, 0, 0, 0.4)',
              p: 1
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em' }}>
            Delete Credential
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
              Are you sure you want to delete the credential for <strong>{credentialToDelete?.name}</strong>? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => setIsDeleteModalOpen(false)}
              sx={{ borderRadius: '14px', fontWeight: 700 }}
            >
              Cancel
            </Button>
            <Button 
              fullWidth 
              variant="contained" 
              color="error"
              onClick={() => {
                requestSudo({
                  onSuccess: () => handleDelete()
                });
              }}
              sx={{ 
                borderRadius: '14px', 
                fontWeight: 800,
                bgcolor: alpha('#ef4444', 0.1),
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                '&:hover': {
                  bgcolor: alpha('#ef4444', 0.2),
                  borderColor: alpha('#ef4444', 0.4)
                }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Credential Detail Sidebar/Overlay */}
        {showDetail && selectedCredential && (
          <CredentialDetail
            credential={selectedCredential}
            onClose={() => setShowDetail(false)}
            isMobile={isMobileView}
          />
        )}

        {/* Master Password Unlock Drawer */}
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
    </VaultGuard>
  );
}
