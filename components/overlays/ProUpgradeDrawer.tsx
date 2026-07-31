'use client';

import { useProUpgrade } from '@/context/ProUpgradeContext';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Stack,
  useTheme,
  useMediaQuery,
  alpha} from '@/lib/openbricks/primitives';
import { Zap, ExternalLink } from 'lucide-react';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

const featureDescriptions: Record<string, { desc: string; fix: string }> = {
  'Voice recording': {
    desc: 'Voice capture needs more storage and upload room.',
    fix: 'Upgrade to Pro to record and attach audio to your ideas.'
  },
  'Discussions': {
    desc: 'Comments on goals need a Pro plan.',
    fix: 'Upgrade to Pro to discuss and collaborate on goals in real time.'
  },
  'New Project': {
    desc: 'Free plans are limited to 1 active project.',
    fix: 'Upgrade to Pro for more projects, or Teams for unlimited workspaces.'
  },
  'New Channel': {
    desc: 'Custom group channels need a Teams plan.',
    fix: 'Upgrade to Teams to create group channels across your workspace.'
  },
  'Collaborators': {
    desc: 'Sharing with others needs a paid plan.',
    fix: 'Upgrade to Pro to invite collaborators, or Teams for larger groups.'
  },
  'Project Collaboration': {
    desc: 'Project-level invites need a Teams plan.',
    fix: 'Upgrade to Teams to collaborate on whole projects with your group.'
  },
  'Pinned Notes': {
    desc: 'You have reached the free pin limit.',
    fix: 'Upgrade to Pro to pin more ideas for quick access.'
  },
  'Article Mode': {
    desc: 'Long-form writing tools need Pro.',
    fix: 'Upgrade to Pro to unlock article mode and richer writing tools.'
  },
  'Kylie Assist': {
    desc: 'Smart assist tools need Pro.',
    fix: 'Upgrade to Pro to summarize, fix grammar, and speed up your work.'
  },
};

const TEAMS_ONLY_FEATURES = new Set(['Project Collaboration', 'New Channel']);

const TEAMS_BENEFITS = [
  'Unlimited projects and team workspaces',
  'Invite members to whole projects',
  'Group channels for coordination',
];

const PRO_BENEFITS = [
  'More storage for files and media',
  'Higher limits on pins, projects, and collaborators',
  'Smart tools across the ecosystem',
];

export function ProUpgradeDrawer() {
  const { showProUpgrade, closeProUpgrade, feature } = useProUpgrade();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const featureName = feature ? ` ${feature}` : '';
  const spec = feature ? featureDescriptions[feature] : null;
  const isTeamsUpgrade = Boolean(feature && TEAMS_ONLY_FEATURES.has(feature));
  const accent = isTeamsUpgrade ? '#F59E0B' : '#6366F1';
  const benefits = isTeamsUpgrade ? TEAMS_BENEFITS : PRO_BENEFITS;
  const upgradeLabel = isTeamsUpgrade ? 'Upgrade to Teams' : 'Upgrade to Pro';
  const checkoutHref = isTeamsUpgrade ? '/pricing?tier=teams' : '/pricing';

  const goCheckout = () => {
    closeProUpgrade();
    // Hard navigation so checkout always starts even if the drawer tree unmounts mid-route.
    if (typeof window !== 'undefined') {
      window.location.assign(checkoutHref);
      return;
    }
  };

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
          backgroundImage: 'none',
          borderTop: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          borderLeft: !isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          maxHeight: isMobile ? '70vh' : '100vh',
          width: isMobile ? '100%' : 420}}}
    >
      <Box
        sx={{
          p: { xs: 2.5, md: 3.5 },
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxWidth: 420,
          mx: 'auto',
          justifyContent: 'space-between'}}
      >
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
              mb: 2}}
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
              fontFamily: 'var(--font-clash), sans-serif'}}
          >
            {upgradeLabel}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.6)',
              lineHeight: 1.5,
              mb: 2.5}}
          >
            {spec ? (
              <>
                <strong style={{ display: 'block', color: '#fff', marginBottom: '6px' }}>{spec.desc}</strong>
                <span>{spec.fix}</span>
              </>
            ) : (
              <>
                {featureName
                  ? `${featureName.trim()} needs a ${isTeamsUpgrade ? 'Teams' : 'Pro'} plan.`
                  : `This feature needs a ${isTeamsUpgrade ? 'Teams' : 'Pro'} plan.`}{' '}
                Unlock higher limits and more tools.
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
                    flexShrink: 0}}
                />
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.85rem', fontWeight: 600 }}>
                  {benefit}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

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
                bgcolor: isTeamsUpgrade ? '#D97706' : '#818CF8'}}}
            onClick={goCheckout}
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
                color: '#fff'}}}
            onClick={closeProUpgrade}
          >
            Maybe Later
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
