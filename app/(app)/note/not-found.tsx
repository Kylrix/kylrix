'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack, alpha, useTheme } from '@mui/material';

export default function NotFound() {
  const router = useRouter();
  const theme = useTheme();
  const [bounce, setBounce] = useState(false);
  const [noteFloat, setNoteFloat] = useState(false);

  useEffect(() => {
    const bounceInterval = setInterval(() => {
      setBounce(true);
      setTimeout(() => setBounce(false), 500);
    }, 3000);

    const floatInterval = setInterval(() => {
      setNoteFloat(true);
      setTimeout(() => setNoteFloat(false), 2000);
    }, 4000);

    return () => {
      clearInterval(bounceInterval);
      clearInterval(floatInterval);
    };
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Box sx={{ maxWidth: 512, width: '100%', textAlign: 'center' }}>
        {/* Floating decorative notes */}
        <Box sx={{ relative: 'relative', mb: 4 }}>
          <Box sx={{ 
            position: 'absolute', top: -16, left: -32, width: 24, height: 32, bgcolor: 'primary.main', borderRadius: 2, 
            boxShadow: 3, transition: 'transform 2s', 
            transform: noteFloat ? 'translateY(8px) rotate(12deg)' : 'translateY(-4px) rotate(-6deg)' 
          }} />
          <Box sx={{ 
            position: 'absolute', top: -8, right: -24, width: 16, height: 24, bgcolor: alpha(theme.palette.primary.main, 0.7), borderRadius: 2, 
            boxShadow: 3, transition: 'transform 2s', 
            transform: noteFloat ? 'translateY(-12px) rotate(-12deg)' : 'translateY(4px) rotate(12deg)' 
          }} />
        </Box>

        {/* Main card */}
        <Paper sx={{ p: 4, borderRadius: 6, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          {/* Giant 404 with bounce animation */}
          <Typography variant="h1" sx={{ 
            fontSize: { xs: '5rem', md: '6rem' }, fontWeight: 900, color: 'primary.main', mb: 2, 
            transition: 'transform 0.5s', transform: bounce ? 'scale(1.1)' : 'scale(1)' 
          }}>
            4🤔4
          </Typography>

          {/* Goofy whisper note illustration */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Box sx={{ position: 'relative' }}>
              <Box sx={{ 
                width: 96, height: 64, bgcolor: 'primary.main', borderRadius: 4, 
                boxShadow: 3, transform: 'rotate(-6deg)', position: 'relative' 
              }}>
                <Box sx={{ position: 'absolute', inset: 8, bgcolor: 'background.paper', borderRadius: 3, p: 1 }}>
                  <Box sx={{ h: 4, bgcolor: alpha(theme.palette.text.primary, 0.2), borderRadius: 1, mb: 0.5 }} />
                  <Box sx={{ h: 4, bgcolor: alpha(theme.palette.text.primary, 0.2), borderRadius: 1, mb: 0.5, width: '75%' }} />
                  <Box sx={{ h: 4, bgcolor: alpha(theme.palette.text.primary, 0.2), borderRadius: 1, width: '50%' }} />
                </Box>
              </Box>
              {/* Speech bubble */}
              <Box sx={{ 
                position: 'absolute', top: -32, right: -16, bgcolor: 'text.primary', color: 'background.default', 
                px: 1.5, py: 0.5, borderRadius: 4, fontSize: '0.75rem', fontWeight: 500 
              }}>
                &quot;Where am I?&quot;
                <Box sx={{ 
                  position: 'absolute', bottom: 0, left: 16, width: 0, height: 0, 
                  borderLeft: '4px solid transparent', borderRight: '4px solid transparent', 
                  borderTop: `4px solid ${theme.palette.text.primary}`, transform: 'translateY(100%)' 
                }} />
              </Box>
            </Box>
          </Box>

          {/* Title */}
          <Typography variant="h2" sx={{ mb: 1.5, fontWeight: 'bold' }}>
            Oops! This note got lost
          </Typography>

          {/* Description */}
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.6 }}>
            This page seems to have wandered off like a rogue whisper note. 
            Maybe it&apos;s hiding in someone else&apos;s collection? 🕵️‍♀️
          </Typography>

          {/* Action buttons */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={() => router.push('/')}
              sx={{ borderRadius: 4, px: 4, py: 1.5, fontWeight: 'bold' }}
            >
              🏠 Take me home
            </Button>
            
            <Button
              variant="outlined"
              size="large"
              onClick={() => router.back()}
              sx={{ borderRadius: 4, px: 4, py: 1.5, fontWeight: 'bold' }}
            >
              ⬅️ Go back
            </Button>
          </Stack>

          {/* Fun footer message */}
          <Box sx={{ mt: 4, pt: 3, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
              &quot;Not all who wander are lost... but this page definitely is.&quot; 📝✨
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
