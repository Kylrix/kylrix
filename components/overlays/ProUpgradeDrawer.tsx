'use client';

import { useProUpgrade } from '@/context/ProUpgradeContext';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Stack,
  Divider,
  useTheme,
  useMediaQuery,
  alpha,
} from '@/lib/openbricks/primitives';
import { Zap, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

const featureDescriptions: Record<string, { desc: string; fix: string }> = {
  'Voice recording': {
    desc: 'Voice notes require encrypted media storage.',
    fix: 'Upgrade to Pro to unlock voice capture and upload audio thoughts instantly.'
  },
  'Discussions': {
    desc: 'Task discussion comments require secondary object sync privileges.',
    fix: 'Upgrade to Pro to post, edit, and collaborate in real-time on task comments and threads.'
  },
  'New Project': {
    desc: 'The Free plan is limited to 1 active project.',
    fix: 'Upgrade to Pro to create up to 10 projects, or Teams for unlimited team workspaces.'
  },
  'New Channel': {
    desc: 'Creating custom group channels requires a Teams plan.',
    fix: 'Upgrade to Teams to coordinate group channels. Pro users can use resource discussions for collaboration.'
  },
  'Collaborators': {
    desc: 'Collaborative projects and shared resources require a premium tier.',
    fix: 'Upgrade to Pro to add up to 3 collaborators per resource, or Teams for unlimited peers.'
  },
  'Project Collaboration': {
    desc: 'Project-level collaboration requires a Teams subscription.',
    fix: 'Upgrade to Teams to collaborate on projects. Pro users can collaborate directly on non-project objects (e.g. notes/ideas, tasks).'
  }
};

const TEAMS_ONLY_FEATURES = new Set(['Project Collaboration', 'New Channel']);

const TEAMS_BENEFITS = [
  'Unlimited projects and team workspaces',
  'Project-level collaboration and member invites',
  'Group channels and advanced team coordination',
];

const PRO_BENEFITS = [
  'Unlimited storage & file uploads',
  'Ecosystem AI access & advanced automation',
  'Temporal masterpass encryption options',
];

export function ProUpgradeDrawer() {
  const router = useRouter();
  const { showProUpgrade, closeProUpgrade, feature } = useProUpgrade();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const featureName = feature ? ` ${feature}` : '';
  const spec = feature ? featureDescriptions[feature] : null;
  const isTeamsUpgrade = Boolean(feature && TEAMS_ONLY_FEATURES.has(feature));
  const accent = isTeamsUpgrade ? '#F59E0B' : '#6366F1';
  const benefits = isTeamsUpgrade ? TEAMS_BENEFITS : PRO_BENEFITS;
  const upgradeLabel = isTeamsUpgrade ? 'Upgrade to Teams' : 'Upgrade to Pro';

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={showProUpgrade}
      onClose={closeProUpgrade}
      ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      sx={{
        zIndex: 14000,
        '& .ob-drawer-panel': {
          bgcolor: '#161412',
          backgroundImage: isTeamsUpgrade
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(99, 102, 241, 0.02) 100%)'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(236, 72, 153, 0.02) 100%)',
          borderTop: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderLeft: !isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          maxHeight: isMobile ? '60vh' : '100vh',
          width: isMobile ? '100%' : 420,
        },
      }}
    >
      <Box
        sx={{
          p: { xs: 2.5, md: 3.5 },
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxWidth: 420,
          mx: 'auto',
          justifyContent: 'space-between',
        }}
      >
        {/* Header */}
        <Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              bgcolor: alpha(accent, 0.1),
              border: `1px solid ${alpha(accent, 0.3)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <Zap size={22} color={accent} />
          </Box>
          <Typography
            sx={{
              fontSize: '1.35rem',
              fontWeight: 900,
              color: '#fff',
              mb: 1.5,
              letterSpacing: '-0.02em',
              fontFamily: 'monospace',
            }}
          >
            {upgradeLabel}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.6)',
              lineHeight: 1.5,
              mb: 2.5,
            }}
          >
            {spec ? (
              <>
                <strong style={{ display: 'block', color: '#fff', marginBottom: '6px' }}>{spec.desc}</strong>
                <span>{spec.fix}</span>
              </>
            ) : (
              <>
                {featureName
                  ? `${featureName} is a ${isTeamsUpgrade ? 'Teams' : 'Pro'} feature.`
                  : `This feature requires a ${isTeamsUpgrade ? 'Teams' : 'Pro'} subscription.`}{' '}
                Unlock full premium capabilities.
              </>
            )}
          </Typography>

          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {benefits.map((benefit) => (
              <Box key={benefit} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: accent,
                    flexShrink: 0,
                  }}
                />
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {benefit}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* CTA */}
        <Stack spacing={1.5} sx={{ mt: 'auto' }}>
          <Button
            fullWidth
            variant="contained"
            sx={{
              bgcolor: accent,
              color: isTeamsUpgrade ? '#111' : '#fff',
              fontWeight: 900,
              py: 1.25,
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderRadius: '12px',
              '&:hover': {
                bgcolor: isTeamsUpgrade ? '#D97706' : '#818CF8',
              },
            }}
            onClick={() => {
              closeProUpgrade();
              router.push(isTeamsUpgrade ? '/pricing?tier=teams' : '/pricing');
            }}
            endIcon={<ExternalLink size={16} />}
          >
            {isTeamsUpgrade ? 'View Teams Plans' : 'Upgrade Now'}
          </Button>
          <Button
            fullWidth
            variant="text"
            sx={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: 700,
              py: 1,
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              '&:hover': {
                bgcolor: 'rgba(99, 102, 241, 0.08)',
                color: '#fff',
              },
            }}
            onClick={closeProUpgrade}
          >
            Maybe Later
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
