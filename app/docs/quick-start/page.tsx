'use client';

import React from 'react';
import { Box, Container, Typography, Stack, Divider, Paper, Button } from '@mui/material';
import { Terminal, CheckCircle2, ArrowRight, Rocket } from 'lucide-react';
import Navbar from '@/components/Navbar';
import NextLink from 'next/link';

export default function QuickStartPage() {
  const steps = [
    {
      title: 'Initialize your project',
      desc: 'Create a new project using your preferred framework and install the Kylrix SDK.',
      cmd: 'pnpm add @kylrix/sdk'
    },
    {
      title: 'Configure Identity',
      desc: 'Set up your Appwrite endpoint and project ID to connect to the Kylrix Root of Trust.',
      cmd: "const sdk = new Kylrix({ endpoint: '...', project: '...' });"
    },
    {
      title: 'Authenticate',
      desc: 'Use WebAuthn or standard sessions to authenticate your users across the ecosystem.',
      cmd: "await sdk.account.createOAuth2Session('kylrix');"
    }
  ];

  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <Box sx={{ py: { xs: 5, md: 10 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={6}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>GETTING STARTED</Typography>
              <Typography variant="h1" sx={{ mb: 2, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>Quick Start Guide</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6 }}>
                Get up and running with the Kylrix Ecosystem in less than 5 minutes.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

            <Stack spacing={4}>
              {steps.map((step, i) => (
                <Box key={i}>
                  <Stack direction="row" spacing={3} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: '50%', 
                      bgcolor: 'rgba(99, 102, 241, 0.1)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: '#6366F1',
                      fontWeight: 900,
                      fontSize: '0.8rem',
                      border: '1px solid rgba(99, 102, 241, 0.2)'
                    }}>
                      {i + 1}
                    </Box>
                    <Typography variant="h4" sx={{ fontWeight: 800 }}>{step.title}</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ mb: 2, opacity: 0.6, ml: 7 }}>{step.desc}</Typography>
                  <Paper sx={{ p: 3, ml: 7, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Terminal size={16} color="#6366F1" />
                      <Typography variant="body2" sx={{ fontFamily: 'JetBrains Mono', color: '#F2F2F2', fontSize: '0.85rem' }}>
                        {step.cmd}
                      </Typography>
                    </Stack>
                  </Paper>
                </Box>
              ))}
            </Stack>

            <Box sx={{ mt: 6, p: 6, bgcolor: 'rgba(99, 102, 241, 0.03)', borderRadius: 4, border: '1px solid rgba(99, 102, 241, 0.1)', textAlign: 'center' }}>
               <Rocket size={48} color="#6366F1" style={{ marginBottom: '24px' }} />
               <Typography variant="h3" sx={{ mb: 2, fontWeight: 900 }}>You're all set!</Typography>
               <Typography variant="body1" sx={{ mb: 4, opacity: 0.6 }}>Now explore the Core Systems to see what you can build.</Typography>
               <Button 
                component={NextLink}
                href="/docs/architecture"
                variant="contained" 
                endIcon={<ArrowRight size={18} />}
                sx={{ borderRadius: '12px', px: 4, py: 1.5 }}
               >
                 Explore Architecture
               </Button>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
