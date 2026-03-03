'use client';

import React from 'react';
import { Box, Container, Typography, Grid, Paper, Divider, Stack } from '@mui/material';
import Logo, { KylrixApp } from '@/components/Logo';

export default function LogoPage() {
  const apps: KylrixApp[] = ['root', 'vault', 'flow', 'note', 'connect'];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', color: '#fff', py: 8 }}>
      <Container maxWidth="lg">
        <Stack spacing={8}>
          <Box>
            <Typography variant="h2" sx={{ fontWeight: 900, mb: 2, fontFamily: '"Clash Display", sans-serif' }}>
              KYLRIX GEOMETRY
            </Typography>
            <Typography sx={{ opacity: 0.6, fontSize: '1.2rem' }}>
              A generative visual system for an autonomous ecosystem.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 4, opacity: 0.8, letterSpacing: '0.1em' }}>
              ECOSYSTEM PERSONALITIES
            </Typography>
            <Grid container spacing={4}>
              {apps.map((app) => (
                <Grid size={{ xs: 12, md: 6 }} key={app}>
                  <Paper sx={{ 
                    p: 6, 
                    bgcolor: 'rgba(255,255,255,0.03)', 
                    borderRadius: 4, 
                    border: '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.3s',
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.15)'
                    }
                  }}>
                    <Logo app={app} size={80} />
                    <Box sx={{ mt: 4, opacity: 0.5, fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {app === 'root' && "The core of the Kylrix design system."}
                      {app === 'vault' && "Secure and dense storage for your most sensitive data."}
                      {app === 'flow' && "Visualizing the movement of your tasks and workflows."}
                      {app === 'note' && "Organizing your thoughts into structured knowledge."}
                      {app === 'connect' && "Connecting you to your team and your other apps."}
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 4, opacity: 0.8, letterSpacing: '0.1em' }}>
              SCALABILITY & FIDELITY
            </Typography>
            <Paper sx={{ 
              p: 6, 
              bgcolor: 'rgba(255,255,255,0.03)', 
              borderRadius: 4, 
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Logo app="root" size={24} variant="icon" />
              <Logo app="root" size={48} variant="icon" />
              <Logo app="root" size={96} variant="icon" />
              <Logo app="root" size={192} variant="icon" />
            </Paper>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

          <Grid container spacing={8}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>The "K" Skeleton</Typography>
              <Typography sx={{ opacity: 0.7, lineHeight: 1.8 }}>
                Every app in the Kylrix ecosystem is a mutation of the same structural "K". This ensures 
                that while each tool has its own visual personality, they are all clearly part of the 
                same autonomous lineage.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>Generative Design</Typography>
              <Typography sx={{ opacity: 0.7, lineHeight: 1.8 }}>
                By using SVG filters (Grain, Turbulence, Blur) and CSS keyframes, the logo becomes a 
                living piece of software rather than a static image asset. It reacts to its 
                environment and state.
              </Typography>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
