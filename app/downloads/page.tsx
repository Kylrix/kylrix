'use client';

import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Button, 
  Stack, 
  Grid, 
  alpha,
  Paper,
  Divider,
} from '@mui/material';
import { 
  Download,
  Terminal,
  Monitor,
  Smartphone,
  ChevronRight,
  ShieldCheck,
  Zap,
  Cpu
} from 'lucide-react';
import Navbar from '@/components/Navbar';

const DownloadCard = ({ platform }: any) => (
  <Paper 
    sx={{ 
      p: 6, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 4,
      transition: 'all 0.3s',
      '&:hover': { 
        borderColor: '#6366F1', 
        bgcolor: 'rgba(99, 102, 241, 0.02)', 
        transform: 'translateY(-8px)' 
      }
    }}
  >
    <Box sx={{ color: '#6366F1' }}>
      <platform.icon size={48} strokeWidth={1} />
    </Box>
    <Box>
      <Typography variant="h3" sx={{ mb: 2, fontWeight: 900 }}>{platform.name}</Typography>
      <Typography variant="body1" sx={{ opacity: 0.5, lineHeight: 1.8 }}>{platform.desc}</Typography>
    </Box>
    <Stack spacing={2} sx={{ mt: 'auto' }}>
      {platform.links.map((link: any, i: number) => (
        <Button 
          key={i}
          fullWidth 
          variant={i === 0 ? "contained" : "outlined"} 
          startIcon={<Download size={18} />}
          sx={{ py: 1.5, borderRadius: 2 }}
        >
          {link.label}
        </Button>
      ))}
    </Stack>
  </Paper>
);

export default function DownloadsPage() {
  const platforms = [
    { 
      name: 'CLI Tooling', 
      icon: Terminal, 
      desc: 'Professional terminal client for managing extensions and P2P orchestration.',
      links: [
        { label: 'npm install -g @kylrix/cli' },
        { label: 'View Source on GitHub' }
      ]
    },
    { 
      name: 'Desktop App', 
      icon: Monitor, 
      desc: 'Complete Kylrix experience with a native dashboard for all core applications.',
      links: [
        { label: 'Download for macOS' },
        { label: 'Download for Windows' },
        { label: 'Download for Linux' }
      ]
    },
    { 
      name: 'Mobile Client', 
      icon: Smartphone, 
      desc: 'Stay synced with your private vault and AI orchestration on the go.',
      links: [
        { label: 'Download for iOS' },
        { label: 'Download for Android' }
      ]
    }
  ];

  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      
      <Container maxWidth="xl">
        <Stack spacing={10} sx={{ pt: { xs: 15, md: 25 }, pb: 20 }}>
          <Box textAlign="center">
            <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 4, fontWeight: 900, letterSpacing: '0.4em' }}>DOWNLOADS</Typography>
            <Typography variant="h1" sx={{ mb: 4, fontWeight: 900 }}>Get the <Box component="span" sx={{ color: '#6366F1' }}>Suite.</Box></Typography>
            <Typography variant="subtitle1" sx={{ maxWidth: 700, mx: 'auto', opacity: 0.6, fontSize: '1.25rem' }}>
              Native Kylrix clients for all your devices. Secure, private, and always in sync.
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

          <Grid container spacing={4}>
            {platforms.map((platform, i) => (
              <Grid size={{ xs: 12, md: 4 }} key={i}>
                <DownloadCard platform={platform} />
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 10, p: { xs: 6, md: 10 }, bgcolor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
            <Grid container spacing={8} alignItems="center">
              <Grid size={{ xs: 12, md: 7 }}>
                <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>Built for Integrity.</Typography>
                <Typography variant="body1" sx={{ opacity: 0.6, mb: 6, fontSize: '1.1rem', lineHeight: 1.8 }}>
                  Every binary we release is cryptographically signed and open-source.
                </Typography>
                <Stack direction="row" spacing={3}>
                  <Button variant="outlined" startIcon={<ShieldCheck size={18} />}>Verification Keys</Button>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={4}>
                  {[
                    { icon: Zap, title: 'Automatic Updates', text: 'Stay current with security patches.' },
                    { icon: Cpu, title: 'Native Performance', text: 'Optimized for local AI.' }
                  ].map((feat, i) => (
                    <Stack key={i} direction="row" spacing={3}>
                      <Box sx={{ color: '#6366F1', pt: 0.5 }}><feat.icon size={24} strokeWidth={1.5} /></Box>
                      <Box>
                        <Typography variant="h4" sx={{ mb: 1, fontWeight: 900 }}>{feat.title}</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.5 }}>{feat.text}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Stack>
      </Container>

      <Box sx={{ py: 15, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(5,5,5,0.8)' }}>
        <Container maxWidth="xl">
          <Typography variant="caption" sx={{ opacity: 0.2 }}>
            © 2026 Kylrix Organization. Built with absolute precision.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
