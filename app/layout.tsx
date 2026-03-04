import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ThemeRegistry from "@/theme/ThemeProvider";
import { AuthProvider } from "@/context/auth/AuthContext";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kylrix — The Future of AI-Powered Productivity",
  description: "A secure, premium, AI-driven suite for creators, developers, and teams. Built for high-fidelity orchestration, secure communication, and zero-knowledge intelligence.",
  keywords: ["kylrix", "ai productivity", "secure suite", "productivity applications", "next-gen tools"],
  authors: [{ name: "Kylrix Team" }],
  openGraph: {
    title: "Kylrix — The Future of AI-Powered Productivity",
    description: "Experience the premium AI-driven ecosystem.",
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
        />
      </head>
      <body>
        <ThemeRegistry>
          <AuthProvider>
            <div className="bg-mesh" />
            {children}
          </AuthProvider>
        </ThemeRegistry>
      </body>
    </html>
  );
}
