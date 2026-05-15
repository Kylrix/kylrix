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
} from '@mui/material';
import { Zap, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

export function ProUpgradeDrawer() {
  const router = useRouter();
  const { showProUpgrade, closeProUpgrade, feature } = useProUpgrade();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const featureName = feature ? ` ${feature}` : '';

  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={showProUpgrade}
      onClose={closeProUpgrade}
      ModalProps={{ keepMounted: false, disableScrollLock: false, disablePortal: true }}
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      sx={{
        '& .MuiDrawer-paper': {
          bgcolor: '#161412',
          backgroundImage: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(236, 72, 153, 0.02) 100%)',
          borderTop: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderLeft: !isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          maxHeight: isMobile ? '85vh' : '100vh',
          width: isMobile ? '100%' : 420,
        },
      }}
    >
      <Box
        sx={{
          p: { xs: 2, md: 3 },
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxWidth: 420,
          mx: 'auto',
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '14px',
              bgcolor: alpha('#6366F1', 0.1),
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <Zap size={24} color="#6366F1" />
          </Box>
          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 900,
              color: '#fff',
              mb: 1,
              letterSpacing: '-0.02em',
            }}
          >
            Upgrade to Pro
          </Typography>
          <Typography
            sx={{
              fontSize: '0.95rem',
              color: 'rgba(255, 255, 255, 0.6)',
              lineHeight: 1.6,
            }}
          >
            {featureName ? `${featureName} is a Pro feature.` : 'This feature is available in Pro.'} Unlock premium capabilities
            and take full control of your digital life.
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', my: 2 }} />

        {/* Benefits */}
        <Box sx={{ mb: 3, flex: 1 }}>
          <Typography
            sx={{
              fontSize: '0.85rem',
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              mb: 1.5,
            }}
          >
            With Pro, You Get
          </Typography>
          <Stack spacing={1.5}>
            {[
              'Unlimited file uploads & attachments',
              'AI-powered features across all apps',
              'Advanced task automation',
              'Priority support',
              'Advanced encryption options',
            ].map((benefit) => (
              <Box key={benefit} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: alpha('#6366F1', 0.2),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#6366F1' }} />
                </Box>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.95rem' }}>
                  {benefit}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>

        {/* CTA */}
        <Stack spacing={2}>
          <Button
            fullWidth
            variant="contained"
            sx={{
              bgcolor: '#6366F1',
              color: '#fff',
              fontWeight: 900,
              py: 1.5,
              fontSize: '0.95rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderRadius: '12px',
              '&:hover': {
                bgcolor: '#818CF8',
              },
            }}
            onClick={() => {
              closeProUpgrade();
              router.push('/accounts/settings/billing');
            }}
            endIcon={<ExternalLink size={18} />}
          >
            Upgrade Now
          </Button>
          <Button
            fullWidth
            variant="text"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontWeight: 700,
              py: 1,
              fontSize: '0.9rem',
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
