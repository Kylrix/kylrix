'use client';

import React from 'react';
import { Box, Skeleton, Grid } from '@mui/material';

export const NoteCardSkeleton: React.FC = () => {
  return (
    <Box 
      sx={{ 
        bgcolor: 'rgba(10, 10, 10, 0.8)', 
        borderRadius: '20px', 
        p: 2, 
        border: '1px solid rgba(255, 255, 255, 0.05)',
        height: { xs: 160, sm: 180, md: 200, lg: 220 },
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Title skeleton */}
      <Skeleton 
        variant="text" 
        width="75%" 
        height={24} 
        sx={{ 
          mb: 1.5, 
          borderRadius: '8px',
          bgcolor: 'rgba(255, 255, 255, 0.05)'
        }} 
      />
      
      {/* Content skeleton - 3 lines */}
      <Box sx={{ mb: 1.5, flex: 1 }}>
        <Skeleton variant="text" width="100%" height={16} sx={{ mb: 0.5, borderRadius: '4px', bgcolor: 'rgba(255, 255, 255, 0.03)' }} />
        <Skeleton variant="text" width="85%" height={16} sx={{ mb: 0.5, borderRadius: '4px', bgcolor: 'rgba(255, 255, 255, 0.03)' }} />
        <Skeleton variant="text" width="65%" height={16} sx={{ borderRadius: '4px', bgcolor: 'rgba(255, 255, 255, 0.03)' }} />
      </Box>
      
      {/* Tags skeleton */}
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
        <Skeleton variant="rectangular" width={50} height={16} sx={{ borderRadius: '6px', bgcolor: 'rgba(255, 255, 255, 0.03)' }} />
        <Skeleton variant="rectangular" width={40} height={16} sx={{ borderRadius: '6px', bgcolor: 'rgba(255, 255, 255, 0.03)' }} />
      </Box>
      
      {/* Date skeleton */}
      <Skeleton variant="text" width={80} height={14} sx={{ borderRadius: '4px', bgcolor: 'rgba(255, 255, 255, 0.02)' }} />
    </Box>
  );
};

interface NoteGridSkeletonProps {
  count?: number;
}

export const NoteGridSkeleton: React.FC<NoteGridSkeletonProps> = ({ count = 12 }) => {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: count }).map((_, index) => (
        <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <NoteCardSkeleton />
        </Grid>
      ))}
    </Grid>
  );
};

export default NoteCardSkeleton;
