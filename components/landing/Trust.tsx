"use client";

import { Box, Container, Typography, Grid, Paper, Stack, alpha } from "@mui/material";

const VAULT_PRIMARY = "#10B981";
import ShieldIcon from "@mui/icons-material/Shield";
import LockIcon from "@mui/icons-material/Lock";
import FingerprintIcon from "@mui/icons-material/Fingerprint";

export default function Trust() {
  return (
    <Box sx={{ py: 15 }}>
      <Container maxWidth="lg">
        <Grid container spacing={8} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 3, fontFamily: 'var(--font-space-grotesk)' }}>
              Your Security Is Our Priority
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4, lineHeight: 1.8 }}>
              With industry-leading encryption and rigorous security practices, Kylrix Vault ensures your digital life remains private and protected.
            </Typography>
            <Stack spacing={3}>
              {[
                { icon: ShieldIcon, title: 'Advanced Encryption', desc: 'Military-grade encryption that protects your data at rest and in transit.', color: '#4CAF50' },
                { icon: LockIcon, title: 'SOC 2 Certified', desc: 'Our security processes are regularly audited and certified by independent experts.', color: '#2196F3' },
                { icon: FingerprintIcon, title: 'Private Access', desc: 'We never see your passwords. Your data is encrypted and decrypted locally.', color: '#9C27B0' },
              ].map((item, i) => (
                <Stack key={i} direction="row" spacing={3} alignItems="flex-start">
                  <Box sx={{ 
                    p: 1.5, 
                    borderRadius: '12px', 
                    bgcolor: alpha(item.color, 0.1), 
                    color: item.color 
                  }}>
                    <item.icon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{item.title}</Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>{item.desc}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ 
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: '-10%',
                right: '-10%',
                width: '120%',
                height: '120%',
                background: `radial-gradient(circle, ${alpha(VAULT_PRIMARY, 0.05)} 0%, transparent 70%)`,
                zIndex: 0
              }
            }}>
              <Paper sx={{ 
                p: 1, 
                borderRadius: '32px', 
                bgcolor: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundImage: 'none',
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden'
              }}>
                <Box component="img" src="https://images.unsplash.com/photo-1633265485768-30698f1d11bc?auto=format&fit=crop&q=80&w=1000" sx={{ width: '100%', borderRadius: '24px', display: 'block', opacity: 0.8 }} />
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
