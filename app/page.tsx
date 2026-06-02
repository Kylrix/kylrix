'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography, alpha, Button } from '@/lib/mui-tailwind/material';
import { useAuth } from '@/context/auth/AuthContext';
import { getLastEcosystemRoute } from '@/lib/ecosystem/state-tracker';
import { getKylrixPulse } from '@/lib/appwrite';
import { Sparkles, ArrowRight } from 'lucide-react';

export default function RootLanding() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [init, setInit] = useState(false);
  const [stayActive, setStayActive] = useState(false);

  useEffect(() => {
    // Check if stay parameter is specified to skip landing redirects
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('stay')) {
      setStayActive(true);
      setInit(true);
      return;
    }

    // AGGRESSIVE OPTIMIZATION FAST-PATH:
    // Avoid blocking on slow AuthContext iframe/network checks if we can determine state synchronously.
    const pulse = getKylrixPulse();
    const hasCachedUser = typeof window !== 'undefined' && !!localStorage.getItem('kylrix_flow_current_user_v2');
    const isMaybeAuthenticated = !!pulse || hasCachedUser;

    const performRedirect = () => {
      if (!isMaybeAuthenticated) {
        router.replace('/send');
      } else {
        const lastState = getLastEcosystemRoute();
        if (lastState && lastState.path && !lastState.path.startsWith('/send') && lastState.path !== '/') {
          router.replace(lastState.path);
        } else {
          router.replace('/connect/chats'); // Default fallback for authenticated
        }
      }
      setInit(true);
    };

    // Use a zero timeout to ensure Next.js router is ready and mounting is complete
    const timeoutId = setTimeout(performRedirect, 0);

    return () => clearTimeout(timeoutId);
  }, [router]);

  // Stay fallback UI
  if (stayActive) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0A0908',
          color: '#fff',
          p: 3,
          textAlign: 'center'
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '24px',
            bgcolor: alpha('#F59E0B', 0.1),
            color: '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 4,
            border: '1px solid rgba(245, 158, 11, 0.2)',
            boxShadow: '0 0 40px rgba(245, 158, 11, 0.05)'
          }}
        >
          <Sparkles size={40} />
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff', mb: 1, letterSpacing: '-0.02em' }}>
          Kylrix Sandbox
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, mb: 4, maxWidth: 320 }}>
          Landing page bypass suspended. Stay-mode is active.
        </Typography>
        <Button
          variant="outlined"
          onClick={() => {
            if (isAuthenticated) {
              const lastState = getLastEcosystemRoute();
              router.push(lastState?.path || '/connect/chats');
            } else {
              router.push('/send');
            }
          }}
          endIcon={<ArrowRight size={16} />}
          sx={{
            borderRadius: '14px',
            borderColor: 'rgba(255,255,255,0.1)',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 800,
            px: 4,
            py: 1.5,
            fontSize: '0.9rem',
            '&:hover': {
              borderColor: '#fff',
              bgcolor: 'rgba(255,255,255,0.05)'
            }
          }}
        >
          Enter Sandbox
        </Button>
      </Box>
    );
  }

  // Fallback UI while authenticating or immediately redirecting
  if (!init) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0A0908',
          color: '#fff',
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: alpha('#6366F1', 0.1),
            color: '#6366F1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 3,
          }}
        >
          <Sparkles size={32} />
        </Box>
        <CircularProgress size={24} sx={{ color: '#6366F1', mb: 2 }} />
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 800 }}>
          Resuming Session...
        </Typography>
      </Box>
    );
  }

  return null;
}
