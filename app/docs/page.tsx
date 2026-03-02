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
  Link as MuiLink,
  List,
  ListItem,
  ListItemButton,
  ListItemText
} from '@mui/material';
import { 
  ChevronRight, 
  ArrowRight,
  Search,
  BookOpen,
  Code2,
  Cpu,
  Fingerprint,
  Layers,
  ShieldCheck,
  Terminal,
  Zap,
  ExternalLink
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
        backgroundImage: 'none',
        zIndex: (theme) => theme.zIndex.drawer + 1
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
                    opacity: item === 'Docs' ? 1 : 0.5,
                    color: item === 'Docs' ? '#00F5FF' : '#fff',
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

          <Button 
            variant="outlined" 
            color="primary" 
            sx={{ 
              borderRadius: 100, 
              px: 4,
              fontWeight: 900
            }}
            startIcon={<Search size={16} />}
          >
            Search
          </Button>
        </Toolbar>
      </Container>
    </AppBar>
  );
};

const Sidebar = () => {
  const sections = [
    { 
      title: 'Introduction', 
      items: ['Overview', 'Quick Start', 'Architecture'] 
    },
    { 
      title: 'Core Systems', 
      items: ['Identity & WebAuthn', 'Zero-Knowledge Vault', 'P2P Communication', 'Flow Orchestration'] 
    },
    { 
      title: 'Guides', 
      items: ['Building Extensions', 'Client Integration', 'Security Best Practices'] 
    },
    { 
      title: 'Reference', 
      items: ['API Reference', 'CLI Commands', 'SDK Documentation'] 
    }
  ];

  return (
    <Box sx={{ width: 280, pt: 15, pb: 10, position: 'fixed', height: '100vh', overflowY: 'auto', borderRight: '1px solid rgba(255,255,255,0.05)', display: { xs: 'none', md: 'block' } }}>
      <Stack spacing={4} sx={{ px: 4 }}>
        {sections.map((section) => (
          <Box key={section.title}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: '#fff', opacity: 0.3, letterSpacing: '0.15em', fontWeight: 900, fontSize: '0.7rem' }}>{section.title}</Typography>
            <List disablePadding>
              {section.items.map((item) => (
                <ListItem key={item} disablePadding sx={{ mb: 1 }}>
                  <ListItemButton 
                    sx={{ 
                      borderRadius: 1.5, 
                      px: 2, 
                      py: 0.75,
                      '&:hover': { bgcolor: 'rgba(0, 245, 255, 0.05)', color: '#00F5FF' }
                    }}
                  >
                    <ListItemText 
                      primary={item} 
                      primaryTypographyProps={{ 
                        variant: 'body2', 
                        sx: { fontWeight: 500, fontSize: '0.9rem', opacity: 0.7 } 
                      }} 
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

export default function DocsPage() {
  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <Sidebar />
      
      <Box sx={{ ml: { xs: 0, md: '280px' }, pt: { xs: 5, md: 10 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={8} sx={{ px: { xs: 2, md: 10 } }}>
            {/* Hero Area */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#00F5FF', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>DOCUMENTATION</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>Master the <br /> Ecosystem.</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem', lineHeight: 1.7 }}>
                Welcome to the Kylrix Documentation. This is your comprehensive guide to the 
                architecture, tools, and integration patterns that power the private web.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

            {/* Quick Links */}
            <Grid container spacing={4}>
              {[
                { icon: Zap, title: 'Quick Start', desc: 'Get your developer environment set up in under 5 minutes.' },
                { icon: Code2, title: 'SDK Guides', desc: 'Learn how to build modular extensions for Flow and Vault.' },
                { icon: Terminal, title: 'CLI Reference', desc: 'Comprehensive command list for managing your Kylrix instance.' },
                { icon: ShieldCheck, title: 'Security', desc: 'Understand our zero-knowledge protocols and WebAuthn auth.' }
              ].map((link, i) => (
                <Grid size={{ xs: 12, sm: 6 }} key={i}>
                  <Paper 
                    sx={{ 
                      p: 5, 
                      height: '100%', 
                      transition: 'all 0.3s', 
                      '&:hover': { borderColor: '#00F5FF', bgcolor: 'rgba(0, 245, 255, 0.02)', transform: 'translateY(-4px)' } 
                    }}
                  >
                    <Box sx={{ color: '#00F5FF', mb: 3 }}><link.icon size={32} strokeWidth={1.5} /></Box>
                    <Typography variant="h3" sx={{ mb: 2, fontSize: '1.5rem', fontWeight: 900 }}>{link.title}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.5, lineHeight: 1.6, mb: 3 }}>{link.desc}</Typography>
                    <MuiLink sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00F5FF', textDecoration: 'none', cursor: 'pointer' }}>
                      Learn More <ChevronRight size={14} />
                    </MuiLink>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {/* Content Section Example */}
            <Box sx={{ pt: 10 }}>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>The Core Philosophy.</Typography>
              <Stack spacing={4}>
                <Typography variant="body1" sx={{ opacity: 0.7, fontSize: '1.15rem' }}>
                  Kylrix is designed from the ground up to prioritize **Privacy First Architecture**. 
                  Every application in the ecosystem adheres to three fundamental pillars:
                </Typography>
                
                <Stack spacing={6} sx={{ pt: 4 }}>
                  {[
                    { icon: Fingerprint, title: 'Zero-Knowledge Security', text: 'All user data is encrypted locally using AES-256-GCM before synchronization. Kylrix never sees your plaintext data.' },
                    { icon: Layers, title: 'Modular Interoperability', text: 'Applications communicate over a secure P2P layer, allowing you to build extensions that work across the entire suite.' },
                    { icon: Cpu, title: 'Edge Execution', text: 'AI models and orchestration logic are processed locally on your hardware to minimize latency and maximize privacy.' }
                  ].map((p, i) => (
                    <Stack key={i} direction="row" spacing={4} alignItems="flex-start">
                      <Box sx={{ color: '#00F5FF', pt: 0.5 }}><p.icon size={28} strokeWidth={1.5} /></Box>
                      <Box>
                        <Typography variant="h4" sx={{ mb: 1.5, fontWeight: 900 }}>{p.title}</Typography>
                        <Typography variant="body1" sx={{ opacity: 0.5, lineHeight: 1.8 }}>{p.text}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Box>

            {/* Help Section */}
            <Box sx={{ mt: 10, p: 6, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center' }}>
               <Typography variant="h4" sx={{ mb: 2, fontWeight: 900 }}>Need more assistance?</Typography>
               <Typography variant="body2" sx={{ mb: 4, opacity: 0.5 }}>Join our developer community to get real-time support and stay updated.</Typography>
               <Stack direction="row" spacing={3} justifyContent="center">
                  <Button variant="outlined" endIcon={<ExternalLink size={16} />}>Community Discord</Button>
                  <Button variant="outlined" endIcon={<ExternalLink size={16} />}>GitHub Discussions</Button>
               </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 10, ml: { xs: 0, md: '280px' }, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Container maxWidth="lg">
          <Typography variant="caption" sx={{ opacity: 0.2 }}>
            © 2026 Kylrix Organization. Built with absolute precision for the global developer community.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
