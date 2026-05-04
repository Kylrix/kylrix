import type { Metadata } from 'next';
import { Box } from '@mui/material';

export const metadata: Metadata = {
  metadataBase: new URL('https://kylrix.space'),
};

/**
 * Unified layout for all app subroutes: /note, /vault, /flow, /connect, /accounts
 * Auth, theme, and other global providers are already in root layout.
 * This layout only provides page-specific styling/structure.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box component="main">
      {children}
    </Box>
  );
}
