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
  Grid
} from '@mui/material';
import Navbar from '@/components/Navbar';
import DocsSidebar from '@/components/layout/DocsSidebar';
import { CodeBlock, LanguageSwitcher } from '@/components/ui/DocsUI';
import { Shield, Lock, Key } from 'lucide-react';

export default function SecurityDocsPage() {
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
              <Typography variant="subtitle2" sx={{ color: '#6366F1', mb: 3, fontWeight: 900, letterSpacing: '0.3em' }}>SECURITY & PRIVACY</Typography>
              <Typography variant="h1" sx={{ mb: 4, fontWeight: 900, fontSize: { xs: '2.5rem', md: '4rem' } }}>Zero-Knowledge <br /> Security.</Typography>
              <Typography variant="subtitle1" sx={{ maxWidth: 800, opacity: 0.6, fontSize: '1.25rem' }}>
                At Kylrix, privacy isn't a feature—it's the foundation. Our SDKs provide first-class support for Zero-Knowledge encryption.
              </Typography>
            </Box>

            <Divider sx={{ borderColor: alpha(theme.palette.text.primary, 0.05) }} />

            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h2" sx={{ fontWeight: 900 }}>Encryption Basics</Typography>
                <LanguageSwitcher />
            </Stack>

            <Box>
              <Typography variant="body1" sx={{ mb: 4, opacity: 0.7 }}>
                The Kylrix SDK handles the heavy lifting of key derivation and AES-256-GCM encryption. Data is encrypted on the client and never sent in plain text to our servers.
              </Typography>
              
              <CodeBlock 
                languages={{
                  typescript: `// 1. Derive a key from a user password\nconst key = await KylrixSecurity.deriveKey('user-password', 'random-salt');\n\n// 2. Encrypt sensitive data\nconst { cipher, iv } = await KylrixSecurity.encrypt('my private note', key);\n\n// 3. Decrypt when needed\nconst plainText = await KylrixSecurity.decrypt(cipher, iv, key);`,
                  go: `// 1. Derive a key from a user password\nkey := sdk.Security.DeriveKey("user-password", "random-salt")\n\n// 2. Encrypt sensitive data\nresult, err := sdk.Security.Encrypt("my private note", key)\n\n// 3. Decrypt when needed\nplainText, err := sdk.Security.Decrypt(result.Cipher, result.IV, key)`,
                  python: `# 1. Derive a key from a user password\nkey = KylrixSecurity.derive_key("user-password", "random-salt")\n\n# 2. Encrypt sensitive data\nresult = KylrixSecurity.encrypt("my private note", key)\n\n# 3. Decrypt when needed\nplain_text = KylrixSecurity.decrypt(result["cipher"], result["iv"], key)`,
                  dart: `// 1. Derive a key from a user password\nfinal key = await sdk.security.deriveKey('user-password', 'random-salt');\n\n// 2. Encrypt sensitive data\nfinal result = await sdk.security.encrypt('my private note', key);\n\n// 3. Decrypt when needed\nfinal plainText = await sdk.security.decrypt(result['cipher']!, result['iv']!, key);`
                }}
              />
            </Box>

            <Grid container spacing={4}>
                {[
                    { icon: Shield, title: 'AES-256-GCM', desc: 'Military-grade encryption for all data at rest and in transit.' },
                    { icon: Lock, title: 'PBKDF2 Derivation', desc: 'Hardened key derivation with 100,000 iterations for password security.' },
                    { icon: Key, title: 'Local-Only Keys', desc: 'Decryption keys never leave your device, ensuring true Zero-Knowledge.' }
                ].map((item, i) => (
                    <Grid key={i} size={{ xs: 12, sm: 4 }}>
                        <Stack spacing={2}>
                            <Box sx={{ color: '#6366F1' }}><item.icon size={32} strokeWidth={1.5} /></Box>
                            <Typography variant="h4" sx={{ fontWeight: 800 }}>{item.title}</Typography>
                            <Typography variant="body2" sx={{ opacity: 0.5 }}>{item.desc}</Typography>
                        </Stack>
                    </Grid>
                ))}
            </Grid>

          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
