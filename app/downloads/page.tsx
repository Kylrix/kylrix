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
  AppBar,
  Toolbar,
  Link as MuiLink
} from '@mui/material';
import { 
  Download,
  Terminal,
  Monitor,
  Smartphone,
  ChevronRight,
  ArrowRight,
  Github,
  Search,
  Cpu,
  ShieldCheck,
  Zap
} from 'lucide-react';
import NextLink from 'next/link';

const Navbar = () => {
  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        bgcolor: 'rgba(0,0,0,0.85)', 
        backdropFilter: 'blur(30px)', 
        boxShadow: 'none', 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backgroundImage: 'none'
      }}
    >
      <Container maxWidth="xl">
        <Toolbar 
          disableGutters 
          sx={{ 
            height: { xs: 80, md: 100 }, 
            justifyContent: 'space-between',
            px: { xs: 2, md: 0 } 
          }}
        >
          <Box component={NextLink} href="/" sx={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: '-0.05em', color: '#fff' }}>KYLRIX</Typography>
          </Box>
          
          <Stack 
            direction="row" 
            spacing={{ xs: 2, md: 6 }} 
            sx={{ 
              display: { xs: 'none', md: 'flex' }, 
              alignItems: 'center' 
            }}
          >
            {['Products', 'Developers', 'Docs', 'Downloads'].map((item) => (
              <Box key={item}>
                <MuiLink
                  component={NextLink}
                  href={`/${item.toLowerCase()}`}
                  underline="none"
                  sx={{ 
                    fontWeight: 700, 
                    fontSize: '0.85rem',
                    opacity: item === 'Downloads' ? 1 : 0.5,
                    color: item === 'Downloads' ? '#00F5FF' : '#fff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    transition: 'all 0.3s',
                    '&:hover': { opacity: 1, color: '#00F5FF' }
                  }}
                >
                  {item}
                </MuiLink>
              </Box>
            ))}
          </Stack>

          <Stack direction="row" spacing={3} alignItems="center">
            <Box 
              component="a" 
              href="https://github.com/kylrix" 
              target="_blank" 
              sx={{ 
                color: '#fff', 
                opacity: 0.5, 
                transition: 'all 0.3s', 
                '&:hover': { opacity: 1, color: '#00F5FF' },
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Github size={22} />
            </Box>
            <Button 
              variant="contained" 
              color="primary" 
              sx={{ 
                borderRadius: 100, 
                px: 4,
                fontWeight: 900
              }}
            >
              Launch Console
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

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
        borderColor: '#00F5FF', 
        bgcolor: 'rgba(0, 245, 255, 0.02)', 
        transform: 'translateY(-8px)' 
      }
    }}
  >
    <Box sx={{ color: '#00F5FF' }}>
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
      desc: 'The professional terminal client for managing extensions and P2P orchestration.',
      links: [
        { label: 'npm install -g @kylrix/cli' },
        { label: 'View Source on GitHub' }
      ]
    },
    { 
      name: 'Desktop App', 
      icon: Monitor, 
      desc: 'The complete Kylrix experience with a native dashboard for all core applications.',
      links: [
        { label: 'Download for macOS (Silicon)' },
        { label: 'Download for Windows' },
        { label: 'Download for Linux (.AppImage)' }
      ]
    },
    { 
      name: 'Mobile Client', 
      icon: Smartphone, 
      desc: 'Stay synced with your private vault and AI orchestration on the go.',
      links: [
        { label: 'Download for iOS (TestFlight)' },
        { label: 'Download for Android (APK)' }
      ]
    }
  ];

  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <Container maxWidth="xl">
        <Stack spacing={10} sx={{ pt: { xs: 15, md: 25 }, pb: 20 }}>
          {/* Hero Section */}
          <Box textAlign="center">
            <Typography variant="subtitle2" sx={{ color: '#00F5FF', mb: 4, fontWeight: 900, letterSpacing: '0.4em' }}>DOWNLOADS</Typography>
            <Typography variant="h1" sx={{ mb: 4, fontWeight: 900 }}>Get the <Box component="span" sx={{ color: '#00F5FF' }}>Suite.</Box></Typography>
            <Typography variant="subtitle1" sx={{ maxWidth: 700, mx: 'auto', opacity: 0.6, fontSize: '1.25rem' }}>
              Download the native Kylrix clients for all your devices. 
              Secure, private, and always in sync.
            </Typography>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

          {/* Downloads Grid */}
          <Grid container spacing={4}>
            {platforms.map((platform, i) => (
              <Grid size={{ xs: 12, md: 4 }} key={i}>
                <DownloadCard platform={platform} />
              </Grid>
            ))}
          </Grid>

          {/* Infrastructure/Security Note */}
          <Box sx={{ mt: 10, p: { xs: 6, md: 10 }, bgcolor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
            <Grid container spacing={8} alignItems="center">
              <Grid size={{ xs: 12, md: 7 }}>
                <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>Built for Integrity.</Typography>
                <Typography variant="body1" sx={{ opacity: 0.6, mb: 6, fontSize: '1.1rem', lineHeight: 1.8 }}>
                  Every binary we release is cryptographically signed and open-source. 
                  We believe in complete transparency for tools that handle your digital sovereignty.
                </Typography>
                <Stack direction="row" spacing={3}>
                  <Button variant="outlined" startIcon={<ShieldCheck size={18} />}>Verification Keys</Button>
                  <Button variant="outlined" startIcon={<Github size={18} />}>Release Notes</Button>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 5 }}>
                <Stack spacing={4}>
                  {[
                    { icon: Zap, title: 'Automatic Updates', text: 'Stay current with the latest security patches.' },
                    { icon: Cpu, title: 'Native Performance', text: 'Optimized for local AI and cryptographic operations.' }
                  ].map((feat, i) => (
                    <Stack key={i} direction="row" spacing={3}>
                      <Box sx={{ color: '#00F5FF', pt: 0.5 }}><feat.icon size={24} strokeWidth={1.5} /></Box>
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

      {/* Footer */}
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
