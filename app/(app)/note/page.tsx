"use client";

import { Suspense } from 'react';
import { Box } from '@mui/material';
import { GhostEditor } from '@/components/landing/GhostEditor';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth/AuthContext';

function NoteLandingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  // Redirect signed-in users to the app — unless they are finishing a ghost claim resume.
  useEffect(() => {
    if (searchParams.get('claimOpen') === '1') return;
    if (!isLoading && user) {
      router.push('/note/notes');
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
          <GhostEditor />
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
