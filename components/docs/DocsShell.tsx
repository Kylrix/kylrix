'use client';

import React from 'react';
import { Box, Container } from '@mui/material';

export default function DocsShell({ children }: { children: React.ReactNode }) {
  return (
    <Box component="div" sx={{ pt: { xs: 3, md: 4 }, pb: 10, pointerEvents: 'auto' }}>
        <Container maxWidth="lg">
          <Box sx={{ px: { xs: 2, md: 4 } }}>{children}</Box>
        </Container>
    </Box>
  );
}
