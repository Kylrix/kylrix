'use client';

import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Stack, 
  Divider, 
  alpha,
  useTheme,
  Grid,
  Paper
} from '@mui/material';
import Navbar from '@/components/Navbar';
import DocsSidebar from '@/components/layout/DocsSidebar';
import { CodeBlock, LanguageSwitcher } from '@/components/ui/DocsUI';
import { Radio, MessageSquare, Zap, Activity } from 'lucide-react';

export default function RealtimeDocsPage() {
  const theme = useTheme();

  return (
    <Box component="main" sx={{ pt: { xs: 8, md: 10 } }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <DocsSidebar />
      
      <Box sx={{ ml: { xs: 0, md: '300px' }, pt: { xs: 8, md: 12 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={8} sx={{ px: { xs: 2, md: 8 } }}>
            {/* Hero */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>REALTIME GOSSIP</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>The Ecosystem Pulse.</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem' }}>
                Kylrix apps communicate via high-fidelity, transient signals. We call this the **Pulse Engine**.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h2" sx={{ fontWeight: 900 }}>Subscribing to Events</Typography>
                <LanguageSwitcher />
            </Stack>

            <Box>
              <Typography variant="body1" sx={{ mb: 4, opacity: 0.7 }}>
                The SDK abstracts the complex Appwrite event paths into simple, domain-specific listeners.
              </Typography>
              
              <CodeBlock 
                languages={{
                  typescript: `// 1. Listen for incoming calls (Connect app logic)\nsdk.pulse.on('call.incoming', DATABASE_ID, PULSE_TABLE_ID, (callData) => {\n  console.log('Incoming call from:', callData.callerId);\n});\n\n// 2. Subscribe to specific Row updates (TableDB Standard)\nsdk.pulse.subscribeToRow(DATABASE_ID, TABLE_ID, ROW_ID, (payload) => {\n  console.log('Document updated:', payload);\n});`,
                  go: `// Pulse Go SDK implementation pending`,
                  python: `# Pulse Python SDK implementation pending`,
                  dart: `// Pulse Dart SDK implementation pending`
                }}
              />
            </Box>

            <Grid container spacing={4}>
                {[
                    { icon: Radio, title: 'Low Latency', desc: 'Powered by WebSocket technology for near-instant signal relay.' },
                    { icon: MessageSquare, title: 'Cross-App Gossip', desc: 'Apps can signal each other without direct database dependencies.' },
                    { icon: Zap, title: 'Standardized Paths', desc: 'No more manual parsing of Appwrite event strings.' },
                    { icon: Activity, title: 'Reactive Graph', desc: 'The entire ecosystem responds instantly to state changes.' }
                ].map((item, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <Paper sx={{ p: 3, height: '100%', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '20px' }}>
                            <Stack spacing={2}>
                                <Box sx={{ color: '#6366F1' }}><item.icon size={28} strokeWidth={1.5} /></Box>
                                <Typography variant="h4" sx={{ fontWeight: 800, fontSize: '1.25rem' }}>{item.title}</Typography>
                                <Typography variant="body2" sx={{ opacity: 0.5 }}>{item.desc}</Typography>
                            </Stack>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
