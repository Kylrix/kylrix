'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Box,
  Button,
  Container,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Fingerprint,
  MessageSquare,
  PhoneCall,
  Shield,
  Sparkles,
  Wallet,
  Waypoints,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import type { KylrixApp } from '@/components/Logo';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  copy: string;
  bullets: string[];
  accent: string;
  scene: React.ReactNode;
};

function Frame({
  accent,
  title,
  subtitle,
  kind = 'desktop',
  children,
}: {
  accent: string;
  title: string;
  subtitle: string;
  kind?: 'desktop' | 'phone';
  children: React.ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        overflow: 'hidden',
        bgcolor: '#161514',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: kind === 'phone' ? 5 : 6,
        boxShadow: '0 24px 60px rgba(0,0,0,0.58)',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          bgcolor: '#1F1D1B',
        }}
      >
        <Stack direction="row" spacing={0.75}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: alpha(accent, 0.8) }} />
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.2)' }} />
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.12)' }} />
        </Stack>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 800, letterSpacing: '0.14em' }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: accent, fontWeight: 800, letterSpacing: '0.12em' }}>
          {subtitle}
        </Typography>
      </Box>
      <Box sx={{ p: kind === 'phone' ? 2 : 2.5 }}>{children}</Box>
    </Paper>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.9,
        borderRadius: 999,
        bgcolor: '#161514',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.08em' }}>
        {label}
      </Typography>
    </Box>
  );
}

function MiniAppCard({
  app,
  text,
}: {
  app: (typeof ECOSYSTEM_APPS)[number];
  text: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 4,
        bgcolor: '#1F1D1B',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Logo app={app.id as KylrixApp} size={30} variant="icon" />
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 800, lineHeight: 1 }}>
              {app.label}
            </Typography>
            <Typography variant="caption" sx={{ color: alpha(app.color, 0.95), fontWeight: 800 }}>
              {text}
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ height: 84, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }} />
      </Stack>
    </Paper>
  );
}

const slides: Slide[] = [
  {
    key: 'hero',
    eyebrow: 'Kylrix',
    title: 'One system for private work.',
    copy: 'Kylrix keeps notes, tasks, calls, and secrets together in one open-source, E2EE product set.',
    bullets: ['Open source', 'E2EE by default', 'One session across all apps'],
    accent: '#6366F1',
    scene: (
      <Frame title="Four apps" subtitle="One session" accent="#6366F1">
        <Grid container spacing={1.5}>
          {ECOSYSTEM_APPS.filter((app) => app.type === 'app').map((app) => (
            <Grid key={app.id} size={{ xs: 6 }}>
              <MiniAppCard
                app={app}
                text={
                  app.id === 'note'
                    ? 'Notes and forms'
                    : app.id === 'vault'
                      ? 'Passwords and keys'
                      : app.id === 'flow'
                        ? 'Tasks and planning'
                        : 'Chat and calls'
                }
              />
            </Grid>
          ))}
        </Grid>
      </Frame>
    ),
  },
  {
    key: 'note',
    eyebrow: 'Note',
    title: 'Notes that turn into work.',
    copy: 'Capture a note, collect replies, and keep the context attached when the idea becomes a task or a post.',
    bullets: ['Notes and docs', 'Forms and replies', 'Attach to a post'],
    accent: '#EC4899',
    scene: (
      <Frame title="Note" subtitle="Write and connect" accent="#EC4899">
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1}>
              {['Project brief', 'Meeting note', 'Shared draft', 'Reply form'].map((item, index) => (
                <Box
                  key={item}
                  sx={{
                    px: 1.5,
                    py: 1.25,
                    borderRadius: 2.5,
                    bgcolor: index === 0 ? alpha('#EC4899', 0.12) : '#161514',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                    {item}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={1.5}>
              <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" sx={{ color: alpha('#EC4899', 0.95), fontWeight: 800, letterSpacing: '0.12em' }}>
                  Daily standup
                </Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900, mt: 0.75 }}>
                  Ship the landing page, then turn the decisions into tasks.
                </Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#1F1D1B', border: '1px solid rgba(255,255,255,0.06)', minHeight: 152 }}>
                <Stack spacing={1.25}>
                  <Chip label="Reply form attached" color="#EC4899" />
                  <Box sx={{ height: 14, width: '76%', borderRadius: 999, bgcolor: 'rgba(255,255,255,0.12)' }} />
                  <Box sx={{ height: 14, width: '58%', borderRadius: 999, bgcolor: 'rgba(255,255,255,0.09)' }} />
                  <Box sx={{ height: 68, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }} />
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Frame>
    ),
  },
  {
    key: 'flow',
    eyebrow: 'Flow',
    title: 'Tasks with the context attached.',
    copy: 'Create a task from a note, pull the discussion with it, and keep the follow-up in the same place.',
    bullets: ['From note to task', 'Start a huddle from the task', 'Keep due dates and context together'],
    accent: '#A855F7',
    scene: (
      <Frame title="Flow" subtitle="Plan and execute" accent="#A855F7">
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.25}>
              {[
                ['Review pitch deck', 'Due today'],
                ['Ship onboarding', 'In progress'],
                ['Send follow-up', 'Waiting on reply'],
              ].map(([title, meta]) => (
                <Box
                  key={title}
                  sx={{
                    px: 1.5,
                    py: 1.2,
                    borderRadius: 2.5,
                    bgcolor: '#161514',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                    {title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: alpha('#A855F7', 0.95), fontWeight: 800 }}>
                    {meta}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={1.25}>
              <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#1F1D1B', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="caption" sx={{ color: alpha('#A855F7', 0.95), fontWeight: 800, letterSpacing: '0.12em' }}>
                  From note
                </Typography>
                <Typography variant="h6" sx={{ color: '#fff', fontWeight: 900, mt: 0.75 }}>
                  Turn the highlighted line into a task.
                </Typography>
              </Box>
              <Box sx={{ p: 2, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Stack direction="row" spacing={1.25} flexWrap="wrap">
                  <Chip label="Join huddle" color="#A855F7" />
                  <Chip label="Set due date" color="#A855F7" />
                  <Chip label="Assign owner" color="#A855F7" />
                </Stack>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Frame>
    ),
  },
  {
    key: 'connect',
    eyebrow: 'Connect',
    title: 'Calls and messages where the work lives.',
    copy: 'Message, join a huddle, and pull notes or tasks into the discussion without leaving the app.',
    bullets: ['Chat', 'Voice huddles', 'Threaded context'],
    accent: '#F59E0B',
    scene: (
      <Frame title="Connect" subtitle="Chat and calls" accent="#F59E0B" kind="phone">
        <Stack spacing={1.25}>
          <Box sx={{ px: 1.5, py: 1.1, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="caption" sx={{ color: alpha('#F59E0B', 0.95), fontWeight: 800 }}>
              Design sync
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', mt: 0.5 }}>
              Can you jump on the huddle and check the note?
            </Typography>
          </Box>
          <Box sx={{ px: 1.5, py: 1.1, borderRadius: 3, bgcolor: '#1F1D1B', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="body2" sx={{ color: '#fff' }}>
              Yes — the note is attached. Joining now.
            </Typography>
          </Box>
          <Box sx={{ p: 1.75, borderRadius: 4, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <PhoneCall size={16} color="#F59E0B" />
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.1em' }}>
                Voice huddle live
              </Typography>
            </Stack>
            <Box sx={{ mt: 1.5, height: 82, borderRadius: 3, bgcolor: '#1F1D1B', border: '1px solid rgba(255,255,255,0.06)' }} />
          </Box>
        </Stack>
      </Frame>
    ),
  },
  {
    key: 'vault',
    eyebrow: 'Vault',
    title: 'Passwords and keys in one locked place.',
    copy: 'Keep passwords, TOTP, and recovery keys private, organized, and ready when you need them.',
    bullets: ['Autofill ready', 'TOTP in one tap', 'Recovery material offline'],
    accent: '#10B981',
    scene: (
      <Frame title="Vault" subtitle="Secrets" accent="#10B981">
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Stack spacing={1}>
              {['prod-db root', 'Github token', 'Team password', 'Recovery key'].map((item, index) => (
                <Box
                  key={item}
                  sx={{
                    px: 1.5,
                    py: 1.2,
                    borderRadius: 2.5,
                    bgcolor: index === 1 ? alpha('#10B981', 0.12) : '#161514',
                    border: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                    {item}
                  </Typography>
                  <Typography variant="caption" sx={{ color: alpha('#10B981', 0.95), fontWeight: 800 }}>
                    stored
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Box sx={{ p: 2, borderRadius: 4, bgcolor: '#1F1D1B', border: '1px solid rgba(255,255,255,0.06)', height: '100%' }}>
              <Typography variant="caption" sx={{ color: alpha('#10B981', 0.95), fontWeight: 800, letterSpacing: '0.12em' }}>
                TOTP
              </Typography>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-mono)', mt: 1 }}>
                184 902
              </Typography>
              <Box sx={{ mt: 2, height: 112, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }} />
            </Box>
          </Grid>
        </Grid>
      </Frame>
    ),
  },
  {
    key: 'integrations',
    eyebrow: 'Everything connects',
    title: 'A note becomes a task. A task becomes a huddle.',
    copy: 'Kylrix keeps the work attached as it moves from note to task, from task to call, and from conversation back to the source.',
    bullets: ['Note -> task', 'Task -> huddle', 'Attach to posts and moments'],
    accent: '#6366F1',
    scene: (
      <Frame title="Integrations" subtitle="Linked work" accent="#6366F1">
        <Stack spacing={1.25}>
          {[
            ['Note', 'Task', '#EC4899'],
            ['Task', 'Huddle', '#A855F7'],
            ['Huddle', 'Post', '#F59E0B'],
            ['Post', 'Note', '#10B981'],
          ].map(([from, to, color]) => (
            <Box
              key={`${from}-${to}`}
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                gap: 1,
                alignItems: 'center',
              }}
            >
              <Box sx={{ p: 1.2, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                  {from}
                </Typography>
              </Box>
              <ArrowRight size={16} color={color} />
              <Box sx={{ p: 1.2, borderRadius: 3, bgcolor: '#1F1D1B', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                  {to}
                </Typography>
              </Box>
            </Box>
          ))}
        </Stack>
      </Frame>
    ),
  },
  {
    key: 'agents',
    eyebrow: 'AI agents',
    title: 'AI that stays inside the system.',
    copy: 'Agents can summarize, route, and act across the apps without sending your work somewhere else first.',
    bullets: ['Works across Note, Flow, Connect, Vault', 'No extra copy and paste', 'Can stay local or controlled'],
    accent: '#A855F7',
    scene: (
      <Frame title="Agents" subtitle="Inside the system" accent="#A855F7">
        <Stack spacing={1.25}>
          <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Typography variant="caption" sx={{ color: alpha('#A855F7', 0.95), fontWeight: 800, letterSpacing: '0.12em' }}>
              Ask Kylrix
            </Typography>
            <Typography variant="body2" sx={{ color: '#fff', mt: 0.5 }}>
              Pull the latest note, create the task, and schedule the huddle.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label="Summarize" color="#A855F7" />
            <Chip label="Create task" color="#A855F7" />
            <Chip label="Schedule huddle" color="#A855F7" />
          </Stack>
          <Box sx={{ height: 108, borderRadius: 3, bgcolor: '#1F1D1B', border: '1px solid rgba(255,255,255,0.06)' }} />
        </Stack>
      </Frame>
    ),
  },
  {
    key: 'business',
    eyebrow: 'Business model',
    title: 'Open core, sovereign pro.',
    copy: 'The core stays open source. Pro adds managed encrypted sync, advanced agent features, and crypto-native billing.',
    bullets: ['Open-source core', 'Managed encrypted sync', 'Crypto-only subscriptions'],
    accent: '#F59E0B',
    scene: (
      <Frame title="Business" subtitle="Revenue" accent="#F59E0B">
        <Grid container spacing={1.25}>
          {[
            ['Open core', 'Free and open source', '#6366F1'],
            ['Sovereign Pro', 'Managed sync and agents', '#A855F7'],
            ['Crypto billing', 'Subscriptions in crypto', '#10B981'],
          ].map(([title, copy, color]) => (
            <Grid key={title} size={{ xs: 12 }}>
              <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: '#fff', fontWeight: 800 }}>
                      {title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                      {copy}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Frame>
    ),
  },
  {
    key: 'close',
    eyebrow: 'Kylrix',
    title: 'One login. Four apps. One work OS.',
    copy: 'Built for teams that want useful software without giving up ownership.',
    bullets: ['See the apps', 'Read the docs', 'Open GitHub'],
    accent: '#6366F1',
    scene: (
      <Frame title="Kylrix" subtitle="Open the system" accent="#6366F1">
        <Stack spacing={1.5}>
          <Grid container spacing={1.25}>
            {ECOSYSTEM_APPS.filter((app) => app.type === 'app').map((app) => (
              <Grid key={app.id} size={{ xs: 6 }}>
                <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center">
                      <Logo app={app.id as KylrixApp} size={28} variant="icon" />
                    <Box>
                      <Typography variant="body2" sx={{ color: '#fff', fontWeight: 800 }}>
                        {app.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                        {app.description}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Stack>
      </Frame>
    ),
  },
];

export default function PitchPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const activeSlide = slides[active];

  const setSlide = (next: number) => setActive((next + slides.length) % slides.length);
  const nextSlide = () => setSlide(active + 1);
  const prevSlide = () => setSlide(active - 1);

  useEffect(() => {
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 9000);

    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    startRef.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    startRef.current = null;

    if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) nextSlide();
    else prevSlide();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      nextSlide();
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      prevSlide();
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setSlide(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      setSlide(slides.length - 1);
    }
  };

  const openApps = () => {
    window.location.assign('/apps');
  };

  const openDocs = () => {
    window.location.assign('/docs');
  };

  return (
    <Box component="main" sx={{ pt: { xs: 10, md: 12 }, pb: { xs: 10, md: 12 }, bgcolor: '#000', color: '#fff' }}>
      <Navbar />

      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, px: 1.75, py: 1, borderRadius: 999, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Logo app="root" size={24} variant="icon" />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.72)', fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                Kylrix pitch
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <IconButton onClick={prevSlide} aria-label="Previous slide" sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.08)', bgcolor: '#161514' }}>
                <ArrowLeft size={18} />
              </IconButton>
              <IconButton onClick={nextSlide} aria-label="Next slide" sx={{ color: '#fff', border: '1px solid rgba(255,255,255,0.08)', bgcolor: '#161514' }}>
                <ArrowRight size={18} />
              </IconButton>
            </Stack>
          </Box>

          <Box
            ref={deckRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            sx={{
              outline: 'none',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: '#0A0908',
              boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
              overflow: 'hidden',
            }}
          >
            <Grid container spacing={0} alignItems="stretch" sx={{ minHeight: { xs: 'auto', lg: '72vh' } }}>
              <Grid size={{ xs: 12, lg: 5 }} sx={{ p: { xs: 3, md: 4 } }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSlide.key}
                    initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -18 }}
                    transition={{ duration: 0.35 }}
                  >
                    <Stack spacing={3} sx={{ height: '100%', justifyContent: 'center' }}>
                      <Box sx={{ display: 'inline-flex', width: 'fit-content', alignItems: 'center', gap: 1, px: 1.5, py: 0.9, borderRadius: 999, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: activeSlide.accent }} />
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                          {activeSlide.eyebrow}
                        </Typography>
                      </Box>

                      <Typography
                        component="h1"
                        sx={{
                          fontSize: { xs: '2.8rem', sm: '4rem', lg: '5.4rem' },
                          lineHeight: 0.94,
                          letterSpacing: '-0.07em',
                          fontWeight: 900,
                          fontFamily: 'var(--font-clash)',
                          textWrap: 'balance',
                        }}
                      >
                        {activeSlide.title}
                      </Typography>

                      <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.85, fontWeight: 400, maxWidth: 560 }}>
                        {activeSlide.copy}
                      </Typography>

                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {activeSlide.bullets.map((bullet) => (
                          <Box key={bullet} sx={{ px: 1.25, py: 0.9, borderRadius: 999, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <Typography variant="caption" sx={{ color: '#fff', fontWeight: 800, letterSpacing: '0.06em' }}>
                              {bullet}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>

                      {active === slides.length - 1 && (
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                          <Button onClick={openApps} variant="contained" endIcon={<ArrowRight size={18} />} sx={{ px: 4, py: 1.4, borderRadius: 999, bgcolor: '#6366F1', color: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#5254E8' } }}>
                            Explore apps
                          </Button>
                          <Button onClick={openDocs} variant="outlined" sx={{ px: 4, py: 1.4, borderRadius: 999, borderColor: 'rgba(255,255,255,0.12)', color: '#fff', fontWeight: 800, '&:hover': { borderColor: 'rgba(255,255,255,0.28)', bgcolor: 'rgba(255,255,255,0.04)' } }}>
                            Read docs
                          </Button>
                          <Button href="https://github.com/kylrix" variant="text" sx={{ px: 2, py: 1.4, borderRadius: 999, color: '#fff', fontWeight: 800 }}>
                            Open GitHub
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </motion.div>
                </AnimatePresence>
              </Grid>

              <Grid size={{ xs: 12, lg: 7 }} sx={{ p: { xs: 0, lg: 4 }, bgcolor: '#000' }}>
                <Box sx={{ height: '100%', p: { xs: 3, lg: 0 }, display: 'grid', placeItems: 'center' }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeSlide.key}
                      initial={reduceMotion ? false : { opacity: 0, scale: 0.98, y: 16 }}
                      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -16 }}
                      transition={{ duration: 0.35 }}
                      style={{ width: '100%' }}
                    >
                      {activeSlide.scene}
                    </motion.div>
                  </AnimatePresence>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            <Box sx={{ px: { xs: 2, md: 3 }, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Swipe or use the arrows
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.56)', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                {String(active + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
              </Typography>
            </Box>
          </Box>

          <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
            {slides.map((slide, index) => (
              <Button
                key={slide.key}
                onClick={() => setSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                sx={{
                  minWidth: 0,
                  width: 12,
                  height: 12,
                  borderRadius: '999px',
                  p: 0,
                  bgcolor: index === active ? '#6366F1' : 'rgba(255,255,255,0.18)',
                  '&:hover': { bgcolor: index === active ? '#6366F1' : 'rgba(255,255,255,0.32)' },
                }}
              />
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
