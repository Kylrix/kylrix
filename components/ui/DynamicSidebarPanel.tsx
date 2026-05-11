'use client';

import { Box, Drawer, IconButton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack as BackIcon, Close as CloseIcon } from '@mui/icons-material';

import { useDynamicSidebar } from '@/components/ui/DynamicSidebarContext';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';

export function DynamicSidebar() {
  const theme = useTheme();
  const { isOpen, content, closeSidebar } = useDynamicSidebar();
  const panelBg = theme.palette.background.paper;
  const iconHoverBg =
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : theme.palette.action.hover;

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={closeSidebar}
      variant="temporary"
      slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
      PaperProps={{
        'data-dynamic-sidebar': 'true',
        sx: {
          width: {
            xs: '100%',
            sm: 400,
            md: 450,
            lg: 500,
          },
          bgcolor: panelBg,
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: { xs: 2, sm: 3 },
          bgcolor: panelBg,
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={closeSidebar}
            size="small"
            sx={{
              display: { xs: 'inline-flex', sm: 'none' },
              color: 'rgba(255, 255, 255, 0.5)',
              '&:hover': { color: '#6366F1', bgcolor: iconHoverBg },
            }}
          >
            <BackIcon />
          </IconButton>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 900,
              fontFamily: '"Space Grotesk", sans-serif',
              color: '#6366F1',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: { xs: '0.875rem', sm: '1rem' },
            }}
          >
            Details
          </Typography>
        </Box>
        <IconButton
          onClick={closeSidebar}
          size="small"
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            color: 'rgba(255, 255, 255, 0.5)',
            '&:hover': { color: '#6366F1', bgcolor: iconHoverBg },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0, bgcolor: panelBg }}>{content}</Box>
    </Drawer>
  );
}
