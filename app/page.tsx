'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  Target,
  Lock,
  Bot,
  Zap,
  Radio,
  Share2,
  Terminal,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  Database,
  Key,
  Globe,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { ThreadNoteClaimer } from '@/components/landing/ThreadNoteClaimer';

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { openAgenticDrawer } = useAgenticDrawer();
  const [activeTab, setActiveTab] = useState<'notes' | 'goals' | 'vault' | 'agents'>('notes');

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      router.push('/app');
    } else {
      openUnified('login');
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#6366F1]/30 selection:text-white font-sans overflow-x-hidden">
      {/* Background Thread Note Claimer */}
      <ThreadNoteClaimer />

      {/* Subtle Spatial Mesh Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#6366F1]/15 via-[#EC4899]/10 to-transparent blur-[120px]" />
        <div className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full bg-[#10B981]/10 blur-[140px]" />
        <div className="absolute top-[1600px] -right-40 h-[600px] w-[600px] rounded-full bg-[#A855F7]/10 blur-[140px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION: Immediate High-Impact Realism (No Dead Space)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 pb-16 lg:pb-24">
        {/* Top Badges & Pill */}
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#161412] border border-white/20 shadow-xl mb-5"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[11px] font-mono tracking-wider uppercase text-white font-bold">
              Open Source Ecosystem · OpenBricks 4.0
            </span>
            <span className="text-white/40">·</span>
            <span className="text-[11px] font-mono text-[#818CF8] font-bold">Offline-First</span>
          </motion.div>

          {/* Punchy Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="font-clash text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl leading-[1.08]"
          >
            The living productivity suite for humans and smart agents.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-4 sm:mt-6 text-base sm:text-xl text-white max-w-2xl font-normal leading-relaxed opacity-90"
          >
            Private notes, live goals, an encrypted vault, and autonomous background agents—unified into a zero-compromise, local-first system that never locks your thinking behind a silo.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-7 sm:mt-8 flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-[#6366F1] text-white font-bold text-sm sm:text-base border border-[#818CF8]/50 shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:bg-[#5254E8] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Enter Workspace' : 'Launch Kylrix Free'}</span>
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => openAgenticDrawer({ prompt: 'Explore system capabilities and workspace status' })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#161412] text-white font-bold text-sm sm:text-base border border-white/20 hover:border-[#EC4899]/60 hover:bg-[#1C1A18] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Bot size={18} className="text-[#EC4899]" />
              <span>Ask System Agent</span>
            </button>

            <a
              href="https://github.com/Kylrix/kylrix"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#161412] text-white font-bold text-sm sm:text-base border border-white/20 hover:border-white/50 hover:bg-[#1C1A18] transition-all"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. ULTRA-REALISTIC 3D CHASSIS: Desktop & Mobile Device Views
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-12 sm:mt-16 relative"
        >
          {/* Subtle Ambient Depth Glow underneath device */}
          <div className="absolute -inset-2 bg-gradient-to-r from-[#6366F1]/20 via-[#EC4899]/15 to-[#10B981]/20 rounded-[38px] blur-2xl opacity-60" />

          {/* 3D Slanted Bevel Desktop Chassis */}
          <div
            className="relative rounded-[32px] sm:rounded-[36px] bg-[#000000] p-2.5 sm:p-4 border-2 border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.1)] transition-transform duration-500 hover:border-white/40"
            style={{
              perspective: '1200px',
              transform: 'rotateX(1.5deg)',
            }}
          >
            {/* Realistic Hardware Bezel Top Bar with Camera & Window Controls */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 rounded-t-[24px] bg-[#161412] border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444] border border-[#DC2626]/60 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                <span className="w-3 h-3 rounded-full bg-[#F59E0B] border border-[#D97706]/60 shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                <span className="w-3 h-3 rounded-full bg-[#10B981] border border-[#059669]/60 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
              </div>

              {/* Center Screen URL Pill */}
              <div className="hidden sm:flex items-center gap-2 px-4 py-1 rounded-xl bg-[#000000] border border-white/10 text-[11px] font-mono text-white">
                <Lock size={11} className="text-[#10B981]" />
                <span className="font-bold">kylrix.space</span>
                <span className="text-white/40">/</span>
                <span className="text-[#818CF8]">workspace</span>
              </div>

              {/* Hardware Camera Dot */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#201D1A] border border-white/20" />
                <span className="text-[10px] font-mono text-white/50 uppercase font-bold tracking-wider hidden md:inline">
                  P2P Active
                </span>
              </div>
            </div>

            {/* Screen Inner Display: Realistic Canonical App UI */}
            <div className="relative rounded-b-[24px] bg-[#000000] p-3 sm:p-6 overflow-hidden min-h-[380px] sm:min-h-[460px]">
              {/* App Interactive Tabs Switcher */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b border-white/10 mb-5 scrollbar-none">
                {[
                  { id: 'notes', label: 'Ideas & Notes', icon: FileText, color: '#EC4899' },
                  { id: 'goals', label: 'Goals & Tasks', icon: Target, color: '#A855F7' },
                  { id: 'vault', label: 'Encrypted Vault', icon: Lock, color: '#10B981' },
                  { id: 'agents', label: 'Autonomous Agents', icon: Bot, color: '#6366F1' },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
                        isActive
                          ? 'bg-[#161412] text-white border-2'
                          : 'bg-transparent text-white/80 border border-white/10 hover:border-white/30 hover:text-white'
                      }`}
                      style={{ borderColor: isActive ? tab.color : undefined }}
                    >
                      <Icon size={15} style={{ color: tab.color }} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Active Tab Screen Render */}
              {activeTab === 'notes' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3 hover:border-[#EC4899]/60 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#EC4899]/15 text-[#EC4899] border border-[#EC4899]/30">
                          Markdown · Living Note
                        </span>
                        <span className="text-[10px] font-mono text-white/50">Updated 2m ago</span>
                      </div>
                      <h4 className="font-clash font-bold text-sm text-white">System Architecture & Offline Sync</h4>
                      <p className="mt-1 text-xs text-white leading-relaxed opacity-85">
                        RxDB client substrate synchronizes immediately to IndexedDB. Network calls are opportunistic and never block typing.
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#EC4899] pt-2 border-t border-white/10">
                      <span>source:kylrixnote:arch</span>
                      <ArrowUpRight size={13} />
                    </div>
                  </div>

                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3 hover:border-[#EC4899]/60 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#6366F1]/15 text-[#818CF8] border border-[#6366F1]/30">
                          E2EE · Encrypted
                        </span>
                        <span className="text-[10px] font-mono text-white/50">Zero-Knowledge</span>
                      </div>
                      <h4 className="font-clash font-bold text-sm text-white">Cryptographic Key Derivation</h4>
                      <p className="mt-1 text-xs text-white leading-relaxed opacity-85">
                        Argon2id + AES-GCM-256 client side derivation. Servers only ever store encrypted ciphertext blobs.
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#818CF8] pt-2 border-t border-white/10">
                      <span>mek:sealed</span>
                      <ArrowUpRight size={13} />
                    </div>
                  </div>

                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3 hover:border-[#EC4899]/60 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                          Public · Shared
                        </span>
                        <span className="text-[10px] font-mono text-white/50">Instant Share</span>
                      </div>
                      <h4 className="font-clash font-bold text-sm text-white">Q3 Ecosystem Roadmap & Deliverables</h4>
                      <p className="mt-1 text-xs text-white leading-relaxed opacity-85">
                        Native WebMCP tool providers, headless agents runtime, Nostr identity handshake, and BlockBee self-hosted billing.
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#10B981] pt-2 border-t border-white/10">
                      <span>/idea/roadmap-q3</span>
                      <ArrowUpRight size={13} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'goals' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-[#A855F7]/20 border border-[#A855F7] flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={15} className="text-[#A855F7]" />
                      </div>
                      <div>
                        <h4 className="font-clash font-bold text-sm text-white">Finalize WebMCP Tool Registration Contract</h4>
                        <p className="text-xs text-white mt-0.5 opacity-85">Expose workspace note creation and search tools to Cursor & Claude Code.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#A855F7] pt-2 border-t border-white/10">
                      <span>Priority · High</span>
                      <span>Done</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-lg bg-white/10 border border-white/30 flex items-center justify-center shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-clash font-bold text-sm text-white">Deploy Caddy Reverse-Proxy for Self-Host Stack</h4>
                        <p className="text-xs text-white mt-0.5 opacity-85">Automated Let&apos;s Encrypt TLS certificate generation for standalone Docker boxes.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-white/60 pt-2 border-t border-white/10">
                      <span>Priority · Medium</span>
                      <span>In Progress</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'vault' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Credential</span>
                      <h4 className="font-clash font-bold text-sm text-white mt-1">Production Database Cluster</h4>
                      <p className="text-xs text-white/60 font-mono mt-1">postgres://admin:••••••••@cluster.local</p>
                    </div>
                    <span className="text-[11px] font-mono text-[#10B981] pt-2 border-t border-white/10">AES-GCM-256</span>
                  </div>

                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">TOTP Authenticator</span>
                      <h4 className="font-clash font-bold text-sm text-white mt-1">Cloud Infrastructure 2FA</h4>
                      <p className="text-lg text-white font-mono font-black tracking-widest mt-1">842 190</p>
                    </div>
                    <span className="text-[11px] font-mono text-white/50 pt-2 border-t border-white/10">Expires in 18s</span>
                  </div>

                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Private Key</span>
                      <h4 className="font-clash font-bold text-sm text-white mt-1">Nostr Identity (nsec)</h4>
                      <p className="text-xs text-white/60 font-mono mt-1">nsec1••••••••••••••••</p>
                    </div>
                    <span className="text-[11px] font-mono text-[#10B981] pt-2 border-t border-white/10">Zero-Trust Protected</span>
                  </div>
                </div>
              )}

              {activeTab === 'agents' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/20">
                        <Terminal size={18} />
                      </div>
                      <div>
                        <h4 className="font-clash font-bold text-sm text-white">Repo Sync & Document Parser</h4>
                        <p className="text-xs text-white/60">Autonomous indexing of codebase markdown contracts.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#818CF8] pt-2 border-t border-white/10">
                      <span>Status: Idle</span>
                      <span>Next Run: On Commit</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-[22px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#EC4899]/10 text-[#EC4899] flex items-center justify-center border border-[#EC4899]/20">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="font-clash font-bold text-sm text-white">Daily Standup & Goal Distiller</h4>
                        <p className="text-xs text-white/60">Summarizes completed team tasks into retrospective notes.</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-[#EC4899] pt-2 border-t border-white/10">
                      <span>Status: Active</span>
                      <span>Cron: 09:00 UTC</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. CORE ARCHITECTURAL PILLARS (OpenBricks 4.0 Standard)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/10">
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-20">
          <span className="text-xs font-mono font-bold uppercase text-[#818CF8] tracking-widest">
            First-Principles Architecture
          </span>
          <h2 className="mt-3 font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Built for total autonomy, longevity, and speed.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white opacity-85">
            Every feature in Kylrix is designed to survive decades on bare metal without corporate lock-in or subscription bloat.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-[26px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-5 hover:border-white/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#EC4899]/10 text-[#EC4899] flex items-center justify-center border border-[#EC4899]/30">
              <FileText size={22} />
            </div>
            <div>
              <h3 className="font-clash text-xl font-bold text-white">Fluid Knowledge & Ideas</h3>
              <p className="mt-2 text-sm text-white leading-relaxed opacity-85">
                Markdown-native notes with crosslink tagging, file attachments, and instant public publishing. No proprietary rich-text blocks.
              </p>
            </div>
            <div className="text-xs font-mono text-[#EC4899] font-bold flex items-center justify-between border-t border-white/10 pt-3">
              <span>Plaintext Sovereignty</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-[26px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-5 hover:border-white/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#10B981]/10 text-[#10B981] flex items-center justify-center border border-[#10B981]/30">
              <Lock size={22} />
            </div>
            <div>
              <h3 className="font-clash text-xl font-bold text-white">Zero-Knowledge Vault</h3>
              <p className="mt-2 text-sm text-white leading-relaxed opacity-85">
                Client-side encrypted credentials, TOTP authenticators, and confidential records. Servers never see your master passphrase.
              </p>
            </div>
            <div className="text-xs font-mono text-[#10B981] font-bold flex items-center justify-between border-t border-white/10 pt-3">
              <span>Client-Side MEK Encryption</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-[26px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-5 hover:border-white/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/10 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/30">
              <Bot size={22} />
            </div>
            <div>
              <h3 className="font-clash text-xl font-bold text-white">Autonomous Agent Runtime</h3>
              <p className="mt-2 text-sm text-white leading-relaxed opacity-85">
                Agents operate strictly within concrete workspaces authenticated via Zero-Trust Provisioning Keys, executing tools without human babysitting.
              </p>
            </div>
            <div className="text-xs font-mono text-[#818CF8] font-bold flex items-center justify-between border-t border-white/10 pt-3">
              <span>WebMCP & HTTP /api/v1</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-[26px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-5 hover:border-white/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#A855F7]/10 text-[#A855F7] flex items-center justify-center border border-[#A855F7]/30">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="font-clash text-xl font-bold text-white">Realtime Offline Sync</h3>
              <p className="mt-2 text-sm text-white leading-relaxed opacity-85">
                IndexedDB-backed local engine ensures instant UI updates without network spin. Mutations queue locally and replenish transparently.
              </p>
            </div>
            <div className="text-xs font-mono text-[#A855F7] font-bold flex items-center justify-between border-t border-white/10 pt-3">
              <span>Zero-Lag Interaction</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-[26px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-5 hover:border-white/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center border border-[#F59E0B]/30">
              <Globe size={22} />
            </div>
            <div>
              <h3 className="font-clash text-xl font-bold text-white">Universal Self-Hosting</h3>
              <p className="mt-2 text-sm text-white leading-relaxed opacity-85">
                One-command Docker Compose stack. Cloud is just a specialized self-host: run everything on your own VPS or Raspberry Pi.
              </p>
            </div>
            <div className="text-xs font-mono text-[#F59E0B] font-bold flex items-center justify-between border-t border-white/10 pt-3">
              <span>True Data Sovereignty</span>
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-[26px] bg-[#000000] border border-white/20 shadow-xl flex flex-col justify-between gap-5 hover:border-white/50 transition-all">
            <div className="w-12 h-12 rounded-2xl bg-[#34D399]/10 text-[#34D399] flex items-center justify-center border border-[#34D399]/30">
              <Radio size={22} />
            </div>
            <div>
              <h3 className="font-clash text-xl font-bold text-white">P2P Calls & Hangouts</h3>
              <p className="mt-2 text-sm text-white leading-relaxed opacity-85">
                Encrypted WebRTC peer-to-peer voice, video, and discussions directly inside workspaces without tracking intermediaries.
              </p>
            </div>
            <div className="text-xs font-mono text-[#34D399] font-bold flex items-center justify-between border-t border-white/10 pt-3">
              <span>Decentralized Comms</span>
              <ChevronRight size={14} />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. INTERACTION SHOWCASE: Mobile + Desktop Realism
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 items-center">
          <div>
            <span className="text-xs font-mono font-bold uppercase text-[#EC4899] tracking-widest">
              Tactile OpenBricks 4.0 Pattern
            </span>
            <h2 className="mt-3 font-clash text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Crafted for thumbs on mobile, keyboards on desktop.
            </h2>
            <p className="mt-5 text-base sm:text-lg text-white opacity-85 leading-relaxed">
              No nested modal mazes. No laggy popups. Clean fixed-height action drawers on mobile, tactile sidebar rails on desktop, and instant keyboard shortcuts for power users.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#161412] border border-white/15">
                <div className="p-2 rounded-xl bg-[#6366F1]/15 text-[#818CF8] shrink-0">
                  <Terminal size={18} />
                </div>
                <div>
                  <h4 className="font-clash font-bold text-sm text-white">Global Keyboard Command Engine</h4>
                  <p className="text-xs text-white/70 mt-0.5">Press <kbd className="px-1.5 py-0.5 rounded bg-black border border-white/20 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-black border border-white/20 font-mono text-[10px]">F</kbd> for instant omni-search, <kbd className="px-1.5 py-0.5 rounded bg-black border border-white/20 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-black border border-white/20 font-mono text-[10px]">K</kbd> to prompt Kylie.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#161412] border border-white/15">
                <div className="p-2 rounded-xl bg-[#10B981]/15 text-[#10B981] shrink-0">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <h4 className="font-clash font-bold text-sm text-white">Zero-Support Passkey Security</h4>
                  <p className="text-xs text-white/70 mt-0.5">WebAuthn passkeys eliminate password reset vulnerabilities entirely.</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Realistic Mobile Frame Shot */}
          <div className="flex justify-center">
            <div
              className="relative w-full max-w-[320px] rounded-[48px] bg-[#000000] p-3 border-[6px] border-[#25221F] shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_0_2px_rgba(255,255,255,0.15)]"
              style={{
                transform: 'rotateZ(-2deg) rotateY(4deg)',
              }}
            >
              {/* Dynamic Island / Speaker Pill */}
              <div className="w-28 h-4 rounded-full bg-[#161412] mx-auto mb-3 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-[#000000] border border-white/20" />
              </div>

              {/* Mobile Screen Surface */}
              <div className="space-y-3 p-2 rounded-[36px] bg-[#000000] min-h-[460px]">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <span className="font-clash font-bold text-xs text-white">KYLRIX</span>
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                </div>

                <div className="p-3.5 rounded-[20px] bg-[#161412] border border-white/15">
                  <span className="text-[9px] font-mono text-[#EC4899] font-bold uppercase">Active Idea</span>
                  <h5 className="font-clash font-bold text-xs text-white mt-1">Nostr Relays & Sync</h5>
                  <p className="text-[10px] text-white/70 mt-1">Direct relay handshake for peer updates.</p>
                </div>

                <div className="p-3.5 rounded-[20px] bg-[#161412] border border-white/15">
                  <span className="text-[9px] font-mono text-[#10B981] font-bold uppercase">Vault TOTP</span>
                  <h5 className="font-clash font-bold text-xs text-white mt-1">Bitwarden Vault Sync</h5>
                  <p className="text-base font-mono font-bold text-[#10B981] mt-1">492 018</p>
                </div>

                <div className="p-3.5 rounded-[20px] bg-[#161412] border border-white/15">
                  <span className="text-[9px] font-mono text-[#A855F7] font-bold uppercase">Pending Goal</span>
                  <h5 className="font-clash font-bold text-xs text-white mt-1">Deploy Caddy Server</h5>
                  <div className="w-full bg-white/10 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-[#A855F7] w-3/4 h-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. BOTTOM ACTION CALLOUT
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="p-8 sm:p-14 rounded-[36px] bg-[#000000] border-2 border-white/20 shadow-[0_20px_80px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
              Start thinking and building right now.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-white max-w-xl mx-auto opacity-85">
              Zero credit cards required. Offline-first from your very first keystroke.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="px-8 py-4 rounded-2xl bg-[#6366F1] text-white font-bold text-base border border-[#818CF8]/50 shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:bg-[#5254E8] hover:scale-105 transition-all cursor-pointer"
              >
                {isAuthenticated ? 'Open Your Workspace' : 'Get Started Free'}
              </button>

              <Link
                href="/docs"
                className="px-7 py-4 rounded-2xl bg-[#161412] text-white font-bold text-base border border-white/20 hover:border-white/50 hover:bg-[#1C1A18] transition-all"
              >
                Documentation & Guides
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 px-4 text-center text-xs font-mono text-white/50">
        <p>© {new Date().getFullYear()} Kylrix Organization. Open Source Productivity Ecosystem.</p>
      </footer>
    </div>
  );
}
