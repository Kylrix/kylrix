"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  IconButton, 
  TextField, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Chip,
  Stack,
  InputAdornment
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ShieldIcon from '@mui/icons-material/Shield';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAppwriteVault } from '@/context/appwrite-context';
import { listTotpSecrets, deleteTotpSecret, listFolders } from '@/lib/appwrite';
import { authenticator } from 'otplib';
import toast from 'react-hot-toast';
import NewTotpDialog from '@/components/app/totp/new';
import { useSudo } from '@/context/SudoContext';

export const dynamic = 'force-dynamic';

function TOTPPageContent() {
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isVaultUnlocked } = useAppwriteVault();
  
  type TotpItem = {
    $id: string;
    issuer?: string | null;
    accountName?: string | null;
    secretKey: string;
    period?: number | null;
    digits?: number | null;
    algorithm?: string | null;
    folderId?: string | null;
    sharedFrom?: string | null;
    url?: string | null;
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
      toast.success("Verification code deleted.");
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(err.message || "Failed to delete verification code.");
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

  const getFaviconUrl = (url: string | null | undefined) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      try {
        if (url.includes('.') && !url.startsWith('http')) {
          return `https://www.google.com/s2/favicons?domain=${url}&sz=64`;
        }
      } catch {}
      return null;
    }
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
    const faviconUrl = getFaviconUrl(totp.url);
    const issuerInitials = totp.issuer ? totp.issuer.trim().charAt(0).toUpperCase() : "?";

    return (
      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          borderRadius: '24px',
          bgcolor: '#161412',
          border: '1px solid #1C1A18',
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          boxShadow: '0 4px 4px -4px rgba(0,0,0,0.9), 0 2px 3px -3px rgba(37,35,33,0.9)',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          backgroundImage: 'none',
          '&:hover': {
            bgcolor: '#1C1A18',
            borderColor: alpha('#10B981', 0.2),
            transform: 'translateY(-2px)',
            boxShadow: '0 8px 10px -8px rgba(0,0,0,1), 0 6px 8px -6px rgba(37,35,33,1)',
            '& .fav-box': { borderColor: alpha('#10B981', 0.2), bgcolor: alpha('#10B981', 0.05) }
          }
        }}
      >
        {/* Left Side: Logo/Avatar & Info */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0, width: { xs: '100%', sm: 'auto' } }}>
          {faviconUrl ? (
            <Box 
              className="fav-box"
              sx={{
                width: 52,
                height: 52,
                borderRadius: '16px',
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Box 
                component="img" 
                src={faviconUrl} 
                alt={totp.issuer || 'app favicon'}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                sx={{ width: 28, height: 28, borderRadius: '6px' }} 
              />
            </Box>
          ) : (
            <Box 
              className="fav-box"
              sx={{ 
                width: 52, 
                height: 52, 
                borderRadius: '16px', 
                bgcolor: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Typography sx={{ fontWeight: 900, color: '#10B981', fontSize: '1.25rem', fontFamily: 'var(--font-clash)' }}>
                {issuerInitials}
              </Typography>
            </Box>
          )}

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, color: '#fff', fontFamily: 'var(--font-clash)', fontSize: '1.05rem', lineHeight: 1.2 }}>
              {totp.issuer || "Smart Code"}
            </Typography>
            <Typography variant="body2" noWrap sx={{ color: '#9B9691', mt: 0.5, fontWeight: 500, fontFamily: 'var(--font-satoshi)', fontSize: '0.9rem' }}>
              {totp.accountName || "No account info"}
            </Typography>
            
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {folderName && (
                <Chip 
                  label={folderName} 
                  size="small" 
                  sx={{ 
                    height: 18, 
                    fontSize: '0.6rem', 
                    fontWeight: 900, 
                    bgcolor: 'rgba(255, 255, 255, 0.04)',
                    color: '#9B9691',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }} 
                />
              )}
              {totp.sharedFrom && (
                <Chip
                  label={`Received`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 900,
                    bgcolor: alpha('#10B981', 0.08),
                    color: '#10B981',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}
                />
              )}
            </Stack>
          </Box>
        </Box>

        {/* Right Side: Code, Timer & Actions */}
        <Box 
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: { xs: 2, sm: 3 }, 
            width: { xs: '100%', sm: 'auto' }, 
            justifyContent: { xs: 'space-between', sm: 'flex-end' },
            mt: { xs: 2.5, sm: 0 },
            pt: { xs: 2.5, sm: 0 },
            borderTop: { xs: '1px solid rgba(255, 255, 255, 0.04)', sm: 'none' }
          }}
        >
          {/* 6-Digit Code & Copy Button */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', color: '#10B981' }}>
              {code.substring(0, 3)} {code.substring(3)}
            </Typography>
            <IconButton 
              size="small" 
              onClick={() => copyToClipboard(code)} 
              sx={{ 
                color: '#10B981', 
                bgcolor: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.1)',
                borderRadius: '10px',
                p: 1,
                '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' }
              }}
            >
              <ContentCopyIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>

          {/* Time Countdown Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: timeRemaining <= 5 ? '#EF4444' : '#9B9691', minWidth: '22px', textAlign: 'right' }}>
              {timeRemaining}s
            </Typography>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress
                variant="determinate"
                value={progress}
                size={28}
                thickness={6}
                sx={{
                  color: timeRemaining <= 5 ? '#EF4444' : '#10B981',
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
                  color: 'rgba(255, 255, 255, 0.04)',
                  position: 'absolute',
                  left: 0,
                }}
              />
            </Box>
          </Box>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <IconButton 
              size="small" 
              onClick={() => openEditDialog(totp)} 
              sx={{ 
                color: '#9B9691', 
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                p: 1,
                '&:hover': { color: '#fff', bgcolor: 'rgba(255, 255, 255, 0.05)' }
              }}
            >
              <EditIcon sx={{ fontSize: 15 }} />
            </IconButton>
            <IconButton 
              size="small" 
              onClick={() => openDeleteDialog(totp.$id)} 
              sx={{ 
                color: '#9B9691', 
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                p: 1,
                '&:hover': { color: '#EF4444', bgcolor: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.2)' }
              }}
            >
              <DeleteIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Box>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      pb: 10,
      bgcolor: '#0A0908',
      pt: { xs: 2, md: 4 }
    }}>
      {/* Header & Back Action */}
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
            Smart Codes
          </Typography>
        </Stack>

        {/* Filter/Search Bar & Add Button Stack */}
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          justifyContent="space-between" 
          alignItems={{ xs: 'stretch', sm: 'center' }} 
          sx={{ mb: 4, maxWidth: 800 }}
        >
          <TextField
            fullWidth
            placeholder="Search codes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            variant="filled"
            InputProps={{
              disableUnderline: true,
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "rgba(255,255,255,0.3)", fontSize: 18 }} />
                </InputAdornment>
              ),
              sx: { 
                borderRadius: '16px', 
                bgcolor: '#161412', 
                border: '1px solid #1C1A18',
                height: 48,
                '& input': { color: '#fff' }
              }
            }}
            sx={{ maxWidth: { xs: '100%', sm: 400 }, flexGrow: 1 }}
          />
          <Button 
            variant="contained" 
            startIcon={<Plus size={18} />} 
            onClick={() => setShowNew(true)}
            sx={{ 
              borderRadius: '16px', 
              fontWeight: 900, 
              px: 4,
              height: 48,
              bgcolor: '#10B981',
              color: '#000',
              textTransform: 'none',
              fontSize: '0.95rem',
              '&:hover': { bgcolor: '#059669' },
              boxShadow: '0 8px 16px rgba(16, 185, 129, 0.1)'
            }}
          >
            Add Code
          </Button>
        </Stack>

        {/* Main List Area */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12, maxWidth: 800 }}>
            <CircularProgress color="primary" />
          </Box>
        ) : totpCodes.length === 0 ? (
          <Paper 
            elevation={0}
            sx={{ 
              p: 10, 
              textAlign: 'center', 
              borderRadius: '32px', 
              bgcolor: '#161412', 
              border: '1px dashed #1C1A18',
              maxWidth: 800,
              backgroundImage: 'none'
            }}
          >
            <ShieldIcon sx={{ fontSize: 64, display: 'block', mx: 'auto', mb: 3, color: 'rgba(255, 255, 255, 0.05)' }} />
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'var(--font-clash)' }}>
              No Smart Codes
            </Typography>
            <Typography variant="body2" sx={{ color: '#9B9691', maxWidth: 320, mx: 'auto', mb: 4 }}>
              Your secure vault is ready to manage two-step verification codes.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<Plus size={18} />} 
              onClick={() => setShowNew(true)} 
              sx={{ 
                borderRadius: '16px', 
                fontWeight: 900, 
                px: 4,
                height: 48,
                bgcolor: '#10B981',
                color: '#000',
                textTransform: 'none',
                '&:hover': { bgcolor: '#059669' }
              }}
            >
              Add Code
            </Button>
          </Paper>
        ) : (
          <Stack spacing={1.5} sx={{ maxWidth: 800 }}>
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
                <TOTPCard key={totp.$id} totp={totp} />
              ))}
          </Stack>
        )}
      </Box>

      {/* Dialogs */}
      {showNew && (
        <NewTotpDialog
          open={showNew}
          onClose={() => {
            setShowNew(false);
            setEditingTotp(null);
          }}
          initialData={editingTotp || undefined}
        />
      )}

      {deleteDialog.open && (
        <Dialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, id: null })}
          keepMounted={false}
          disablePortal={true}
          PaperProps={{
            sx: {
              borderRadius: '24px',
              bgcolor: '#161412',
              border: '1px solid #1C1A18',
              backgroundImage: 'none',
              p: 2,
              maxWidth: 400,
              width: '100%'
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff', px: 3, pt: 3 }}>
            Delete Smart Code
          </DialogTitle>
          <DialogContent sx={{ px: 3 }}>
            <Typography variant="body2" sx={{ color: '#9B9691', mb: 3, lineHeight: 1.6 }}>
              Are you sure you want to delete this verification code? This action cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2.5, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid rgba(255,255,255,0.03)' }}>
              {(() => {
                const selected = totpCodes.find((t) => t.$id === deleteDialog.id);
                if (!selected) return null;
                return (
                  <>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#9B9691', display: 'block', mb: 0.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issuer</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>{selected.issuer || "—"}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" sx={{ color: '#9B9691', display: 'block', mb: 0.5, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Account</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>{selected.accountName || "—"}</Typography>
                    </Box>
                  </>
                );
              })()}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 1.5, justifyContent: 'space-between' }}>
            <Button 
              fullWidth 
              variant="outlined" 
              onClick={() => setDeleteDialog({ open: false, id: null })}
              sx={{ 
                borderRadius: '14px', 
                borderColor: 'rgba(255, 255, 255, 0.1)', 
                color: '#fff',
                textTransform: 'none',
                fontWeight: 800,
                '&:hover': {
                  borderColor: '#fff',
                  bgcolor: 'rgba(255, 255, 255, 0.05)'
                }
              }}
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
              sx={{ 
                borderRadius: '14px', 
                bgcolor: '#EF4444',
                color: '#fff',
                textTransform: 'none',
                fontWeight: 800,
                '&:hover': { bgcolor: '#DC2626' }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

export default function TOTPPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#0A0908' }}>
          <CircularProgress color="primary" />
        </Box>
      }
    >
      <TOTPPageContent />
    </Suspense>
  );
}

