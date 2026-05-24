'use client';

import React, { useState } from 'react';
import { Box, Container, Typography, Grid, Paper, Stack, InputBase, Button } from '@mui/material';
import Logo from '@/components/common/Logo';
import { ArrowLeft, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PrimaryComponentsPage() {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('Type your raw notes here in Space Grotesk...');
  const apps = ['root', 'note', 'vault', 'flow', 'connect'] as const;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: 8, px: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={8}>
          
          {/* Navigation Bar */}
          <Stack direction="row" spacing={2}>
            <Button 
              onClick={() => router.back()}
              startIcon={<ArrowLeft size={16} />}
              sx={{ 
                fontFamily: 'var(--font-space-grotesk)', 
                fontWeight: 700, 
                color: '#9B9691', 
                bgcolor: '#131110', 
                border: '1px solid #23211F', 
                borderRadius: '12px',
                px: 3,
                textTransform: 'none',
                boxShadow: '2px 2px 0px #000000',
                '&:hover': {
                  bgcolor: '#1B1918',
                  color: '#FFFFFF',
                  transform: 'translate(-1px, -1px)',
                  boxShadow: '3px 3px 0px #000000'
                },
                '&:active': {
                  transform: 'translate(1px, 1px)',
                  boxShadow: '1px 1px 0px #000000'
                }
              }}
            >
              Back
            </Button>
            <Link href="/kitchen" passHref legacyBehavior>
              <Button 
                component="a"
                startIcon={<Home size={16} />}
                sx={{ 
                  fontFamily: 'var(--font-space-grotesk)', 
                  fontWeight: 700, 
                  color: '#FFFFFF', 
                  bgcolor: '#6366F1', 
                  border: '1px solid #000000', 
                  borderRadius: '12px',
                  px: 3,
                  textTransform: 'none',
                  boxShadow: '2px 2px 0px #000000',
                  '&:hover': {
                    bgcolor: '#4F46E5',
                    transform: 'translate(-1px, -1px)',
                    boxShadow: '3px 3px 0px #000000'
                  },
                  '&:active': {
                    transform: 'translate(1px, 1px)',
                    boxShadow: '1px 1px 0px #000000'
                  }
                }}
              >
                Kitchen Home
              </Button>
            </Link>
          </Stack>
          
          {/* Section Header */}
          <Box sx={{ borderBottom: '1px solid #23211F', pb: 4 }}>
            <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>
              Openbricks 2.0 Specification
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.04em', mt: 1, mb: 2 }}>
              Solid Primary Components
            </Typography>
            <Typography sx={{ opacity: 0.5, fontSize: '1.1rem', fontFamily: 'var(--font-satoshi)', maxWidth: '800px' }}>
              A live environment previewing the Carbon-Obsidian container stack, dynamic carved hexagons, and brutalist interactive focus layers under strict zero-glow, zero-gradient constraints.
            </Typography>
          </Box>

          {/* 1. THE CHROMATIC STACK (Bedrock Depth) */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'var(--font-outfit)', mb: 3, letterSpacing: '-0.02em' }}>
              1. The Obsidian Container Depth
            </Typography>
            <Grid container spacing={4}>
              
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ 
                  p: 4, 
                  bgcolor: '#0B0A09', 
                  borderRadius: '24px', 
                  border: '1px solid #23211F',
                  boxShadow: '4px 4px 0px #000000',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translate(-2px, -2px)',
                    boxShadow: '6px 6px 0px #000000'
                  }
                }}>
                  <Typography variant="caption" sx={{ color: '#9B9691', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    LEVEL 1: CARBON BEDROCK (#0B0A09)
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-outfit)', mt: 2, mb: 1 }}>
                    Primary Surface
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9B9691', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6 }}>
                    This is our primary content backing, replacing standard flat developer dark grays. Heavy, dense, and physically solid.
                  </Typography>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ 
                  p: 4, 
                  bgcolor: '#131110', 
                  borderRadius: '24px', 
                  border: '1px solid #23211F',
                  boxShadow: '4px 4px 0px #000000',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translate(-2px, -2px)',
                    boxShadow: '6px 6px 0px #000000'
                  }
                }}>
                  <Typography variant="caption" sx={{ color: '#9B9691', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    LEVEL 2: TACTILE ASH (#131110)
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-outfit)', mt: 2, mb: 1 }}>
                    Elevated Component
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9B9691', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6 }}>
                    Used for cards, dropdown panels, and overlay drawers floating above bedrock level. Separated by crisp hairline joins.
                  </Typography>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Paper sx={{ 
                  p: 4, 
                  bgcolor: '#1B1918', 
                  borderRadius: '24px', 
                  border: '1px solid #6366F1',
                  boxShadow: '4px 4px 0px #000000',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translate(-2px, -2px)',
                    boxShadow: '6px 6px 0px #000000'
                  }
                }}>
                  <Typography variant="caption" sx={{ color: '#6366F1', fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                    LEVEL 3: ACTIVE OBSIDIAN (#1B1918)
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: 'var(--font-outfit)', mt: 2, mb: 1 }}>
                    Interactive Focus
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#9B9691', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6 }}>
                    Active or highlighted state container. Bordered by the ecosystem primary solid hairline, expressing clean modular bounds.
                  </Typography>
                </Paper>
              </Grid>

            </Grid>
          </Box>

          {/* 2. DYNAMIC CARVED LOGOS */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'var(--font-outfit)', mb: 3, letterSpacing: '-0.02em' }}>
              2. Machine-Carved Ecosystem Hexagons
            </Typography>
            <Paper sx={{ p: 6, bgcolor: '#0B0A09', borderRadius: '24px', border: '1px solid #23211F', boxShadow: '4px 4px 0px #000000' }}>
              <Grid container spacing={4} justifyContent="center" alignItems="center">
                {apps.map((app) => (
                  <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={app} style={{ textAlign: 'center' }}>
                    <Box sx={{ 
                      display: 'inline-flex',
                      p: 3, 
                      bgcolor: '#131110', 
                      borderRadius: '20px', 
                      border: '1px solid #23211F',
                      boxShadow: '3px 3px 0px #000000',
                      mb: 2
                    }}>
                      <Logo app={app} size={56} variant="icon" />
                    </Box>
                    <Typography sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', fontSize: '1rem', textTransform: 'uppercase' }}>
                      {app}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#9B9691', mt: 0.5 }}>
                      {app === 'root' ? 'Ecosystem' : `${app} accent`}
                    </Typography>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Box>

          {/* 3. TACTILE INPUT (Space Grotesk Brutalist Drawer) */}
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: 'var(--font-outfit)', mb: 3, letterSpacing: '-0.02em' }}>
              3. Brutalist Active Focus Input
            </Typography>
            <Paper sx={{ 
              p: 4, 
              bgcolor: '#0B0A09', 
              borderRadius: '24px', 
              border: '1px solid #23211F', 
              boxShadow: '4px 4px 0px #000000' 
            }}>
              <Typography variant="caption" sx={{ color: '#9B9691', fontFamily: 'var(--font-mono)', fontWeight: 800, display: 'block', mb: 2, textTransform: 'uppercase' }}>
                Create Post (Tactile Bottom Drawer Simulator)
              </Typography>
              
              <Box sx={{ 
                bgcolor: '#131110', 
                borderRadius: '16px', 
                border: '1px solid #000000', 
                p: 3,
                boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.9)',
                '&:focus-within': {
                  borderColor: '#6366F1'
                }
              }}>
                <InputBase 
                  multiline
                  fullWidth
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  sx={{ 
                    color: '#FFFFFF',
                    fontFamily: 'var(--font-space-grotesk)',
                    fontSize: '1.25rem',
                    lineHeight: 1.4,
                    '& textarea': {
                      caretColor: '#6366F1'
                    }
                  }}
                />
              </Box>

              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
                <Button sx={{ 
                  fontFamily: 'var(--font-space-grotesk)', 
                  fontWeight: 700, 
                  color: '#9B9691', 
                  bgcolor: '#131110', 
                  border: '1px solid #23211F', 
                  borderRadius: '12px',
                  px: 3,
                  textTransform: 'none',
                  boxShadow: '2px 2px 0px #000000',
                  '&:hover': {
                    bgcolor: '#1B1918',
                    color: '#FFFFFF'
                  }
                }}>
                  Cancel
                </Button>
                <Button sx={{ 
                  fontFamily: 'var(--font-space-grotesk)', 
                  fontWeight: 700, 
                  color: '#FFFFFF', 
                  bgcolor: '#6366F1', 
                  border: '1px solid #000000', 
                  borderRadius: '12px',
                  px: 3,
                  textTransform: 'none',
                  boxShadow: '2px 2px 0px #000000',
                  '&:hover': {
                    bgcolor: '#4F46E5',
                    transform: 'translate(-1px, -1px)',
                    boxShadow: '3px 3px 0px #000000'
                  },
                  '&:active': {
                    transform: 'translate(1px, 1px)',
                    boxShadow: '1px 1px 0px #000000'
                  }
                }}>
                  Ship Note
                </Button>
              </Stack>
            </Paper>
          </Box>

        </Stack>
      </Container>
    </Box>
  );
}
