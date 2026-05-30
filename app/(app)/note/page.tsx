"use client";

import React, { useEffect, Suspense } from 'react';
import { Box } from '@mui/material';
import { GhostEditor } from '@/components/landing/GhostEditor';
import { LoginDrawerProvider } from '@/context/LoginDrawerContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';

function NoteLandingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  // Redirect immediately to /note/notes (if authenticated) or /send (if unauthenticated)
  useEffect(() => {
    if (searchParams.get('claimOpen') === '1') return;
    if (!isLoading) {
      if (user) {
        router.replace('/note/notes');
      } else {
        router.replace('/send');
      }
    }
  }, [user, isLoading, router, searchParams]);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      color: 'rgba(255, 255, 255, 0.9)',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.05) 0%, transparent 50%)'
    }}>
      <Box component="main" sx={{ flex: 1 }}>
        <Suspense fallback={null}>
          <LoginDrawerProvider>
            <GhostEditor />
          </LoginDrawerProvider>
        </Suspense>
      </Box>
    </Box>
  );
}

export default function NoteLandingPage() {
  return (
    <Suspense fallback={null}>
      <NoteLandingInner />
    </Suspense>
  );
}
