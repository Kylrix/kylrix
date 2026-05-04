'use client';
import { useColors } from '@/lib/theme-context';

import { useState } from 'react';
import {
  Drawer,
  Button,
  Typography,
  Box,
  CircularProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { account } from '@/lib/appwrite';

interface LogoutDialogProps {
  open: boolean;
  onClose: () => void;
  onLogoutComplete: () => void;
}

export function LogoutDialog({ open, onClose, onLogoutComplete }: LogoutDialogProps) {
  const dynamicColors = useColors();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = async () => {
    setLoading(true);
    setError(null);
    try {
      await account.deleteSession('current');
      onLogoutComplete();
    } catch (err: unknown) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <Drawer 
      anchor={isMobile ? 'bottom' : 'right'}
      open={open} 
      onClose={onClose}
      PaperProps={{
        sx: {
          width: isMobile ? '100%' : 'min(100vw, 500px)',
          maxWidth: '100%',
          height: isMobile ? 'auto' : '100%',
          maxHeight: isMobile ? '92dvh' : '100%',
          backgroundColor: dynamicColors.secondary,
          borderRadius: isMobile ? '24px 24px 0 0' : '0',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
          display: 'flex',
          flexDirection: 'column',
        }
      }}
    >
      <Box sx={{ backgroundColor: dynamicColors.secondary, color: 'white', pb: 1, px: 3, pt: 3, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', fontWeight: 700, fontSize: '1.1rem', flexShrink: 0 }}>Logout</Box>
      <Box sx={{ backgroundColor: dynamicColors.background, color: 'white', pt: 3, px: 3, flex: 1, overflowY: 'auto' }}>
        {error && (
          <Box sx={{ 
            mb: 2, 
            p: 1.5, 
            backgroundColor: 'rgba(255, 68, 68, 0.1)', 
            border: '1px solid rgba(255, 68, 68, 0.3)', 
            borderRadius: '0.5rem',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3)',
          }}>
            <Typography sx={{ fontSize: '0.875rem', color: '#ff8a65' }}>{error}</Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: '0.95rem', color: dynamicColors.foreground }}>
          Are you sure you want to logout? You will need to log in again to access your account.
        </Typography>
      </Box>
      <Box sx={{ backgroundColor: dynamicColors.secondary, p: 2, gap: 1, display: 'flex', borderTop: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0 }}>
        <Button 
          onClick={onClose} 
          disabled={loading} 
          sx={{ 
            color: dynamicColors.foreground,
            borderRadius: '0.5rem',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleLogout}
          disabled={loading}
          variant="contained"
          sx={{
            backgroundColor: '#c91d1d',
            color: 'white',
            borderRadius: '0.5rem',
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
            '&:hover:not(:disabled)': { 
              backgroundColor: '#a01515',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
            },
            '&:disabled': { opacity: 0.6 },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Logout'}
        </Button>
      </Box>
    </Drawer>
  );
}
