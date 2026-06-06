'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLastEcosystemRoute } from '@/lib/ecosystem/state-tracker';
import { Box, CircularProgress } from '@/lib/mui-tailwind/material';

/**
 * AUTHORITATIVE RESUME HANDLER
 * 
 * This page is the instant target for authenticated middleware redirects.
 * It reads the client-side state tracker and performs the final jump.
 */
export default function ResumePage() {
  const router = useRouter();

  useEffect(() => {
    const lastState = getLastEcosystemRoute();
    if (lastState && lastState.path) {
      router.replace(lastState.path);
    } else {
      router.replace('/connect/chats'); // Authoritative default for resumed sessions
    }
  }, [router]);

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
      <CircularProgress sx={{ color: '#6366F1' }} />
    </Box>
  );
}
