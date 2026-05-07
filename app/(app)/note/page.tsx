"use client";

import { Box, Typography } from '@mui/material';
import { GhostEditor } from '@/components/landing/GhostEditor';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/context/auth/AuthContext';

export default function NoteLandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Redirect to /notes if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.push('/note/notes');
    }
  }, [user, loading, router]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh',
      color: 'rgba(255, 255, 255, 0.9)',
      backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.05) 0%, transparent 50%)'
    }}>
      <Box component="main" sx={{ flex: 1 }}>
        <GhostEditor />
      </Box>
    </Box>
  );
}
