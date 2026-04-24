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
  ChevronRight, 
  ArrowRight,
  LayoutDashboard,
  MessageSquare,
  Lock,
  StickyNote,
  Terminal,
  ShieldCheck,
} from 'lucide-react';
import NextLink from 'next/link';
import Navbar from '@/components/Navbar';

const ProductHero = ({ app, reversed = false }: any) => (
  <Box sx={{ py: { xs: 15, md: 25 }, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <Grid container spacing={10} direction={reversed ? 'row-reverse' : 'row'} alignItems="center">
      <Grid size={{ xs: 12, md: 6 }}>
        <Stack spacing={4}>
          <Stack direction="row" spacing={2} alignItems="center">
             <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
               <app.icon size={28} strokeWidth={1.5} />
             </Box>
             <Typography variant="subtitle2" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.3em' }}>{app.tagline}</Typography>
          </Stack>
          
          <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: '3rem', md: '4.5rem' } }}>{app.name}</Typography>
          
          <Typography variant="subtitle1" sx={{ opacity: 0.6, fontSize: '1.25rem', lineHeight: 1.7, maxWidth: 550 }}>
            {app.longDesc}
          </Typography>

          <Stack spacing={3} sx={{ pt: 2 }}>
            {app.features.map((feat: string, i: number) => (
              <Stack key={i} direction="row" spacing={2} alignItems="center">
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#6366F1' }} />
                <Typography variant="body1" sx={{ fontWeight: 600, opacity: 0.8 }}>{feat}</Typography>
              </Stack>
            ))}
          </Stack>

          <Stack direction="row" spacing={3} sx={{ pt: 4 }}>
            <Button size="large" variant="contained" endIcon={<ArrowRight size={18} />}>Get Started</Button>
            <Button size="large" variant="outlined">Documentation</Button>
          </Stack>
        </Stack>
      </Grid>
      
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper 
          sx={{ 
            p: 4, 
            height: 500, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center',
            bgcolor: 'rgba(5,5,5,0.4)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 40, bgcolor: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', px: 2, gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,95,86,0.5)' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(255,189,46,0.5)' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'rgba(39,201,63,0.5)' }} />
          </Box>
          <Stack spacing={3} sx={{ px: 4 }}>
             <Box sx={{ height: 10, width: '40%', bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 5 }} />
             <Box sx={{ height: 60, width: '100%', bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }} />
             <Box sx={{ height: 10, width: '60%', bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 5 }} />
             <Box sx={{ height: 100, width: '100%', bgcolor: 'rgba(0,245,255,0.02)', border: '1px dashed rgba(0,245,255,0.1)', borderRadius: 2 }} />
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  </Box>
);

export default function ProductsPage() {
  const products = [
    {
      name: 'Flow',
      icon: LayoutDashboard,
      tagline: 'ORCHESTRATION ENGINE',
      longDesc: 'Advanced AI-driven orchestration for high-fidelity task management. Automate complex event-driven workflows with local execution and zero-knowledge data security.',
      features: ['Real-time Event Triggers', 'Local AI Model Integration', 'Cross-Platform Sync', 'Declarative Workflow Engine'],
      color: '#6366F1'
    },
    {
      name: 'Vault',
      icon: Lock,
      tagline: 'SECURE ASSET MANAGEMENT',
      longDesc: 'The definitive solution for zero-knowledge security. Store your most sensitive credentials, cryptographic keys, and digital assets in a local-first, peer-verified environment.',
      features: ['End-to-End Encryption', 'WebAuthn Hardware Support', 'Secure Note Attachments', 'Automatic Breach Alerts'],
      color: '#F43F5E'
    },
    {
      name: 'Connect',
      icon: MessageSquare,
      tagline: 'ENCRYPTED P2P LAYER',
      longDesc: 'Seamless, encrypted communication layer for the modern web. Establish secure tunnels between your devices and trusted peers without centralized intermediaries.',
      features: ['P2P Direct Handshake', 'AI-Assisted Collaboration', 'File Transfer over Tunnel', 'Metadata-Free Routing'],
      color: '#A855F7'
    },
    {
      name: 'CLI',
      icon: Terminal,
      tagline: 'DEVELOPER INTERFACE',
      longDesc: 'A powerful, native terminal client engineered for precision. Manage your entire Kylrix environment, initialize extensions, and monitor secure streams directly from your shell.',
      features: ['Headless Orchestration', 'Extension Development Kit', 'Security Audit Tools', 'JSON-Native API Support'],
      color: '#10B981'
    },
    {
      name: 'Note',
      icon: StickyNote,
      tagline: 'INTELLIGENT KNOWLEDGE',
      longDesc: 'Privacy-first knowledge synthesis powered by local intelligence. Take notes, build graphs, and let local AI help you discover hidden connections across your data.',
      features: ['Bi-directional Linking', 'Graph Visualization', 'Local AI Summary Tools', 'Secure Markdown Editor'],
      color: '#F59E0B'
    },
    {
      name: 'Accounts',
      icon: ShieldCheck,
      tagline: 'UNIFIED IDENTITY',
      longDesc: 'A revolutionary approach to digital identity. Using WebAuthn and biometric security, Accounts provides a passwordless gateway to the entire Kylrix ecosystem and beyond.',
      features: ['Passwordless Biometrics', 'Multi-Factor Verification', 'Single Sign-On (SSO)', 'Identity Audit Logs'],
      color: '#6366F1'
    }
  ];

  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      
      <Container maxWidth="xl">
        <Stack spacing={8} alignItems="center" textAlign="center" sx={{ pt: { xs: 15, md: 25 }, pb: { xs: 15, md: 20 } }}>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 4, color: '#6366F1', letterSpacing: '0.4em', fontWeight: 900 }}>KYLRIX SUITE</Typography>
            <Typography variant="h1" sx={{ mb: 4, fontWeight: 900 }}>Tools for the <br /> <Box component="span" sx={{ color: '#6366F1' }}>Digital Sovereign.</Box></Typography>
            <Typography variant="subtitle1" sx={{ maxWidth: 850, mx: 'auto', opacity: 0.6, fontSize: '1.4rem' }}>
              A deeply integrated ecosystem of high-performance applications designed to 
              give you absolute control over your intelligence, privacy, and productivity.
            </Typography>
          </Box>
        </Stack>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

        {products.map((product, i) => (
          <ProductHero key={product.name} app={product} reversed={i % 2 !== 0} />
        ))}

        <Box sx={{ py: { xs: 20, md: 30 }, textAlign: 'center' }}>
           <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>Ready to upgrade your stack?</Typography>
           <Typography variant="body1" sx={{ mb: 6, opacity: 0.5, maxWidth: 600, mx: 'auto', fontSize: '1.25rem' }}>
             Start your journey with the Kylrix ecosystem today. 
             Download the clients and join the future of private productivity.
           </Typography>
           <Stack direction="row" spacing={3} justifyContent="center">
              <Button size="large" variant="contained">Get Started for Free</Button>
              <NextLink href="/downloads" passHref style={{ textDecoration: 'none' }}>
                <Button size="large" variant="outlined">Download Clients</Button>
              </NextLink>
           </Stack>
        </Box>
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
