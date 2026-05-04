'use client';
import React from 'react';
import { 
  Box, 
  Typography, 
  Grid, 
  Paper 
} from '@mui/material';
import Link from 'next/link';
import { 
  Campaign as BroadcastIcon, 
  Construction as ToolsIcon 
} from '@mui/icons-material';

export default function AdminDashboard() {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', py: 8, px: 3 }}>
      <Box sx={{ mb: 6 }}>
        <Typography 
          variant="h3" 
          sx={{ 
            fontWeight: 900, 
            fontFamily: 'var(--font-space-grotesk)', 
            mb: 1,
            background: 'linear-gradient(90deg, #fff, #6366F1)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Admin Dashboard
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
          Manage application configurations and messaging.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            component={Link}
            href="/admin/messages"
            sx={{
              p: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              textDecoration: 'none',
              borderRadius: '24px',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(25px)',
              transition: 'all 0.3s ease',
              '&:hover': {
                bgcolor: 'rgba(99, 102, 241, 0.05)',
                borderColor: '#6366F1',
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(99, 102, 241, 0.15)'
              }
            }}
          >
            <Box 
              sx={{ 
                width: 48, 
                height: 48, 
                borderRadius: '12px', 
                bgcolor: 'rgba(99, 102, 241, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#6366F1'
              }}
            >
              <BroadcastIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
                Broadcast Messages
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                Send announcements or targeted emails to users.
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper
            sx={{
              p: 4,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              borderRadius: '24px',
              bgcolor: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(25px)',
              opacity: 0.6
            }}
          >
            <Box 
              sx={{ 
                width: 48, 
                height: 48, 
                borderRadius: '12px', 
                bgcolor: 'rgba(255, 255, 255, 0.05)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: 'rgba(255, 255, 255, 0.3)'
              }}
            >
              <ToolsIcon />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', mb: 0.5 }}>
                Coming Soon
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                More management tools will appear here.
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
