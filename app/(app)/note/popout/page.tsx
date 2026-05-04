"use client";

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Typography, Stack, CircularProgress } from '@mui/material';

function PopoutContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<any>(null);

  useEffect(() => {
    const rawState = searchParams?.get('state');
    if (rawState) {
      try {
        const decoded = JSON.parse(atob(rawState));
        setState(decoded);
        document.title = `${decoded.title} - Kylrix Ecosystem`;
      } catch (e: any) {
        console.error('Failed to parse popout state', e);
      }
    }
  }, [searchParams]);

  if (!state) {
    return (
      <Box sx={{ 
        height: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        bgcolor: '#000',
        color: '#fff' 
      }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={24} sx={{ color: '#00F0FF' }} />
          <Typography variant="caption" sx={{ opacity: 0.5, letterSpacing: '0.1em' }}>
            INITIALIZING SECURE SESSION...
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', width: '100vw', bgcolor: '#000', overflow: 'hidden' }}>
      <iframe
        src={state.url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title={state.title}
      />
    </Box>
  );
}

export default function PopoutPage() {
  return (
    <Suspense fallback={null}>
      <PopoutContent />
    </Suspense>
  );
}
