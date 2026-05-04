import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Providers } from '@/components/Providers';
import { EcosystemClient } from '@/components/EcosystemClient';
import TopbarShell from '@/components/layout/TopbarShell';
import { Box } from '@mui/material';
import "./globals.css";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://id.kylrix.space'),
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mono.variable}>
      <head>
        {/* THE KYLRIX SIGNATURE TRIO: Satoshi (Body) & Clash Display (Headings) */}
        <link 
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&display=swap" 
          rel="stylesheet" 
        />
        <link rel="preconnect" href="https://fra.cloud.appwrite.io" />
      </head>
      <body className="antialiased">
        <EcosystemClient nodeId="id" />
        <Providers>
          <TopbarShell />
          <Box component="main" sx={{ pt: '88px', pb: { xs: '120px', md: '0' } }}>
            {children}
          </Box>
        </Providers>
      </body>
    </html>
  );
}
