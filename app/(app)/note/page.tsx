"use client";

import { Box, AppBar, Toolbar, Stack, Typography } from '@mui/material';
import Logo from '@/components/common/Logo';
import { Button } from '@/components/ui/Button';
import { DynamicSidebarProvider, DynamicSidebar } from '@/components/ui/DynamicSidebar';
import { GhostEditor } from '@/components/landing/GhostEditor';
import { useRouter } from 'next/navigation';

export default function NoteLandingPage() {
  const router = useRouter();

  return (
    <DynamicSidebarProvider>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: 'calc(100vh - 88px)', 
        color: 'rgba(255, 255, 255, 0.9)',
        backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.05) 0%, transparent 50%)'
      }}>
        <Box component="main" sx={{ flex: 1, py: 4 }}>
          <GhostEditor />
        </Box>

        <Box component="footer" sx={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', py: 6, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.2)', fontWeight: 700, letterSpacing: '0.1em' }}>
              © 2026 KYLRIX MESH. POWERED BY SOVEREIGN IDENTITY.
          </Typography>
        </Box>
      </Box>
      <DynamicSidebar />
    </DynamicSidebarProvider>
  );
}
