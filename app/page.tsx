'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Database,
  Github,
  KeyRound,
  Lock,
  Menu,
  ShieldCheck,
  Terminal,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { ThreadNoteClaimer } from '@/components/landing/ThreadNoteClaimer';

const FEATURES = [
  {
    icon: Lock,
    accent: '#10B981',
    eyebrow: '01 / Private by default',
    title: 'Secrets stay yours.',
    copy: 'Credentials are encrypted on your device before they reach a server. Agents receive only what they need, when they need it.',
  },
  {
    icon: Database,
    accent: '#6366F1',
    eyebrow: '02 / Memory that persists',
    title: 'Context survives the session.',
    copy: 'Keep notes, goals, and decisions close to your work. Local-first storage makes every edit instant, online or off.',
  },
  {
    icon: Bot,
    accent: '#A855F7',
    eyebrow: '03 / Built for agents',
    title: 'Give tools a safe workspace.',
    copy: 'Connect Claude Code, Cursor, and your own automations through open MCP and API surfaces with clear permissions.',
  },
  {
    icon: Terminal,
    accent: '#F59E0B',
    eyebrow: '04 / Yours to run',
    title: 'Cloud, local, or self-hosted.',
    copy: 'Use Kylrix in the browser, from the terminal, or on your own infrastructure. Your data has an exit route.',
  },
];

function Command({ children, onCopy, copied }: { children: string; onCopy: () => void; copied: boolean }) {
  return (
    <button
      onClick={onCopy}
      className="group flex w-full items-center justify-between gap-4 border border-white/20 bg-black px-4 py-3 text-left font-mono text-xs text-white transition-colors hover:border-indigo-400 sm:text-sm"
      aria-label={`Copy ${children}`}
    >
      <span className="truncate">
        <span className="mr-2 text-indigo-400">$</span>
        {children}
      </span>
      {copied ? <Check size={16} className="shrink-0 text-emerald-400" /> : <Copy size={16} className="shrink-0 text-white/60 group-hover:text-white" />}
    </button>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      let target = '/app';
      if (typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|; )kylrix_last_route=([^;]*)/);
        if (match?.[1]) {
          try {
            const decoded = decodeURIComponent(match[1]);
            if (decoded && decoded !== '/' && decoded !== '/landing' && !decoded.startsWith('/login') && !decoded.startsWith('/connect')) {
              target = decoded;
            }
          } catch {
            // Use the workspace default when the saved route is malformed.
          }
        }
      }
      router.replace(target);
    }
  }, [isAuthenticated, isLoading, router]);

  const copy = (value: string, setter: (value: boolean) => void) => {
    void navigator.clipboard.writeText(value);
    setter(true);
    window.setTimeout(() => setter(false), 1800);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-black font-sans text-white selection:bg-indigo-500 selection:text-white">
      <ThreadNoteClaimer />

      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute left-1/2 top-24 h-px w-[min(80vw,900px)] -translate-x-1/2 bg-indigo-500/50" />
        <div className="absolute left-1/2 top-0 h-[520px] w-[min(90vw,1100px)] -translate-x-1/2 rounded-full border border-indigo-500/10" />
        <div className="absolute left-1/2 top-16 h-[420px] w-[min(72vw,820px)] -translate-x-1/2 rounded-full border border-white/5" />
      </div>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 pt-14 sm:px-8 sm:pt-20 lg:px-12 lg:pb-32">
        <div className="mb-16 flex items-center justify-between border-b border-white/15 pb-5">
          <a href="/" className="flex items-center gap-3" aria-label="Kylrix home">
            <span className="grid h-9 w-9 place-items-center bg-indigo-500 font-clash text-lg font-bold text-white">K</span>
            <span className="font-clash text-xl font-bold tracking-tight">KYLRIX</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-bold sm:flex">
            <a href="#why" className="text-white transition-colors hover:text-indigo-300">Why Kylrix</a>
            <a href="#connect" className="text-white transition-colors hover:text-indigo-300">Connect</a>
            <a href="https://github.com/Kylrix/kylrix" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-white transition-colors hover:text-indigo-300">
              <Github size={16} /> GitHub
            </a>
            <Link href="/login" className="border border-white/25 px-4 py-2 transition-colors hover:border-white hover:bg-white hover:text-black">Sign in</Link>
          </nav>
          <button onClick={() => setMobileMenuOpen((open) => !open)} className="border border-white/20 p-2 sm:hidden" aria-label="Toggle navigation">
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="mb-10 grid gap-3 border border-white/20 bg-[#161412] p-4 text-sm font-bold sm:hidden">
            <a href="#why" onClick={() => setMobileMenuOpen(false)}>Why Kylrix</a>
            <a href="#connect" onClick={() => setMobileMenuOpen(false)}>Connect</a>
            <Link href="/login">Sign in</Link>
          </nav>
        )}

        <div className="grid items-end gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div>
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">
              <span className="h-2 w-2 bg-emerald-400" />
              Private infrastructure for intelligent work
            </motion.div>
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="max-w-4xl font-clash text-5xl font-bold leading-[0.94] tracking-[-0.04em] sm:text-7xl lg:text-[6.8rem]">
              Give your agents
              <span className="block text-indigo-400">a memory.</span>
              Keep your secrets.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="mt-8 max-w-xl text-base font-medium leading-7 text-white sm:text-lg">
              Kylrix is the private workspace for humans and AI tools: encrypted credentials, persistent context, and local-first control in one place.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/app" className="inline-flex items-center justify-center gap-2 bg-indigo-500 px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-indigo-400">
                Open your workspace <ArrowRight size={17} />
              </Link>
              <a href="#connect" className="inline-flex items-center justify-center gap-2 border border-white/25 px-6 py-4 text-sm font-bold transition-colors hover:border-white hover:bg-white hover:text-black">
                Connect an agent <ChevronRight size={17} />
              </a>
            </motion.div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold uppercase tracking-wider text-white">
              <span className="flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-400" /> No plaintext secrets</span>
              <span className="flex items-center gap-2"><Database size={15} className="text-indigo-400" /> Local-first</span>
              <span className="flex items-center gap-2"><KeyRound size={15} className="text-amber-400" /> Open source</span>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="border border-white/20 bg-[#161412] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-4 font-mono text-[11px] uppercase tracking-widest text-white">
              <span>kylrix / local bridge</span>
              <span className="flex items-center gap-2 text-emerald-400"><span className="h-2 w-2 bg-emerald-400" /> ready</span>
            </div>
            <div className="space-y-3 font-mono text-xs text-white">
              <p><span className="text-indigo-400">01</span> &nbsp; vault encrypted locally</p>
              <p><span className="text-indigo-400">02</span> &nbsp; workspace memory indexed</p>
              <p><span className="text-indigo-400">03</span> &nbsp; agent permissions verified</p>
              <div className="mt-5 border-t border-white/15 pt-5">
                <p className="mb-2 text-white">Start in one command</p>
                <Command onCopy={() => copy('npm i -g @kylrix/cli', setCopiedCli)} copied={copiedCli}>npm i -g @kylrix/cli</Command>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="why" className="relative z-10 border-y border-white/15 bg-[#161412]">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">The Kylrix difference</p>
              <h2 className="max-w-2xl font-clash text-4xl font-bold leading-tight sm:text-6xl">Work with AI without handing over the keys.</h2>
            </div>
            <p className="max-w-sm text-sm font-medium leading-6 text-white">A durable layer between your work, your infrastructure, and the tools that help you move faster.</p>
          </div>
          <div className="grid gap-px border border-white/15 bg-white/15 md:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="bg-black p-7 sm:p-9">
                  <Icon size={22} style={{ color: feature.accent }} />
                  <p className="mt-10 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: feature.accent }}>{feature.eyebrow}</p>
                  <h3 className="mt-3 font-clash text-2xl font-bold">{feature.title}</h3>
                  <p className="mt-4 max-w-md text-sm font-medium leading-6 text-white">{feature.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="connect" className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-amber-400">Bring your own setup</p>
            <h2 className="font-clash text-4xl font-bold leading-tight sm:text-6xl">Start small.<br />Own the whole stack.</h2>
            <p className="mt-6 max-w-md text-sm font-medium leading-6 text-white">Run the CLI locally, connect an MCP client, or put the full workspace on your own VPS. Kylrix stays useful wherever you run it.</p>
          </div>
          <div className="space-y-4">
            <div className="border border-white/20 bg-[#161412] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-clash text-lg font-bold">CLI + MCP</span>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Recommended</span>
              </div>
              <Command onCopy={() => copy('kylrix mcp', setCopiedCli)} copied={copiedCli}>kylrix mcp</Command>
              <p className="mt-3 text-xs font-medium text-white">Connect Claude Code, Cursor, and local tools to your private workspace.</p>
            </div>
            <div className="border border-white/20 bg-[#161412] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-clash text-lg font-bold">Self-host with Docker</span>
                <span className="text-xs font-bold uppercase tracking-widest text-white">Your server</span>
              </div>
              <Command onCopy={() => copy('docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest', setCopiedDocker)} copied={copiedDocker}>docker run -d -p 5003:3000 --name kylrix ghcr.io/kylrix/kylrix:latest</Command>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/15 bg-indigo-500 px-5 py-20 text-black sm:px-8 lg:px-12 lg:py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em]">The next session starts here</p>
            <h2 className="max-w-3xl font-clash text-4xl font-bold leading-tight sm:text-6xl">Your work deserves a home that lasts.</h2>
          </div>
          <Link href="/app" className="inline-flex shrink-0 items-center gap-2 border border-black px-6 py-4 text-sm font-bold transition-colors hover:bg-black hover:text-white">Get started free <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col justify-between gap-5 px-5 py-8 text-xs font-bold text-white sm:flex-row sm:items-center sm:px-8 lg:px-12">
        <div className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center bg-indigo-500 font-clash text-xs text-white">K</span><span>KYLRIX © {new Date().getFullYear()}</span></div>
        <div className="flex flex-wrap gap-5">
          <a href="#why" className="hover:text-indigo-300">Why Kylrix</a>
          <a href="#connect" className="hover:text-indigo-300">Connect</a>
          <a href="https://github.com/Kylrix/kylrix" target="_blank" rel="noreferrer" className="hover:text-indigo-300">GitHub</a>
          <Link href="/login" className="hover:text-indigo-300">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}
