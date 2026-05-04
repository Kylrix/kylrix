"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  Box, 
  Typography, 
  Button, 
  Grid, 
  Paper, 
  IconButton, 
  TextField, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ShieldIcon from "@mui/icons-material/Shield";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAppwriteVault } from "@/context/appwrite-context";
import { listTotpSecrets, deleteTotpSecret, listFolders } from "@/lib/appwrite";
import { authenticator } from "otplib";
import toast from "react-hot-toast";
import VaultGuard from "@/components/layout/VaultGuard";
import NewTotpDialog from "@/components/app/totp/new";
import { useSudo } from "@/context/SudoContext";

export default function TOTPPage() {
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isVaultUnlocked } = useAppwriteVault();
  type TotpItem = {
    $id: string;
    issuer?: string | null;
    accountName?: string | null;
    secretKey: string; // stored/encrypted elsewhere; never display
    period?: number | null;
    digits?: number | null;
    algorithm?: string | null;
    folderId?: string | null;
    sharedFrom?: string | null;
  };
  const [totpCodes, setTotpCodes] = useState<TotpItem[]>([]);
  const [folders, setFolders] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });
  const [editingTotp, setEditingTotp] = useState<TotpItem | null>(null);

  const { requestSudo } = useSudo();

  // Handle action query param
  useEffect(() => {
    const action = searchParams?.get('action');
    if (action === 'add-totp') {
      setEditingTotp(null);
      setShowNew(true);
      
      const params = new URLSearchParams(window.location.search);
      params.delete('action');
      const newRelativePathQuery = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      router.replace(newRelativePathQuery);
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!user?.$id) return;

    if (!isVaultUnlocked()) {
      return;
    }

    setLoading(true);
    Promise.allSettled([listTotpSecrets(user.$id), listFolders(user.$id)])
      .then(([secretsResult, foldersResult]) => {
        if (secretsResult.status === "fulfilled") {
          setTotpCodes(secretsResult.value);
        } else {
          console.error("Failed to fetch TOTP secrets", secretsResult.reason);
        }

        if (foldersResult.status === "fulfilled") {
          const folderMap = new Map<string, string>();
          foldersResult.value.forEach((f) => folderMap.set(f.$id, f.name));
          setFolders(folderMap);
        }
      })
      .catch((err) => {
        console.error("Error loading TOTP data:", err);
        toast.error("Failed to load data.");
      })
      .finally(() => setLoading(false));
  }, [user, showNew, isVaultUnlocked]);

  const generateTOTP = (
    secret: string,
    period: number = 30,
    digits: number = 6,
    algorithm: string = "SHA1",
  ): string => {
    try {
      if (!secret || secret.includes("[DECRYPTION_FAILED]")) return "Locked";
      const normalized = (secret || "").replace(/\s+/g, "").toUpperCase();
      if (!normalized) return "------";
      const algo = (algorithm || "sha1").toLowerCase();

      authenticator.options = {
        step: period || 30,
        digits: digits || 6,
        // @ts-expect-error - types can be strict
        algorithm: algo,
        window: 0
      };

      return authenticator.generate(normalized);
    } catch (err: unknown) {
      console.warn("TOTP Generation warning for secret ending in ...", secret?.slice(-4), err);
      if (algorithm?.toLowerCase() !== 'sha1') {
        try {
          // @ts-expect-error - type mismatch
          authenticator.options = { step: 30, digits: 6, algorithm: 'sha1' };
          return authenticator.generate((secret || "").replace(/\s+/g, ""));
        } catch { }
      }
      return "Invalid";
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: string) => {
    if (!user?.$id) return;
    try {
      await deleteTotpSecret(id);
      setTotpCodes((codes) => codes.filter((c) => c.$id !== id));
      toast.success("TOTP code deleted.");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message || "Failed to delete TOTP code.");
    } finally {
      setDeleteDialog({ open: false, id: null });
    }
  };

  const openDeleteDialog = (id: string) => {
    setDeleteDialog({ open: true, id });
  };

  const getTimeRemaining = (period: number = 30): number => {
    return period - (Math.floor(currentTime / 1000) % period);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Code copied to clipboard");
  };

  const openEditDialog = (totp: TotpItem) => {
    setEditingTotp(totp);
    setShowNew(true);
  };

  const TOTPCard = ({ totp }: { totp: TotpItem }) => {
    const code = generateTOTP(
      totp.secretKey,
      totp.period || 30,
      totp.digits || 6,
      totp.algorithm || "SHA1"
    );

    const timeRemaining = getTimeRemaining(totp.period || 30);
    const progress = (timeRemaining / (totp.period || 30)) * 100;
    const folderName = totp.folderId ? folders.get(totp.folderId) : null;

    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '24px',
          bgcolor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid',
          borderColor: 'rgba(255, 255, 255, 0.08)',
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.04)',
            borderColor: 'rgba(255, 255, 255, 0.15)',
            transform: 'translateY(-2px)'
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, color: 'text.primary' }}>
              {totp.issuer || "Unknown Issuer"}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: 'text.secondary', mb: 1 }}>
              {totp.accountName || "No account name"}
            </Typography>
            {folderName && (
              <Chip 
                label={folderName} 
                size="small" 
                sx={{ 
                  height: 20, 
                  fontSize: '0.65rem', 
                  fontWeight: 700, 
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  color: 'text.secondary',
                  borderRadius: '6px'
                }} 
              />
            )}
            {totp.sharedFrom && (
              <Chip
                label={`shared from ${totp.sharedFrom}`}
                size="small"
                sx={{
                  mt: 1,
                  height: 20,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  color: 'text.secondary',
                  borderRadius: '6px'
                }}
              />
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <IconButton size="small" onClick={() => openEditDialog(totp)} sx={{ color: 'text.secondary' }}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton size="small" onClick={() => openDeleteDialog(totp.$id)} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', color: '#10B981' }}>
              {code.substring(0, 3)} {code.substring(3)}
            </Typography>
            <IconButton size="small" onClick={() => copyToClipboard(code)} sx={{ color: '#10B981', bgcolor: 'rgba(16, 185, 129, 0.05)' }}>
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: timeRemaining <= 5 ? 'error.main' : 'text.secondary' }}>
              {timeRemaining}s
            </Typography>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress
                variant="determinate"
                value={progress}
                size={28}
                thickness={6}
                sx={{
                  color: timeRemaining <= 5 ? 'error.main' : '#10B981',
                  '& .MuiCircularProgress-circle': {
                    strokeLinecap: 'round',
                  },
                }}
              />
              <CircularProgress
                variant="determinate"
                value={100}
                size={28}
                thickness={6}
                sx={{
                  color: 'rgba(255, 255, 255, 0.05)',
                  position: 'absolute',
                  left: 0,
                }}
              />
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  };

  return (
    <VaultGuard>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'var(--font-space-grotesk)', letterSpacing: '-0.02em' }}>
              TOTP Codes
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Manage your two-factor authentication codes
            </Typography>
          </Box>
          <Button 
            variant="contained" 
            startIcon={<AddIcon sx={{ fontSize: 18 }} />} 
            onClick={() => setShowNew(true)}
            sx={{ 
              borderRadius: '12px', 
              fontWeight: 700, 
              px: 3,
              bgcolor: '#10B981',
              color: '#000',
              '&:hover': { bgcolor: alpha('#10B981', 0.8) }
            }}
          >
            Add TOTP
          </Button>
        </Box>

        <TextField
          fullWidth
          placeholder="Search TOTP codes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              borderRadius: '16px',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
              '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
              '&.Mui-focused fieldset': { borderColor: 'primary.main' }
            }
          }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress />
          </Box>
        ) : totpCodes.length === 0 ? (
          <Paper sx={{ p: 8, textAlign: 'center', borderRadius: '32px', bgcolor: 'rgba(255, 255, 255, 0.01)', border: '1px dashed', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <ShieldIcon sx={{ fontSize: 64, display: 'block', mx: 'auto', mb: 3, color: 'rgba(255, 255, 255, 0.1)' }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>No TOTP codes found</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
              Start by adding your first two-factor authentication code
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon sx={{ fontSize: 18 }} />} onClick={() => setShowNew(true)} sx={{ borderRadius: '12px' }}>
              Add TOTP
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {totpCodes
              .filter((totp) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                return (
                  (totp.issuer && totp.issuer.toLowerCase().includes(q)) ||
                  (totp.accountName &&
                    totp.accountName.toLowerCase().includes(q))
                );
              })
              .map((totp) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={totp.$id}>
                  <TOTPCard totp={totp} />
                </Grid>
              ))}
          </Grid>
        )}

        <NewTotpDialog
          open={showNew}
          onClose={() => {
            setShowNew(false);
            setEditingTotp(null);
          }}
          initialData={editingTotp || undefined}
        />

        <Dialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, id: null })}
          PaperProps={{
            sx: {
              borderRadius: '24px',
              bgcolor: 'rgba(10, 10, 10, 0.9)',
              backdropFilter: 'blur(20px)',
              border: '1px solid',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              backgroundImage: 'none',
              p: 1
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 800, fontFamily: 'var(--font-space-grotesk)' }}>
            Delete TOTP Code
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
              Are you sure you want to delete this TOTP code? This action cannot be undone.
            </Typography>
            {deleteDialog.open && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, borderRadius: '16px', bgcolor: 'rgba(255, 255, 255, 0.03)' }}>
                {(() => {
                  const selected = totpCodes.find((t) => t.$id === deleteDialog.id);
                  if (!selected) return null;
                  return (
                    <>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}>Issuer</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{selected.issuer || "—"}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.5 }}>Account</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{selected.accountName || "—"}</Typography>
                      </Box>
                    </>
                  );
                })()}
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1 }}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => setDeleteDialog({ open: false, id: null })}
              sx={{ borderRadius: '12px' }}
            >
              Cancel
            </Button>
            <Button 
              fullWidth 
              variant="contained" 
              color="error"
              onClick={() => {
                if (deleteDialog.id) {
                  requestSudo({
                    onSuccess: () => handleDelete(deleteDialog.id!)
                  });
                }
              }}
              sx={{ borderRadius: '12px' }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </VaultGuard>
  );
}
