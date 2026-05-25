'use client';

import React, { useState } from 'react';
import { Box, Container, Typography, Grid, Paper, Stack, Button, IconButton, TextField } from '@mui/material';
import { ArrowLeft, Home, Play, Pause, Copy, Check, Sparkles, Box as CubeIcon, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface LogoIteration {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  svgCode: string;
  render: (color: string, animate: boolean) => React.ReactNode;
}

export default function LogoIterationsPage() {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string>('cube3d');
  const [isAnimated, setIsAnimated] = useState<boolean>(true);
  const [activeColor, setActiveColor] = useState<string>('#6366F1'); // Indigo accent
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const iterations: LogoIteration[] = [
    {
      id: 'current',
      name: 'Iteration 1: Canonical Hexagon',
      subtitle: 'CURRENT SYSTEM BRAND',
      description: 'The flat hexagonal logo split down the center with a carved diamond cutout recess on the right, maintaining simple asymmetric visual density.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer Black Contour -->
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#000000" stroke-width="4.5" stroke-linejoin="round" />
  <!-- Volcanic Slate Hairline -->
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2.5" stroke-linejoin="round" />
  
  <!-- Hemispheres -->
  <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
  <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
  
  <!-- Specular Reflection Highlight -->
  <polyline points="15,30 50,10 85,30" fill="none" stroke="#ACCENTS" stroke-width="1.5" opacity="0.6" />

  <!-- Center Split Seam -->
  <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" stroke-width="3" />
  <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" stroke-width="1" />

  <!-- Carved Cutout Diamond Recess -->
  <polygon points="51,40 63,52 51,64 39,52" fill="#000000" />
  <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" stroke-width="2.2" />
</svg>`,
      render: (color, animate) => (
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="52,11 16,31 16,73 52,93 88,73 88,31" fill="#000000" />
          <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#000000" strokeWidth="4" strokeLinejoin="round" />
          <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth="2.5" strokeLinejoin="round" />
          
          <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
          <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
          
          <polyline 
            points="15,30 50,10 85,30" 
            fill="none" 
            stroke={color} 
            strokeWidth={1.5} 
            opacity={0.7} 
            style={{ animation: animate ? 'glow 2s infinite alternate ease-in-out' : 'none' }}
          />

          <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" strokeWidth="1" />

          <polygon points="51,40 63,52 51,64 39,52" fill="#000000" />
          <polygon points="50,38 62,50 50,62 38,50" fill="#FFFFFF" stroke="#000000" strokeWidth="2.2" />
          <style>{`
            @keyframes glow {
              0% { opacity: 0.2; }
              100% { opacity: 1; }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'sync',
      name: 'Iteration 2: Sync & Boot Loader',
      subtitle: 'ACTIVE STATE ADAPTATION',
      description: 'The dynamic border tracing loop wrapping a center-pulsing carved cutout, utilizing motion to represent data synchronizations.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer Border Hairline -->
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" stroke-width="2" />
  
  <!-- Hemisphere fills -->
  <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
  <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
  
  <!-- Border Sync line -->
  <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#ACCENTS" stroke-width="3" stroke-dasharray="180 180" style="animation: trace 3s infinite linear; stroke-linejoin: round;" />

  <!-- Seam Split -->
  <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" stroke-width="2" />

  <!-- Pulsing Diamond Cutout -->
  <polygon points="50,38 62,50 50,62 38,50" fill="#ACCENTS" stroke="#000000" stroke-width="2" style="animation: pulse-cutout 1.2s infinite alternate ease-in-out; transform-origin: 50px 50px;" />

  <style>
    @keyframes trace {
      0% { stroke-dashoffset: 360; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes pulse-cutout {
      0% { opacity: 0.4; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1.08); }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,10 15,30 15,70 50,90" fill="#131110" />
          <polygon points="50,10 85,30 85,70 50,90" fill="#0B0A09" />
          
          <polygon points="50,9 14,29 14,71 50,91 86,71 86,29" fill="none" stroke="#23211F" strokeWidth="2.5" strokeLinejoin="round" />
          <polygon 
            points="50,9 14,29 14,71 50,91 86,71 86,29" 
            fill="none" 
            stroke={color} 
            strokeWidth={3} 
            strokeLinejoin="round"
            strokeDasharray="180 180"
            style={{ animation: animate ? 'trace 2.8s infinite linear' : 'none', transformOrigin: '50px 50px' }} 
          />

          <line x1="50" y1="10" x2="50" y2="90" stroke="#000000" strokeWidth="3" />
          <line x1="50" y1="10" x2="50" y2="90" stroke="#23211F" strokeWidth="1" />

          <polygon 
            points="50,38 62,50 50,62 38,50" 
            fill={color} 
            stroke="#000000" 
            strokeWidth={2.2} 
            style={{
              animation: animate ? 'pulse-fast 1.2s infinite alternate ease-in-out' : 'none',
              transformOrigin: '50px 50px'
            }}
          />
          <style>{`
            @keyframes trace {
              0% { stroke-dashoffset: 360; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes pulse-fast {
              0% { opacity: 0.4; transform: scale(0.9); }
              100% { opacity: 1; transform: scale(1.08); }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'cube3d',
      name: 'Iteration 3: 3D Isometric Cube',
      subtitle: 'THE NEW 3D SPECULATION',
      description: 'An outstanding isometric wireframe. Facets are transparent, leaving only the "sticky" skeleton of edges and vertices. All edges are weighted equally at 3.5px to represent a balanced, interconnected ecosystem.',
      svgCode: `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer Boundary (Weighted 3.5) -->
  <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" stroke-width="3.5" />
  <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" stroke-width="3.5" />
  <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" stroke-width="3.5" />
  <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" stroke-width="3.5" />
  <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" stroke-width="3.5" />
  <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" stroke-width="3.5" />

  <!-- Inner Seams (Weighted 3.5) -->
  <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" stroke-width="3.5" />
  <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" stroke-width="3.5" />
  <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" stroke-width="3.5" />

  <!-- Vertices (Unified Ecosystem Color) -->
  <circle cx="50" cy="10" r="4" fill="#ACCENTS" stroke="#000000" stroke-width="1.5" />
  <circle cx="85" cy="30" r="4" fill="#ACCENTS" stroke="#000000" stroke-width="1.5" />
  <circle cx="85" cy="70" r="4" fill="#ACCENTS" stroke="#000000" stroke-width="1.5" />
  <circle cx="50" cy="90" r="4" fill="#ACCENTS" stroke="#000000" stroke-width="1.5" />
  <circle cx="15" cy="70" r="4" fill="#ACCENTS" stroke="#000000" stroke-width="1.5" />
  <circle cx="15" cy="30" r="4" fill="#ACCENTS" stroke="#000000" stroke-width="1.5" />
  <circle cx="50" cy="50" r="5" fill="#ACCENTS" stroke="#000000" stroke-width="2" />
</svg>`,
      render: (color, _animate) => (
        <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Edges (Stickly Skeleton) */}
          <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" strokeWidth={3.5} />
          <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" strokeWidth={3.5} />
          <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" strokeWidth={3.5} />
          <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" strokeWidth={3.5} />
          <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" strokeWidth={3.5} />
          <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" strokeWidth={3.5} />

          <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" strokeWidth={3.5} />
          <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" strokeWidth={3.5} />
          <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" strokeWidth={3.5} />

          {/* Vertices (Unified Ecosystem Color) */}
          <circle cx="50" cy="10" r="4" fill={color} stroke="#000000" strokeWidth={1.5} />
          <circle cx="15" cy="30" r="4" fill={color} stroke="#000000" strokeWidth={1.5} />
          <circle cx="85" cy="30" r="4" fill={color} stroke="#000000" strokeWidth={1.5} />
          <circle cx="15" cy="70" r="4" fill={color} stroke="#000000" strokeWidth={1.5} />
          <circle cx="50" cy="90" r="4" fill={color} stroke="#000000" strokeWidth={1.5} />
          <circle cx="85" cy="70" r="4" fill={color} stroke="#000000" strokeWidth={1.5} />

          {/* Core Hub */}
          <circle 
            cx="50" 
            cy="50" 
            r="5.5" 
            fill={color} 
            stroke="#000000" 
            strokeWidth={2}
          />
        </svg>
      )
    }
  ];

  // Selected Iteration
  const activeLogo = iterations.find(i => i.id === selectedId) || iterations[2];

  const currentSvgCode = activeLogo.svgCode
    .replace(/#ACCENTS/g, activeColor);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentSvgCode);
    setCopiedId(activeLogo.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: 8, px: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={6}>
          
          {/* Navigation Stack */}
          <Stack direction="row" spacing={2}>
            <Button 
              onClick={() => router.back()}
              startIcon={<ArrowLeft size={16} />}
              sx={{ 
                fontFamily: 'var(--font-space-grotesk)', 
                fontWeight: 900, 
                color: '#9B9691', 
                bgcolor: '#0B0A09', 
                border: '2px solid #23211F', 
                borderRadius: '8px',
                px: 3,
                textTransform: 'none',
                boxShadow: '3px 3px 0px #000000',
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: '#131110',
                  color: '#FFFFFF',
                  borderColor: '#23211F',
                  transform: 'translate(-1px, -1px)',
                  boxShadow: '4px 4px 0px #000000'
                },
                '&:active': {
                  transform: 'translate(1px, 1px)',
                  boxShadow: '2px 2px 0px #000000'
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
                  fontWeight: 900, 
                  color: '#6366F1', 
                  bgcolor: '#0B0A09', 
                  border: '2px solid #3D3AA9', 
                  borderRadius: '8px',
                  px: 3,
                  textTransform: 'none',
                  boxShadow: '3px 3px 0px #000000',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: '#131110',
                    color: '#818CF8',
                    borderColor: '#4F46E5',
                    transform: 'translate(-1px, -1px)',
                    boxShadow: '4px 4px 0px #000000'
                  },
                  '&:active': {
                    transform: 'translate(1px, 1px)',
                    boxShadow: '2px 2px 0px #000000'
                  }
                }}
              >
                Kitchen Home
              </Button>
            </Link>
          </Stack>

          {/* Header */}
          <Box sx={{ borderBottom: '2px solid #23211F', pb: 3 }}>
            <Typography variant="overline" sx={{ color: '#6366F1', fontWeight: 900, letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
              EXPERIMENTAL PORTAL // BRAND EVOLUTION
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.04em', mt: 1, mb: 1 }}>
              Kylrix Logo Iterations
            </Typography>
            <Typography sx={{ opacity: 0.5, fontSize: '1rem', fontFamily: 'var(--font-satoshi)' }}>
              Tracing the design trajectory from the flat hexagonal classic cutout to the animated sync loader, culminating in the 3D Isometric Cube.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            
            {/* Left Column: Interactive Logo Iterations */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3}>
                {iterations.map((logo) => {
                  const isSelected = selectedId === logo.id;
                  return (
                    <Paper 
                      key={logo.id}
                      onClick={() => setSelectedId(logo.id)}
                      sx={{ 
                        p: 4, 
                        bgcolor: '#0B0A09', 
                        borderRadius: '24px', 
                        border: isSelected ? `2px solid ${activeColor}` : '2px solid #23211F',
                        boxShadow: isSelected ? '4px 4px 0px #000000' : '2px 2px 0px #000000',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '4px 4px 0px #000000'
                        }
                      }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} alignItems="center">
                        
                        {/* Rendering Well */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          alignItems: 'center', 
                          width: 160,
                          height: 160, 
                          bgcolor: '#000000', 
                          borderRadius: '16px',
                          border: '1px solid #23211F',
                          flexShrink: 0
                        }}>
                          {logo.render(activeColor, isAnimated)}
                        </Box>

                        {/* Details */}
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 900, color: activeColor, mb: 0.5 }}>
                            {logo.subtitle}
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-outfit)', fontWeight: 900, fontSize: '1.25rem', mb: 1.5 }}>
                            {logo.name}
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.85rem', opacity: 0.6, lineHeight: 1.5 }}>
                            {logo.description}
                          </Typography>
                        </Box>

                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Grid>

            {/* Right Column: Code Inspector Well & Controls */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper sx={{ 
                p: 4, 
                bgcolor: '#0B0A09', 
                borderRadius: '24px', 
                border: '2px solid #23211F',
                boxShadow: '4px 4px 0px #000000',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#10B981' }}>
                  SVG_BLUEPRINT // SELECTED CODE
                </Typography>

                {/* Controls */}
                <Stack direction="row" spacing={2}>
                  <Button
                    onClick={() => setIsAnimated(!isAnimated)}
                    startIcon={isAnimated ? <Pause size={14} /> : <Play size={14} />}
                    sx={{
                      flexGrow: 1,
                      py: 1,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      bgcolor: isAnimated ? '#131110' : '#000000',
                      color: isAnimated ? '#FFFFFF' : '#9B9691',
                      border: '1px solid #23211F',
                      borderRadius: '8px',
                      textTransform: 'none',
                      '&:hover': { bgcolor: '#131110' }
                    }}
                  >
                    {isAnimated ? 'Pause Physics' : 'Animate Physics'}
                  </Button>

                  {/* Accent Highlight Selectors */}
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {[
                      { color: '#6366F1', name: 'Indigo' },
                      { color: '#10B981', name: 'Emerald' },
                      { color: '#EC4899', name: 'Pink' },
                      { color: '#F59E0B', name: 'Amber' }
                    ].map((item) => (
                      <IconButton
                        key={item.name}
                        onClick={() => setActiveColor(item.color)}
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: item.color,
                          border: activeColor === item.color ? '2px solid #FFFFFF' : 'none',
                          '&:hover': { opacity: 0.8 }
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>

                {/* Code Window */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691' }}>
                      SOURCE SVG BLUEPRINT
                    </Typography>
                    
                    <Button
                      onClick={handleCopyCode}
                      size="small"
                      startIcon={copiedId === activeLogo.id ? <Check size={12} /> : <Copy size={12} />}
                      sx={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.65rem',
                        textTransform: 'none',
                        color: copiedId === activeLogo.id ? '#10B981' : '#6366F1'
                      }}
                    >
                      {copiedId === activeLogo.id ? 'Copied!' : 'Copy Code'}
                    </Button>
                  </Stack>

                  <TextField
                    multiline
                    fullWidth
                    rows={12}
                    value={currentSvgCode}
                    InputProps={{
                      readOnly: true,
                      style: {
                        color: '#10B981',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.75rem',
                        backgroundColor: '#000000',
                        border: '1px solid #23211F',
                        borderRadius: '8px',
                        padding: '16px'
                      }
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': { border: 'none' }
                      }
                    }}
                  />
                </Box>

                {/* Geometry explanation */}
                <Box sx={{ p: 2.5, bgcolor: '#131110', border: '1px solid #23211F', borderRadius: '12px' }}>
                  <Typography sx={{ fontFamily: 'var(--font-outfit)', fontWeight: 900, fontSize: '0.85rem', mb: 0.5 }}>
                    3D Isometric Perspective Twist:
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.75rem', opacity: 0.5, lineHeight: 1.4 }}>
                    By removing the center flat seams and diamond cutouts, we partition the hexagon into three diamonds meeting at `50,50`. This creates a perfect isometric cube. When animated, the facets slide along their 3D coordinate vectors (isometric translation offsets), creating a state-of-the-art physical mechanical expansion effect!
                  </Typography>
                </Box>
              </Paper>
            </Grid>

          </Grid>

          {/* Solid Footing */}
          <Box sx={{ textAlign: 'center', py: 3, opacity: 0.4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', borderTop: '2px solid #23211F' }}>
            KYLRIX BRAND EVOLUTION • BRAND LOGO DESIGN & ITERATION PORTAL • VER 2.0
          </Box>

        </Stack>
      </Container>
    </Box>
  );
}
