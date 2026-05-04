"use client";

import { Box, Typography, Button, Paper } from '@mui/material';
import { useTheme } from "@/components/ThemeProvider";

export function ThemeTest() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <Paper sx={{ p: 4, bgcolor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px' }}>
      <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, color: 'white' }}>Theme System Test</Typography>
      <Typography sx={{ mb: 4, color: 'rgba(255, 255, 255, 0.7)' }}>Current theme: <strong>{theme}</strong></Typography>
      <Button 
        variant="contained"
        onClick={toggleTheme}
        sx={{ 
          bgcolor: '#6366F1', 
          color: 'black', 
          fontWeight: 800,
          '&:hover': { bgcolor: '#00E5EE' }
        }}
      >
        Toggle Theme
      </Button>
      <Box sx={{ mt: 4, p: 2, bgcolor: 'rgba(0, 0, 0, 0.2)', color: 'white', borderRadius: '8px' }}>
        <Typography variant="body2">This text uses MUI components that should change with theme</Typography>
      </Box>
    </Paper>
  );
}
