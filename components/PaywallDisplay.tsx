'use client';

import React from 'react';
import { Box, Stack, Typography, Button, alpha } from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';
import type { Notes } from '@/types/appwrite';

interface PaywallDisplayProps {
  note: Notes;
  authorName?: string;
  onPayClick?: () => void;
}

const PaywallDisplay: React.FC<PaywallDisplayProps> = ({ note, authorName, onPayClick }) => {
  const metadata = typeof note.metadata === 'string' ? JSON.parse(note.metadata || '{}') : note.metadata;
  const paywall = metadata?.paywall;

  if (!paywall?.enabled) {
    return null;
  }

  const amount = paywall.amount || 0;
  const currency = paywall.currency || 'USD';

  return (
    <Box
      sx={{
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(22, 20, 18, 0.6)',
          zIndex: 1,
          borderRadius: 'inherit',
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          p: 3,
          gap: 2,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            bgcolor: alpha('#EC4899', 0.12),
            border: '1px solid rgba(236,72,153,0.2)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <LockIcon sx={{ color: '#EC4899', fontSize: 32 }} />
        </Box>

        <Stack spacing={1} alignItems="center" textAlign="center">
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)' }}>
            {authorName ? `${authorName} made this note premium` : 'This note is premium'}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
            Pay ${amount} to access this content
          </Typography>
        </Stack>

        <Button
          variant="contained"
          onClick={onPayClick}
          sx={{
            mt: 2,
            bgcolor: '#6366F1',
            color: 'white',
            '&:hover': {
              bgcolor: '#4F46E5',
            },
            px: 3,
            py: 1,
          }}
        >
          Unlock for {currency} {amount}
        </Button>
      </Box>
    </Box>
  );
};

export default PaywallDisplay;
