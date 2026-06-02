'use client';

import React, { useState } from 'react';
import { Box, Container, Typography, Grid, Paper, Stack, Button, IconButton, Slider, ToggleButton, ToggleButtonGroup } from '@/lib/mui-tailwind/material';
import { 
  ArrowLeft, Home, Shield, Lock, KeyRound, Fingerprint, Share2, Link2, Radio, Network,
  MessageSquare, MessageCircle, Mic, Users, Workflow, Cpu, Zap, GitMerge, PlayCircle,
  Settings, Trash2, Plus, Search, Copy, ExternalLink, Sparkles, Check
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface IconDetail {
  name: string;
  category: 'Security' | 'Sharing' | 'Huddles' | 'Workflows' | 'Utility';
  component: React.ComponentType<any>;
  description: string;
}

export default function IconsSandboxPage() {
  const router = useRouter();

  // Curated Icon Deck
  const iconDeck: IconDetail[] = [
    // Security Niche
    { name: 'Shield', category: 'Security', component: Shield, description: 'Ecosystem firewall protective boundary symbol.' },
    { name: 'Lock', category: 'Security', component: Lock, description: 'Cryptographical lock status indicator.' },
    { name: 'KeyRound', category: 'Security', component: KeyRound, description: 'Access credentials and vault key identifier.' },
    { name: 'Fingerprint', category: 'Security', component: Fingerprint, description: 'Biometric local owner authentication.' },
    
    // Sharing Niche
    { name: 'Share2', category: 'Sharing', component: Share2, description: 'Workspace connection node distribution flow.' },
    { name: 'Link2', category: 'Sharing', component: Link2, description: 'Encrypted peer-to-peer linking portal.' },
    { name: 'Radio', category: 'Sharing', component: Radio, description: 'Live TUI client sync frequency broadcasting.' },
    { name: 'Network', category: 'Sharing', component: Network, description: 'Multi-node server sync visualization map.' },
    
    // Huddles Niche
    { name: 'MessageSquare', category: 'Huddles', component: MessageSquare, description: 'Ephemeral project huddle bubble indicator.' },
    { name: 'MessageCircle', category: 'Huddles', component: MessageCircle, description: 'Real-time active voice discussion console.' },
    { name: 'Mic', category: 'Huddles', component: Mic, description: 'Huddle audio stream active record status.' },
    { name: 'Users', category: 'Huddles', component: Users, description: 'Workspace collective huddle membership panel.' },
    
    // Workflows Niche
    { name: 'Workflow', category: 'Workflows', component: Workflow, description: 'Smart Action chain sequence pipeline builder.' },
    { name: 'Cpu', category: 'Workflows', component: Cpu, description: 'Local context processing engine status.' },
    { name: 'Zap', category: 'Workflows', component: Zap, description: 'Instant macro speed execution shortcut trigger.' },
    { name: 'GitMerge', category: 'Workflows', component: GitMerge, description: 'Branch-merge resolution node sync.' },
    
    // Utility Niche
    { name: 'Settings', category: 'Utility', component: Settings, description: 'System hardware config variables adjustment.' },
    { name: 'Trash2', category: 'Utility', component: Trash2, description: 'Permanent cache/metadata purge delete sweep.' },
    { name: 'Plus', category: 'Utility', component: Plus, description: 'Add new container panel block action.' },
    { name: 'Search', category: 'Utility', component: Search, description: 'Workspace deep indexing dynamic query query.' }
  ];

  // Interactive Configuration State
  const [selectedIconName, setSelectedIconName] = useState<string>('Shield');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [containerBg, setContainerBg] = useState<string>('#131110'); // Bedrock, Chrome, Active
  const [borderRadius, setBorderRadius] = useState<number>(12);
  const [borderWidth, setBorderWidth] = useState<number>(2);
  const [accentColor, setAccentColor] = useState<string>('#6366F1'); // Indigo, Emerald, Pink, Amber
  const [hasShadow, setHasShadow] = useState<boolean>(true);
  const [hasSpecularHighlight, setHasSpecularHighlight] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Active Icon
  const activeIconDetail = iconDeck.find(i => i.name === selectedIconName) || iconDeck[0];
  const ActiveIconComponent = activeIconDetail.component;

  // Categories
  const categories = ['All', 'Security', 'Sharing', 'Huddles', 'Workflows', 'Utility'];

  // Filtered Icons
  const filteredIcons = activeCategory === 'All' 
    ? iconDeck 
    : iconDeck.filter(i => i.category === activeCategory);

  const handleCopyCode = () => {
    const codeString = `<Box sx={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '64px',
  height: '64px',
  bgcolor: '${containerBg}',
  border: '${borderWidth}px solid #23211F',
  borderRadius: '${borderRadius}px',
  color: '${accentColor}',
  ${hasShadow ? `boxShadow: '1px 1px 0px #23211F, 2px 2px 0px #000000',` : ''}
  position: 'relative',
  overflow: 'hidden'
}}>
  ${hasSpecularHighlight ? `<Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', bgcolor: 'rgba(255,255,255,0.08)' }} />` : ''}
  <${activeIconDetail.name} size={32} />
</Box>`;
    
    navigator.clipboard.writeText(codeString);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000000', color: '#FFFFFF', py: 8, px: { xs: 2, md: 4 } }}>
      <Container maxWidth="xl">
        <Stack spacing={6}>
          
          {/* Navigation Bar */}
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
              Skeuomorphic Icon Playground
            </Typography>
            <Typography sx={{ opacity: 0.5, fontSize: '1rem', fontFamily: 'var(--font-satoshi)' }}>
              Configure physical border-radius curves, tactile shadows, specular edge glimmers, and unified accent profiles in real-time.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            
            {/* Left Column: Interactive Blueprint Configurator */}
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
                <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#6366F1' }}>
                  ACTIVE_BLUEPRINT // PREVIEW & CONTROL
                </Typography>

                {/* Main Interactive Icon Preview Frame */}
                <Box sx={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  py: 6,
                  bgcolor: '#000000',
                  borderRadius: '16px',
                  border: '1px solid #23211F',
                  position: 'relative'
                }}>
                  {/* Skeuomorphic Icon Tile */}
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: 110, 
                    height: 110, 
                    bgcolor: containerBg, 
                    border: `${borderWidth}px solid #23211F`, 
                    borderRadius: `${borderRadius}px`,
                    color: accentColor,
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: hasShadow 
                      ? '1px 1px 0px #23211F, 2px 2px 0px #1E1B19, 3px 3px 0px #161412, 4px 4px 0px #0A0908, 5px 5px 0px #000000' 
                      : 'none',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}>
                    {/* Specular Highlight line */}
                    {hasSpecularHighlight && (
                      <Box sx={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        height: '1px', 
                        bgcolor: 'rgba(255, 255, 255, 0.12)',
                        zIndex: 2 
                      }} />
                    )}
                    <ActiveIconComponent size={44} strokeWidth={2.2} />
                  </Box>

                  <Typography sx={{ fontFamily: 'var(--font-outfit)', fontWeight: 900, mt: 3, fontSize: '1.2rem' }}>
                    {activeIconDetail.name}
                  </Typography>
                  <Typography sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.8rem', opacity: 0.5, px: 4, textAlign: 'center', mt: 0.5 }}>
                    {activeIconDetail.description}
                  </Typography>
                </Box>

                {/* Configuration Controls */}
                <Stack spacing={3}>
                  
                  {/* Container Background Fills */}
                  <Box>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691', mb: 1 }}>
                      CONTAINER DEPTH FILL
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      {[
                        { label: 'Void (#000000)', val: '#000000' },
                        { label: 'Bedrock (#0B0A09)', val: '#0B0A09' },
                        { label: 'Chrome (#131110)', val: '#131110' },
                        { label: 'Active (#1B1918)', val: '#1B1918' }
                      ].map((item) => (
                        <Button 
                          key={item.val}
                          onClick={() => setContainerBg(item.val)}
                          sx={{
                            flexGrow: 1,
                            py: 1,
                            fontSize: '0.65rem',
                            fontFamily: 'var(--font-mono)',
                            bgcolor: containerBg === item.val ? '#1B1918' : '#000000',
                            color: containerBg === item.val ? '#FFFFFF' : '#9B9691',
                            border: containerBg === item.val ? '1px solid #6366F1' : '1px solid #23211F',
                            borderRadius: '6px',
                            textTransform: 'none',
                            '&:hover': { bgcolor: '#131110' }
                          }}
                        >
                          {item.label.split(' ')[0]}
                        </Button>
                      ))}
                    </Stack>
                  </Box>

                  {/* Border Radii Control */}
                  <Box>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691' }}>
                        BORDER RADIUS (SUPERIOR UI STANDARD)
                      </Typography>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 900, color: '#6366F1' }}>
                        {borderRadius}px
                      </Typography>
                    </Stack>
                    <Slider 
                      value={borderRadius} 
                      onChange={(_, val) => setBorderRadius(val as number)}
                      min={0}
                      max={55}
                      step={2}
                      sx={{ 
                        color: '#6366F1',
                        '& .MuiSlider-thumb': { bgcolor: '#FFFFFF', border: '2px solid #6366F1' },
                        '& .MuiSlider-track': { height: 4 },
                        '& .MuiSlider-rail': { height: 4, bgcolor: '#23211F' }
                      }}
                    />
                  </Box>

                  {/* Border Thickness & Highlights */}
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691', mb: 1 }}>
                        OUTLINE THICKNESS
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {[1, 2, 3].map((val) => (
                          <Button
                            key={val}
                            onClick={() => setBorderWidth(val)}
                            sx={{
                              flexGrow: 1,
                              py: 0.5,
                              fontFamily: 'var(--font-mono)',
                              bgcolor: borderWidth === val ? '#1B1918' : '#000000',
                              color: borderWidth === val ? '#FFFFFF' : '#9B9691',
                              border: borderWidth === val ? '1px solid #6366F1' : '1px solid #23211F',
                              borderRadius: '6px'
                            }}
                          >
                            {val}px
                          </Button>
                        ))}
                      </Stack>
                    </Grid>

                    <Grid size={{ xs: 6 }}>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691', mb: 1 }}>
                        ACCENT COLOR PRESET
                      </Typography>
                      <Stack direction="row" spacing={0.5} justifyContent="space-between">
                        {[
                          { color: '#6366F1', name: 'Indigo' },
                          { color: '#10B981', name: 'Emerald' },
                          { color: '#EC4899', name: 'Pink' },
                          { color: '#F59E0B', name: 'Amber' },
                          { color: '#A855F7', name: 'Purple' }
                        ].map((preset) => (
                          <IconButton
                            key={preset.name}
                            onClick={() => setAccentColor(preset.color)}
                            sx={{
                              width: 24,
                              height: 24,
                              bgcolor: preset.color,
                              border: accentColor === preset.color ? '2px solid #FFFFFF' : 'none',
                              '&:hover': { opacity: 0.8 }
                            }}
                          />
                        ))}
                      </Stack>
                    </Grid>
                  </Grid>

                  {/* Physics & Edge Highlights Switches */}
                  <Box>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, color: '#9B9691', mb: 1.5 }}>
                      SKEUOMORPHIC ANCHORS
                    </Typography>
                    <Stack direction="row" spacing={2}>
                      <Button
                        onClick={() => setHasShadow(!hasShadow)}
                        sx={{
                          flexGrow: 1,
                          py: 1,
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          bgcolor: hasShadow ? '#1B1918' : '#000000',
                          color: hasShadow ? '#FFFFFF' : '#9B9691',
                          border: hasShadow ? '1px solid #6366F1' : '1px solid #23211F',
                          borderRadius: '8px',
                          textTransform: 'none'
                        }}
                      >
                        {hasShadow ? 'Tactile Shadow: ON' : 'Tactile Shadow: OFF'}
                      </Button>
                      <Button
                        onClick={() => setHasSpecularHighlight(!hasSpecularHighlight)}
                        sx={{
                          flexGrow: 1,
                          py: 1,
                          fontSize: '0.7rem',
                          fontFamily: 'var(--font-mono)',
                          bgcolor: hasSpecularHighlight ? '#1B1918' : '#000000',
                          color: hasSpecularHighlight ? '#FFFFFF' : '#9B9691',
                          border: hasSpecularHighlight ? '1px solid #6366F1' : '1px solid #23211F',
                          borderRadius: '8px',
                          textTransform: 'none'
                        }}
                      >
                        {hasSpecularHighlight ? 'Edge Specular: ON' : 'Edge Specular: OFF'}
                      </Button>
                    </Stack>
                  </Box>

                  {/* Copy code trigger */}
                  <Button
                    onClick={handleCopyCode}
                    startIcon={isCopied ? <Check size={16} /> : <Copy size={16} />}
                    sx={{
                      py: 1.5,
                      bgcolor: isCopied ? '#10B981' : '#6366F1',
                      color: isCopied ? '#000000' : '#FFFFFF',
                      fontWeight: 900,
                      fontFamily: 'var(--font-space-grotesk)',
                      borderRadius: '8px',
                      textTransform: 'none',
                      boxShadow: '3px 3px 0px #000000',
                      '&:hover': {
                        bgcolor: isCopied ? '#34D399' : '#818CF8',
                        transform: 'translate(-1px, -1px)',
                        boxShadow: '4px 4px 0px #000000'
                      },
                      '&:active': {
                        transform: 'translate(1px, 1px)',
                        boxShadow: '2px 2px 0px #000000'
                      }
                    }}
                  >
                    {isCopied ? 'Code copied to Clipboard!' : 'Copy Code Snippet'}
                  </Button>

                </Stack>
              </Paper>
            </Grid>

            {/* Right Column: Curated Icon Grid and Presets */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={4}>
                
                {/* 1. Curated Icon Deck */}
                <Paper sx={{ 
                  p: 4, 
                  bgcolor: '#0B0A09', 
                  borderRadius: '24px', 
                  border: '2px solid #23211F',
                  boxShadow: '4px 4px 0px #000000'
                }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 4 }}>
                    <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#EC4899' }}>
                      CURATED_DECK // SELECT ICON TO CUSTOMIZE
                    </Typography>

                    {/* Filter categories */}
                    <ToggleButtonGroup
                      value={activeCategory}
                      exclusive
                      onChange={(_, val) => val && setActiveCategory(val)}
                      sx={{
                        mt: { xs: 2, sm: 0 },
                        bgcolor: '#000000',
                        border: '1px solid #23211F',
                        borderRadius: '8px',
                        p: '2px',
                        '& .MuiToggleButton-root': {
                          border: 'none',
                          color: '#9B9691',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          py: 0.5,
                          px: 1.5,
                          borderRadius: '6px',
                          textTransform: 'none',
                          '&.Mui-selected': {
                            bgcolor: '#131110',
                            color: '#FFFFFF',
                            border: '1px solid #23211F'
                          }
                        }
                      }}
                    >
                      {categories.map((c) => (
                        <ToggleButton key={c} value={c}>
                          {c}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Stack>

                  {/* Icon Grid */}
                  <Grid container spacing={2.5} sx={{ minHeight: '260px' }}>
                    {filteredIcons.map((item) => {
                      const IconItem = item.component;
                      const isSelected = selectedIconName === item.name;
                      return (
                        <Grid key={item.name} size={{ xs: 4, sm: 3, md: 2.4 }}>
                          <Box
                            onClick={() => setSelectedIconName(item.name)}
                            sx={{
                              p: 2.5,
                              bgcolor: isSelected ? '#1B1918' : '#131110',
                              border: isSelected ? `2px solid ${accentColor}` : '2px solid #23211F',
                              borderRadius: '12px',
                              textAlign: 'center',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1.5,
                              boxShadow: isSelected ? `2px 2px 0px #000000` : 'none',
                              transition: 'all 0.15s ease',
                              '&:hover': {
                                bgcolor: '#1B1918',
                                borderColor: isSelected ? accentColor : '#3D3AA9',
                                transform: 'translateY(-2px)'
                              }
                            }}
                          >
                            <Box sx={{ color: isSelected ? accentColor : '#9B9691' }}>
                              <IconItem size={24} />
                            </Box>
                            <Typography sx={{ fontFamily: 'var(--font-space-grotesk)', fontSize: '0.75rem', fontWeight: 800, wordBreak: 'break-all' }}>
                              {item.name}
                            </Typography>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>

                {/* 2. Skeuomorphic Button Presets */}
                <Paper sx={{ 
                  p: 4, 
                  bgcolor: '#0B0A09', 
                  borderRadius: '24px', 
                  border: '2px solid #23211F',
                  boxShadow: '4px 4px 0px #000000'
                }}>
                  <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 900, color: '#10B981', mb: 3 }}>
                    SKEUOMORPHIC_PRESETS // APPLIED EXAMPLES
                  </Typography>

                  <Grid container spacing={3}>
                    
                    {/* Preset 1: Tactile Navigation Circle */}
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Box sx={{ p: 3, bgcolor: '#131110', border: '1px solid #23211F', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <IconButton sx={{ 
                          width: 52, 
                          height: 52, 
                          bgcolor: '#0B0A09', 
                          border: '2px solid #23211F', 
                          color: '#10B981', 
                          boxShadow: '2px 2px 0px #000000',
                          '&:hover': { bgcolor: '#1B1918', transform: 'translate(-1px, -1px)', boxShadow: '3px 3px 0px #000000' }
                        }}>
                          <ActiveIconComponent size={22} />
                        </IconButton>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontFamily: 'var(--font-outfit)', fontSize: '0.85rem', fontWeight: 800 }}>
                            Tactile Circle FAB
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.4 }}>
                            border-radius: 50%
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* Preset 2: Tool Accent Action Block */}
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Box sx={{ p: 3, bgcolor: '#131110', border: '1px solid #23211F', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Button
                          startIcon={<ActiveIconComponent size={16} />}
                          sx={{
                            fontFamily: 'var(--font-space-grotesk)',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            bgcolor: '#0B0A09',
                            color: '#FFFFFF',
                            border: '2px solid #23211F',
                            borderRadius: '8px',
                            px: 3,
                            py: 1,
                            textTransform: 'none',
                            boxShadow: '3px 3px 0px #000000',
                            '&:hover': { bgcolor: '#1B1918', borderColor: accentColor, transform: 'translate(-1px, -1px)', boxShadow: '4px 4px 0px #000000' }
                          }}
                        >
                          Execute Command
                        </Button>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontFamily: 'var(--font-outfit)', fontSize: '0.85rem', fontWeight: 800 }}>
                            Tactile Action Trigger
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.4 }}>
                            border-radius: 8px
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                    {/* Preset 3: System Status Indicator Pill */}
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Box sx={{ p: 3, bgcolor: '#131110', border: '1px solid #23211F', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ 
                          display: 'inline-flex', 
                          alignItems: 'center', 
                          gap: 1.5, 
                          bgcolor: '#0B0A09', 
                          border: '1px solid #23211F', 
                          borderRadius: '20px', 
                          px: 2.5, 
                          py: 1,
                          color: '#FFFFFF' 
                        }}>
                          <Box sx={{ display: 'flex', color: accentColor }}><ActiveIconComponent size={14} /></Box>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                            SECURE_NODE_OK
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontFamily: 'var(--font-outfit)', fontSize: '0.85rem', fontWeight: 800 }}>
                            System Status Pill
                          </Typography>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', opacity: 0.4 }}>
                            border-radius: 20px
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>

                  </Grid>
                </Paper>

              </Stack>
            </Grid>

          </Grid>

          {/* Solid Footing */}
          <Box sx={{ textAlign: 'center', py: 3, opacity: 0.4, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', borderTop: '2px solid #23211F' }}>
            OPENBRICKS 2.0 • SKEUOMORPHIC ICON & SHADOW EXPERIMENT • VER 2.0
          </Box>

        </Stack>
      </Container>
    </Box>
  );
}
