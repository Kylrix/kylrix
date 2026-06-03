"use client";

import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { 
  ShieldCheck, 
  ChevronRight, 
  ArrowRight,
  Terminal,
  Layers,
  Fingerprint,
  Cpu,
  Zap,
  Lock,
  MessageSquare,
  StickyNote,
  Sparkles
} from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/auth/AuthContext';
import { ECOSYSTEM_APPS, getEcosystemUrl } from '@/lib/ecosystem';
import { Logo } from '@/components/Logo';

const getAppIcon = (id: string) => {
  switch (id) {
    case 'note': return StickyNote;
    case 'vault': return Lock;
    case 'flow': return Zap;
    case 'connect': return MessageSquare;
    case 'accounts': return Fingerprint;
    default: return StickyNote;
  }
};

const ProductCard = ({ app }: { app: any }) => {
  const Icon = getAppIcon(app.id);

  return (
    <motion.div 
      whileHover={{ y: -8 }} 
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="h-full"
    >
      <a 
        href={getEcosystemUrl(app.subdomain)}
        className="p-8 rounded-3xl border border-white/5 bg-[#141211] flex flex-col gap-6 h-full transition duration-300 hover:bg-[#1C1917]"
        style={{ '--hover-border-color': `${app.color}66` } as React.CSSProperties}
      >
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center border"
          style={{ 
            backgroundColor: `${app.color}0d`, 
            borderColor: `${app.color}1f` 
          }}
        >
          <Logo app={app.id as any} size={36} variant="icon" />
        </div>
        
        <div className="flex-1">
          <h4 className="text-xl font-extrabold font-clash text-white mb-2">{app.label}</h4>
          <p className="text-sm text-white/50 leading-relaxed font-satoshi">{app.description}</p>
        </div>

        <div className="pt-4 mt-auto">
          <span 
            className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider"
            style={{ color: app.color }}
          >
            <span>Initialize {app.label}</span>
            <ChevronRight size={14} />
          </span>
        </div>
      </a>
    </motion.div>
  );
};

export default function LandingPage() {
  const { openIDMWindow, isAuthenticated, user, isAuthenticating } = useAuth();
  const router = useRouter();
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('stay')) {
      return;
    }
    if (isAuthenticated) {
      router.replace('/note/notes');
      return;
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-[#0A0908] text-white/90 flex flex-col font-satoshi relative overflow-hidden">
      {/* Main Body */}
      <main className="flex-1 relative z-10">
        
        {/* Hero Section */}
        <section className="py-20 md:py-32 text-center px-6">
          <Container maxW="3xl">
            <motion.div style={{ opacity }}>
              <div className="flex flex-col items-center gap-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border border-cyan-500/30 bg-cyan-500/5 text-cyan-400">
                  <Sparkles size={12} />
                  <span>AI-POWERED ORCHESTRATION IS HERE</span>
                </span>
                
                <h1 className="text-4xl md:text-8xl font-black font-clash leading-none tracking-tight bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
                  Redefining the <br />
                  <span className="text-[#6366F1]">Ecosystem</span> of Tools.
                </h1>
                
                <p className="text-base md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mt-4">
                  Kylrix is a unified suite of ultra-secure applications designed for the modern creator.
                  Experience zero-knowledge privacy and seamless AI intelligence across your entire workflow.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center w-full max-w-md">
                  <button 
                    onClick={() => openIDMWindow()}
                    disabled={isAuthenticating}
                    className="px-8 py-3.5 bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-sm uppercase tracking-wider rounded-xl transition shadow-[0_0_30px_rgba(99,102,241,0.25)] active:scale-[0.98] disabled:opacity-50"
                  >
                    Get Started Free
                  </button>
                  <a 
                    href="/docs"
                    className="px-8 py-3.5 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white font-black text-sm uppercase tracking-wider rounded-xl transition text-center active:scale-[0.98]"
                  >
                    Documentation
                  </a>
                </div>
              </div>
            </motion.div>
          </Container>
        </section>

        {/* Flagships Grid */}
        <section className="py-20 md:py-32 border-t border-white/5 bg-white/[0.01] px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16 flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#6366F1] font-clash">THE FLAGSHIPS</span>
              <h2 className="text-3xl md:text-5xl font-black font-clash text-white">Engineered for Excellence.</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ECOSYSTEM_APPS.filter(app => app.type === 'app').map((app) => (
                <div key={app.id}>
                  <ProductCard app={app} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Infrastructure Section */}
        <section className="py-20 md:py-32 px-6 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            
            {/* Left side text info */}
            <div className="flex flex-col gap-10">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#6366F1] font-clash block mb-3">INFRASTRUCTURE</span>
                <h2 className="text-3xl md:text-5xl font-black font-clash text-white leading-tight mb-4">
                  Secure by Design. <br />Private by Default.
                </h2>
                <p className="text-lg text-white/50 leading-relaxed font-satoshi">
                  Every Kylrix application is built on our own secure infrastructure, so your data stays yours.
                </p>
              </div>

              <div className="flex flex-col gap-6">
                {[
                  { icon: Fingerprint, title: 'Private', desc: 'Local encryption means only you can see your data.', color: '#EF4444' },
                  { icon: Layers, title: 'Extensible', desc: 'Built for developers to build on top of.', color: '#6366F1' },
                  { icon: Cpu, title: 'Local AI', desc: 'Fast, private AI that runs on your device.', color: '#10B981' }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="pt-1" style={{ color: item.color }}>
                      <item.icon size={28} strokeWidth={1.5} />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-white mb-1 font-clash">{item.title}</h4>
                      <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right side interactive console mock */}
            <div className="bg-black/60 border border-white/10 rounded-3xl p-8 md:p-12 min-h-[400px] flex flex-col justify-between relative overflow-hidden shadow-2xl backdrop-blur">
              <div className="flex flex-col gap-6">
                <div className="text-white/20">
                  <Terminal size={48} strokeWidth={1} />
                </div>
                <div className="font-mono text-lg md:text-2xl text-white/90 leading-relaxed">
                  <span className="text-[#6366F1]">$</span> kylrix initialize <br />
                  <div className="text-white/30 text-sm md:text-base mt-2 flex flex-col gap-1">
                    <span>&gt; Secure Connection Established.</span>
                    <span>&gt; Connection Successful.</span>
                    <span>&gt; Syncing your data...</span>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 mt-8">
                <a 
                  href="/developers"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white font-black text-sm uppercase tracking-wider rounded-xl transition"
                >
                  <span>Developer Portal</span>
                  <ArrowRight size={16} />
                </a>
              </div>
            </div>

          </div>
        </section>

        {/* Action Promo Banner */}
        <section className="px-6 max-w-7xl mx-auto pb-16">
          <div className="p-8 md:p-12 rounded-[32px] bg-[#161412] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 shadow-2xl">
            <div className="flex-1">
              <h3 className="text-2xl md:text-3xl font-black font-clash text-white mb-2">
                Premium enough to lead with, quiet enough to live in.
              </h3>
              <p className="text-sm text-white/50 leading-relaxed max-w-3xl">
                Kylrix is built to look like a serious system: crisp typography, true app marks, a black canvas,
                and one shell that routes you to the right product without modal noise.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 w-full md:w-auto">
              <button
                onClick={() => openIDMWindow()}
                disabled={isAuthenticating}
                className="px-6 py-3 bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs uppercase tracking-wider rounded-xl transition text-center whitespace-nowrap active:scale-[0.98] disabled:opacity-50"
              >
                Open Accounts
              </button>
              <a
                href="/pricing"
                className="px-6 py-3 border border-white/10 hover:border-white/20 hover:bg-white/5 text-white font-black text-xs uppercase tracking-wider rounded-xl transition text-center whitespace-nowrap active:scale-[0.98]"
              >
                View Pricing
              </a>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 bg-[#0A0908] px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="text-[10px] font-black tracking-widest uppercase text-white/40 block">KYLRIX.SPACE</span>
            <p className="text-xs text-white/30 mt-1 max-w-md font-satoshi">
              One system, one session, one premium surface for the entire ecosystem.
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="/docs" className="text-xs font-black text-white hover:text-[#6366F1] transition font-clash uppercase tracking-wider">Docs</a>
            <a href="/downloads" className="text-xs font-black text-white hover:text-[#6366F1] transition font-clash uppercase tracking-wider">Downloads</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-white/[0.03] text-center">
          <span className="text-[10px] text-white/20 font-black tracking-widest uppercase font-clash block">
            © 2026 Kylrix Ecosystem. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}

// Inline Container helper for clean layout
const Container = ({ children, maxW = '7xl' }: { children: React.ReactNode; maxW?: string }) => {
  const widthClasses: Record<string, string> = {
    '3xl': 'max-w-3xl',
    '7xl': 'max-w-7xl',
  };
  return (
    <div className={`mx-auto w-full ${widthClasses[maxW] || 'max-w-7xl'}`}>
      {children}
    </div>
  );
};
