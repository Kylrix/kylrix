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
  Divider
} from '@mui/material';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ShieldCheck, 
  ChevronRight, 
  ArrowRight,
  LayoutDashboard,
  MessageSquare,
  Lock,
  StickyNote,
  Terminal,
  Layers,
  Fingerprint,
  Cpu
} from 'lucide-react';
import NextLink from 'next/link';
import Navbar from '@/components/Navbar';

const ProductCard = ({ app }: any) => (
  <motion.div whileHover={{ y: -12 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
    <Box 
      sx={{ 
        p: { xs: 4, md: 6 }, 
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        gap: 4,
        background: 'rgba(10, 10, 10, 0.8)',
        backdropFilter: 'blur(30px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        transition: 'all 0.4s',
        '&:hover': { 
          borderColor: 'rgba(0, 245, 255, 0.4)', 
          background: 'rgba(15, 15, 15, 0.95)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
        }
      }}
    >
      <Box 
        sx={{ 
          width: 64, 
          height: 64, 
          borderRadius: 3, 
          bgcolor: 'rgba(0, 245, 255, 0.05)', 
          border: '1px solid rgba(0, 245, 255, 0.1)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#00F5FF' 
        }}
      >
        <app.icon size={32} strokeWidth={1.5} />
      </Box>
      
      <Box>
        <Typography variant="h3" sx={{ mb: 2, fontWeight: 900 }}>{app.name}</Typography>
        <Typography variant="body1" sx={{ opacity: 0.5, lineHeight: 1.8 }}>{app.desc}</Typography>
      </Box>

      <Box sx={{ mt: 'auto', pt: 4 }}>
         <Typography 
           variant="caption" 
           sx={{ 
             display: 'flex', 
             alignItems: 'center', 
             gap: 1, 
             color: '#00F5FF', 
             fontWeight: 900, 
             textTransform: 'uppercase', 
             letterSpacing: '0.2em' 
           }}
         >
           Initialize {app.name} <ChevronRight size={14} />
         </Typography>
      </Box>
    </Box>
  </motion.div>
);

import Logo from '@/components/Logo';

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);

  const apps = [
    { name: 'Flow', icon: LayoutDashboard, desc: 'Advanced AI orchestration for high-fidelity task management and event-driven workflows.' },
    { name: 'Vault', icon: Lock, desc: 'Zero-knowledge security for your most sensitive assets, credentials, and cryptographic keys.' },
    { name: 'Connect', icon: MessageSquare, desc: 'Encrypted peer-to-peer communication layer with integrated AI assistance.' },
    { name: 'CLI', icon: Terminal, desc: 'A powerful, native terminal client for developers to interface with the Kylrix ecosystem.' },
    { name: 'Note', icon: StickyNote, desc: 'Privacy-first intelligent note-taking and knowledge synthesis powered by local AI.' },
    { name: 'Accounts', icon: ShieldCheck, desc: 'Unified identity management using WebAuthn for passwordless, secure authentication.' },
  ];

  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      <div className="bg-mesh" />
      
      {/* Hero Section */}
      <Container maxWidth="xl">
        <motion.div style={{ opacity }}>
          <Stack 
            spacing={8} 
            alignItems="center" 
            textAlign="center" 
            sx={{ 
              pt: { xs: 15, md: 25 }, 
              pb: { xs: 15, md: 30 },
              px: { xs: 2, md: 0 }
            }}
          >
            <Box>
              <Typography 
                variant="subtitle2" 
                sx={{ 
                  mb: 4,
                  color: '#00F5FF',
                  letterSpacing: '0.4em',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  fontSize: { xs: '0.7rem', md: '0.875rem' }
                }}
              >
                Architecture of Digital Intelligence
              </Typography>
              <Typography 
                variant="h1" 
                sx={{ 
                  mb: 6, 
                  fontWeight: 900,
                  fontSize: { xs: '3rem', md: '5.5rem' }
                }}
              >
                Software for the <br /> 
                <Box component="span" sx={{ color: '#00F5FF' }}>Private Era.</Box>
              </Typography>
              <Typography 
                variant="subtitle1" 
                sx={{ 
                  maxWidth: 850, 
                  mx: 'auto', 
                  opacity: 0.6, 
                  fontSize: { xs: '1.1rem', md: '1.5rem' },
                  lineHeight: 1.6
                }}
              >
                A premium ecosystem of secure, AI-driven applications engineered 
                for absolute performance, zero-knowledge privacy, and precision.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
              <Button 
                size="large" 
                variant="contained" 
                color="primary" 
                sx={{ px: 6, py: 2.5, fontSize: '1.1rem', borderRadius: 2 }}
              >
                Get Started
              </Button>
              <Button 
                size="large" 
                variant="outlined" 
                sx={{ px: 6, py: 2.5, fontSize: '1.1rem', borderRadius: 2 }}
              >
                Documentation
              </Button>
            </Stack>
          </Stack>
        </motion.div>
      </Container>

      {/* Flagships Grid */}
      <Box sx={{ py: { xs: 15, md: 25 }, borderTop: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.01)' }}>
        <Container maxWidth="xl">
          <Stack spacing={4} mb={15} textAlign="center">
            <Typography variant="subtitle2" sx={{ color: '#00F5FF', fontWeight: 900 }}>THE FLAGSHIPS</Typography>
            <Typography variant="h2" sx={{ fontWeight: 900 }}>Ecosystem of Precision.</Typography>
          </Stack>

          <Grid container spacing={4}>
            {apps.map((app) => (
              <Grid size={{ xs: 12, md: 4 }} key={app.name}>
                <ProductCard app={app} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Infrastructure Section */}
      <Box sx={{ py: { xs: 15, md: 25 } }}>
        <Container maxWidth="xl">
          <Grid container spacing={10} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <Stack spacing={8}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 4, color: '#00F5FF', fontWeight: 900 }}>INFRASTRUCTURE</Typography>
                  <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>Secure by Design. <br />Private by Default.</Typography>
                  <Typography variant="body1" sx={{ opacity: 0.5, maxWidth: 600, fontSize: '1.25rem' }}>
                    Every Kylrix application is built on our proprietary infrastructure layer, ensuring your data never leaves your control.
                  </Typography>
                </Box>
                
                <Stack spacing={6}>
                  {[
                    { icon: Fingerprint, title: 'Zero-Knowledge', desc: 'Local encryption ensures only you have access to your data.' },
                    { icon: Layers, title: 'Modular Systems', desc: 'Built for developers to extend and integrate seamlessly.' },
                    { icon: Cpu, title: 'Edge Intelligence', desc: 'Real-time local AI processing for maximum performance.' }
                  ].map((f, i) => (
                    <Stack key={i} direction="row" spacing={4}>
                      <Box sx={{ color: '#00F5FF', pt: 1 }}>
                        <f.icon size={32} strokeWidth={1.5} />
                      </Box>
                      <Box>
                        <Typography variant="h3" sx={{ mb: 1, fontSize: '1.75rem', fontWeight: 900 }}>{f.title}</Typography>
                        <Typography variant="body1" sx={{ opacity: 0.4 }}>{f.desc}</Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </Grid>
            
            <Grid size={{ xs: 12, md: 6 }}>
              <Box 
                sx={{ 
                  p: { xs: 4, md: 10 }, 
                  minHeight: 600, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center',
                  bgcolor: 'rgba(5,5,5,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  position: 'relative'
                }}
              >
                <Stack spacing={6}>
                  <Box sx={{ opacity: 0.2, color: '#00F5FF' }}>
                    <Terminal size={64} strokeWidth={1} />
                  </Box>
                  <Typography variant="h2" sx={{ fontFamily: 'var(--font-mono)', fontSize: 'clamp(1.5rem, 4vw, 2.5rem)', fontWeight: 400, opacity: 0.9 }}>
                    <Box component="span" sx={{ color: '#00F5FF' }}>$</Box> kylrix initialize <br />
                    <Box component="span" sx={{ opacity: 0.3 }}>
                      &gt; Secure Tunnel Established.<br />
                      &gt; P2P Handshake Success.<br />
                      &gt; Ecosystem Syncing...
                    </Box>
                  </Typography>
                  <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />
                  <Box component={NextLink} href="/developers" sx={{ textDecoration: 'none' }}>
                    <Button 
                      size="large" 
                      variant="outlined" 
                      endIcon={<ArrowRight size={20} />} 
                      sx={{ px: 5, py: 2, borderRadius: 2 }}
                    >
                      Developer Portal
                    </Button>
                  </Box>
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 15, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'rgba(5,5,5,0.8)' }}>
        <Container maxWidth="xl">
          <Grid container spacing={8}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Logo size={40} sx={{ mb: 4 }} />
              <Typography variant="body1" sx={{ opacity: 0.4, maxWidth: 400 }}>
                High-fidelity secure productivity applications. Built for the future of digital sovereignty.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Grid container spacing={8} justifyContent="flex-end">
                {[
                  { title: 'Resources', links: ['Docs', 'Developers', 'Downloads'] },
                  { title: 'Legal', links: ['Privacy', 'Terms'] }
                ].map((col) => (
                  <Grid size={{ xs: 6, sm: 4 }} key={col.title}>
                    <Typography variant="subtitle2" sx={{ mb: 4, color: '#fff', opacity: 0.3, letterSpacing: '0.2em' }}>{col.title}</Typography>
                    <Stack spacing={2}>
                      {col.links.map(link => (
                        <Box key={link} component={NextLink} href={`/${link.toLowerCase()}`} sx={{ textDecoration: 'none' }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              fontWeight: 500, 
                              opacity: 0.5, 
                              transition: 'all 0.3s',
                              '&:hover': { opacity: 1, color: '#00F5FF' } 
                            }}
                          >
                            {link}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
          <Box sx={{ mt: 10, pt: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <Typography variant="caption" sx={{ opacity: 0.2 }}>
              © 2026 Kylrix Organization. Built with absolute precision.
            </Typography>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
