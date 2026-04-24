'use client';

import React, { useMemo, useRef, useState } from 'react';
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
  ArrowUp,
  Github,
  FileText,
  Plus,
  Shield,
  X,
  Zap,
  MessageSquare,
  Wallet,
  Waypoints,
} from 'lucide-react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';

import Navbar from '@/components/Navbar';
import Logo, { KylrixApp } from '@/components/Logo';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';

const appOrder = ['note', 'vault', 'flow', 'connect'] as const;

const surfaceShadow =
  'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4), 0 10px 30px rgba(0,0,0,0.8)';

const heroMetrics = [
  { value: 'Encrypted', label: 'by default' },
  { value: 'Yours', label: 'always' },
  { value: '4 apps', label: 'one system' },
];

const livePanels = [
  {
    id: 'note',
    title: 'Note',
    accent: '#EC4899',
    eyebrow: 'Notes and docs',
    summary: 'Write notes, collect forms, and keep the related context together.',
    rows: [
      { title: 'Write a note', meta: 'Keep it private' },
      { title: 'Collect replies', meta: 'Forms stay linked' },
      { title: 'Share by link', meta: 'Only who you choose' },
    ],
    footer: 'Notes, docs, forms',
    icon: FileText,
  },
  {
    id: 'vault',
    title: 'Vault',
    accent: '#10B981',
    eyebrow: 'Passwords and keys',
    summary: 'Save passwords, TOTP codes, and recovery keys in one locked place.',
    rows: [
      { title: 'Password entry', meta: 'Autofill ready' },
      { title: 'TOTP code', meta: 'Copy in one tap' },
      { title: 'Recovery key', meta: 'Kept offline' },
    ],
    footer: 'Passwords, TOTP, keys',
    icon: Shield,
  },
  {
    id: 'flow',
    title: 'Flow',
    accent: '#A855F7',
    eyebrow: 'Tasks and planning',
    summary: 'Turn a thought into a task, then keep the conversation and follow-up together.',
    rows: [
      { title: 'Make it a task', meta: 'From a note' },
      { title: 'Start a huddle', meta: 'From the task' },
      { title: 'Keep follow-up', meta: 'No context lost' },
    ],
    footer: 'Tasks, meetings, follow-up',
    icon: Zap,
  },
  {
    id: 'connect',
    title: 'Connect',
    accent: '#F59E0B',
    eyebrow: 'Chat and calls',
    summary: 'Message, call, and share context without leaving the app.',
    rows: [
      { title: 'Join a call', meta: 'From a discussion' },
      { title: 'Send a note', meta: 'Into a thread' },
      { title: 'React live', meta: 'Presence stays current' },
    ],
    footer: 'Chat, calls, presence',
    icon: MessageSquare,
  },
];

const integrationCards = [
  {
    id: 'note-to-flow',
    from: 'Note',
    to: 'Flow',
    title: 'Turn a note into a task',
    copy: 'Highlight something in a note, turn it into a task, and keep the original context attached.',
    accent: '#EC4899',
  },
  {
    id: 'flow-to-connect',
    from: 'Flow',
    to: 'Connect',
    title: 'Start a huddle from a task',
    copy: 'Open the discussion right from the task, then jump into the call without losing the thread.',
    accent: '#A855F7',
  },
  {
    id: 'connect-to-note',
    from: 'Connect',
    to: 'Note',
    title: 'Attach notes to a chat or moment',
    copy: 'Drop a note into a thread or a post so the idea stays with the conversation.',
    accent: '#F59E0B',
  },
  {
    id: 'note-to-connect',
    from: 'Note',
    to: 'Connect',
    title: 'Attach a note or task to a moment',
    copy: 'Keep the note, the task, and the chat thread tied to the same post, so nothing gets lost.',
    accent: '#10B981',
  },
];

const infraPanels = [
  {
    title: 'AI Agents',
    label: 'Built into the apps',
    copy: 'AI can help inside the apps without making you move your data somewhere else.',
    icon: Zap,
  },
  {
    title: 'Non-custodial financial layer',
    label: 'Built into the apps',
    copy: 'Payments and settlement can live alongside your work, not outside it.',
    icon: Wallet,
  },
  {
    title: 'Crypto-exclusive subscriptions',
    label: 'Built into the apps',
    copy: 'Pricing and subscriptions can run on crypto instead of card rails.',
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
      <Backdrop
        open={open}
        onClick={() => setOpen(false)}
        sx={{
          zIndex: -1,
          bgcolor: 'rgba(0,0,0,0.32)',
          backdropFilter: 'blur(6px) saturate(140%)',
          transition: 'opacity 180ms ease',
        }}
      />

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
                  bgcolor: 'rgba(22,20,18,0.92)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontWeight: 800,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  boxShadow: surfaceShadow,
                  backdropFilter: 'blur(10px)',
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
        <Zoom in={open} style={{ transitionDelay: open ? `${items.length * 40}ms` : '0ms' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Typography
              variant="caption"
              sx={{
                px: 1.25,
                py: 0.75,
                borderRadius: 999,
                bgcolor: 'rgba(22,20,18,0.92)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                boxShadow: surfaceShadow,
                backdropFilter: 'blur(10px)',
              }}
            >
              Back to top
            </Typography>

            <Fab
              size="medium"
              aria-label="Scroll back to top"
              onClick={() => {
                setOpen(false);
                window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
              }}
              sx={{
                width: 52,
                height: 52,
                bgcolor: '#1F1D1B',
                color: '#fff',
                boxShadow: `0 12px 26px rgba(0,0,0,0.35)`,
                border: '1px solid rgba(255,255,255,0.08)',
                transition: reduceMotion ? 'none' : 'transform 150ms ease-out, box-shadow 150ms ease-out',
                '&:hover': {
                  bgcolor: '#1F1D1B',
                  transform: 'translateY(-2px)',
                  boxShadow: `0 16px 30px rgba(0,0,0,0.45)`,
                },
                '&.Mui-focusVisible': {
                  boxShadow: `0 0 0 1px ${alpha('#fff', 0.5)}, 0 0 0 6px ${alpha('#6366F1', 0.18)}`,
                },
              }}
            >
              <ArrowUp size={22} />
            </Fab>
          </Box>
        </Zoom>
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

function LiveSurfaceCard({
  panel,
  index,
  scrollYProgress,
}: {
  panel: (typeof livePanels)[number];
  index: number;
  scrollYProgress: MotionValue<number>;
}) {
  const reduceMotion = useReducedMotion();
  const appMeta = ECOSYSTEM_APPS.find((item) => item.id === panel.id)!;
  const y = useTransform(scrollYProgress, [0, 1], [index * 28, -index * 34]);
  const rotate = useTransform(scrollYProgress, [0, 1], [index % 2 === 0 ? -1.4 : 1.4, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.98]);

  return (
    <ButtonBase
      onClick={() => openApp(panel.id)}
      sx={{
        width: '100%',
        height: '100%',
        textAlign: 'left',
        borderRadius: 2.25,
        display: 'block',
        '&.Mui-focusVisible .surface-shell': {
          boxShadow: `0 0 0 1px ${alpha(panel.accent, 0.55)}, 0 0 0 6px ${alpha(panel.accent, 0.16)}`,
        },
        '&:hover .surface-shell': {
          boxShadow: `${surfaceShadow}, 0 18px 36px ${alpha(panel.accent, 0.08)}`,
        },
      }}
    >
      <Paper
        className="surface-shell"
        component={motion.div}
        style={{ y, rotate, scale }}
        sx={{
          height: '100%',
          minHeight: 248,
          p: 2.25,
          borderRadius: 2.25,
          bgcolor: '#161514',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: surfaceShadow,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          transition: reduceMotion ? 'none' : 'transform 150ms ease-out, background-color 150ms ease-out',
          '&:hover': {
            bgcolor: '#1F1D1B',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 18% 0%, ${alpha(panel.accent, 0.18)}, transparent 46%)`,
            opacity: 0,
            transition: reduceMotion ? 'none' : 'opacity 150ms ease-out',
            pointerEvents: 'none',
          },
          '&:hover::before': {
            opacity: 1,
          },
        }}
      >
        <Stack spacing={2} sx={{ position: 'relative', height: '100%' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              pb: 1.5,
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: '#1F1D1B',
                  border: `1px solid ${alpha(panel.accent, 0.28)}`,
                  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 24px ${alpha(panel.accent, 0.12)}`,
                  flexShrink: 0,
                }}
              >
                <Logo app={panel.id as KylrixApp} size={24} variant="icon" />
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontWeight: 800,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: alpha(panel.accent, 0.95),
                  }}
                >
                  {panel.eyebrow}
                </Typography>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, lineHeight: 1.05 }}>
                  {appMeta.label}
                </Typography>
              </Box>
            </Stack>
            <ArrowRight size={16} color={panel.accent} />
          </Box>

          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 1.75,
            }}
          >
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)', lineHeight: 1.75, maxWidth: 300 }}>
              {panel.summary}
            </Typography>

            <Stack spacing={1}>
              {panel.rows.map((row) => (
                <Box
                  key={row.title}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    px: 1.5,
                    py: 1.1,
                    borderRadius: 1.5,
                    bgcolor: '#1F1D1B',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700, lineHeight: 1.3 }}>
                    {row.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: alpha(panel.accent, 0.9), fontWeight: 800 }}>
                    {row.meta}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                pt: 1,
                borderTop: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: alpha(panel.accent, 0.95),
                }}
              >
                {panel.footer}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                Open {appMeta.label}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Paper>
    </ButtonBase>
  );
}

export default function LandingPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: showcaseRef,
    offset: ['start end', 'end start'],
  });
  const showcaseGlowY = useTransform(scrollYProgress, [0, 1], [0, -90]);

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
              The open-source, E2EE Notion/Discord alternative. Notes, voice huddles, forms, and a secure vault—
              deeply integrated so your tools finally talk to each other, without giving up ownership.
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
                borderRadius: 2.25,
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
              href="https://github.com/kylrix"
              size="large"
              variant="outlined"
              startIcon={<Github size={18} />}
              sx={{
                px: 4,
                py: 1.6,
                borderRadius: 2.25,
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
              Our GitHub
            </Button>
          </Stack>

          <Grid container spacing={2.5} sx={{ width: '100%', maxWidth: 980, mt: 2 }}>
            {heroMetrics.map((metric) => (
              <Grid key={metric.label} size={{ xs: 12, sm: 4 }}>
                <Paper
                  sx={{
                    p: 2.5,
                    borderRadius: 2.25,
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

      <Container maxWidth="xl" sx={{ mt: { xs: 8, md: 12 } }}>
        <Box
          ref={showcaseRef}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 2.25,
            border: '1px solid rgba(255,255,255,0.08)',
            bgcolor: '#0A0908',
            boxShadow: surfaceShadow,
            p: { xs: 2.5, md: 4 },
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: `
                radial-gradient(circle at 10% 15%, ${alpha('#EC4899', 0.14)}, transparent 26%),
                radial-gradient(circle at 95% 10%, ${alpha('#10B981', 0.13)}, transparent 24%),
                radial-gradient(circle at 85% 90%, ${alpha('#A855F7', 0.12)}, transparent 24%),
                radial-gradient(circle at 5% 90%, ${alpha('#F59E0B', 0.12)}, transparent 24%)
              `,
              pointerEvents: 'none',
            }}
          />
          <Box
            component={motion.div}
            style={{ y: showcaseGlowY }}
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: -140,
              width: '82%',
              height: 300,
              marginLeft: '-41%',
              background: `radial-gradient(circle, ${alpha('#6366F1', 0.16)} 0%, transparent 68%)`,
              pointerEvents: 'none',
            }}
          />

          <Grid container spacing={4} sx={{ position: 'relative' }} alignItems="start">
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={2} sx={{ position: { xs: 'relative', md: 'sticky' }, top: { md: 118 } }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#6366F1',
                    fontWeight: 900,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                  }}
                >
                  What the apps do
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    color: '#fff',
                    fontWeight: 900,
                    letterSpacing: '-0.06em',
                    fontFamily: 'var(--font-clash)',
                    textWrap: 'balance',
                  }}
                >
                  See the real app screens.
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.85, maxWidth: 460 }}>
                  These are the four apps people will actually use. Each panel shows the real icon and the exact job
                  that app does.
                </Typography>
                <Box
                  sx={{
                    mt: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    width: 'fit-content',
                    borderRadius: 999,
                    bgcolor: '#161514',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: surfaceShadow,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                    Drag, scroll, hover
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={2.25}>
                {livePanels.map((panel, index) => (
                  <LiveSurfaceCard
                    key={panel.id}
                    panel={panel}
                    index={index}
                    scrollYProgress={scrollYProgress}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Box>
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
            Everything connects
          </Typography>
          <Typography
            variant="h2"
            sx={{
              color: '#fff',
              fontWeight: 900,
              letterSpacing: '-0.05em',
              fontFamily: 'var(--font-clash)',
              textWrap: 'balance',
            }}
          >
            Notes, tasks, calls, and posts work together.
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.85, maxWidth: 720 }}>
            Kylrix is not four separate apps. It is one system, so the things you make in one place can show up where
            you need them next.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          {integrationCards.map((item) => (
            <Grid key={item.id} size={{ xs: 12, md: 6 }}>
              <Paper
                sx={{
                  p: 2.5,
                  borderRadius: 2.25,
                  bgcolor: '#161514',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: surfaceShadow,
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(item.accent, 0.12),
                          border: `1px solid ${alpha(item.accent, 0.25)}`,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: item.accent, fontWeight: 900 }}>
                          {item.from[0]}
                        </Typography>
                      </Box>
                      <ArrowRight size={16} color={item.accent} />
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: alpha(item.accent, 0.12),
                          border: `1px solid ${alpha(item.accent, 0.25)}`,
                        }}
                      >
                        <Typography variant="caption" sx={{ color: item.accent, fontWeight: 900 }}>
                          {item.to[0]}
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="caption" sx={{ color: alpha(item.accent, 0.95), fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                      {item.from} to {item.to}
                    </Typography>
                  </Stack>
                  <Box>
                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.8 }}>
                      {item.copy}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
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
            Built into the apps
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
            AI, payments, and subscriptions sit inside the product.
          </Typography>
        </Stack>

        <Grid container spacing={2.5}>
          {infraPanels.map((panel) => (
            <Grid key={panel.title} size={{ xs: 12, md: 4 }}>
              <Paper
                sx={{
                  height: '100%',
                  p: 2.5,
                  borderRadius: 2.25,
                  bgcolor: '#161514',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: surfaceShadow,
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(180deg, ${alpha('#1F1D1B', 0.45)}, transparent 45%)`,
                    pointerEvents: 'none',
                  },
                }}
              >
                <Stack spacing={2.25} sx={{ position: 'relative' }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'rgba(255,255,255,0.5)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {panel.label}
                  </Typography>
                  <Stack direction="row" alignItems="flex-start" spacing={1.75}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: '#1F1D1B',
                        color: '#6366F1',
                        border: '1px solid rgba(255,255,255,0.08)',
                        flexShrink: 0,
                      }}
                    >
                      <panel.icon size={22} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, mb: 1 }}>
                        {panel.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.8 }}>
                        {panel.copy}
                      </Typography>
                    </Box>
                  </Stack>
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
