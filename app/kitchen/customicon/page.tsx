'use client';

import React, { useState } from 'react';
import { Box, Container, Typography, Grid, Paper, Stack, Button, IconButton, TextField } from '@/lib/mui-tailwind/material';
import { ArrowLeft, Home, Play, Pause, Copy, Check, Sparkles, Code2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CustomIconDetail {
  id: string;
  name: string;
  category: 'Security' | 'Huddles' | 'Workflows' | 'Branding';
  description: string;
  svgCode: string;
  render: (color: string, animate: boolean) => React.ReactNode;
}

export default function CustomIconsPage() {
  const router = useRouter();

  // Selected Custom Icon for code output
  const [selectedId, setSelectedId] = useState<string>('shield');
  const [isAnimated, setIsAnimated] = useState<boolean>(true);
  const [activeAccent, setActiveAccent] = useState<string>('#6366F1'); // Default Indigo
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const customIconsDeck: CustomIconDetail[] = [
    {
      id: 'shield',
      name: 'The Obsidian Shield',
      category: 'Security',
      description: 'A multi-layered protective boundary showing local scanning beams and double-bevel hairline channels.',
      svgCode: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Outer Bevel Shield -->
  <path d="M32 4C44 4 54 8 54 22C54 42 44 54 32 60C20 54 10 42 10 22C10 8 20 4 32 4Z" stroke="#23211F" stroke-width="2" fill="#0B0A09" />
  <!-- Inner Specular Edge -->
  <path d="M32 10C40 10 47 13 47 23C47 37 40 46 32 51C24 46 17 37 17 23C17 13 24 10 32 10Z" stroke="#ACCENTS" stroke-width="1.5" stroke-dasharray="4, 4" opacity="0.8" />
  <!-- Center Core Lock Shackle -->
  <path d="M26 32V28C26 24.7 28.7 22 32 22C35.3 22 38 24.7 38 28V32" stroke="#23211F" stroke-width="2" />
  <!-- Core Solid Lock Pad -->
  <rect x="23" y="32" width="18" height="14" rx="3" fill="#131110" stroke="#23211F" stroke-width="2" />
  <circle cx="32" cy="38" r="2" fill="#ACCENTS" />
  
  <!-- Active Scanning Beam -->
  <line x1="14" y1="20" x2="50" y2="20" stroke="#ACCENTS" stroke-width="2" opacity="0.8" style="animation: scan 2s infinite ease-in-out;" />
  
  <style>
    @keyframes scan {
      0% { transform: translateY(0); opacity: 0.2; }
      50% { transform: translateY(24px); opacity: 1; }
      100% { transform: translateY(0); opacity: 0.2; }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="84" height="84" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Outer Bevel Shield */}
          <path d="M32 4C44 4 54 8 54 22C54 42 44 54 32 60C20 54 10 42 10 22C10 8 20 4 32 4Z" stroke="#23211F" stroke-width="2.5" fill="#0B0A09" />
          {/* Inner Specular Edge */}
          <path d="M32 10C40 10 47 13 47 23C47 37 40 46 32 51C24 46 17 37 17 23C17 13 24 10 32 10Z" stroke={color} strokeWidth={1.5} strokeDasharray="3, 3" opacity={0.6} />
          {/* Center Core Lock Shackle */}
          <path d="M26 32V28C26 24.7 28.7 22 32 22C35.3 22 38 24.7 38 28V32" stroke="#23211F" strokeWidth={2.5} />
          {/* Core Solid Lock Pad */}
          <rect x="23" y="32" width="18" height="14" rx="3" fill="#131110" stroke="#23211F" strokeWidth={2.5} />
          <circle cx="32" cy="38" r="2.5" fill={color} />
          {/* Active Scanning Beam */}
          <line 
            x1="14" 
            y1="22" 
            x2="50" 
            y2="22" 
            stroke={color} 
            strokeWidth={2} 
            style={{
              animation: animate ? 'scan 2.5s infinite ease-in-out' : 'none',
              transformOrigin: 'center'
            }} 
          />
          <style>{`
            @keyframes scan {
              0% { transform: translateY(0); opacity: 0.1; }
              50% { transform: translateY(22px); opacity: 1; }
              100% { transform: translateY(0); opacity: 0.1; }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'voice',
      name: 'Huddle Audio Waveform',
      category: 'Huddles',
      description: 'Continuous voice broadcast bars oscillating dynamically from center hubs with organic offsets.',
      svgCode: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Interactive Waveforms -->
  <rect x="14" y="24" width="4" height="16" rx="2" fill="#23211F" style="animation: wave 1.2s infinite ease-in-out; transform-origin: 16px 32px;" />
  <rect x="23" y="14" width="4" height="36" rx="2" fill="#ACCENTS" style="animation: wave 1.2s infinite ease-in-out; animation-delay: 0.15s; transform-origin: 25px 32px;" />
  <rect x="32" y="6" width="4" height="52" rx="2" fill="#23211F" style="animation: wave 1.2s infinite ease-in-out; animation-delay: 0.3s; transform-origin: 34px 32px;" />
  <rect x="41" y="18" width="4" height="28" rx="2" fill="#ACCENTS" style="animation: wave 1.2s infinite ease-in-out; animation-delay: 0.45s; transform-origin: 43px 32px;" />
  <rect x="50" y="26" width="4" height="12" rx="2" fill="#23211F" style="animation: wave 1.2s infinite ease-in-out; animation-delay: 0.6s; transform-origin: 52px 32px;" />

  <style>
    @keyframes wave {
      0%, 100% { transform: scaleY(0.4); }
      50% { transform: scaleY(1.2); }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="84" height="84" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Dynamic Waveforms */}
          <rect 
            x="14" 
            y="24" 
            width="4.5" 
            height="16" 
            rx="2.2" 
            fill="#23211F" 
            style={{ 
              animation: animate ? 'wave 1.1s infinite ease-in-out' : 'none', 
              transformOrigin: '16px 32px' 
            }} 
          />
          <rect 
            x="23" 
            y="14" 
            width="4.5" 
            height="36" 
            rx="2.2" 
            fill={color} 
            style={{ 
              animation: animate ? 'wave 1.1s infinite ease-in-out' : 'none', 
              animationDelay: '0.15s',
              transformOrigin: '25px 32px' 
            }} 
          />
          <rect 
            x="32" 
            y="6" 
            width="4.5" 
            height="52" 
            rx="2.2" 
            fill="#23211F" 
            style={{ 
              animation: animate ? 'wave 1.1s infinite ease-in-out' : 'none', 
              animationDelay: '0.3s',
              transformOrigin: '34px 32px' 
            }} 
          />
          <rect 
            x="41" 
            y="18" 
            width="4.5" 
            height="28" 
            rx="2.2" 
            fill={color} 
            style={{ 
              animation: animate ? 'wave 1.1s infinite ease-in-out' : 'none', 
              animationDelay: '0.45s',
              transformOrigin: '43px 32px' 
            }} 
          />
          <rect 
            x="50" 
            y="26" 
            width="4.5" 
            height="12" 
            rx="2.2" 
            fill="#23211F" 
            style={{ 
              animation: animate ? 'wave 1.1s infinite ease-in-out' : 'none', 
              animationDelay: '0.6s',
              transformOrigin: '52px 32px' 
            }} 
          />
          <style>{`
            @keyframes wave {
              0%, 100% { transform: scaleY(0.35); }
              50% { transform: scaleY(1.2); }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'pivot',
      name: 'Polymorphic Pivot Hub',
      category: 'Workflows',
      description: 'A central execution processing terminal flowing real-time data packets to three branch satellite collection indices.',
      svgCode: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Central Hub Node -->
  <circle cx="32" cy="32" r="8" fill="#131110" stroke="#23211F" stroke-width="2" />
  <circle cx="32" cy="32" r="3" fill="#ACCENTS" />
  
  <!-- Satellites -->
  <circle cx="16" cy="16" r="5" fill="#0B0A09" stroke="#23211F" stroke-width="1.5" />
  <circle cx="48" cy="16" r="5" fill="#0B0A09" stroke="#23211F" stroke-width="1.5" />
  <circle cx="32" cy="52" r="5" fill="#0B0A09" stroke="#23211F" stroke-width="1.5" />

  <!-- Data Flow Pipelines -->
  <line x1="32" y1="32" x2="16" y2="16" stroke="#23211F" stroke-width="2" stroke-dasharray="4, 4" style="animation: flow 3s infinite linear;" />
  <line x1="32" y1="32" x2="48" y2="16" stroke="#ACCENTS" stroke-width="2" stroke-dasharray="4, 4" style="animation: flow-reverse 3s infinite linear;" />
  <line x1="32" y1="32" x2="32" y2="52" stroke="#23211F" stroke-width="2" stroke-dasharray="4, 4" style="animation: flow 3s infinite linear;" />

  <style>
    @keyframes flow {
      0% { stroke-dashoffset: 16; }
      100% { stroke-dashoffset: 0; }
    }
    @keyframes flow-reverse {
      0% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: 16; }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="84" height="84" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Central Hub Node */}
          <circle cx="32" cy="32" r="9" fill="#131110" stroke="#23211F" strokeWidth={2} />
          <circle cx="32" cy="32" r="4.5" fill={color} />
          {/* Satellites */}
          <circle cx="16" cy="16" r="6" fill="#0B0A09" stroke="#23211F" strokeWidth={2} />
          <circle cx="48" cy="16" r="6" fill="#0B0A09" stroke="#23211F" strokeWidth={2} />
          <circle cx="32" cy="52" r="6" fill="#0B0A09" stroke="#23211F" strokeWidth={2} />
          {/* Data Flow Pipelines */}
          <line 
            x1="32" 
            y1="32" 
            x2="16" 
            y2="16" 
            stroke="#23211F" 
            strokeWidth={2} 
            strokeDasharray="4, 4" 
            style={{ animation: animate ? 'flow 2.5s infinite linear' : 'none' }} 
          />
          <line 
            x1="32" 
            y1="32" 
            x2="48" 
            y2="16" 
            stroke={color} 
            strokeWidth={2} 
            strokeDasharray="4, 4" 
            style={{ animation: animate ? 'flow-reverse 2.5s infinite linear' : 'none' }} 
          />
          <line 
            x1="32" 
            y1="32" 
            x2="32" 
            y2="52" 
            stroke="#23211F" 
            strokeWidth={2} 
            strokeDasharray="4, 4" 
            style={{ animation: animate ? 'flow 2.5s infinite linear' : 'none' }} 
          />
          <style>{`
            @keyframes flow {
              0% { stroke-dashoffset: 16; }
              100% { stroke-dashoffset: 0; }
            }
            @keyframes flow-reverse {
              0% { stroke-dashoffset: 0; }
              100% { stroke-dashoffset: 16; }
            }
          `}</style>
        </svg>
      )
    },
    {
      id: 'infinity',
      name: 'The Obsidian Loop',
      category: 'Branding',
      description: 'An elegant skeuomorphic continuous double-loop emblem wrapping dynamic accent sweeps at the pivot center.',
      svgCode: `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Infinity Double Loop -->
  <path d="M 32 32 C 26 20 12 20 12 32 C 12 44 26 44 32 32 C 38 20 52 20 52 32 C 52 44 38 44 32 32 Z" stroke="#23211F" stroke-width="2.5" fill="none" />
  
  <!-- Active Speeds Accent Dot -->
  <circle cx="32" cy="32" r="3" fill="#ACCENTS" style="animation: loop-accent 3s infinite linear; transform-origin: 32px 32px;" />

  <style>
    @keyframes loop-accent {
      0% { transform: scale(0.8) rotate(0deg) translate(20px) rotate(0deg); }
      100% { transform: scale(0.8) rotate(360deg) translate(20px) rotate(-360deg); }
    }
  </style>
</svg>`,
      render: (color, animate) => (
        <svg width="84" height="84" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Infinity Double Loop */}
          <path 
            d="M 32 32 C 26 20 12 20 12 32 C 12 44 26 44 32 32 C 38 20 52 20 52 32 C 52 44 38 44 32 32 Z" 
            stroke="#23211F" 
            strokeWidth={3} 
            fill="none" 
          />
          {/* Secondary Highlight Sweep */}
          <path 
            d="M 32 32 C 26 20 12 20 12 32 C 12 44 26 44 32 32" 
            stroke={color} 
            strokeWidth={1.5} 
            strokeDasharray="8, 12"
            fill="none" 
            style={{
              animation: animate ? 'dash-sweep 3s infinite linear' : 'none'
            }}
          />
          {/* Active Speeds Accent Dot */}
          <circle 
            cx="32" 
            cy="32" 
            r="3.5" 
            fill={color} 
            style={{ 
              animation: animate ? 'loop-accent 2.8s infinite linear' : 'none', 
              transformOrigin: '32px 32px' 
            }} 
          />
          <style>{`
            @keyframes loop-accent {
              0% { transform: scale(0.9) rotate(0deg) translate(20px) rotate(0deg); }
              100% { transform: scale(0.9) rotate(360deg) translate(20px) rotate(-360deg); }
            }
            @keyframes dash-sweep {
              0% { stroke-dashoffset: 24; }
              100% { stroke-dashoffset: 0; }
            }
          `}</style>
        </svg>
      )
    }
  ];

  // Active Selected Detail
  const activeCustomIcon = customIconsDeck.find(i => i.id === selectedId) || customIconsDeck[0];

  // Compile code payload for copying
  const currentSvgCode = activeCustomIcon.svgCode
    .replace(/#ACCENTS/g, activeAccent);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentSvgCode);
    setCopiedId(activeCustomIcon.id);
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
              EXPERIMENTAL PORTAL
            </Typography>
            <Typography variant="h2" sx={{ fontWeight: 900, fontFamily: 'var(--font-outfit)', letterSpacing: '-0.04em', mt: 1, mb: 1 }}>
              Low-Level Custom SVG Icons
            </Typography>
            <Typography sx={{ opacity: 0.5, fontSize: '1rem', fontFamily: 'var(--font-satoshi)' }}>
              Pure inline geometric vectors styled with dynamic keyframes. Designed entirely in code with zero external assets.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            
            {/* Left Column: Interactive 2x2 Custom Icon Deck */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Grid container spacing={3}>
                {customIconsDeck.map((icon) => {
                  const isSelected = selectedId === icon.id;
                  return (
                    <Grid key={icon.id} size={{ xs: 12, sm: 6 }}>
                      <Paper sx={{ 
                        p: 4, 
                        bgcolor: '#0B0A09', 
                        borderRadius: '24px', 
                        border: isSelected ? `2px solid ${activeAccent}` : '2px solid #23211F',
                        boxShadow: isSelected ? '4px 4px 0px #000000' : '2px 2px 0px #000000',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '4px 4px 0px #000000'
                        }
                      }}
                      onClick={() => setSelectedId(icon.id)}
                      >
                        {/* Title and Category indicator */}
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                          <Typography sx={{ fontFamily: 'var(--font-outfit)', fontWeight: 900, fontSize: '1.1rem' }}>
                            {icon.name}
                          </Typography>
                          <Box sx={{ 
                            px: 1.5, 
                            py: 0.5, 
                            bgcolor: '#131110', 
                            border: '1px solid #23211F', 
                            borderRadius: '6px' 
                          }}>
                            <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 900, color: '#9B9691' }}>
                              {icon.category.toUpperCase()}
                            </Typography>
                          </Box>
                        </Stack>

                        {/* Rendering Well */}
                        <Box sx={{ 
                          display: 'flex', 
                          justifyContent: 'center', 
                          alignItems: 'center', 
                          py: 5, 
                          bgcolor: '#000000', 
                          borderRadius: '16px',
                          border: '1px solid #23211F',
                          mb: 3
                        }}>
                          {icon.render(activeAccent, isAnimated)}
                        </Box>

                        <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.85rem', opacity: 0.6 }}>
                          {icon.description}
                        </Typography>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
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
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#EC4899' }}>
                  SVG_INSPECTOR // RAW VECTOR BLUEPRINT
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
                        onClick={() => setActiveAccent(item.color)}
                        sx={{
                          width: 24,
                          height: 24,
                          bgcolor: item.color,
                          border: activeAccent === item.color ? '2px solid #FFFFFF' : 'none',
                          '&:hover': { opacity: 0.8 }
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>

                {/* Path Inspector Code Box */}
                <Box>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691' }}>
                      SOURCE SVG BLUEPRINT
                    </Typography>
                    
                    <Button
                      onClick={handleCopyCode}
                      size="small"
                      startIcon={copiedId === activeCustomIcon.id ? <Check size={12} /> : <Copy size={12} />}
                      sx={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.65rem',
                        textTransform: 'none',
                        color: copiedId === activeCustomIcon.id ? '#10B981' : '#6366F1'
                      }}
                    >
                      {copiedId === activeCustomIcon.id ? 'Copied!' : 'Copy Code'}
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

                {/* Description info */}
                <Box sx={{ p: 2.5, bgcolor: '#131110', border: '1px solid #23211F', borderRadius: '12px' }}>
                  <Typography sx={{ fontFamily: 'var(--font-outfit)', fontWeight: 900, fontSize: '0.85rem', mb: 0.5 }}>
                    How SVG Physics Works Entirely in Code:
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.75rem', opacity: 0.5, lineHeight: 1.4 }}>
                    By leveraging native SVG elements alongside standard CSS keyframes, we bypass heavy external script frameworks. The resulting vector path calculations compile with 100% client smoothness and infinitely scaling pixel density. Perfect for custom emojis, active loader widgets, and stateful huddle responses.
                  </Typography>
                </Box>
              </Paper>
            </Grid>

          </Grid>

          {/* Solid Footing */}
          <Box sx={{ textAlign: 'center', py: 3, opacity: 0.4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', borderTop: '2px solid #23211F' }}>
            OPENBRICKS 2.0 • INTERACTIVE SVG PHYSICS & CUSTOM EMOTE SYSTEM • VER 2.0
          </Box>

        </Stack>
      </Container>
    </Box>
  );
}
