'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Target,
  Lock,
  Bot,
  ShieldCheck,
  ChevronRight,
  Copy,
  Check,
  Zap,
  Sparkles,
  ArrowRight,
  Terminal,
  Layers,
  Database,
  KeyRound,
  CheckCircle2,
  Workflow,
  Globe,
  Sliders,
  Send,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { ThreadNoteClaimer } from '@/components/landing/ThreadNoteClaimer';

const FEATURE_TABS = [
  {
    id: 'vault',
    label: 'Encrypted Vault',
    icon: Lock,
    title: 'Zero-knowledge encryption for your sensitive secrets',
    desc: 'Passwords, passkeys, recovery phrases, and API credentials encrypted client-side with Argon2id and AES-GCM before ever leaving your device.',
    badge: 'Hardware & Masterpass Protected',
  },
  {
    id: 'notes',
    label: 'Private Notes',
    icon: FileText,
    title: 'Fast markdown notes with offline-first synchronization',
    desc: 'Capture ideas, write documentation, and link concepts with tags and unified threads. Instant local caching with seamless cloud replication.',
    badge: 'Offline & Realtime Sync',
  },
  {
    id: 'goals',
    label: 'Goals & Tasks',
    icon: Target,
    title: 'Track milestones and projects with clarity',
    desc: 'Organize high-impact initiatives, assign priority states, and link tasks directly to notes and automated agent sessions.',
    badge: 'Workspace Isolated',
  },
  {
    id: 'ai',
    label: 'Autonomous AI',
    icon: Bot,
    title: 'Native Model Context Protocol (MCP) tool server',
    desc: 'Empower Claude Code, Cursor, and autonomous agents to safely read, query, and organize your workspace via open protocols.',
    badge: 'MCP 1.0 Compatible',
  },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      let target = '/app';
      if (typeof document !== 'undefined') {
        const match = document.cookie.match(/(?:^|; )kylrix_last_route=([^;]*)/);
        if (match && match[1]) {
          try {
            const decoded = decodeURIComponent(match[1]);
            if (
              decoded &&
              decoded !== '/' &&
              decoded !== '/landing' &&
              !decoded.startsWith('/login') &&
              !decoded.startsWith('/connect')
            ) {
              target = decoded;
            }
          } catch {}
        }
      }
      router.replace(target);
    }
  }, [isAuthenticated, isLoading, router]);

  const [activeTab, setActiveTab] = useState<(typeof FEATURE_TABS)[number]['id']>('vault');
  const [copiedDocker, setCopiedDocker] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);

  const copyDockerCmd = () => {
    navigator.clipboard.writeText('docker run -d -p 3000:3000 kylrix/app:latest');
    setCopiedDocker(true);
    setTimeout(() => setCopiedDocker(false), 2000);
  };

  const copyMcpCmd = () => {
    navigator.clipboard.writeText('npx @kylrix/mcp-server');
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0A0908] text-[#F5F2ED] selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden font-sans">
      <ThreadNoteClaimer />

      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute top-[40%] right-[-10%] w-[600px] h-[400px] bg-amber-500/5 blur-[140px] rounded-full" />
      </div>

      {/* Navigation Header */}
      <header className="relative z-20 border-b border-white/[0.06] bg-[#0A0908]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              K
            </div>
            <span className="font-extrabold text-lg tracking-tight text-white font-clash">
              Kylrix
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-white/60">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#vault" className="hover:text-white transition-colors">
              Security
            </a>
            <a href="#mcp" className="hover:text-white transition-colors">
              AI Tools
            </a>
            <a href="#selfhost" className="hover:text-white transition-colors">
              Self-Host
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white/80 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25 transition-all flex items-center gap-1.5"
            >
              <span>Open App</span>
              <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-20 pb-16 sm:pt-28 sm:pb-24 px-4 sm:px-6 max-w-5xl mx-auto text-center">
        {/* Release / Status Pill */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-semibold text-white/70 mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Sovereign Workspace & AI Integration</span>
          <span className="text-white/30">·</span>
          <span className="text-indigo-400">v2.4 Active</span>
        </motion.div>

        {/* Hero Title */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight font-clash leading-[1.08] text-white"
        >
          Your sovereign workspace. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-indigo-100 to-amber-200">
            Zero compromises.
          </span>
        </motion.h1>

        {/* Hero Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-base sm:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed"
        >
          Private notes, hardware-grade encrypted credentials, and autonomous AI agents in one
          seamless environment. Works entirely offline, self-hostable anywhere.
        </motion.p>

        {/* Action CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3.5"
        >
          <Link
            href="/app"
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all group"
          >
            <span>Launch Workspace</span>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <button
            onClick={copyDockerCmd}
            className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white/80 hover:text-white font-semibold text-sm flex items-center justify-center gap-2.5 transition-all font-mono"
          >
            <Terminal size={15} className="text-indigo-400" />
            <span>docker run kylrix</span>
            {copiedDocker ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white/40" />}
          </button>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-white/40 font-medium"
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Zero-Knowledge Vault</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Database size={14} className="text-indigo-400" />
            <span>Local-First SQLite</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bot size={14} className="text-amber-400" />
            <span>Model Context Protocol</span>
          </div>
        </motion.div>
      </section>

      {/* Interactive Feature Showcase */}
      <section id="features" className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md">
            {FEATURE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Showcase Card */}
        <AnimatePresence mode="wait">
          {FEATURE_TABS.filter((t) => t.id === activeTab).map((tab) => {
            const Icon = tab.icon;
            return (
              <motion.div
                key={tab.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
                className="rounded-3xl bg-[#12100E] border border-white/[0.08] p-6 sm:p-10 shadow-2xl relative overflow-hidden"
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Left Column: Details */}
                  <div className="lg:col-span-5 space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold">
                      <Icon size={13} />
                      <span>{tab.badge}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-clash">
                      {tab.title}
                    </h2>
                    <p className="text-sm text-white/65 leading-relaxed">{tab.desc}</p>

                    <div className="pt-4 flex items-center gap-3">
                      <Link
                        href="/app"
                        className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <span>Explore {tab.label}</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>

                  {/* Right Column: Visual Mockup */}
                  <div className="lg:col-span-7 rounded-2xl bg-[#0A0908] border border-white/[0.08] p-5 font-mono text-xs space-y-3.5 shadow-inner">
                    {tab.id === 'vault' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                          <div className="flex items-center gap-2 text-white font-bold font-sans">
                            <Lock size={15} className="text-emerald-400" />
                            <span>Hardware Keychain · Argon2id T5</span>
                          </div>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-sans font-bold">
                            Active in memory
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <div className="text-[11px] text-white/50">Primary MEK Key</div>
                            <div className="text-white font-bold mt-1 truncate">aes-gcm-256 (derived)</div>
                          </div>
                          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                            <div className="text-[11px] text-white/50">KDF Derivation</div>
                            <div className="text-white font-bold mt-1">64MB memory · 3 passes</div>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15 flex items-center justify-between text-indigo-300">
                          <div className="flex items-center gap-2">
                            <KeyRound size={15} />
                            <span>Zero plaintext exposure to server or cloud</span>
                          </div>
                          <CheckCircle2 size={15} className="text-emerald-400" />
                        </div>
                      </div>
                    )}

                    {tab.id === 'notes' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                          <span className="text-white font-bold font-sans">Architecture Roadmap.md</span>
                          <span className="text-[10px] text-white/40">Synced just now</span>
                        </div>
                        <div className="space-y-2 text-white/80 font-sans leading-relaxed text-xs">
                          <p className="font-bold text-white text-sm"># Sovereign Stack Vision</p>
                          <p className="text-white/60">
                            - Local-first IndexedDB cache with instant hydration
                            <br />
                            - End-to-end cryptographic integrity across workspaces
                            <br />- Automatic note linking via tags & unified thread messages
                          </p>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] text-white/60">
                            #architecture
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] text-white/60">
                            #v2-release
                          </span>
                        </div>
                      </div>
                    )}

                    {tab.id === 'goals' && (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                          <span className="text-white font-bold font-sans">Active Workspace Goals</span>
                          <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full font-sans font-bold">
                            3 in progress
                          </span>
                        </div>
                        {[
                          { title: 'Deploy Turso SQLite substrate', status: 'Completed', color: 'emerald' },
                          { title: 'Publish Model Context Protocol server', status: 'In Review', color: 'indigo' },
                          { title: 'Verify offline-first sync engine', status: 'In Progress', color: 'amber' },
                        ].map((g, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between"
                          >
                            <span className="text-white/80 font-sans">{g.title}</span>
                            <span
                              className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded ${
                                g.color === 'emerald'
                                  ? 'text-emerald-400 bg-emerald-500/10'
                                  : g.color === 'indigo'
                                  ? 'text-indigo-400 bg-indigo-500/10'
                                  : 'text-amber-400 bg-amber-500/10'
                              }`}
                            >
                              {g.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {tab.id === 'ai' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                          <div className="flex items-center gap-2 text-white font-bold font-sans">
                            <Bot size={15} className="text-indigo-400" />
                            <span>MCP Streamable HTTP Session</span>
                          </div>
                          <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-sans font-bold">
                            Connected
                          </span>
                        </div>
                        <div className="p-3 rounded-xl bg-white/[0.03] text-white/70 space-y-1.5 font-mono text-[11px]">
                          <div className="text-indigo-300">
                            → call_tool: kylrix.list_notes(filter: &quot;architecture&quot;)
                          </div>
                          <div className="text-emerald-400">
                            ✓ returned 4 notes with zero client secret leaks
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </section>

      {/* 4 Pillars Bento Grid */}
      <section className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-clash">
            Engineered for decade-scale longevity
          </h2>
          <p className="mt-3 text-sm text-white/60">
            No vendor lock-in. No closed cloud silos. Built to survive independently on bare metal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-6 rounded-2xl bg-[#12100E] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Lock size={18} />
            </div>
            <h3 className="font-bold text-white text-base font-clash">Zero-Knowledge</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Your encryption keys are derived on your hardware and never leave your memory unencrypted.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#12100E] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database size={18} />
            </div>
            <h3 className="font-bold text-white text-base font-clash">Local-First Sync</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Read and write immediately with zero network latency. Reconciles seamlessly when online.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#12100E] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Bot size={18} />
            </div>
            <h3 className="font-bold text-white text-base font-clash">Native MCP AI</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Hook into Claude Code, Cursor, and custom agentic runtimes with fine-grained developer scopes.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#12100E] border border-white/[0.07] hover:border-white/[0.15] transition-all space-y-3">
            <div className="w-10 h-10 rounded-xl bg-pink-600/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Terminal size={18} />
            </div>
            <h3 className="font-bold text-white text-base font-clash">1-Command Host</h3>
            <p className="text-xs text-white/60 leading-relaxed">
              Spin up your private sovereign node with Docker Compose in under 30 seconds on any VPS.
            </p>
          </div>
        </div>
      </section>

      {/* Developer Strip: CLI & MCP */}
      <section id="mcp" className="relative z-10 py-16 px-4 sm:px-6 max-w-5xl mx-auto">
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-[#161412] to-[#0E0D0C] border border-white/[0.08] shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-bold">
                <Sparkles size={12} />
                <span>Developer Ready</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white font-clash">
                Connect AI coding assistants in seconds
              </h3>
              <p className="text-xs text-white/60 max-w-md">
                Query notes, workspaces, and tasks directly inside Claude Code or Cursor.
              </p>
            </div>

            <div className="w-full md:w-auto">
              <button
                onClick={copyMcpCmd}
                className="w-full px-5 py-3.5 rounded-xl bg-[#0A0908] hover:bg-black border border-white/[0.12] text-xs font-mono text-indigo-300 flex items-center justify-between gap-4 transition-all"
              >
                <span>npx @kylrix/mcp-server</span>
                {copiedMcp ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-white/40" />}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* High-Impact CTA Banner */}
      <section className="relative z-10 py-20 px-4 sm:px-6 max-w-4xl mx-auto text-center">
        <div className="p-10 sm:p-14 rounded-3xl bg-gradient-to-tr from-indigo-900/30 via-[#161412] to-amber-900/20 border border-indigo-500/20 shadow-2xl relative overflow-hidden">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-clash">
            Take full ownership of your data today.
          </h2>
          <p className="mt-4 text-sm sm:text-base text-white/65 max-w-xl mx-auto leading-relaxed">
            Free forever for personal workspaces. Zero telemetry on your decrypted notes and credentials.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/app"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white text-black font-extrabold text-sm hover:bg-white/90 transition-all shadow-xl shadow-white/10"
            >
              Get Started for Free
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-sm border border-white/[0.1] transition-all"
            >
              Existing Account
            </Link>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] py-10 px-4 sm:px-6 max-w-6xl mx-auto text-xs text-white/40 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-600 flex items-center justify-center text-white font-black text-[10px]">
            K
          </div>
          <span className="font-bold text-white/70">Kylrix</span>
          <span>© {new Date().getFullYear()}</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a href="#vault" className="hover:text-white transition-colors">
            Security
          </a>
          <Link href="/login" className="hover:text-white transition-colors">
            Sign In
          </Link>
          <a
            href="https://github.com/Kylrix/kylrix"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
