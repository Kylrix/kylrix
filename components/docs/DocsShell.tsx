'use client';

import React from 'react';
import { Box, Container } from '@mui/material';
import DocsSidebar from '@/components/layout/DocsSidebar';

export default function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <Box component="main">
      <DocsSidebar />
      <Box sx={{ ml: { xs: 0, md: '320px' }, pt: { xs: 3, md: 4 }, pb: 20 }}>
        <Container maxWidth="lg">
          <Box sx={{ px: { xs: 2, md: 8 } }}>{children}</Box>
        </Container>
      </Box>
    </Box>
  );
}
