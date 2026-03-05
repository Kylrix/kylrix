'use client';

import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Stack, 
  Divider, 
  alpha,
  useTheme
} from '@mui/material';
import Navbar from '@/components/Navbar';
import DocsSidebar from '@/components/layout/DocsSidebar';
import { CodeBlock } from '@/components/ui/DocsUI';

export default function ArchitecturePage() {
  const theme = useTheme();

  return (
    <Box component="main" sx={{ pt: { xs: 8, md: 10 } }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <DocsSidebar />
      
      <Box sx={{ ml: { xs: 0, md: '300px' }, pt: { xs: 8, md: 12 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={8} sx={{ px: { xs: 2, md: 8 } }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>ARCHITECTURE</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>The Reactive Graph.</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem', lineHeight: 1.7 }}>
                Kylrix is built on a distributed reactive graph of specialized services, unified by a single identity and a live inter-app gossip protocol.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>Core Principles</Typography>
              <Stack spacing={4}>
                <Box>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: '#6366F1' }}>1. Point, Don't Duplicate</md.Typography>
                  <Typography variant="body1" sx={{ opacity: 0.7, lineHeight: 1.8 }}>
                    Data exists in exactly one place. If `Note` needs `Vault` data, it points to the source. We never replicate state across databases.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: '#6366F1' }}>2. Pulse vs. Notification</md.Typography>
                  <Typography variant="body1" sx={{ opacity: 0.7, lineHeight: 1.8 }}>
                    The **Pulse** is transient, live inter-app gossip via Realtime. **Notifications** are persistent pointers in the activity log.
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ mb: 2, fontWeight: 700, color: '#6366F1' }}>3. Universal Session</md.Typography>
                  <Typography variant="body1" sx={{ opacity: 0.7, lineHeight: 1.8 }}>
                    An Appwrite session is a global key. A user logged into **Accounts** is authenticated across the entire ecosystem.
                  </Typography>
                </Box>
              </Stack>
            </Box>

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>TableDB Terminology</Typography>
              <Typography variant="body1" sx={{ opacity: 0.7, mb: 4, lineHeight: 1.8 }}>
                We use standardized terminology to maintain architectural integrity across all clients.
              </Typography>
              <Box sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                <Stack spacing={2}>
                  <Typography variant="body2"><strong>Collections</strong> are referred to as <strong>Tables</strong>.</Typography>
                  <Typography variant="body2"><strong>Documents</strong> are referred to as <strong>Rows</strong>.</Typography>
                  <Typography variant="body2"><strong>Event Paths</strong> use the <code>.tables.[ID].rows.[ID]</code> structure.</Typography>
                </Stack>
              </Box>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
