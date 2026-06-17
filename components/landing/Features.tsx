"use client";

import { Box, Container, Typography, Grid, Paper, alpha } from '@/lib/openbricks/primitives';

const VAULT_PRIMARY = "#10B981";
import { Shield as ShieldIcon, Lock as LockIcon, VpnKey as VpnKeyIcon, Fingerprint as FingerprintIcon, Public as PublicIcon, Sync as SyncIcon } from '@/lib/openbricks/icons';

const features = [
  {
    icon: ShieldIcon,
    title: "Private Storage",
    description:
      "Your data is locked on your device. We never see your passwords.",
  },
  {
    icon: VpnKeyIcon,
    title: "Secure Password Generator",
    description:
      "Create strong, unique passwords for all your accounts with one click.",
  },
  {
    icon: FingerprintIcon,
    title: "Biometric Authentication",
    description:
      "Quickly access your vault with fingerprint or face recognition.",
  },
  {
    icon: SyncIcon,
    title: "Keep in Sync",
    description:
      "Your saved items stay up to date across all your devices.",
  },
  {
    icon: PublicIcon,
    title: "Cross-Platform Access",
    description: "Available on desktop, mobile, and as a browser extension.",
  },
  {
    icon: LockIcon,
    title: "One-Time Codes",
    description: "Built-in code generator for extra security.",
  }];
const IconWrapper = ({ icon: Icon, sx }: { icon: any, sx?: any }) => <Icon sx={sx} />;

export default function Features() {
  return (
    <Box sx={{ py: 15, bgcolor: 'rgba(255, 255, 255, 0.01)', borderY: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 10 }}>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-space-grotesk)' }}>
            Private Password Management
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.5)', maxWidth: '700px', mx: 'auto' }}>
            Built to keep your passwords safe and easy to use.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {features.map((feature, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Paper sx={{ 
                p: 4, 
                height: '100%', 
                borderRadius: '28px', 
                bgcolor: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.05)',
                backgroundImage: 'none',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-8px)',
                  borderColor: alpha(VAULT_PRIMARY, 0.3),
                  bgcolor: 'rgba(255, 255, 255, 0.04)'
                }
              }}>
                <Box sx={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '16px', 
                  bgcolor: alpha(VAULT_PRIMARY, 0.1), 
                  color: VAULT_PRIMARY, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  mb: 3
                }}>

...

                  <IconWrapper icon={feature.icon} sx={{ fontSize: 28 }} />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>{feature.title}</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', lineHeight: 1.6 }}>{feature.description}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
