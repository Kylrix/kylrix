'use client';

import React from 'react';
import { Box, Typography, LinearProgress, Paper } from '@mui/material';
import Image from 'next/image';

interface InitialLoadingScreenProps {
  show?: boolean;
}

export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({
  show = true
}) => {
  if (!show) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(10, 10, 10, 1)',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          bgcolor: 'rgba(20, 20, 20, 0.8)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          p: 6,
          borderRadius: '32px',
          maxWidth: 320,
          width: '100%',
          mx: 2,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <Box
          sx={{
            width: 96,
            height: 96,
            bgcolor: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <Image
            src="/logo/kylrixnote.png"
            alt="WhisperNote logo"
            width={72}
            height={72}
            style={{ opacity: 0.8 }}
          />
        </Box>

        <Typography
          variant="caption"
          sx={{
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.4em',
            color: '#6366F1',
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '0.7rem',
            opacity: 0.8
          }}
        >
          Initializing
        </Typography>

        <Box sx={{ width: '100%', px: 4 }}>
          <LinearProgress 
            sx={{ 
              height: 2, 
              borderRadius: 1,
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#6366F1',
                borderRadius: 1,
                boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)'
              }
            }} 
          />
        </Box>
      </Paper>
    </Box>
  );
};
