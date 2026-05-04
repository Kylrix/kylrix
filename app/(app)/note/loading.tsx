'use client';

import React from 'react';
import { Box, Skeleton, Grid, Stack } from '@mui/material';

// Minimal skeleton loading - shows app structure instantly
export default function Loading() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header skeleton */}
      <Box sx={{ h: 64, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', px: 2, gap: 2 }}>
        <Skeleton variant="rectangular" width={32} height={32} sx={{ borderRadius: 2 }} />
        <Skeleton variant="rectangular" width="100%" height={40} sx={{ borderRadius: 3, maxWidth: 448 }} />
        <Skeleton variant="circular" width={40} height={40} />
      </Box>
      
      {/* Main content skeleton */}
      <Box sx={{ display: 'flex' }}>
        {/* Sidebar skeleton - hidden on mobile */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, width: 256, height: 'calc(100vh - 64px)', bgcolor: 'background.paper', borderRight: 1, borderColor: 'divider', p: 2 }}>
          <Stack spacing={1.5}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="rectangular" width="100%" height={40} sx={{ borderRadius: 3 }} />
            ))}
          </Stack>
        </Box>
        
        {/* Content area skeleton */}
        <Box sx={{ flex: 1, p: 3 }}>
          {/* Title skeleton */}
          <Skeleton variant="text" width={192} height={32} sx={{ mb: 3, borderRadius: 1 }} />
          
          {/* Grid skeleton */}
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }} key={i}>
                <Skeleton variant="rectangular" width="100%" height={192} sx={{ borderRadius: 4 }} />
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}
