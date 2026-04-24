'use client';

import React, { useMemo, useState } from 'react';
import {
  alpha,
  Backdrop,
  Box,
  Button,
  ButtonBase,
  Container,
  Divider,
  Fab,
  Grid,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  Zoom,
} from '@mui/material';
import {
  ArrowRight,
  FileText,
  Plus,
  Shield,
  X,
  Zap,
  MessageSquare,
  Wallet,
  Waypoints,
} from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

import Navbar from '@/components/Navbar';
import Logo, { KylrixApp } from '@/components/Logo';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';

const appOrder = ['note', 'vault', 'flow', 'connect'] as const;

const surfaceShadow =
  'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0,0,0,0.8)';

const heroMetrics = [
  { value: 'E2EE', label: 'end-to-end encryption' },
  { value: '100%', label: 'data ownership' },
  { value: '4+', label: 'native surfaces' },
];

const suiteCards = [
  {
    id: 'note',
    title: 'Note',
    copy: 'The encrypted knowledge engine for research, writing, and context you actually own.',
    accent: '#EC4899',
    icon: FileText,
  },
  {
    id: 'vault',
    title: 'Vault',
    copy: 'Unbreakable credential and data storage with a zero-knowledge core.',
    accent: '#10B981',
    icon: Shield,
  },
  {
    id: 'flow',
    title: 'Flow',
    copy: 'Task orchestration and execution that stays reactive across the shared session.',
    accent: '#A855F7',
    icon: Zap,
  },
  {
    id: 'connect',
    title: 'Connect',
    copy: 'Secure private communication for teams that refuse to leak their context.',
    accent: '#F59E0B',
    icon: MessageSquare,
  },
];

const infraPanels = [
  {
    title: 'AI Agents',
    label: 'ORCHESTRATION LAYER',
    copy: 'Embedded AI can see and act across the ecosystem without the privacy trade-off that breaks trust.',
    icon: Zap,
  },
  {
    title: 'Non-custodial financial layer',
    label: 'VALUE MOVEMENT',
    copy: 'Machine-to-machine settlement and payments live inside the same sovereign surface.',
    icon: Wallet,
  },
  {
    title: 'Crypto-exclusive subscriptions',
    label: 'REVENUE MODEL',
    copy: 'The commercial model is built entirely on cryptocurrency: no fiat, no surveillance stack.',
    icon: Waypoints,
  },
];

function openApp(subdomain: string) {
  window.location.assign(getEcosystemUrl(subdomain));
}

function AppSwitcherFab() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const theme = useTheme();

  const items = useMemo(
    () =>
      appOrder
        .map((id) => ECOSYSTEM_APPS.find((app) => app.id === id))
        .filter((app): app is (typeof ECOSYSTEM_APPS)[number] => Boolean(app)),
    [],
  );

  return (
    <Box
      sx={{
        position: 'fixed',
        right: { xs: 16, md: 28 },
        bottom: { xs: 16, md: 28 },
        zIndex: theme.zIndex.appBar + 5,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1.25,
      }}
    >
      <Backdrop open={open} onClick={() => setOpen(false)} sx={{ zIndex: -1, bgcolor: 'rgba(0,0,0,0.4)' }} />

      <Stack spacing={1.25} sx={{ mb: 0.25 }}>
        {items.map((app, index) => (
          <Zoom key={app.id} in={open} style={{ transitionDelay: open ? `${index * 40}ms` : '0ms' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Typography
                variant="caption"
                sx={{
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 999,
                  bgcolor: '#161514',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  boxShadow: surfaceShadow,
                }}
              >
                {app.label}
              </Typography>

              <Fab
                size="medium"
                aria-label={`Open ${app.label}`}
                onClick={() => {
                  setOpen(false);
                  openApp(app.subdomain);
                }}
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: app.color,
                  color: '#000',
                  boxShadow: `0 12px 26px ${alpha(app.color, 0.32)}`,
                  transition: reduceMotion ? 'none' : 'transform 150ms ease-out, box-shadow 150ms ease-out',
                  '&:hover': {
                    bgcolor: app.color,
                    transform: 'translateY(-2px)',
                    boxShadow: `0 16px 30px ${alpha(app.color, 0.42)}`,
                  },
                  '&.Mui-focusVisible': {
                    boxShadow: `0 0 0 1px ${alpha('#fff', 0.5)}, 0 0 0 6px ${alpha(app.color, 0.18)}`,
                  },
                }}
              >
                <Logo app={app.id as KylrixApp} size={28} variant="icon" />
              </Fab>
            </Box>
          </Zoom>
        ))}
      </Stack>

      <Fab
        aria-label="Open ecosystem switcher"
        onClick={() => setOpen((value) => !value)}
        sx={{
          width: 64,
          height: 64,
          borderRadius: '20px',
          bgcolor: open ? '#1F1D1B' : '#6366F1',
          color: open ? '#fff' : '#000',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: open ? 'none' : '0 18px 40px rgba(0,0,0,0.55)',
          transition: reduceMotion ? 'none' : 'transform 150ms ease-out, background-color 150ms ease-out',
          '&:hover': {
            bgcolor: open ? '#1F1D1B' : '#5254E8',
            transform: 'translateY(-2px)',
          },
          '&.Mui-focusVisible': {
            boxShadow: `0 0 0 1px ${alpha('#6366F1', 0.55)}, 0 0 0 6px ${alpha('#6366F1', 0.18)}`,
          },
        }}
      >
        {open ? <X size={24} /> : <Plus size={24} />}
      </Fab>
    </Box>
  );
}

function SuiteCard({ app }: { app: (typeof suiteCards)[number] }) {
  const reduceMotion = useReducedMotion();
  const appMeta = ECOSYSTEM_APPS.find((item) => item.id === app.id)!;

  return (
    <ButtonBase
      onClick={() => openApp(app.id)}
      sx={{
        width: '100%',
        height: '100%',
        textAlign: 'left',
        borderRadius: 6,
        display: 'block',
        '&.Mui-focusVisible .card-shell': {
          boxShadow: `0 0 0 1px ${alpha(app.accent, 0.55)}, 0 0 0 6px ${alpha(app.accent, 0.16)}`,
        },
        '&:hover .card-shell': {
          transform: reduceMotion ? 'none' : 'perspective(1200px) rotateX(2deg) translateY(-4px)',
        },
      }}
    >
      <Paper
        className="card-shell"
        sx={{
          height: '100%',
          p: 3,
          borderRadius: 6,
          bgcolor: '#161514',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: surfaceShadow,
          overflow: 'hidden',
          position: 'relative',
          transition: reduceMotion ? 'none' : 'transform 150ms ease-out, background-color 150ms ease-out',
          '&:hover': {
            bgcolor: '#1F1D1B',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 100%, ${alpha(app.accent, 0.18)}, transparent 48%)`,
            opacity: 0,
            transition: reduceMotion ? 'none' : 'opacity 150ms ease-out',
            pointerEvents: 'none',
          },
          '&:hover::before': {
            opacity: 1,
          },
        }}
      >
        <Stack spacing={3} sx={{ position: 'relative' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Logo app={app.id as KylrixApp} size={44} variant="icon" />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: alpha(app.accent, 0.95),
              }}
            >
              {app.title}
            </Typography>
          </Stack>

          <Box>
            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>
              {app.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
              {app.copy}
            </Typography>
          </Box>

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: alpha(app.accent, 0.95),
              }}
            >
              Open {appMeta.label}
            </Typography>
            <ArrowRight size={16} color={app.accent} />
          </Stack>
        </Stack>
      </Paper>
    </ButtonBase>
  );
}

export default function LandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const initiateEcosystem = () => {
    const accountsUrl = getEcosystemUrl('accounts');
    const targetUrl = `${accountsUrl}/login?source=${encodeURIComponent(window.location.origin)}`;

    if (isMobile) {
      window.location.assign(targetUrl);
      return;
    }

    const width = 560;
    const height = 760;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    window.open(
      targetUrl,
      'KylrixAccounts',
      `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no`,
    );
  };

  return (
    <Box component="main" sx={{ position: 'relative', overflow: 'clip', bgcolor: '#000', color: '#fff', pt: { xs: 10, md: 12 }, pb: { xs: 10, md: 14 } }}>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `
            radial-gradient(circle at 50% 16%, ${alpha('#6366F1', 0.14)} 0, transparent 34%),
            radial-gradient(circle at 50% 58%, ${alpha('#6366F1', 0.14)} 0, transparent 30%),
            linear-gradient(to bottom, rgba(99,102,241,0.08) 0%, transparent 26%)
          `,
        }}
      />
      <Navbar />

      <Container maxWidth="xl" sx={{ position: 'relative' }}>
        <Stack spacing={4} alignItems="center" textAlign="center" sx={{ pt: { xs: 10, md: 14 }, pb: { xs: 8, md: 12 } }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.5,
              px: 1.75,
              py: 1,
              width: 'fit-content',
              borderRadius: 999,
              bgcolor: '#161514',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: surfaceShadow,
            }}
          >
            <Logo app="root" size={24} variant="icon" />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              Sovereign work OS
            </Typography>
          </Box>

          <Box sx={{ maxWidth: 1100 }}>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: '3.2rem', sm: '4.8rem', lg: '6.6rem' },
                lineHeight: 0.92,
                letterSpacing: '-0.07em',
                fontWeight: 900,
                color: '#fff',
                textWrap: 'balance',
                fontFamily: 'var(--font-clash)',
              }}
            >
              The Sovereign Work OS.
            </Typography>

            <Typography
              variant="h6"
              sx={{
                mt: 3,
                mx: 'auto',
                maxWidth: 820,
                color: 'rgba(255,255,255,0.74)',
                lineHeight: 1.85,
                fontWeight: 400,
              }}
            >
              Kylrix gives you end-to-end encrypted notes, tasks, vaults, and communication with absolute data
              ownership. It is the alternative to Notion and Discord that refuses to trade sovereignty for utility.
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              onClick={initiateEcosystem}
              size="large"
              variant="contained"
              endIcon={<ArrowRight size={18} />}
              sx={{
                px: 4,
                py: 1.6,
                borderRadius: 3,
                bgcolor: '#6366F1',
                color: '#fff',
                fontWeight: 800,
                boxShadow: '0 16px 36px rgba(99,102,241,0.25)',
                '&:hover': { bgcolor: '#5254E8' },
              }}
            >
              Initiate Ecosystem
            </Button>

            <Button
              href="/pitch"
              size="large"
              variant="outlined"
              sx={{
                px: 4,
                py: 1.6,
                borderRadius: 3,
                bgcolor: '#161514',
                borderColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                fontWeight: 800,
                boxShadow: surfaceShadow,
                '&:hover': {
                  bgcolor: '#1F1D1B',
                  borderColor: 'rgba(255,255,255,0.2)',
                },
              }}
            >
              Read the Manifesto
            </Button>
          </Stack>

          <Grid container spacing={2.5} sx={{ width: '100%', maxWidth: 980, mt: 2 }}>
            {heroMetrics.map((metric) => (
              <Grid key={metric.label} size={{ xs: 12, sm: 4 }}>
                <Paper
                  sx={{
                    p: 2.5,
                    borderRadius: 3,
                    bgcolor: '#161514',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: surfaceShadow,
                  }}
                >
                  <Typography
                    variant="h4"
                    sx={{
                      color: '#fff',
                      fontWeight: 900,
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                    }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      mt: 1,
                      display: 'block',
                      color: 'rgba(255,255,255,0.55)',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {metric.label}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 4, md: 8 } }}>
        <Grid container spacing={2.5}>
          {suiteCards.map((app) => (
            <Grid key={app.id} size={{ xs: 12, sm: 6, xl: 3 }}>
              <SuiteCard app={app} />
            </Grid>
          ))}
        </Grid>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 } }}>
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Typography
            variant="caption"
            sx={{
              color: '#6366F1',
              fontWeight: 900,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            Sovereign infrastructure
          </Typography>
          <Typography
            variant="h2"
            sx={{
              color: '#fff',
              fontWeight: 900,
              letterSpacing: '-0.05em',
              fontFamily: 'var(--font-clash)',
            }}
          >
            Built for privacy, automation, and crypto-native scale.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          {infraPanels.map((panel) => (
            <Grid key={panel.title} size={{ xs: 12, md: 4 }}>
              <Paper
                sx={{
                  height: '100%',
                  p: 3,
                  borderRadius: 6,
                  bgcolor: '#161514',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: surfaceShadow,
                }}
              >
                <Stack spacing={2.25}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 3,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: '#1F1D1B',
                      color: '#6366F1',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <panel.icon size={22} />
                  </Box>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mb: 1,
                        color: 'rgba(255,255,255,0.5)',
                        fontFamily: 'var(--font-mono)',
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {panel.label}
                    </Typography>
                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>
                      {panel.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.66)', lineHeight: 1.8 }}>
                      {panel.copy}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 } }}>
        <Paper
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 6,
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
              Terminal footer
            </Typography>
            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
            >
              <Typography variant="h4" sx={{ color: '#fff', fontWeight: 900, letterSpacing: '-0.04em' }}>
                Kylrix. A sovereign entity.
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', maxWidth: 540, lineHeight: 1.8 }}>
                Privacy as a power, not a feature. Built to feel like hardware, not a generic SaaS landing page.
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      </Container>

      <AppSwitcherFab />
    </Box>
  );
}
