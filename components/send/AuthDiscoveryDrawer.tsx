'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Drawer, Typography, Stack, alpha, useTheme, useMediaQuery } from '@mui/material';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';

const PRIMARY = '#6366F1';

function getPathTitle(path: string): string {
  if (path.startsWith('/projects')) return 'Projects';
  if (path.startsWith('/note')) return 'Note';
  if (path.startsWith('/flow')) return 'Flow';
  if (path.startsWith('/vault')) return 'Vault';
  if (path.startsWith('/connect')) return 'Connect';
  if (path.startsWith('/accounts')) return 'Accounts';
  if (path.startsWith('/settings')) return 'Settings';
  if (path.startsWith('/agents')) return 'Agents';
  return 'your dashboard';
}

export function AuthDiscoveryDrawer() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  
  const [open, setOpen] = useState(false);
  const [targetPath, setTargetPath] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const source = sessionStorage.getItem('kylrix_send_redirect_source');
      if (source) {
        setTargetPath(source);
        setOpen(true);
      }
    }
  }, [isLoading, isAuthenticated]);

  const handleReturn = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    sessionStorage.removeItem('kylrix_send_redirect_source');
    setOpen(false);
    if (targetPath) {
      router.push(targetPath);
    }
  }, [targetPath, router]);

  useEffect(() => {
    if (open && countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (open && countdown === 0) {
      handleReturn();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, countdown, handleReturn]);

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    sessionStorage.removeItem('kylrix_send_redirect_source');
    setOpen(false);
  };

  if (!open || !targetPath) return null;

  return (
    <Drawer
      anchor={isDesktop ? 'right' : 'bottom'}
      open={open}
      variant="persistent"
      PaperProps={{
        sx: {
          bgcolor: 'transparent',
          boxShadow: 'none',
          pointerEvents: 'none',
          pb: { xs: 2, sm: 4 },
          px: { xs: 2, sm: 4 },
          pt: { xs: 0, md: 4 },
          display: 'flex',
          alignItems: isDesktop ? 'flex-end' : 'center',
          justifyContent: isDesktop ? 'flex-end' : 'center',
        }
      }}
    >
      <Box
        sx={{
          bgcolor: '#161412',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          borderRadius: '24px',
          p: { xs: 2.5, sm: 3 },
          pointerEvents: 'auto',
          maxWidth: 500,
          width: '100%',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            height: '3px', 
            bgcolor: PRIMARY, 
            width: `${(countdown / 5) * 100}%`,
            transition: 'width 1s linear'
          }} 
        />
        
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Box sx={{ 
                p: 1.5, 
                borderRadius: '12px', 
                bgcolor: alpha(PRIMARY, 0.1), 
                color: PRIMARY 
            }}>
              <Sparkles size={24} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-clash)', color: '#fff' }}>
                Authenticated account detected
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', mt: 0.5 }}>
                Returning to {getPathTitle(targetPath)} in {countdown}...
              </Typography>
            </Box>
          </Box>
          
          <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <Button
              onClick={handleCancel}
              sx={{
                minWidth: 0,
                px: 2,
                color: 'rgba(255,255,255,0.5)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', color: '#fff' }
              }}
            >
              <X size={18} />
            </Button>
            <Button
              variant="contained"
              onClick={handleReturn}
              endIcon={<ArrowRight size={16} />}
              sx={{
                flex: { xs: 1, sm: 'none' },
                bgcolor: PRIMARY,
                color: '#000',
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '12px',
                px: 3,
                '&:hover': { bgcolor: alpha(PRIMARY, 0.8) }
              }}
            >
              Go Now
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Drawer>
  );
}
