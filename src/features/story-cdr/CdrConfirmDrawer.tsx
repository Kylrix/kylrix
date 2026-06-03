'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  IconButton,
  Drawer,
  useTheme,
  useMediaQuery,
} from '@/lib/mui-tailwind/material';
import { Shield, X } from 'lucide-react';
import { account, invalidateCurrentUserCache } from '@/lib/appwrite';
import { toast } from 'react-hot-toast';

interface CdrConfirmDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CdrConfirmDrawer({ open, onClose, onSuccess }: CdrConfirmDrawerProps) {
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const currentPrefs = await account.getPrefs();
      await account.updatePrefs({ ...currentPrefs, cdr_enabled: true });
      invalidateCurrentUserCache();
      toast.success('Confidential Data Rails activated successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[Story-CDR] Activation failed:', err);
      toast.error(err.message || 'Failed to activate Confidential Data Rails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: false, disablePortal: true }}
      PaperProps={{
        sx: {
          bgcolor: '#000000',
          borderLeft: isDesktop ? '1px solid #1f1f1f' : 'none',
          borderTop: !isDesktop ? '1px solid #1f1f1f' : 'none',
          borderRadius: !isDesktop ? '32px 32px 0 0' : '0',
          height: isDesktop ? '100%' : 'auto',
          maxHeight: isDesktop ? '100%' : '90dvh',
          maxWidth: 480,
          width: '100%',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ p: { xs: 3, md: 4 }, color: '#fff', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <Box>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                <Shield size={24} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1.2 }}>
                Story CDR Beta
              </Typography>
            </Stack>
            <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff' } }}>
              <X size={20} />
            </IconButton>
          </Stack>

          {/* Body */}
          <Box sx={{ mb: 4 }}>
            <Typography sx={{ color: '#ffffff', fontWeight: 900, fontSize: '1.25rem', mb: 2, fontFamily: 'var(--font-mono)', tracking: '-0.02em', lineHeight: 1.3 }}>
              Activate Sovereign On-Chain Data Rails?
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: 1.6, fontFamily: 'var(--font-sans)' }}>
              This routes your sensitive data credentials and TOTP seeds through hardware-isolated TEE enclaves on the Story Aeneid Testnet. Access permissions are regulated strictly via decentralized smart contracts tied to your internal EVM wallet identity.
            </Typography>
          </Box>

          {/* Additional info badge */}
          <Box sx={{ p: 2.5, bgcolor: '#161412', border: '1px solid #1f1f1f', borderRadius: '16px', mb: 4 }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block', fontFamily: 'var(--font-mono)' }}>
              Aeneid Testnet Deployment
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', lineHeight: 1.4 }}>
              Vault operations will intercept standard flows and securely upload data rails using threshold cryptography and the pre-deployed OwnerWriteCondition.
            </Typography>
          </Box>
        </Box>

        {/* Footer Actions */}
        <Stack spacing={2} sx={{ mt: 'auto' }}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleConfirm}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{
              py: 2,
              borderRadius: '16px',
              fontWeight: 900,
              textTransform: 'none',
              fontSize: '0.95rem',
              bgcolor: '#6366F1',
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              '&:hover': { bgcolor: '#5458E8', transform: 'translateY(-1px)' },
              '&:disabled': { bgcolor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' },
              transition: 'all 0.2s ease-in-out',
              boxShadow: 'none',
            }}
          >
            {loading ? 'Activating...' : 'Activate Data Rails'}
          </Button>

          <Button
            fullWidth
            variant="text"
            onClick={onClose}
            disabled={loading}
            sx={{
              py: 1.5,
              borderRadius: '12px',
              fontWeight: 800,
              textTransform: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-mono)',
              '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' },
            }}
          >
            Cancel
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
