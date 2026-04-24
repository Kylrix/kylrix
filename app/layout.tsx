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

export const metadata: Metadata = {
  title: "Kylrix — The Sovereign Work OS",
  description: "Kylrix is the sovereign, end-to-end encrypted work OS for notes, vaults, tasks, and private communication.",
  keywords: ["kylrix", "sovereign work os", "e2ee", "notes", "vault", "tasks", "communication"],
  authors: [{ name: "Kylrix Team" }],
  openGraph: {
    title: "Kylrix — The Sovereign Work OS",
    description: "One login. Four surfaces. One sovereign system.",
    type: "website",
    url: "https://kylrix.space",
    siteName: "Kylrix",
  },
  twitter: {
    card: "summary_large_image",
    site: "@kylrix",
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  }
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={mono.variable}>
      <head>
        {/* THE KYLRIX SIGNATURE TRIO: Satoshi (Body) & Clash Display (Headings) via Fontshare */}
        <link 
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,700,900&display=swap" 
          rel="stylesheet" 
          crossOrigin="anonymous"
        />
      </head>
      <body>
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
