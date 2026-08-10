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
  alpha
} from '@/lib/openbricks/primitives';
import { Zap, ArrowRight, Check } from 'lucide-react';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

const featureDescriptions: Record<string, { desc: string; fix: string }> = {
  'Voice recording': {
    desc: 'Voice capture requires higher storage limits.',
    fix: 'Upgrade to Pro to record and store high-fidelity audio.'
  },
  'Discussions': {
    desc: 'Real-time discussions need a Pro plan.',
    fix: 'Upgrade to Pro to collaborate on ideas in real time.'
  },
  'New Project': {
    desc: 'Free tier limits workspace projects.',
    fix: 'Upgrade to Pro for more projects, or Teams for unlimited.'
  },
  'New Channel': {
    desc: 'Custom channels need a Teams plan.',
    fix: 'Upgrade to Teams to create group channels across your team.'
  },
  'Collaborators': {
    desc: 'Sharing with collaborators needs a paid plan.',
    fix: 'Upgrade to Pro to invite collaborators, or Teams for groups.'
  },
  'Project Collaboration': {
    desc: 'Project-level invites need a Teams plan.',
    fix: 'Upgrade to Teams to collaborate on entire projects.'
  },
  'Pinned Notes': {
    desc: 'You reached the free pin limit.',
    fix: 'Upgrade to Pro to pin unlimited notes for instant access.'
  },
  'Article Mode': {
    desc: 'Long-form tools need Pro.',
    fix: 'Upgrade to Pro to unlock article mode and rich editing.'
  },
  'Kylie Assist': {
    desc: 'AI Assistant features require a Pro subscription.',
    fix: 'Upgrade to Pro to chat with Kylie and automate your workflow.'
  },
};

const TEAMS_ONLY_FEATURES = new Set(['Project Collaboration', 'New Channel']);

const TEAMS_BENEFITS = [
  'Unlimited projects and team workspaces',
  'Invite collaborators to full projects',
  'Group channels and workflow routing',
];

const PRO_BENEFITS = [
  'Unlimited AI Assistant (Kylie) chat & tools',
  'Higher storage & file upload limits',
  'Unlimited pins, projects & workspace sharing',
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
    if (typeof window !== 'undefined') {
      window.location.assign(checkoutHref);
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
          borderTop: isMobile ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          borderLeft: !isMobile ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          maxHeight: isMobile ? '80vh' : '100vh',
          width: isMobile ? '100%' : 420,
          borderRadius: isMobile ? '24px 24px 0 0' : 0,
        }
      }}
    >
      <Box
        sx={{
          p: { xs: 3, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxWidth: 420,
          mx: 'auto',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '16px',
              bgcolor: alpha(accent, 0.12),
              border: `1px solid ${alpha(accent, 0.25)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <Zap size={24} color={accent} strokeWidth={2.2} />
          </Box>

          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 900,
              color: '#FFFFFF',
              mb: 1,
              letterSpacing: '-0.02em',
              fontFamily: 'var(--font-clash), sans-serif',
            }}
          >
            {upgradeLabel}
          </Typography>

          <Typography
            sx={{
              fontSize: '0.875rem',
              color: 'rgba(255, 255, 255, 0.65)',
              lineHeight: 1.6,
              mb: 3,
              fontFamily: 'var(--font-satoshi), sans-serif',
            }}
          >
            {spec ? (
              <>
                <strong style={{ display: 'block', color: '#FFFFFF', fontWeight: 800, marginBottom: '4px' }}>
                  {spec.desc}
                </strong>
                <span>{spec.fix}</span>
              </>
            ) : (
              <>
                {featureName
                  ? `${featureName.trim()} requires a ${isTeamsUpgrade ? 'Teams' : 'Pro'} plan.`
                  : `Unlock advanced productivity tools and AI agents with ${isTeamsUpgrade ? 'Teams' : 'Pro'}.`}
              </>
            )}
          </Typography>

          <Box
            sx={{
              p: 2.5,
              borderRadius: '18px',
              bgcolor: '#0B0A09',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              mb: 3,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.725rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                tracking: '0.08em',
                color: 'rgba(255, 255, 255, 0.45)',
                mb: 2,
                fontFamily: 'var(--font-mono), monospace',
              }}
            >
              Included in {isTeamsUpgrade ? 'Teams' : 'Pro'}
            </Typography>

            <Stack spacing={2}>
              {benefits.map((benefit) => (
                <Box key={benefit} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      bgcolor: alpha(accent, 0.2),
                      border: `1px solid ${alpha(accent, 0.4)}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.2,
                    }}
                  >
                    <Check size={10} color={accent} strokeWidth={3} />
                  </Box>
                  <Typography
                    sx={{
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      lineHeight: 1.4,
                      fontFamily: 'var(--font-satoshi), sans-serif',
                    }}
                  >
                    {benefit}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        </Box>

        <Stack spacing={1.5} sx={{ mt: 'auto' }}>
          <Button
            fullWidth
            onClick={goCheckout}
            sx={{
              bgcolor: accent,
              color: isTeamsUpgrade ? '#000000' : '#FFFFFF',
              fontWeight: 900,
              py: 1.5,
              fontSize: '0.9rem',
              borderRadius: '14px',
              textTransform: 'none',
              fontFamily: 'var(--font-satoshi), sans-serif',
              boxShadow: `0 8px 20px ${alpha(accent, 0.3)}`,
              '&:hover': {
                bgcolor: isTeamsUpgrade ? '#D97706' : '#5254E8',
                transform: 'translateY(-1px)',
              },
              transition: 'all 0.2s ease',
            }}
            endIcon={<ArrowRight size={18} />}
          >
            {isTeamsUpgrade ? 'Upgrade to Teams' : 'Upgrade to Pro'}
          </Button>

          <Button
            fullWidth
            onClick={closeProUpgrade}
            sx={{
              color: 'rgba(255, 255, 255, 0.45)',
              fontWeight: 700,
              py: 1.2,
              fontSize: '0.85rem',
              borderRadius: '14px',
              textTransform: 'none',
              fontFamily: 'var(--font-satoshi), sans-serif',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                color: '#FFFFFF',
              },
            }}
          >
            Maybe Later
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
