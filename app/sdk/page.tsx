'use client';

import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Copy, ExternalLink, Search, Sparkles, WandSparkles, FileText, ShieldCheck, MessagesSquare, Grid2x2, SquarePlay } from 'lucide-react';
import NextLink from 'next/link';

import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import SdkShell from '@/components/sdk/SdkShell';
import { SDK_SECTIONS, getSdkSection } from '@/components/sdk/catalog';
import { KYLRIX_APP_TONES, KYLRIX_COLORS, TOPBAR_LAYOUT, getAppTone } from '@kylrix/sdk/design';
import { createFabModel } from '@kylrix/sdk/fab';
import { createTopbarAction, createTopbarSurface } from '@kylrix/sdk/topbar';
import { createProfilePreviewManager } from '@kylrix/sdk/appwrite';
import { getEcosystemUrl, TABLE_DB } from '@kylrix/sdk/ecosystem';
import { getProfilePicturePreview } from '@/lib/appwrite';

const copyToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
};

function SectionHeader({
  eyebrow,
  title,
  summary,
  sourceHref,
  snippet,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  sourceHref: string;
  snippet: string;
}) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.22em' }}>
          {eyebrow}
        </Typography>
        <Typography variant="h3" sx={{ mt: 1, fontWeight: 900, letterSpacing: '-0.05em' }}>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1.5, color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
          {summary}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1.25} flexWrap="wrap">
        <Button
          variant="contained"
          startIcon={<Copy size={16} />}
          onClick={() => copyToClipboard(snippet)}
          sx={{ borderRadius: 999, fontWeight: 800 }}
        >
          Copy snippet
        </Button>
        <Button
          component="a"
          href={sourceHref}
          target="_blank"
          rel="noreferrer"
          variant="outlined"
          startIcon={<ExternalLink size={16} />}
          sx={{ borderRadius: 999, fontWeight: 800 }}
        >
          Open source
        </Button>
      </Stack>
    </Stack>
  );
}

function SnippetBlock({ snippet }: { snippet: string }) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 4,
        bgcolor: 'rgba(0,0,0,0.36)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflowX: 'auto',
      }}
    >
      <Typography
        component="pre"
        sx={{
          m: 0,
          color: '#D7D8E6',
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.84rem',
          lineHeight: 1.8,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {snippet}
      </Typography>
    </Paper>
  );
}

function DesignPreview() {
  const tones = Object.entries(KYLRIX_APP_TONES) as Array<[keyof typeof KYLRIX_APP_TONES, (typeof KYLRIX_APP_TONES)[keyof typeof KYLRIX_APP_TONES]]>;

  return (
    <Grid container spacing={1.5}>
      {[
        { label: 'Background', value: KYLRIX_COLORS.background },
        { label: 'Surface', value: KYLRIX_COLORS.surface },
        { label: 'Hover', value: KYLRIX_COLORS.surfaceHover },
        { label: 'Primary', value: KYLRIX_COLORS.ecosystemPrimary },
      ].map((color) => (
        <Grid key={color.label} size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <Box sx={{ height: 88, borderRadius: 3, bgcolor: color.value, mb: 1.5, border: '1px solid rgba(255,255,255,0.08)' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
              {color.label}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)', fontFamily: 'JetBrains Mono, monospace' }}>
              {color.value}
            </Typography>
          </Paper>
        </Grid>
      ))}

      {tones.map(([app, tone]) => (
        <Grid key={app} size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper
            sx={{
              p: 2,
              borderRadius: 4,
              bgcolor: alpha(tone.secondary, 0.08),
              border: `1px solid ${alpha(tone.secondary, 0.16)}`,
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box sx={{ width: 12, height: 12, borderRadius: 999, bgcolor: tone.secondary }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                {tone.label}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.56)', display: 'block', mt: 1 }}>
              Secondary tone for {String(app)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace' }}>
              {tone.secondary}
            </Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

function TopbarPreview({
  onJump,
}: {
  onJump: (id: string) => void;
}) {
  const quickActions = useMemo(
    () => [
      createTopbarAction({
        id: 'new-note',
        kind: 'action',
        title: 'New note',
        description: 'Create a private page',
        terms: ['note', 'compose', 'new'],
        app: 'note',
        onSelect: () => onJump('social'),
      }),
      createTopbarAction({
        id: 'open-vault',
        kind: 'action',
        title: 'Open Vault',
        description: 'Jump to secrets',
        terms: ['vault', 'secrets', 'password'],
        app: 'vault',
        onSelect: () => onJump('security'),
      }),
      createTopbarAction({
        id: 'start-call',
        kind: 'action',
        title: 'Start huddle',
        description: 'Spin up a live call',
        terms: ['call', 'huddle', 'meet'],
        app: 'connect',
        onSelect: () => onJump('huddles'),
      }),
    ],
    [onJump],
  );

  const surface = useMemo(
    () =>
      createTopbarSurface({
        routeLabel: 'SDK sandbox',
        currentApp: 'note',
        snippets: [
          { id: 'design', kind: 'token', title: 'Theme tokens', description: 'Color and layout primitives' },
          { id: 'profile', kind: 'surface', title: 'Profile preview', description: 'Cache-first avatar fetching' },
          { id: 'source', kind: 'link', title: 'Source map', description: 'Jump straight to the package file' },
        ],
        quickActions,
        searchTargets: quickActions,
      }),
    [quickActions],
  );

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 5,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} flexWrap="wrap">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Logo app="note" size={34} variant="icon" />
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.52)', letterSpacing: '0.18em' }}>
                LIVE TOPBAR
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                {surface.routeLabel}
              </Typography>
            </Box>
          </Stack>
          <Chip
            label={`${TOPBAR_LAYOUT.height}px header`}
            sx={{
              bgcolor: alpha(getAppTone('note').secondary, 0.12),
              color: '#fff',
              fontWeight: 800,
            }}
          />
        </Stack>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
            flexWrap: 'wrap',
          }}
        >
          <Button variant="text" startIcon={<Search size={16} />} sx={{ borderRadius: 999, fontWeight: 800 }}>
            Search
          </Button>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
          {surface.quickActions.map((action) => (
            <Button
              key={action.id}
              onClick={action.onSelect}
              sx={{
                borderRadius: 999,
                px: 1.5,
                color: action.accent,
                bgcolor: alpha(action.accent, 0.08),
                fontWeight: 800,
              }}
            >
              {action.title}
            </Button>
          ))}
        </Box>

        <Grid container spacing={1.5}>
          {surface.snippets.map((snippet) => (
            <Grid key={snippet.id} size={{ xs: 12, sm: 4 }}>
              <Paper sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  {snippet.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                  {snippet.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Paper>
  );
}

function FabPreview({
  onJump,
}: {
  onJump: (id: string) => void;
}) {
  const fab = useMemo(
    () =>
      createFabModel([
        { id: 'compose', title: 'Compose', description: 'Create a moment or note', icon: 'plus', app: 'note' },
        { id: 'task', title: 'New task', description: 'Create a flow action', icon: 'sparkles', app: 'flow' },
        { id: 'call', title: 'Start huddle', description: 'Open a live room', icon: 'circle-dot', app: 'connect' },
      ]),
    [],
  );

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 5,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
        <Box>
          <Typography variant="subtitle2" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.16em' }}>
            FLOATING ACTION BUTTON
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 900, mt: 1 }}>
            {fab.size}px dock with app-aware actions
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.62)', mt: 1, lineHeight: 1.8 }}>
            The demo mirrors the global compose affordance so each app can surface its own action set without drifting from the design tokens.
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'grid',
            placeItems: 'center',
            minWidth: 132,
            minHeight: 132,
            borderRadius: '999px',
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '28px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(KYLRIX_COLORS.ecosystemPrimary, 0.16),
              border: `1px solid ${alpha(KYLRIX_COLORS.ecosystemPrimary, 0.24)}`,
              boxShadow: `0 24px 40px ${alpha(KYLRIX_COLORS.ecosystemPrimary, 0.24)}`,
            }}
          >
            <Sparkles size={28} color={KYLRIX_COLORS.ecosystemPrimary} />
          </Box>
        </Box>
      </Stack>

      <Grid container spacing={1.5} sx={{ mt: 1 }}>
        {fab.actions.map((action) => (
          <Grid key={action.id} size={{ xs: 12, md: 4 }}>
            <Button
              onClick={() => onJump(action.app === 'flow' ? 'security' : action.app === 'connect' ? 'huddles' : 'social')}
              fullWidth
              sx={{
                justifyContent: 'flex-start',
                borderRadius: 3,
                p: 1.5,
                bgcolor: 'rgba(0,0,0,0.26)',
                border: '1px solid rgba(255,255,255,0.06)',
                textAlign: 'left',
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                  {action.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                  {action.description}
                </Typography>
              </Stack>
            </Button>
          </Grid>
        ))}
      </Grid>
    </Paper>
  );
}

function ProfilePreviewSection() {
  const profileManager = useMemo(
    () =>
      createProfilePreviewManager(async (fileId, width, height) => {
        const preview = await getProfilePicturePreview(fileId, width, height);
        return String(preview);
      }),
    [],
  );
  const [fileId, setFileId] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFetch = async () => {
    if (!fileId.trim()) return;
    setLoading(true);
    const next = await profileManager.fetchProfilePreview(fileId.trim(), 96, 96);
    setPreviewUrl(next);
    setLoading(false);
  };

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 5,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#F59E0B', fontWeight: 900, letterSpacing: '0.16em' }}>
              PROFILE PREVIEW
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, mt: 1 }}>
              Cache-first avatar fetching
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.62)', mt: 1, lineHeight: 1.8 }}>
              The manager uses session cache first, then asks Appwrite for a fresh preview, which keeps the avatar path fast on reload.
            </Typography>
          </Box>
          <Avatar
            src={previewUrl || undefined}
            sx={{
              width: 96,
              height: 96,
              bgcolor: alpha('#F59E0B', 0.16),
              border: `1px solid ${alpha('#F59E0B', 0.24)}`,
            }}
          />
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            fullWidth
            value={fileId}
            onChange={(event) => setFileId(event.target.value)}
            placeholder="Paste a profile picture file id"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 999,
              },
            }}
          />
          <Button onClick={handleFetch} variant="contained" disabled={loading} sx={{ borderRadius: 999, px: 3, fontWeight: 800 }}>
            {loading ? 'Loading…' : 'Fetch preview'}
          </Button>
        </Stack>

        <SnippetBlock snippet={`const profilePreview = createProfilePreviewManager(async (fileId, width, height) => {
  const preview = await getProfilePicturePreview(fileId, width, height);
  return String(preview);
});`} />
      </Stack>
    </Paper>
  );
}

function SourceCard({
  title,
  description,
  icon: Icon,
  sourceHref,
  snippet,
  accent,
}: {
  title: string;
  description: string;
  icon: ComponentType<{ size?: number }>;
  sourceHref: string;
  snippet: string;
  accent: string;
}) {
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 5,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Box sx={{ color: accent }}>
              <Icon size={18} />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                {title}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.56)' }}>
                {description}
              </Typography>
            </Box>
          </Stack>
          <Button component="a" href={sourceHref} target="_blank" rel="noreferrer" size="small" endIcon={<ExternalLink size={14} />}>
            Source
          </Button>
        </Stack>
        <SnippetBlock snippet={snippet} />
      </Stack>
    </Paper>
  );
}

export default function SdkDemoPage() {
  const [activeSection, setActiveSection] = useState(SDK_SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: 0.2 },
    );

    SDK_SECTIONS.forEach((section) => {
      const node = sectionRefs.current[section.id];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, []);

  const jumpToSection = (id: string) => {
    setActiveSection(id);
    const node = sectionRefs.current[id];
    node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const currentSection = getSdkSection(activeSection);

  const topbarCard = (
    <TopbarPreview onJump={jumpToSection} />
  );

  return (
    <Box>
      <Navbar />
      <SdkShell sections={SDK_SECTIONS} activeSection={activeSection} onSelectSection={jumpToSection}>
        <Container maxWidth="xl" sx={{ px: { xs: 0, md: 1 } }}>
          <Stack spacing={3.5}>
            <Paper
              sx={{
                p: { xs: 3, md: 4 },
                borderRadius: 6,
                overflow: 'hidden',
                position: 'relative',
                bgcolor: 'var(--surface)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: 'none',
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: `radial-gradient(circle at top right, ${alpha(KYLRIX_COLORS.ecosystemPrimary, 0.14)}, transparent 36%), radial-gradient(circle at bottom left, ${alpha('#EC4899', 0.1)}, transparent 30%)`,
                  pointerEvents: 'none',
                }}
              />

              <Stack spacing={2.5} sx={{ position: 'relative' }}>
                <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                  <Chip label="LIVE SDK DEMO" sx={{ bgcolor: alpha('#6366F1', 0.14), color: '#fff', fontWeight: 800 }} />
                  <Chip label="@kylrix/sdk/*" sx={{ bgcolor: alpha('#fff', 0.06), color: '#fff', fontWeight: 800 }} />
                </Stack>

                <Box>
                  <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: '-0.06em' }}>
                    Kylrix SDK playground
                  </Typography>
                  <Typography variant="body1" sx={{ mt: 1.5, maxWidth: 900, color: 'rgba(255,255,255,0.68)', lineHeight: 1.8 }}>
                    This page mirrors the modular TypeScript SDK inside the website so you can test each export live before copying it into the app repos.
                    Desktop uses a loaded sidebar; mobile uses a scrollable bottom strip with the same section set.
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1.25} flexWrap="wrap">
                  {[
                    { label: 'Design tokens', icon: Grid2x2 },
                    { label: 'Topbar', icon: WandSparkles },
                    { label: 'Preview fetch', icon: FileText },
                    { label: 'Security', icon: ShieldCheck },
                    { label: 'Realtime shapes', icon: MessagesSquare },
                  ].map((item) => (
                    <Chip
                      key={item.label}
                      icon={<item.icon size={14} />}
                      label={item.label}
                      sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 800 }}
                    />
                  ))}
                </Stack>
              </Stack>
            </Paper>

            <Box
              ref={(node) => {
                sectionRefs.current.design = node;
              }}
              id="design"
              sx={{ scrollMarginTop: '120px' }}
            >
              <SectionHeader
                eyebrow="DESIGN"
                title="Tokens, colors, and layout"
                summary="The shared design module gives every app the same base palette, typography, and layout constants so visual drift stays low."
                sourceHref={getSdkSection('design').sourceHref}
                snippet={getSdkSection('design').snippet}
              />
              <Box sx={{ mt: 2.5 }}>
                <DesignPreview />
              </Box>
            </Box>

            <Box
              ref={(node) => {
                sectionRefs.current.topbar = node;
              }}
              id="topbar"
              sx={{ scrollMarginTop: '120px' }}
            >
              <SectionHeader
                eyebrow="TOPBAR"
                title="Search, profile, and quick actions"
                summary="The topbar surface stays model-driven so the website can render the same control set without hard-coding each app’s behavior."
                sourceHref={getSdkSection('topbar').sourceHref}
                snippet={getSdkSection('topbar').snippet}
              />
              <Box sx={{ mt: 2.5 }}>{topbarCard}</Box>
            </Box>

            <Box
              ref={(node) => {
                sectionRefs.current.fab = node;
              }}
              id="fab"
              sx={{ scrollMarginTop: '120px' }}
            >
              <SectionHeader
                eyebrow="FAB"
                title="Floating action intent"
                summary="The floating button stays tiny in code but expressive in behavior, letting each app surface the right compose path."
                sourceHref={getSdkSection('fab').sourceHref}
                snippet={getSdkSection('fab').snippet}
              />
              <Box sx={{ mt: 2.5 }}>
                <FabPreview onJump={jumpToSection} />
              </Box>
            </Box>

            <Box
              ref={(node) => {
                sectionRefs.current['profile-preview'] = node;
              }}
              id="profile-preview"
              sx={{ scrollMarginTop: '120px' }}
            >
              <SectionHeader
                eyebrow="APPWRITE"
                title="Profile preview fetching"
                summary="The avatar manager keeps a fast in-memory/session cache and only falls back to Appwrite when the preview is missing."
                sourceHref={getSdkSection('profile-preview').sourceHref}
                snippet={getSdkSection('profile-preview').snippet}
              />
              <Box sx={{ mt: 2.5 }}>
                <ProfilePreviewSection />
              </Box>
            </Box>

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  ref={(node) => {
                    sectionRefs.current.ecosystem = node;
                  }}
                  id="ecosystem"
                  sx={{ scrollMarginTop: '120px' }}
                >
                  <SectionHeader
                    eyebrow="ECOSYSTEM"
                    title="Cross-app routing"
                    summary="Route helpers keep the website and companion apps pointed at the right subdomain without duplicating URL logic."
                    sourceHref={getSdkSection('ecosystem').sourceHref}
                    snippet={getSdkSection('ecosystem').snippet}
                  />
                  <Paper sx={{ mt: 2.5, p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Stack spacing={1.25}>
                      {[
                        { id: 'note', label: 'Note', desc: 'Private knowledge surface' },
                        { id: 'vault', label: 'Vault', desc: 'Zero-knowledge secrets' },
                        { id: 'flow', label: 'Flow', desc: 'Tasks and orchestration' },
                        { id: 'connect', label: 'Connect', desc: 'Messaging and calls' },
                      ].map((app) => (
                        <Button
                          key={app.id}
                          component="a"
                          href={
                            app.id === 'note'
                              ? getEcosystemUrl('NOTE')
                              : app.id === 'vault'
                                ? getEcosystemUrl('VAULT')
                                : app.id === 'flow'
                                  ? getEcosystemUrl('FLOW')
                                  : getEcosystemUrl('CONNECT')
                          }
                          variant="outlined"
                          sx={{ justifyContent: 'space-between', borderRadius: 3, py: 1.5, textTransform: 'none' }}
                        >
                          <Stack spacing={0.25} alignItems="flex-start">
                            <Typography sx={{ fontWeight: 900 }}>{app.label}</Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                              {app.desc}
                            </Typography>
                          </Stack>
                          <ExternalLink size={15} />
                        </Button>
                      ))}
                      <Box sx={{ mt: 1, p: 1.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)', display: 'block', mb: 0.5 }}>
                          TableDB event path example
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                          {TABLE_DB.getEventPath('FLOW', 'TASKS')}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box
                  ref={(node) => {
                    sectionRefs.current.security = node;
                  }}
                  id="security"
                  sx={{ scrollMarginTop: '120px' }}
                >
                  <SectionHeader
                    eyebrow="SECURITY"
                    title="Masterpass and encryption"
                    summary="Security exports stay narrow: the browser-side crypto primitive and the masterpass helper layer are split so apps can import only what they need."
                    sourceHref={getSdkSection('security').sourceHref}
                    snippet={getSdkSection('security').snippet}
                  />
                  <Paper sx={{ mt: 2.5, p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Stack spacing={1.5}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                        Browser crypto primitives
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.64)', lineHeight: 1.8 }}>
                        `KylrixSecurity` provides the AES-GCM primitives while the masterpass module wraps them for unlock, lock, and reset flows.
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label="deriveKey" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }} />
                        <Chip label="encrypt/decrypt" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }} />
                        <Chip label="reset impact" sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }} />
                      </Stack>
                    </Stack>
                  </Paper>
                </Box>
              </Grid>
            </Grid>

            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  ref={(node) => {
                    sectionRefs.current.messaging = node;
                  }}
                  id="messaging"
                  sx={{ scrollMarginTop: '120px' }}
                >
                  <SectionHeader
                    eyebrow="MESSAGING"
                    title="Thread envelopes"
                    summary="A tiny message envelope module keeps chat payloads, read state, and metadata shape consistent."
                    sourceHref={getSdkSection('messaging').sourceHref}
                    snippet={getSdkSection('messaging').snippet}
                  />
                  <Paper sx={{ mt: 2.5, p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.64)', lineHeight: 1.8 }}>
                      Used wherever messages need to stay portable between chat, tasks, and huddle threads.
                    </Typography>
                  </Paper>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  ref={(node) => {
                    sectionRefs.current.social = node;
                  }}
                  id="social"
                  sx={{ scrollMarginTop: '120px' }}
                >
                  <SectionHeader
                    eyebrow="SOCIAL"
                    title="Moments and reactions"
                    summary="Feed and thread primitives keep content metadata close to the post model so cards can render without re-inventing shape names."
                    sourceHref={getSdkSection('social').sourceHref}
                    snippet={getSdkSection('social').snippet}
                  />
                  <Paper sx={{ mt: 2.5, p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.64)', lineHeight: 1.8 }}>
                      The website can point its live feeds at the same shared contract and keep the moment UI aligned with the SDK.
                    </Typography>
                  </Paper>
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  ref={(node) => {
                    sectionRefs.current.huddles = node;
                  }}
                  id="huddles"
                  sx={{ scrollMarginTop: '120px' }}
                >
                  <SectionHeader
                    eyebrow="HUDDLES"
                    title="Calls in context"
                    summary="Huddle signals stay small enough to start from notes, tasks, and threads without coupling the app shell to call state."
                    sourceHref={getSdkSection('huddles').sourceHref}
                    snippet={getSdkSection('huddles').snippet}
                  />
                  <Paper sx={{ mt: 2.5, p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.64)', lineHeight: 1.8 }}>
                      The idea is the same one used in the live apps: a transient pulse object, not a heavy persistent table row.
                    </Typography>
                  </Paper>
                </Box>
              </Grid>
            </Grid>

            <Box
              ref={(node) => {
                sectionRefs.current.extensions = node;
              }}
              id="extensions"
              sx={{ scrollMarginTop: '120px' }}
            >
              <SectionHeader
                eyebrow="EXTENSIONS"
                title="Global add-ons"
                summary="Extensions let Note-style global add-ons stay separate from the app shells while still sharing a consistent manifest shape."
                sourceHref={getSdkSection('extensions').sourceHref}
                snippet={getSdkSection('extensions').snippet}
              />
              <Box sx={{ mt: 2.5 }}>
                <SourceCard
                  title="Extension manifest"
                  description="Source-only shape for add-ons and ecosystem hooks"
                  icon={SquarePlay}
                  accent="#22C55E"
                  sourceHref={getSdkSection('extensions').sourceHref}
                  snippet={`// Keep extension manifests tiny and route-aware\nexport interface ExtensionManifest {\n  id: string;\n  name: string;\n  description: string;\n  scope: 'note' | 'flow' | 'connect' | 'vault';\n}`}
                />
              </Box>
            </Box>

            <Paper
              sx={{
                p: 3,
                borderRadius: 5,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.16em' }}>
                    REFERENCE
                  </Typography>
                  <Typography variant="h5" sx={{ mt: 1, fontWeight: 900 }}>
                    Current source target
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.64)', lineHeight: 1.8 }}>
                    {currentSection.sourceHref}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1.25} flexWrap="wrap">
                  <Button component="a" href={currentSection.sourceHref} target="_blank" rel="noreferrer" variant="contained">
                    Open source file
                  </Button>
                  <Button component={NextLink} href="/docs" variant="outlined">
                    Open docs
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        </Container>
      </SdkShell>
    </Box>
  );
}
