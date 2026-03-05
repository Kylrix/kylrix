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

export default function IdentityPage() {
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
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>CORE SYSTEMS</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>Identity & <br /> WebAuthn.</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem', lineHeight: 1.7 }}>
                The root of trust for the Kylrix ecosystem, enabling seamless passwordless authentication across all applications.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>Universal Session</Typography>
              <Typography variant="body1" sx={{ opacity: 0.7, mb: 4, lineHeight: 1.8 }}>
                Kylrix Accounts provides a unified identity layer. Once authenticated, your session is valid across all subdomains via the shared <strong>kylrix.space</strong> root domain.
              </Typography>
              
              <Box sx={{ p: 4, bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)', mb: 6 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>Why WebAuthn?</Typography>
                <Typography variant="body2" sx={{ opacity: 0.6, lineHeight: 1.8 }}>
                  Passkeys provide superior security and UX. By leveraging hardware-backed credentials, we eliminate the risks of phishing and password reuse while maintaining the luxury-tech aesthetic of frictionless access.
                </Typography>
              </Box>
            </Box>

            <Box>
              <Typography variant="h2" sx={{ mb: 4, fontWeight: 900 }}>Integration</Typography>
              <Typography variant="body1" sx={{ opacity: 0.7, mb: 4, lineHeight: 1.8 }}>
                The SDK provides high-level helpers to manage user sessions and account state.
              </Typography>
              
              <CodeBlock 
                languages={{
                  typescript: `// Accessing the account service
const sdk = new Kylrix({ project: "PROJECT_ID" });
const user = await sdk.account.get();`,
                  dart: `// Dart / Flutter example
final sdk = Kylrix(project: "PROJECT_ID");
final user = await sdk.account.get();`,
                  go: `// Go CLI example
sdk := kylrix.NewClient(kylrix.Config{Project: "PROJECT_ID"})
user, err := sdk.Account.Get()`,
                  python: `# Python example
sdk = Kylrix(project="PROJECT_ID")
user = sdk.account.get()`
                }}
              />
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
