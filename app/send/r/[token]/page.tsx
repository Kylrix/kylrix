'use client';

import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { alpha, Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { ArrowLeft, Lock } from 'lucide-react';

import Logo from '@/components/Logo';

const SURFACE = '#161412';
const RIM = '1px solid rgba(255, 255, 255, 0.06)';
const PRIMARY = '#6366F1';

export default function SendRecipientStubPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: 'rgba(255,255,255,0.92)' }}>
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          borderBottom: RIM,
          background: alpha('#0A0908', 0.72),
          backdropFilter: 'blur(16px)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component={NextLink}
            href="/send"
            startIcon={<ArrowLeft size={18} />}
            sx={{
              color: 'rgba(255,255,255,0.65)',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.06) },
            }}
          >
            Send
          </Button>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Logo variant="icon" size={26} />
            <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 600 }}>Receive</Typography>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            bgcolor: SURFACE,
            border: RIM,
            textAlign: 'center',
            boxShadow: `0 24px 80px ${alpha('#000', 0.45)}`,
          }}
        >
          <Stack spacing={2} alignItems="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha(PRIMARY, 0.12),
                border: `1px solid ${alpha(PRIMARY, 0.35)}`,
              }}
            >
              <Lock size={26} color={PRIMARY} />
            </Box>
            <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1.5rem' }}>
              Encrypted send link
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
              This URL will decrypt and render your send-object here. Token{' '}
              <Box component="span" sx={{ fontFamily: 'var(--font-mono)', color: alpha('#fff', 0.75), wordBreak: 'break-all' }}>
                {token || '…'}
              </Box>{' '}
              is recognized; server persistence and crypto unwrap ship in the next milestone.
            </Typography>
            <Button
              component={NextLink}
              href="/send"
              variant="contained"
              sx={{ mt: 1, textTransform: 'none', fontWeight: 700, bgcolor: PRIMARY }}
            >
              Create your own send link
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
