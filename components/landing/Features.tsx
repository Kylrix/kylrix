"use client";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import { alpha } from "@mui/material/styles";

const VAULT_PRIMARY = "#10B981";
import ShieldIcon from "@mui/icons-material/Shield";
import LockIcon from "@mui/icons-material/Lock";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import PublicIcon from "@mui/icons-material/Public";
import SyncIcon from "@mui/icons-material/Sync";

const features = [
  {
    icon: ShieldIcon,
    title: "Private Encryption",
    description:
      "Your data is encrypted on your device. We never see your passwords.",
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
    title: "Automatic Syncing",
    description:
      "Your credentials sync automatically across all your devices.",
  },
  {
    icon: PublicIcon,
    title: "Cross-Platform Access",
    description: "Available on desktop, mobile, and as a browser extension.",
  },
  {
    icon: LockIcon,
    title: "Two-Factor Authentication",
    description: "Built-in TOTP code generator for added security.",
  },
];

export default function Features() {
  return (
    <Box sx={{ py: 15, bgcolor: 'rgba(255, 255, 255, 0.01)', borderY: '1px solid rgba(255, 255, 255, 0.05)' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 10 }}>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-space-grotesk)' }}>
            Security-First Password Management
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.5)', maxWidth: '700px', mx: 'auto' }}>
            Designed with your security and privacy as the top priority.
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
                  <feature.icon sx={{ fontSize: 28 }} />
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
