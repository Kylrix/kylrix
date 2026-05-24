'use client';

import React from 'react';
import { Box, Container, Typography, Paper, Grid, Stack, Divider } from '@mui/material';

export default function KitchenFontsPage() {
  const fonts = [
    {
      name: 'Outfit',
      variable: 'var(--font-outfit)',
      description: 'Display / Headers: highly opinionated, premium rounded geometric weights.',
      samples: [
        { size: '3.5rem', label: 'Massive Header (56px)', text: 'OPENBRICKS 2.0' },
        { size: '2rem', label: 'Section Heading (32px)', text: 'The Autonomous Workspace' },
        { size: '1.25rem', label: 'Sub-title / Item Label (20px)', text: 'Secure. Private. Smart. Tactile.' }
      ]
    },
    {
      name: 'Space Grotesk',
      variable: 'var(--font-space-grotesk)',
      description: 'Inputs & Focus: high-character, brutalist geometric curves that turn interactive typing into luxury.',
      samples: [
        { size: '1.5rem', label: 'Hero Input Value (24px)', text: 'Searching note vault: "Confidential System Keys"...' },
        { size: '1.1rem', label: 'Active Form Input (18px)', text: 'Write down your raw thoughts here. Openbricks will structure them.' },
        { size: '0.9rem', label: 'Tactile Label / Guide (14.4px)', text: 'CTRL + SPACE TO SUMMON ECOSYSTEM PORTAL' }
      ]
    },
    {
      name: 'Satoshi',
      variable: 'var(--font-satoshi)',
      description: 'UI / Body Copy: ultra-clean, highly readable geometric sans-serif for primary interface grids.',
      samples: [
        { size: '1.2rem', label: 'Lead Paragraph (19.2px)', text: 'We build digital sanctuaries completely compromise-free.' },
        { size: '1rem', label: 'Standard UI Text (16px)', text: 'Every detail in Openbricks is mathematically structured. We reject soft glows and fuzzy glassmorphism to craft solid tactile interfaces layered with sharp hairline definitions.' },
        { size: '0.85rem', label: 'Interactive Caption (13.6px)', text: 'Notes updated 2 minutes ago by auracrab-purple-48' }
      ]
    },
    {
      name: 'JetBrains Mono',
      variable: 'var(--font-mono)',
      description: 'Technical / Metadata: high-density monospace for precise telemetry, payloads, and codes.',
      samples: [
        { size: '1.1rem', label: 'Console / Terminal (17.6px)', text: 'pnpm run dev --filter openbricks-2.0' },
        { size: '0.9rem', label: 'Database Telemetry (14.4px)', text: 'DB_TRANSACTION_SUCCESS: pivotId=resource_tags [67ff06280034908cf08a]' },
        { size: '0.75rem', label: 'Timestamp / Code Log (12px)', text: 'SYS_TICK: 2026-05-24T23:03:35Z [STATUS_OK]' }
      ]
    }
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: 8, px: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={8}>
          {/* Header */}
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.04em', mb: 2 }}>
              OPENBRICKS 2.0
            </Typography>
            <Typography sx={{ opacity: 0.5, fontSize: '1.2rem', fontFamily: 'var(--font-satoshi)', maxWidth: '600px' }}>
              Typography Kitchen. Real-time rendering of our four core, highly opinionated product fonts.
            </Typography>
          </Box>

          <Divider sx={{ borderColor: '#2E2A27' }} />

          {/* Grid of Fonts */}
          <Grid container spacing={4}>
            {fonts.map((font) => (
              <Grid size={{ xs: 12, md: 6 }} key={font.name}>
                <Paper sx={{ 
                  p: 4, 
                  bgcolor: '#141211', 
                  borderRadius: '24px', 
                  border: '1px solid #2E2A27',
                  transition: 'transform 0.3s ease, border-color 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    borderColor: '#3D3AA9'
                  }
                }}>
                  {/* Font Title */}
                  <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', mb: 1 }}>
                      {font.name}
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.5, fontFamily: 'var(--font-satoshi)' }}>
                      {font.description}
                    </Typography>
                  </Box>

                  {/* Font Samples */}
                  <Stack spacing={4}>
                    {font.samples.map((sample, idx) => (
                      <Box key={idx} sx={{ p: 2, bgcolor: '#0A0908', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <Typography sx={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 800, 
                          color: '#6366F1', 
                          fontFamily: 'var(--font-mono)', 
                          letterSpacing: '0.05em', 
                          mb: 1.5,
                          textTransform: 'uppercase'
                        }}>
                          {sample.label}
                        </Typography>
                        <Box sx={{ 
                          fontFamily: font.variable, 
                          fontSize: sample.size, 
                          color: '#FFFFFF',
                          lineHeight: 1.3,
                          wordBreak: 'break-word'
                        }}>
                          {sample.text}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Footer */}
          <Box sx={{ textAlign: 'center', py: 4, opacity: 0.3, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            OPENBRICKS 2.0 BRAND SPECIFICATIONS • DESIGNED BY ANTIGRAVITY
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
