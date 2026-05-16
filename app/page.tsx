'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Backdrop,
  Box,
  Button,
  ButtonBase,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
  useTheme,
  useMediaQuery,
  Zoom,
} from '@mui/material';
import { 
  ArrowUp,
  Layout,
  MessageSquare,
  PenTool,
  Shield,
  Zap,
  Phone,
  Settings,
  ChevronRight,
  Globe,
  Lock,
  Cpu,
  Fingerprint,
} from 'lucide-react';
import Logo from '@/components/common/Logo';
import { getEcosystemUrl } from '@/lib/constants';
import { KylrixApp } from '@/lib/sdk/design';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const theme = useTheme();
  const router = useRouter();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const surfaceShadow = '0 12px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)';

  const openApp = (app: string) => {
    router.push(`/${app}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', overflow: 'hidden' }}>
      {/* Hero Section */}
      <Container maxWidth="xl" sx={{ pt: { xs: 12, md: 20 }, pb: { xs: 8, md: 12 } }}>
        <Grid container spacing={8} alignItems="center">
          <Grid item xs={12} md={7}>
            <Stack spacing={4}>
              <Box>
                <Typography 
                  variant="h1" 
                  sx={{ 
                    fontSize: { xs: '3.5rem', md: '5.5rem' }, 
                    fontWeight: 900, 
                    fontFamily: 'var(--font-clash)',
                    lineHeight: 0.9,
                    letterSpacing: '-0.04em',
                    color: '#fff',
                    mb: 2
                  }}
                >
                  Work Effortlessly.<br />
                  <span style={{ color: '#6366F1' }}>Secured</span> by Design.
                </Typography>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    color: 'rgba(255,255,255,0.5)', 
                    fontFamily: 'var(--font-satoshi)',
                    fontWeight: 500,
                    maxWidth: 600,
                    lineHeight: 1.5
                  }}
                >
                  The unified ecosystem for private notes, tasks, and secure messaging. Built on zero-knowledge architecture.
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button 
                  variant="contained" 
                  size="large"
                  onClick={() => openApp('note')}
                  sx={{ 
                    bgcolor: '#6366F1', 
                    color: '#000',
                    px: 4,
                    py: 2,
                    borderRadius: '16px',
                    fontWeight: 900,
                    fontSize: '1.1rem',
                    textTransform: 'none',
                    '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
                  }}
                >
                  Get Started
                </Button>
                <Button 
                  variant="outlined" 
                  size="large"
                  sx={{ 
                    borderColor: 'rgba(255,255,255,0.1)', 
                    color: '#fff',
                    px: 4,
                    py: 2,
                    borderRadius: '16px',
                    fontWeight: 900,
                    fontSize: '1.1rem',
                    textTransform: 'none',
                    '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }
                  }}
                >
                  View Documentation
                </Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      {/* App Grid Section */}
      <Container maxWidth="xl" sx={{ pb: 12 }}>
        <Grid container spacing={3}>
          {[
            { id: 'note', title: 'Note', desc: 'Secure, markdown-powered personal knowledge base.', icon: <PenTool size={32} />, color: '#EC4899' },
            { id: 'flow', title: 'Flow', desc: 'Context-aware task management and event planning.', icon: <Zap size={32} />, color: '#A855F7' },
            { id: 'connect', title: 'Connect', desc: 'Encrypted messaging and real-time collaboration.', icon: <MessageSquare size={32} />, color: '#F59E0B' },
            { id: 'vault', title: 'Vault', desc: 'Zero-knowledge password and secret management.', icon: <Shield size={32} />, color: '#10B981' },
          ].map((app) => (
            <Grid item xs={12} sm={6} md={3} key={app.id}>
              <Paper
                onClick={() => openApp(app.id)}
                sx={{
                  p: 4,
                  height: '100%',
                  borderRadius: '32px',
                  bgcolor: '#161514',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  boxShadow: 'none',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    borderColor: app.color,
                    boxShadow: `0 20px 40px ${alpha(app.color, 0.1)}`,
                  }
                }}
              >
                <Box sx={{ color: app.color, mb: 3 }}>
                  {app.icon}
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#fff', mb: 1, fontFamily: 'var(--font-clash)' }}>
                  {app.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                  {app.desc}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Footer Section */}
      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 }, pb: 8 }}>
        <Paper
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 2.25,
            bgcolor: '#161514',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: surfaceShadow,
          }}
        >
          <Stack spacing={2}>
            <Typography
              variant="caption"
              sx={{
                color: '#6366F1',
                fontWeight: 900,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Kylrix Ecosystem
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Stack spacing={0.5}>
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.04em' }}>
                    Kylrix. Effortless work, secured by design.
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 540, lineHeight: 1.7 }}>
                    One secure surface for notes, tasks, calls, and autonomous execution.
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
