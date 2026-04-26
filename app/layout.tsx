import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ThemeRegistry from "@/theme/ThemeProvider";
import { AuthProvider } from "@/context/auth/AuthContext";
import { DocsProvider } from "@/context/DocsContext";
import { SubscriptionProvider } from "@/context/subscription/SubscriptionContext";
import { DataNexusProvider } from "@/context/DataNexusContext";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={mono.variable}>
      <head>
        <link rel="preconnect" href="https://api.kylrix.space" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.kylrix.space" />

        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var match = document.cookie.match(new RegExp('(^| )kylrix_pulse_v2=([^;]+)'));
              if (match) {
                var d = JSON.parse(decodeURIComponent(match[2]));
                d.avatarBase64 = localStorage.getItem('kylrix_avatar_pulse_v2_' + d.$id);
                window.__KYLRIX_PULSE__ = d;
                document.documentElement.setAttribute('data-kylrix-pulse', 'true');
                var s = document.createElement('style');
                s.innerHTML = '[data-kylrix-pulse="true"] #navbar-connect-btn { display: none !important; }';
                document.head.appendChild(s);
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
        <ThemeRegistry>
          <DataNexusProvider>
            <AuthProvider>
              <DocsProvider>
                <SubscriptionProvider>
                  {children}
                </SubscriptionProvider>
              </DocsProvider>
            </AuthProvider>
          </DataNexusProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
