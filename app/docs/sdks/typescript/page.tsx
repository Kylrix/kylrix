'use client';

import React from 'react';
import { Box, Container, Typography, Stack, Divider, Paper } from '@mui/material';
import { Terminal, Code, Cpu, Package } from 'lucide-react';
import Navbar from '@/components/Navbar';

export default function TypeScriptSDKPage() {
  return (
    <Box component="main" sx={{ pt: 12 }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <Box sx={{ py: { xs: 5, md: 10 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={6}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>SDK DOCUMENTATION</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>TypeScript SDK</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem', lineHeight: 1.7 }}>
                Integrate Kylrix into your web applications with our official TypeScript SDK. Built for safety, performance, and developer comfort.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900, fontSize: '2rem' }}>Installation</Typography>
              <Paper sx={{ p: 4, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Terminal size={20} color="#6366F1" />
                  <Typography variant="body2" sx={{ fontFamily: 'JetBrains Mono', color: '#F2F2F2' }}>
                    pnpm add @kylrix/sdk
                  </Typography>
                </Stack>
              </Paper>
            </Box>

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900, fontSize: '2rem' }}>Quick Start</Typography>
              <Paper sx={{ p: 4, bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}>
                <Typography variant="body2" sx={{ fontFamily: 'JetBrains Mono', whiteSpace: 'pre-wrap', color: '#A1A1AA' }}>
                  {`import { Kylrix } from '@kylrix/sdk';

// Initialize the SDK
const kylrix = new Kylrix({
  endpoint: 'https://cloud.appwrite.io/v1',
  project: 'your-project-id'
});

// Access identity features
const session = await kylrix.account.getSession('current');`}
                </Typography>
              </Paper>
            </Box>

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900, fontSize: '2rem' }}>Features</Typography>
              <Stack spacing={4}>
                <Stack direction="row" spacing={3} alignItems="flex-start">
                  <Box sx={{ color: '#6366F1', pt: 0.5 }}><Package size={24} /></Box>
                  <Box>
                    <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>Type Safe API</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.5 }}>Full TypeScript support with auto-generated interfaces for TableDB schemas.</Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={3} alignItems="flex-start">
                  <Box sx={{ color: '#6366F1', pt: 0.5 }}><Cpu size={24} /></Box>
                  <Box>
                    <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>Offline Support</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.5 }}>Built-in local caching and background synchronization for the private web.</Typography>
                  </Box>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
