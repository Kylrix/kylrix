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
import { AuthErrorBoundary } from '@/components/ui/ErrorBoundary';

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap"});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap'});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap'});

import GlobalShell from '@/components/GlobalShell';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.kylrix.space'),
  title: {
    default: 'Build, ship and think in one living agentic workspace. — Kylrix',
    template: '%s · Kylrix'},
  description: 'Your workflow becomes a living, scalable system that compounds daily leverage over time. Everything is an object, every action is just a tool call, and every result is more context.',
  keywords: ['agentic workspace', 'local-first', 'PAT', 'OAuth2', 'WebRTC', 'offline-first', 'productivity system'],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'},
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.kylrix.space',
    siteName: 'Kylrix',
    title: 'Build, ship and think in one living agentic workspace.',
    description: 'Your workflow becomes a living, scalable system that compounds daily leverage over time. Everything is an object, every action is just a tool call, and every result is more context.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Build, ship and think in one living agentic workspace.'},
    ]},
  twitter: {
    card: 'summary_large_image',
    title: 'Build, ship and think in one living agentic workspace. — Kylrix',
    description: 'Your workflow becomes a living, scalable system that compounds daily leverage over time. Everything is an object, every action is just a tool call, and every result is more context.',
    images: ['/opengraph-image']}};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
                        if (p && p !== '/' && p.indexOf('/send') !== 0 && p.indexOf('/app') !== 0 && p.indexOf('/idea') !== 0) {
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
        <AuthErrorBoundary>
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
        </AuthErrorBoundary>
      </body>
    </html>
  );
}
