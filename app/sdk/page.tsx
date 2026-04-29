'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChevronDown, Copy, ExternalLink, Search, Wallet } from 'lucide-react';

import Navbar from '@/components/Navbar';
import Logo from '@/components/Logo';
import SdkShell from '@/components/sdk/SdkShell';
import { SDK_SECTIONS, getSdkSection } from '@/components/sdk/catalog';
import { KYLRIX_APP_TONES, KYLRIX_COLORS, TOPBAR_LAYOUT, getAppTone } from '@/lib/sdk/design';
import { createFabModel } from '@/lib/sdk/fab';
import { createConnectTopbarSurface } from '@/lib/sdk/topbar';
import { createProfilePreviewManager } from '@/lib/sdk/appwrite';
import { TABLE_DB } from '@/lib/sdk/ecosystem';
import { createMessageEnvelope } from '@/lib/sdk/messaging';
import { createMomentSignal } from '@/lib/sdk/social';
import { createHuddleSignal } from '@/lib/sdk/huddles';
import { createExtensionManifest } from '@/lib/sdk/extensions';
import { getProfilePicturePreview } from '@/lib/appwrite';

const copyToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  await navigator.clipboard.writeText(value);
};

function SnippetBlock({ snippet }: { snippet: string }) {
  return (
    <Paper sx={{ p: 2, borderRadius: 4, bgcolor: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
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

function LiveTopbar() {
  const surface = useMemo(
    () =>
      createConnectTopbarSurface({
        routeLabel: 'Connect',
        identity: {
          displayName: 'Kylrix User',
          username: 'kylrix',
          profilePicId: null,
          profilePreviewUrl: null,
          walletConnected: true,
        },
      }),
    [],
  );

  return (
    <Paper
      sx={{
        p: 0,
        borderRadius: '0 0 28px 28px',
        bgcolor: '#161412',
        border: '1px solid rgba(255,255,255,0.05)',
        borderTop: 'none',
        boxShadow: '0 16px 42px rgba(0,0,0,0.42)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 2, md: 4 } }}>
        <Box
          sx={{
            minHeight: TOPBAR_LAYOUT.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: { xs: 1.25, md: 2 },
          }}
        >
          <Box
            component="button"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <Logo app="connect" size={32} />
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                right: -6,
                bottom: -6,
                width: 18,
                height: 18,
                bgcolor: '#0A0908',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.55)',
                '&:hover': { bgcolor: '#161412', color: 'white' },
              }}
            >
              <ChevronDown size={11} />
            </IconButton>
          </Box>

          <Box
            component="button"
            sx={{
              width: { xs: 44, md: 114 },
              minWidth: { xs: 44, md: 114 },
              maxWidth: { xs: 44, md: 114 },
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              px: 1,
              py: 0,
              minHeight: 44,
              border: '1px solid rgba(255,255,255,0.08)',
              bgcolor: '#000000',
              color: 'white',
              borderRadius: { xs: '999px', md: '24px' },
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 0 0 6px rgba(245, 158, 11, 0.02), 0 0 26px rgba(0, 0, 0, 0.55)',
              cursor: 'pointer',
              transition: 'transform 150ms ease-out, box-shadow 150ms ease-out, border-radius 150ms ease-out, width 150ms ease-out, min-width 150ms ease-out, max-width 150ms ease-out, background-color 150ms ease-out',
              '&:hover': { transform: 'translateY(-1px)' },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <Search size={16} strokeWidth={2.25} style={{ flexShrink: 0, opacity: 0.84 }} />
          </Box>

          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flexShrink: 0 }}>
            <Tooltip title={surface.walletLabel}>
              <IconButton
                sx={{
                  color: '#F59E0B',
                  bgcolor: alpha('#F59E0B', 0.03),
                  border: '1px solid',
                  borderColor: alpha('#F59E0B', 0.1),
                  borderRadius: '12px',
                  width: 42,
                  height: 42,
                  '&:hover': { bgcolor: alpha('#F59E0B', 0.08) },
                }}
              >
                <Wallet size={18} strokeWidth={1.5} />
              </IconButton>
            </Tooltip>

            <Box
              component="button"
              sx={{
                p: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                '&:hover': { transform: 'scale(1.05)' },
                transition: 'transform 0.2s',
              }}
            >
              <Avatar
                sx={{
                  width: 38,
                  height: 38,
                  bgcolor: surface.identity.walletConnected ? getAppTone('connect').secondary : '#6366F1',
                  color: '#fff',
                  fontWeight: 900,
                  borderRadius: '12px',
                }}
              >
                {surface.identity.displayName.slice(0, 1).toUpperCase()}
              </Avatar>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
}

function LiveProfilePreview() {
  const manager = useMemo(
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

  const fetchPreview = async () => {
    if (!fileId.trim()) return;
    setLoading(true);
    const next = await manager.fetchProfilePreview(fileId.trim(), 96, 96);
    setPreviewUrl(next);
    setLoading(false);
  };

  return (
    <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar
            src={previewUrl || undefined}
            sx={{
              width: 88,
              height: 88,
              bgcolor: alpha(getAppTone('note').secondary, 0.16),
              border: `1px solid ${alpha(getAppTone('note').secondary, 0.24)}`,
            }}
          />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>
              Profile preview
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.66)', mt: 0.5 }}>
              Fetch a profile image using the shared Appwrite preview helper.
            </Typography>
          </Box>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
          <TextField
            fullWidth
            size="small"
            value={fileId}
            onChange={(event) => setFileId(event.target.value)}
            placeholder="Profile picture file id"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 999 } }}
          />
          <Button onClick={fetchPreview} variant="contained" sx={{ borderRadius: 999, px: 3, fontWeight: 800 }}>
            {loading ? 'Loading…' : 'Fetch preview'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

function LiveDesign() {
  const appOrder = Object.entries(KYLRIX_APP_TONES) as Array<[keyof typeof KYLRIX_APP_TONES, (typeof KYLRIX_APP_TONES)[keyof typeof KYLRIX_APP_TONES]]>;

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          {[
            { label: 'Background', value: KYLRIX_COLORS.background },
            { label: 'Surface', value: KYLRIX_COLORS.surface },
            { label: 'Hover', value: KYLRIX_COLORS.surfaceHover },
            { label: 'Primary', value: KYLRIX_COLORS.ecosystemPrimary },
          ].map((item) => (
            <Chip key={item.label} label={`${item.label}: ${item.value}`} sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }} />
          ))}
        </Stack>
      </Paper>
      <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack direction="row" spacing={1.25} flexWrap="wrap">
          {appOrder.map(([app, tone]) => (
            <Chip key={app} label={tone.label} sx={{ bgcolor: alpha(tone.secondary, 0.1), color: '#fff', fontWeight: 800 }} />
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
}

function LiveFab() {
  const fab = useMemo(
    () =>
      createFabModel([
        { id: 'compose', title: 'Compose', description: 'Create a note or moment', icon: 'plus', app: 'note' },
        { id: 'task', title: 'Task', description: 'Start a flow action', icon: 'sparkles', app: 'flow' },
        { id: 'call', title: 'Huddle', description: 'Open a live call', icon: 'phone', app: 'connect' },
      ]),
    [],
  );

  return (
    <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <Stack direction="row" spacing={1.5} flexWrap="wrap">
        {fab.actions.map((action) => (
          <Chip key={action.id} label={action.title} sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff' }} />
        ))}
      </Stack>
    </Paper>
  );
}

function SimpleLiveCard({ title, text, accent }: { title: string; text: string; accent: string }) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 5, bgcolor: 'rgba(255,255,255,0.03)', border: `1px solid ${alpha(accent, 0.16)}` }}>
      <Typography variant="subtitle2" sx={{ color: accent, fontWeight: 900, letterSpacing: '0.16em' }}>
        LIVE
      </Typography>
      <Typography variant="h5" sx={{ mt: 1, fontWeight: 900 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.66)', lineHeight: 1.8 }}>
        {text}
      </Typography>
    </Paper>
  );
}

function LiveEcosystem() {
  return <SimpleLiveCard title="Ecosystem routes" text={TABLE_DB.getEventPath('FLOW', 'TASKS')} accent={getAppTone('root').secondary} />;
}

function LiveSecurity() {
  return (
    <SimpleLiveCard
      title="Security primitives"
      text="AES-GCM derive/encrypt/decrypt helpers wrapped by the masterpass layer."
      accent={getAppTone('vault').secondary}
    />
  );
}

function LiveMessaging() {
  const message = createMessageEnvelope({
    id: 'message-1',
    threadId: 'thread-1',
    senderId: 'user-1',
    body: 'Hello from the SDK',
  });
  return <SimpleLiveCard title="Messaging envelope" text={message.body} accent="#F97316" />;
}

function LiveSocial() {
  const moment = createMomentSignal({ id: 'moment-1', authorId: 'user-1', body: 'Moment preview' });
  return <SimpleLiveCard title="Social moment" text={moment.body} accent={getAppTone('note').secondary} />;
}

function LiveHuddles() {
  const huddle = createHuddleSignal({ id: 'huddle-1', roomId: 'room-1', hostId: 'user-1', purpose: 'Live call' });
  return <SimpleLiveCard title="Huddle signal" text={huddle.purpose} accent={getAppTone('flow').secondary} />;
}

function LiveExtensions() {
  const extension = createExtensionManifest({ id: 'ext-1', name: 'Note Tools', description: 'Demo extension', scope: 'note' });
  return <SimpleLiveCard title="Extension manifest" text={extension.description} accent="#22C55E" />;
}

function renderSection(sectionId: string) {
  switch (sectionId) {
    case 'topbar':
      return <LiveTopbar />;
    case 'profile-preview':
      return <LiveProfilePreview />;
    case 'design':
      return <LiveDesign />;
    case 'fab':
      return <LiveFab />;
    case 'ecosystem':
      return <LiveEcosystem />;
    case 'security':
      return <LiveSecurity />;
    case 'messaging':
      return <LiveMessaging />;
    case 'social':
      return <LiveSocial />;
    case 'huddles':
      return <LiveHuddles />;
    case 'extensions':
      return <LiveExtensions />;
    default:
      return <LiveDesign />;
  }
}

function DemoHeader({ section }: { section: ReturnType<typeof getSdkSection> }) {
  return (
    <Paper
      sx={{
        p: { xs: 2.5, md: 3 },
        borderRadius: 6,
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} flexWrap="wrap">
        <Box>
          <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.18em' }}>
            LIVE SDK DEMO
          </Typography>
          <Typography variant="h3" sx={{ mt: 1, fontWeight: 900, letterSpacing: '-0.05em' }}>
            {section.title}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255,255,255,0.66)', lineHeight: 1.8, maxWidth: 720 }}>
            {section.description}
          </Typography>
        </Box>

        <Chip
          label={section.sourceHref.replace('https://github.com/kylrix/sdks/blob/master/', '')}
          sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: '#fff', maxWidth: '100%' }}
        />
      </Stack>
    </Paper>
  );
}

function DemoStage({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <Paper
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 6,
        bgcolor: 'rgba(255,255,255,0.025)',
        border: `1px solid ${alpha(accent, 0.14)}`,
        boxShadow: `0 24px 80px ${alpha(accent, 0.08)}`,
      }}
    >
      <Box
        sx={{
          minHeight: { xs: 220, md: 280 },
          p: { xs: 1, md: 2 },
          borderRadius: 5,
          bgcolor: 'rgba(0,0,0,0.18)',
          border: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</Box>
      </Box>
    </Paper>
  );
}

export default function SdkDemoPage() {
  const [activeSection, setActiveSection] = useState('topbar');
  const section = getSdkSection(activeSection);

  return (
    <Box>
      <Navbar />
      <SdkShell sections={SDK_SECTIONS} activeSection={activeSection} onSelectSection={setActiveSection}>
        <Container maxWidth="xl" sx={{ px: { xs: 0, md: 1 } }}>
          <Stack spacing={2.5}>
            <DemoHeader section={section} />

            <DemoStage accent={section.accent}>
              {renderSection(section.id)}
            </DemoStage>

            <Stack direction="row" spacing={1.25} flexWrap="wrap">
              <Button
                startIcon={<Copy size={16} />}
                variant="contained"
                onClick={() => copyToClipboard(section.snippet)}
                sx={{ borderRadius: 999, fontWeight: 800 }}
              >
                Copy snippet
              </Button>
              <Button
                component="a"
                href={section.sourceHref}
                target="_blank"
                rel="noreferrer"
                variant="outlined"
                startIcon={<ExternalLink size={16} />}
                sx={{ borderRadius: 999, fontWeight: 800 }}
              >
                Open source
              </Button>
            </Stack>

            <SnippetBlock snippet={section.snippet} />
          </Stack>
        </Container>
      </SdkShell>
    </Box>
  );
}
