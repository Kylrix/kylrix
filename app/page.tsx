'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography, alpha } from '@mui/material';
import { useAuth } from '@/context/auth/AuthContext';
import { getLastEcosystemRoute } from '@/lib/ecosystem/state-tracker';
import { Sparkles } from 'lucide-react';

export default function RootLanding() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [init, setInit] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    // Small timeout ensures local storage operations (if any) settle before edge redirect
    const timeoutId = setTimeout(() => {
      if (!isAuthenticated) {
        router.replace('/send');
      } else {
        const lastState = getLastEcosystemRoute();
        if (lastState && lastState.path && !lastState.path.startsWith('/send')) {
          router.replace(lastState.path);
        } else {
          router.replace('/connect/chats'); // Default fallback for authenticated
        }
      }
      setInit(true);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, isLoading, router]);

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
