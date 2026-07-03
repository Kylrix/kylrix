import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Outfit, Space_Grotesk } from 'next/font/google';
import './globals.css';
import './chrome.css';
import './lists.css';
import ThemeRegistry from '@/theme/ThemeProvider';
import { DataNexusProvider } from '@/context/DataNexusContext';
import { LayoutProvider } from '@/context/LayoutContext';
import { ClientProviders } from './ClientProviders';
import { AuthProvider } from '@/context/auth/AuthContext';

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

import GlobalShell from '@/components/GlobalShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://kylrix.space'),
  title: {
    default: 'Kylrix · The only agentic workspace where your productivity tools and autonomous agents coexist',
    template: '%s · Kylrix',
  },
  description: 'The only agentic workspace where your productivity tools and autonomous agents coexist. A deeply interconnected, zero-knowledge workspace where people create and agents execute.',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://kylrix.space',
    siteName: 'Kylrix',
    images: [
      {
        url: '/logo_social.png',
        width: 1200,
        height: 630,
        alt: 'Kylrix Ecosystem',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Kylrix · The only agentic workspace where your productivity tools and autonomous agents coexist',
    description: 'The only agentic workspace where your productivity tools and autonomous agents coexist.',
    images: ['/logo_social.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#6366F1',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${mono.variable} ${outfit.variable} ${spaceGrotesk.variable}`}>
      <head>
        <link rel="preconnect" href="https://api.kylrix.space" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.kylrix.space" />

        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var match = document.cookie.match(new RegExp('(^| )kylrix_pulse_v2=([^;]+)'));
              if (match) {
                var d = JSON.parse(decodeURIComponent(match[2]));
                var storage = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null;
                d.avatarBase64 = storage ? storage.getItem('kylrix_avatar_pulse_v2_' + d.$id) : null;
                window.__KYLRIX_PULSE__ = d;
                document.documentElement.setAttribute('data-kylrix-pulse', 'true');
                var s = document.createElement('style');
                s.innerHTML = '[data-kylrix-pulse="true"] #navbar-connect-btn { display: none !important; }';
                document.head.appendChild(s);
              }
            } catch(e) {}

            try {
              if (location.pathname === '/') {
                var hasPulse = document.documentElement.getAttribute('data-kylrix-pulse') === 'true';
                var hasSession = document.cookie.indexOf('a_session_') !== -1;
                if (hasPulse || hasSession) {
                  var dest = '/connect/chats';
                  try {
                    var hist = localStorage.getItem('kylrix_ecosystem_state_tracker');
                    if (hist) {
                      var routes = JSON.parse(hist);
                      for (var i = 0; i < routes.length; i++) {
                        var p = routes[i] && routes[i].path;
                        if (p && p !== '/' && p.indexOf('/send') !== 0 && p.indexOf('/app/shared') !== 0 && p.indexOf('/idea') !== 0) {
                          dest = p;
                          break;
                        }
                      }
                    }
                  } catch (e) {}
                  location.replace(dest);
                }
              }
            } catch(e) {}
          })();
        `}} />
        
        <link 
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&display=swap" 
          rel="stylesheet" 
          crossOrigin="anonymous"
        />
      </head>
      <body className={mono.className}>
        <AuthProvider>
            <ThemeRegistry>
              <DataNexusProvider>
                <LayoutProvider>
                  <ClientProviders>
                    <GlobalShell>
                      {children}
                    </GlobalShell>
                  </ClientProviders>
                </LayoutProvider>
              </DataNexusProvider>
            </ThemeRegistry>
        </AuthProvider>
      </body>
    </html>
  );
}
