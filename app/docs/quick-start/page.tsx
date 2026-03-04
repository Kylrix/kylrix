'use client';

import React from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Stack, 
  Divider, 
  Paper, 
  Button,
  Grid,
  alpha,
  useTheme
} from '@mui/material';
import { Terminal, CheckCircle2, ArrowRight, Rocket, Code2, ShieldCheck, Zap } from 'lucide-react';
import Navbar from '@/components/Navbar';
import DocsSidebar from '@/components/layout/DocsSidebar';
import { CodeBlock, LanguageSwitcher } from '@/components/ui/DocsUI';
import NextLink from 'next/link';

export default function QuickStartPage() {
  const theme = useTheme();

  return (
    <Box component="main" sx={{ pt: { xs: 8, md: 10 } }}>
      <Navbar />
      <div className="bg-mesh" />
      
      <DocsSidebar />
      
      <Box sx={{ ml: { xs: 0, md: '300px' }, pt: { xs: 8, md: 12 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Stack spacing={8} sx={{ px: { xs: 2, md: 8 } }}>
            {/* Hero Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>GETTING STARTED</Typography>
              <Typography variant="h1" sx={{ mb: 2, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>Quick Start</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem' }}>
                Integrate the Kylrix Ecosystem into your application in minutes.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            {/* Language Selection */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={4} sx={{ flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>Installation</Typography>
                <Typography variant="body2" sx={{ opacity: 0.5 }}>Choose your platform to get started.</Typography>
              </Box>
              <LanguageSwitcher />
            </Stack>

            {/* Install Commands */}
            <CodeBlock 
              languages={{
                typescript: 'pnpm add @kylrix/sdk',
                go: 'go get github.com/kylrix/sdks-go',
                python: 'pip install kylrix-sdk',
                dart: 'dart pub add kylrix_sdk'
              }}
            />

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            {/* Next Steps */}
            <Box>
              <Typography variant="h2" sx={{ mb: 6, fontWeight: 900 }}>Initial Setup</Typography>
              <Stack spacing={6}>
                {[
                  {
                    title: 'Initialize Client',
                    desc: 'Create an instance of the Kylrix client with your project credentials.',
                    code: {
                      typescript: "import { Kylrix } from '@kylrix/sdk';\n\nconst sdk = new Kylrix({\n  endpoint: 'https://cloud.appwrite.io/v1',\n  project: 'your-project-id'\n});",
                      go: "import \"github.com/kylrix/sdks-go/pkg/kylrix\"\n\nsdk := kylrix.NewClient(kylrix.Config{\n  Endpoint: \"https://cloud.appwrite.io/v1\",\n  Project: \"your-project-id\",\n})",
                      python: "from kylrix.client import Kylrix\n\nsdk = Kylrix(\n  endpoint=\"https://cloud.appwrite.io/v1\",\n  project=\"your-project-id\"\n)",
                      dart: "import 'package:kylrix_sdk/kylrix_sdk.dart';\n\nfinal sdk = Kylrix(\n  endpoint: 'https://cloud.appwrite.io/v1',\n  project: 'your-project-id'\n);"
                    }
                  },
                  {
                    title: 'Authentication',
                    desc: 'Log in your user to access the private ecosystem.',
                    code: {
                      typescript: "await sdk.account.createOAuth2Session('kylrix');",
                      go: "// See full auth guide for platform specifics\nerr := sdk.Account.CreateOAuth2Session(\"kylrix\", \"\", \"\", nil)",
                      python: "sdk.account.create_oauth2_session('kylrix')",
                      dart: "await sdk.account.createOAuth2Session(provider: 'kylrix');"
                    }
                  }
                ].map((step, i) => (
                  <Box key={i}>
                    <Stack direction="row" spacing={3} sx={{ mb: 3 }}>
                      <Box sx={{ 
                        width: 36, height: 36, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1', fontWeight: 900
                      }}>
                        {i + 1}
                      </Box>
                      <Box>
                        <Typography variant="h4" sx={{ mb: 1, fontWeight: 800 }}>{step.title}</Typography>
                        <Typography variant="body2" sx={{ opacity: 0.6 }}>{step.desc}</Typography>
                      </Box>
                    </Stack>
                    <CodeBlock languages={step.code} />
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box sx={{ mt: 10, p: 6, bgcolor: alpha('#6366F1', 0.03), borderRadius: 6, border: '1px solid rgba(99, 102, 241, 0.1)', textAlign: 'center' }}>
               <Rocket size={56} color="#6366F1" style={{ marginBottom: '24px' }} />
               <Typography variant="h2" sx={{ mb: 3, fontWeight: 900 }}>Ready for takeoff?</Typography>
               <Typography variant="body1" sx={{ mb: 6, opacity: 0.6, maxWidth: 600, mx: 'auto' }}>
                 You've successfully initialized the SDK. Now dive deep into the architecture to master the Reactive Graph.
               </Typography>
               <Button 
                component={NextLink}
                href="/docs/architecture"
                variant="contained" 
                size="large"
                endIcon={<ArrowRight size={20} />}
                sx={{ borderRadius: '16px', px: 6, py: 2, fontWeight: 900 }}
               >
                 Master the Architecture
               </Button>
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
