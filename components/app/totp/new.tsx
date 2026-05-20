"use client";

import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  Typography, 
  FormControlLabel, 
  Checkbox,
  Grid,
  CircularProgress
} from '@mui/material';
import { createTotpSecret, updateTotpSecret } from '@/lib/appwrite';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function NewTotpDialog({
  open,
  onClose,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  initialData?: {
    $id?: string;
    issuer?: string | null;
    accountName?: string | null;
    secretKey?: string;
    period?: number | null;
    digits?: number | null;
    algorithm?: string | null;
    folderId?: string | null;
  };
}) {
  const { user } = useAppwriteVault();
  const [form, setForm] = useState({
    issuer: "",
    accountName: "",
    secretKey: "",
    folderId: "",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        issuer: initialData.issuer || "",
        accountName: initialData.accountName || "",
        secretKey: initialData.secretKey || "",
        folderId: initialData.folderId || "",
        algorithm: initialData.algorithm || "SHA1",
        digits: initialData.digits || 6,
        period: initialData.period || 30,
      });
    } else {
      setForm({
        issuer: "",
        accountName: "",
        secretKey: "",
        folderId: "",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
      });
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!user) throw new Error("Not authenticated");
      if (initialData && initialData.$id) {
        await updateTotpSecret(initialData.$id, {
          ...form,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Smart Code updated!");
      } else {
        await createTotpSecret({
          userId: user.$id,
          ...form,
          url: null,
          tags: null,
          isFavorite: false,
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        toast.success("Smart Code added!");
      }
      onClose();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(
        err.message || `Failed to ${initialData ? "update" : "add"} Smart Code.`,
      );
    }
    setLoading(false);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      PaperProps={{
        sx: {
          borderRadius: '28px',
          bgcolor: '#161412',
          border: '1px solid #1C1A18',
          backgroundImage: 'none',
          maxWidth: '450px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ 
          fontWeight: 900, 
          fontFamily: 'var(--font-clash)', 
          pt: 4, 
          px: 4,
          fontSize: '1.5rem',
          letterSpacing: '-0.02em',
          color: '#fff'
        }}>
          {initialData ? "Edit" : "Add"} Smart Code
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 2, px: 4 }}>
          <TextField
            fullWidth
            label="Issuer"
            placeholder="e.g. Google, GitHub"
            value={form.issuer}
            onChange={(e) => setForm({ ...form, issuer: e.target.value })}
            required
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                bgcolor: '#0A0908',
                '& fieldset': { borderColor: '#1C1A18' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#10B981' }
              },
              '& .MuiInputLabel-root': { color: '#9B9691' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#10B981' }
            }}
          />
          <TextField
            fullWidth
            label="Account Name"
            placeholder="e.g. user@example.com"
            value={form.accountName}
            onChange={(e) => setForm({ ...form, accountName: e.target.value })}
            required
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                bgcolor: '#0A0908',
                '& fieldset': { borderColor: '#1C1A18' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#10B981' }
              },
              '& .MuiInputLabel-root': { color: '#9B9691' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#10B981' }
            }}
          />
          <TextField
            fullWidth
            label="Secure Key"
            placeholder="Enter the secure key"
            value={form.secretKey}
            onChange={(e) => setForm({ ...form, secretKey: e.target.value })}
            required
            variant="outlined"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '16px',
                bgcolor: '#0A0908',
                '& fieldset': { borderColor: '#1C1A18' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused fieldset': { borderColor: '#10B981' }
              },
              '& .MuiInputLabel-root': { color: '#9B9691' },
              '& .MuiInputLabel-root.Mui-focused': { color: '#10B981' }
            }}
          />
          
          <FormControlLabel
            control={
              <Checkbox 
                checked={showAdvanced} 
                onChange={(e) => setShowAdvanced(e.target.checked)}
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.2)', 
                  '&.Mui-checked': { color: '#10B981' } 
                }}
              />
            }
            label={<Typography variant="body2" sx={{ fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)' }}>Advanced Settings</Typography>}
          />

          {showAdvanced && (
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Digits"
                  type="number"
                  value={form.digits}
                  disabled
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: '#0A0908',
                      '& fieldset': { borderColor: '#1C1A18' },
                    }
                  }}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Period (s)"
                  type="number"
                  value={form.period}
                  disabled
                  variant="outlined"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '12px',
                      bgcolor: '#0A0908',
                      '& fieldset': { borderColor: '#1C1A18' },
                    }
                  }}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 4, gap: 2 }}>
          <Button 
            fullWidth 
            variant="text" 
            onClick={onClose}
            sx={{ 
              borderRadius: '16px', 
              py: 1.5, 
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'none',
              fontWeight: 800,
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            Cancel
          </Button>
          <Button 
            fullWidth 
            type="submit" 
            variant="contained" 
            disabled={loading}
            sx={{ 
              borderRadius: '16px', 
              py: 1.5, 
              fontWeight: 800,
              bgcolor: '#10B981',
              color: '#000',
              textTransform: 'none',
              '&:hover': { bgcolor: '#059669' },
              '&.Mui-disabled': { bgcolor: 'rgba(16, 185, 129, 0.3)' }
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : (initialData ? "Save Changes" : "Add Smart Code")}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
