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
import { CodeBlock, LanguageSwitcher } from '@/components/ui/DocsUI';

export default function DocsPage() {
  const theme = useTheme();

  return (
    <Box component="main" sx={{ pt: { xs: 8, md: 10 } }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <DocsSidebar />
      
      <Box sx={{ ml: { xs: 0, md: '300px' }, pt: { xs: 8, md: 12 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={8} sx={{ px: { xs: 2, md: 8 } }}>
            {/* Hero Area */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>DOCUMENTATION</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>Master the <br /> Ecosystem.</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem', lineHeight: 1.7 }}>
                Comprehensive guide to the architecture, tools, and integration patterns that power the private web.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            {/* Quick Links */}
            <Box>
              <Typography variant="h2" sx={{ mb: 6, fontWeight: 900 }}>Ecosystem Core</Typography>
              <Typography variant="body1" sx={{ opacity: 0.7, fontSize: '1.15rem', mb: 4 }}>
                Kylrix is designed from the ground up to prioritize **Privacy First Architecture**.
              </Typography>
              
              <CodeBlock 
                languages={{
                  typescript: "// Get started with the TypeScript SDK\nimport { Kylrix } from '@kylrix/sdk';",
                  go: "// Master the Go SDK\nimport \"github.com/kylrix/sdks-go/pkg/kylrix\"",
                  python: "# Use the Python SDK\nfrom kylrix.client import Kylrix",
                  dart: "// Integrate with Dart/Flutter\nimport 'package:kylrix_sdk/kylrix_sdk.dart';"
                }}
              />
            </Box>

            <Box>
               <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>The Core Philosophy.</Typography>
               <Typography variant="body1" sx={{ opacity: 0.5, lineHeight: 1.8 }}>
                 Kylrix bridges the gap between raw database primitives and ecosystem-level logic. By modularizing repeated patterns across the four core service apps—**Note**, **Vault**, **Flow**, and **Connect**—we provide a robust foundation for building the private web.
               </Typography>
            </Box>

          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
