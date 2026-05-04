import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { Box } from '@mui/material';
import '../../../globals.css';

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://kylrix.space'),
  title: 'Kylrix ID - Premium Identity Management',
  description: 'The root of your digital identity. Manage your secure access and passkeys with professional reliability.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    images: ['/og-image.png'],
  }
};

export default function AccountsLayout({ children }: { children: React.ReactNode }) {
  // Auth and global providers handled by root layout
  // This layout only provides accounts-specific structure
  return (
    <Box component="main">
      {children}
    </Box>
  );
}
