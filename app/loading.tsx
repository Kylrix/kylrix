'use client';

import React from 'react';
import { Box, CircularProgress, Typography } from '@/lib/mui-tailwind/material';

export default function RootLoading() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        background: '#090807',
        color: '#FFFFFF',
        fontFamily: 'var(--font-outfit), sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 99999,
        padding: 3,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Background glowing ambient light */}
      <Box
        sx={{
          position: 'absolute',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, rgba(236, 72, 153, 0.04) 50%, rgba(0, 0, 0, 0) 100%)',
          filter: 'blur(60px)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          animation: 'pulseGlow 8s ease-in-out infinite alternate',
          '@keyframes pulseGlow': {
            '0%': { opacity: 0.5, transform: 'translate(-50%, -50%) scale(0.95)' },
            '100%': { opacity: 1, transform: 'translate(-50%, -50%) scale(1.05)' },
          },
        }}
      />

      {/* Branded Loading Card */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 48px',
          borderRadius: '24px',
          background: 'rgba(22, 20, 18, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.5)',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Sleek Geometric Loading Ornament */}
        <Box sx={{ position: 'relative', marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Inner Custom Spinner */}
          <CircularProgress
            variant="indeterminate"
            size={72}
            thickness={2.5}
            sx={{
              color: '#6366F1',
              animationDuration: '1.2s',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          {/* Outer Pulsing Branded Ring */}
          <Box
            sx={{
              position: 'absolute',
              width: '92px',
              height: '92px',
              borderRadius: '50%',
              border: '2px solid rgba(236, 72, 153, 0.15)',
              animation: 'ringPulse 1.8s cubic-bezier(0.16, 1, 0.3, 1) infinite',
              '@keyframes ringPulse': {
                '0%': { transform: 'scale(0.8)', opacity: 0.8 },
                '100%': { transform: 'scale(1.2)', opacity: 0 },
              },
            }}
          />
          {/* Logo center point */}
          <Box
            sx={{
              position: 'absolute',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#EC4899',
              boxShadow: '0 0 12px #EC4899',
            }}
          />
        </Box>

        {/* Branded Identity Copy */}
        <Typography
          variant="h6"
          sx={{
            fontSize: '1.25rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            marginBottom: '8px',
            fontFamily: 'var(--font-space-grotesk), sans-serif',
          }}
        >
          Kylrix System
        </Typography>

        <Typography
          variant="body2"
          sx={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.5)',
            letterSpacing: '0.01em',
            fontWeight: 400,
            animation: 'textFade 1.5s ease-in-out infinite alternate',
            '@keyframes textFade': {
              '0%': { opacity: 0.4 },
              '100%': { opacity: 0.8 },
            },
          }}
        >
          Initializing secure workspace...
        </Typography>
      </Box>
    </Box>
  );
}
