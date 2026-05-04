'use client';

import { useEffect, Suspense, useState } from 'react';
import { account } from '@/lib/appwrite';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSource } from '@/lib/source-context';
import { Box, Button, CircularProgress, Typography, alpha } from '@mui/material';
import { useColors } from '@/lib/theme-context';

function HomeContent() {
  const dynamicColors = useColors();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSource } = useSource();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let hasResolved = false;

    const markReady = () => {
      if (!hasResolved && isMounted) {
        hasResolved = true;
        setIsChecking(false);
      }
    };

    const checkAuth = async () => {
      try {
        const source = searchParams.get('source');
        if (source) {
          setSource(source);
        }

        const userData = await account.get();
        if (userData) {
          if (source) {
            const url = new URL(source.startsWith('http') ? source : `https://${source}`);
            url.searchParams.set('auth', 'success');
            const redirectUrl = url.toString();
            
            markReady();
            window.location.replace(redirectUrl);
            return;
          } else {
            // If logged in and no source, go to settings profile
            router.replace('/accounts/settings/profile');
            return;
          }
        }

        if (!userData) {
          // If not logged in, go to login page
          const loginUrl = source ? `/login?source=${encodeURIComponent(source)}` : '/login';
          window.location.replace(loginUrl);
          return;
        }

      } catch (error: unknown) {
        console.error('IDM auth check failed:', error);
        // If error (usually 401), redirect to login
        const source = searchParams.get('source');
        const loginUrl = source ? `/login?source=${encodeURIComponent(source)}` : '/login';
        window.location.replace(loginUrl);
      } finally {
        markReady();
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams, setSource]);

    if (isChecking) {
    return (
      <Box sx={{ minHeight: '100vh', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
        <Typography sx={{ color: '#FFFFFF' }}>Verifying session...</Typography>
      </Box>
    );
  }

  const source = searchParams.get('source');
  const redirectUrl = source ? (source.startsWith('http') ? source : `https://${source}`) : null;
  const isPopup = typeof window !== 'undefined' && !!window.opener;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 520,
          textAlign: 'center',
          p: 6,
          borderRadius: '1.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}

      >
        <Typography variant="h3" sx={{ color: 'white', mb: 2, fontWeight: 900 }}>
          Authentication finished
        </Typography>
        <Typography sx={{ color: dynamicColors.foreground, mb: 4, opacity: 0.8 }}>
          You can close this window or tab now and return to the application.
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
          {redirectUrl && (
            <Button
              variant="contained"
              fullWidth
              onClick={() => window.location.href = redirectUrl}
              sx={{
                height: 56,
                borderRadius: '0.75rem',
                backgroundColor: dynamicColors.primary,
                color: dynamicColors.secondary,
                fontWeight: 800,
                fontSize: '1rem',
                textTransform: 'none',
                boxShadow: `0 8px 20px ${alpha(dynamicColors.primary, 0.25)}`,
                '&:hover': { backgroundColor: dynamicColors.primary, opacity: 0.9 }
              }}
            >
              Continue to Application
            </Button>
          )}

          {isPopup && (
            <Button
              variant="outlined"
              fullWidth
              onClick={() => window.close()}
              sx={{
                height: 56,
                borderRadius: '0.75rem',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 800,
                fontSize: '1rem',
                textTransform: 'none',
                '&:hover': { borderColor: 'white', backgroundColor: 'rgba(255, 255, 255, 0.05)' }
              }}
            >
              Close Window
            </Button>
          )}
        </Box>

        <Typography sx={{ color: dynamicColors.foreground, fontSize: '0.875rem', opacity: 0.5 }}>
          If things still look stale, refresh the application window you came from as a last resort.
        </Typography>
      </Box>
    </Box>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', backgroundColor: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    }>
      <HomeContent />
    </Suspense>
  );
}
