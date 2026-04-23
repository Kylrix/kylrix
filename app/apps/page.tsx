'use client';

import React, { useMemo, useState } from 'react';
import {
  alpha,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  ButtonBase,
  Container,
  Divider,
  Drawer,
  Grid,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Shield,
  Waypoints,
  Zap,
} from 'lucide-react';

import Navbar from '@/components/Navbar';
import Logo, { KylrixApp } from '@/components/Logo';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';

const desktopOrder = ['note', 'vault', 'flow', 'connect', 'accounts'] as const;
const mobileOrder = ['note', 'vault', 'flow', 'connect'] as const;

export default function AppsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [selected, setSelected] = useState<'note' | 'vault' | 'flow' | 'connect' | 'accounts'>('note');

  const desktopApps = useMemo(
    () =>
      desktopOrder
        .map((id) => ECOSYSTEM_APPS.find((app) => app.id === id))
        .filter((app): app is (typeof ECOSYSTEM_APPS)[number] => Boolean(app)),
    [],
  );

  const mobileApps = useMemo(
    () =>
      mobileOrder
        .map((id) => ECOSYSTEM_APPS.find((app) => app.id === id))
        .filter((app): app is (typeof ECOSYSTEM_APPS)[number] => Boolean(app)),
    [],
  );

  const activeApp = ECOSYSTEM_APPS.find((app) => app.id === selected) || ECOSYSTEM_APPS[0];

  const heroCopy = {
    note: 'Structured knowledge with private links, source-backed context, and no public feed leakage.',
    vault: 'Zero-knowledge secrets storage for passwords, TOTP, and recovery-critical material.',
    flow: 'Tasks and calendar state that resolve the current user first and stay cache-friendly.',
    connect: 'Real-time messages and calls built around read integrity and a live pulse layer.',
    accounts: 'Root of trust, sessions, and passkeys for the entire ecosystem.',
  }[selected];

  return (
    <Box component="main" sx={{ pt: { xs: 10, md: 12 }, pb: { xs: 12, md: 14 } }}>
      <Navbar />

      <Container maxWidth="xl">
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 3 }} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Paper
              sx={{
                position: 'sticky',
                top: 112,
                p: 2,
                borderRadius: 5,
                bgcolor: 'var(--surface)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Stack spacing={1}>
                {desktopApps.map((app) => {
                  const isActive = selected === app.id;
                  return (
                    <ButtonBase
                      key={app.id}
                      onClick={() => setSelected(app.id as typeof selected)}
                      sx={{
                        width: '100%',
                        borderRadius: 3,
                        textAlign: 'left',
                        '&.Mui-focusVisible': {
                          boxShadow: `0 0 0 1px ${alpha(app.color, 0.5)}, 0 0 0 6px ${alpha(app.color, 0.16)}`,
                        },
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{
                          width: '100%',
                          p: 1.5,
                          borderRadius: 3,
                          bgcolor: isActive ? alpha(app.color, 0.08) : 'transparent',
                          border: '1px solid',
                          borderColor: isActive ? alpha(app.color, 0.25) : 'transparent',
                        }}
                      >
                        <Logo app={app.id as KylrixApp} size={34} variant="icon" />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 800 }}>
                            {app.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                            {app.id === 'accounts' ? 'Root of trust' : app.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </ButtonBase>
                  );
                })}
              </Stack>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 9 }}>
            <Stack spacing={3}>
              <Paper
                sx={{
                  p: { xs: 3, md: 4 },
                  borderRadius: 6,
                  bgcolor: 'var(--surface)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at top right, ${alpha(activeApp.color, 0.12)}, transparent 35%)`,
                    pointerEvents: 'none',
                  }}
                />

                <Stack spacing={3} sx={{ position: 'relative' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                    <Box>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: 'rgba(255, 255, 255, 0.5)',
                          fontWeight: 800,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                        }}
                      >
                        Ecosystem showcase
                      </Typography>
                      <Typography variant="h3" sx={{ mt: 1, color: '#fff', fontWeight: 900, letterSpacing: '-0.04em' }}>
                        {activeApp.label}
                      </Typography>
                    </Box>
                    <Logo app={activeApp.id as KylrixApp} size={56} />
                  </Stack>

                  <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.8, maxWidth: 760 }}>
                    {heroCopy}
                  </Typography>

                  <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    {[
                      { icon: Shield, label: 'Private by default' },
                      { icon: Waypoints, label: 'Shared session' },
                      { icon: Zap, label: 'Reactive graph' },
                    ].map((item) => (
                      <Box
                        key={item.label}
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.5,
                          py: 1,
                          borderRadius: 999,
                          bgcolor: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <item.icon size={15} color={activeApp.color} />
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.08em' }}>
                          {item.label}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                </Stack>
              </Paper>

              <Grid container spacing={2.5}>
                {desktopApps.map((app) => (
                  <Grid key={app.id} size={{ xs: 12, sm: 6 }}>
                    <Paper
                      sx={{
                        p: 3,
                        height: '100%',
                        borderRadius: 5,
                        bgcolor: 'var(--surface)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <Stack spacing={2}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                          <Logo app={app.id as KylrixApp} size={42} variant="icon" />
                          <Typography
                            variant="caption"
                            sx={{
                              color: app.color,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: '0.16em',
                            }}
                          >
                            {app.id === 'accounts' ? 'Identity' : 'App'}
                          </Typography>
                        </Stack>
                        <Box>
                          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 800, mb: 1 }}>
                            {app.label}
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.62)', lineHeight: 1.8 }}>
                            {app.description}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.45)' }}>
                          {app.id === 'note' && 'E2EE knowledge surface'}
                          {app.id === 'vault' && 'Secrets and credentials'}
                          {app.id === 'flow' && 'Tasks and workflows'}
                          {app.id === 'connect' && 'Messaging and calls'}
                          {app.id === 'accounts' && 'Sessions and passkeys'}
                        </Typography>
                      </Stack>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Grid>
        </Grid>
      </Container>

      <Drawer
        variant="persistent"
        anchor="bottom"
        open={isMobile}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: {
            display: { xs: 'block', md: 'none' },
            bgcolor: 'var(--surface)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundImage: 'none',
          },
        }}
      >
        <BottomNavigation
          value={selected}
          onChange={(_, value) => setSelected(value)}
          showLabels
          sx={{
            bgcolor: 'transparent',
            height: 74,
            '& .MuiBottomNavigationAction-root': {
              color: 'rgba(255, 255, 255, 0.55)',
              minWidth: 0,
            },
            '& .Mui-selected': {
              color: '#fff',
            },
          }}
        >
          {mobileApps.map((app) => (
            <BottomNavigationAction
              key={app.id}
              value={app.id}
              label={app.label}
              icon={<Logo app={app.id as KylrixApp} size={26} variant="icon" />}
              onClick={() => {
                window.location.assign(getEcosystemUrl(app.subdomain));
              }}
            />
          ))}
        </BottomNavigation>
      </Drawer>

      <Container maxWidth="xl" sx={{ mt: 6 }}>
        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      </Container>
    </Box>
  );
}
