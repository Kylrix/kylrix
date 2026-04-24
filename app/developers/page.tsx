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
  Code2, 
  Key, 
  ShieldCheck, 
  ArrowRight,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import NextLink from 'next/link';
import Navbar from '@/components/Navbar';

const DevSection = ({ icon: Icon, title, description, children }: any) => (
  <Box sx={{ py: { xs: 15, md: 20 }, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
    <Grid container spacing={10}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Stack spacing={4}>
          <Box sx={{ width: 64, height: 64, borderRadius: 3, bgcolor: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
            <Icon size={32} strokeWidth={1.5} />
          </Box>
          <Box>
            <Typography variant="h2" sx={{ mb: 3, fontSize: '2.5rem', fontWeight: 900 }}>{title}</Typography>
            <Typography variant="body1" sx={{ opacity: 0.5, lineHeight: 1.8, fontSize: '1.1rem' }}>{description}</Typography>
          </Box>
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {children}
      </Grid>
    </Grid>
  </Box>
);

const CodeBlock = ({ code, language = 'bash' }: { code: string; language?: string }) => (
  <Paper sx={{ p: 4, bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', overflowX: 'auto', borderRadius: 4 }}>
    <Typography variant="caption" sx={{ opacity: 0.3, display: 'block', mb: 3, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{language}</Typography>
    <pre style={{ margin: 0, color: '#f2f2f2', lineHeight: 1.6 }}>
      <code>{code}</code>
    </pre>
  </Paper>
);

export default function DevelopersPage() {
  return (
    <Box component="main" sx={{ pt: 12, bgcolor: '#000', color: '#fff' }}>
      <Navbar />
      
      {/* Hero */}
      <Box sx={{ pt: { xs: 15, md: 25 }, pb: { xs: 10, md: 15 }, textAlign: 'center' }}>
        <Container maxWidth="lg">
          <Typography variant="subtitle2" sx={{ mb: 6, color: '#6366F1', letterSpacing: '0.4em', fontWeight: 900, textTransform: 'uppercase' }}>DEVELOPER PORTAL</Typography>
          <Typography variant="h1" sx={{ mb: 6, fontWeight: 900 }}>Build for the <br /><Box component="span" sx={{ color: '#6366F1' }}>Private Web.</Box></Typography>
          <Typography variant="subtitle1" sx={{ mb: 8, maxWidth: 800, mx: 'auto', fontSize: '1.25rem', opacity: 0.6 }}>
            Modular infrastructure for secure, AI-powered applications with zero-knowledge privacy at the core.
          </Typography>
          <Stack direction="row" spacing={3} justifyContent="center">
            <Button size="large" variant="contained" sx={{ px: 6, borderRadius: 2 }}>Create Client ID</Button>
            <Button size="large" variant="outlined" sx={{ px: 6, borderRadius: 2 }}>Read Docs</Button>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="xl">
        {/* Extensions */}
        <DevSection 
          icon={Code2}
          title="Extensions"
          description="Extend the Kylrix ecosystem with custom capabilities. Build tools that live directly within Flow, Vault, or Note."
        >
          <Stack spacing={6}>
            <Typography variant="body1" sx={{ fontSize: '1.2rem', opacity: 0.8 }}>
              Modular bundles that hook into Kylrix events, add UI components, or provide custom AI tools to the orchestration layer.
            </Typography>
            <CodeBlock 
              language="typescript"
              code={`import { Extension } from '@kylrix/sdk';

export default new Extension({
  id: 'my-custom-tool',
  name: 'Intelligence Booster',
  onActivate: async (context) => {
    console.log('Kylrix Extension Active');
  }
});`}
            />
            <Button variant="outlined" sx={{ alignSelf: 'flex-start', px: 4, borderRadius: 2 }} endIcon={<ArrowRight size={18} />}>Extension Guide</Button>
          </Stack>
        </DevSection>

        {/* Client IDs & Auth */}
        <DevSection 
          icon={Key}
          title="OAuth & Client IDs"
          description="Register your third-party applications to interact with the Kylrix ecosystem securely."
        >
          <Stack spacing={6}>
            <Typography variant="body1" sx={{ fontSize: '1.2rem', opacity: 0.8 }}>
              Manage your Client IDs and Secrets to authorize your applications for P2P communication and secure data access.
            </Typography>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper sx={{ p: 6, height: '100%', borderStyle: 'dashed', bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography variant="h3" sx={{ mb: 3, fontWeight: 900 }}>Register App</Typography>
                  <Typography variant="body2" sx={{ mb: 4, opacity: 0.5, lineHeight: 1.6 }}>Generate unique credentials for your platform.</Typography>
                  <Button variant="contained" fullWidth size="large">New Client ID</Button>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Paper sx={{ p: 6, height: '100%', bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography variant="h3" sx={{ mb: 3, fontWeight: 900 }}>Permissions</Typography>
                  <Typography variant="body2" sx={{ mb: 4, opacity: 0.5, lineHeight: 1.6 }}>Configure granular Scopes for your application.</Typography>
                  <Stack spacing={2}>
                    {['identity:read', 'vault:write', 'flow:execute'].map(scope => (
                      <Box key={scope} sx={{ px: 3, py: 1.5, bgcolor: 'rgba(99, 102, 241, 0.03)', borderRadius: 2, border: '1px solid rgba(99, 102, 241, 0.1)' }}>
                        <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)', color: '#6366F1', fontWeight: 700 }}>{scope}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </Stack>
        </DevSection>

        {/* Sign in with Kylrix */}
        <DevSection 
          icon={ShieldCheck}
          title="Sign in with Kylrix"
          description="Leverage our WebAuthn-based identity system to provide passwordless, secure login for your users."
        >
          <Stack spacing={6}>
            <Typography variant="body1" sx={{ fontSize: '1.2rem', opacity: 0.8 }}>
              Implement the most secure authentication method on the web. No passwords, just biometric security.
            </Typography>
            <Box 
              sx={{ 
                p: 8, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 4,
                bgcolor: '#161514',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6
              }}
            >
              <Button 
                variant="contained" 
                size="large" 
                startIcon={<Typography variant="h3" sx={{ color: 'inherit', fontWeight: 900, mb: 0.5 }}>K</Typography>}
                sx={{ 
                  bgcolor: '#fff', 
                  color: '#000', 
                  px: 6, 
                  py: 2,
                  fontSize: '1.2rem',
                  borderRadius: 2,
                  '&:hover': { bgcolor: '#f2f2f2' } 
                }}
              >
                Sign in with Kylrix
              </Button>
              <Typography variant="caption" sx={{ opacity: 0.4, letterSpacing: '0.1em' }}>BIOMETRIC / WEBAUTHN SECURED</Typography>
            </Box>
          </Stack>
        </DevSection>
      </Container>

      {/* Footer */}
      <Box sx={{ py: 15, mt: 20, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: '#000' }}>
        <Container maxWidth="xl">
          <Typography variant="caption" sx={{ opacity: 0.2 }}>
            © 2026 Kylrix Organization. Built with absolute precision.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}
