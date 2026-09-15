'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  Target,
  Lock,
  Bot,
  MessageSquare,
  Zap,
  ShieldCheck,
  ChevronRight,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  RotateCw,
  Send,
  Pin,
  Tag,
  Paperclip,
  Server,
  Globe,
  Settings,
  Search,
  Bell,
  Heart,
  Calendar,
  Layers,
  Share2,
  MoreVertical,
  CheckSquare,
  Plus,
  FileSpreadsheet,
  GitFork,
  Cpu,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { ThreadNoteClaimer } from '@/components/landing/ThreadNoteClaimer';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { openAgenticDrawer } = useAgenticDrawer();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/app');
    }
  }, [isAuthenticated, isLoading, router]);

  // Copy states
  const [copiedSelfHost, setCopiedSelfHost] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);

  // Active tab in mockups
  const [activeTab, setActiveTab] = useState<'ideas' | 'forms' | 'workflows'>('ideas');

  // Smart Assistant Session Simulation in 1:1 Mockups
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentInput, setAgentInput] = useState('');
  const [agentMessages, setAgentMessages] = useState<
    Array<{
      id: string;
      role: 'user' | 'assistant';
      content: string;
      tools?: Array<{ toolKey: string; status: string; resultSummary: string }>;
      nextSteps?: string[];
    }>
  >([
    {
      id: 'm1',
      role: 'user',
      content: 'Scan my workspace, generate project milestone summary & encrypt backup vault',
    },
    {
      id: 'm2',
      role: 'assistant',
      content:
        'Analyzed 14 workspace notes and 4 active goals. Generated project summary "#Q3-Milestones" and encrypted backup key in Vault.',
      tools: [
        {
          toolKey: 'workspace_summarizer',
          status: 'success',
          resultSummary: 'Scanned 14 items • Saved & encrypted',
        },
      ],
      nextSteps: ['Open #Q3-Milestones', 'Share summary with team'],
    },
  ]);

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      router.push('/app');
    } else {
      openUnified('login');
    }
  };

  const handleCopyText = (text: string, type: 'selfhost' | 'mcp') => {
    navigator.clipboard.writeText(text);
    if (type === 'selfhost') {
      setCopiedSelfHost(true);
      setTimeout(() => setCopiedSelfHost(false), 2000);
    } else if (type === 'mcp') {
      setCopiedMcp(true);
      setTimeout(() => setCopiedMcp(false), 2000);
    }
  };

  const runSimulatedAgentTask = (promptText?: string) => {
    const textToSend = promptText || agentInput || 'Summarize workspace updates';
    if (!textToSend.trim() || agentRunning) return;

    setAgentRunning(true);
    setAgentInput('');

    setAgentMessages((prev) => [
      ...prev,
      { id: `u-${prev.length + 1}`, role: 'user' as const, content: textToSend },
    ]);

    setTimeout(() => {
      setAgentMessages((prev) => [
        ...prev,
        {
          id: `a-${prev.length + 1}`,
          role: 'assistant' as const,
          content: `Completed task: "${textToSend}". Scanned active items and applied updates.`,
          tools: [
            {
              toolKey: 'workspace_executor',
              status: 'success',
              resultSummary: 'Executed action • Updated 3 workspace records',
            },
          ],
          nextSteps: ['Review updated items', 'Export session log'],
        },
      ]);
      setAgentRunning(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#6366F1]/30 selection:text-white font-sans overflow-x-hidden relative">
      {/* Background Claimer */}
      <ThreadNoteClaimer />

      {/* Ambient Lighting */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 left-1/2 h-[650px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#6366F1]/20 via-[#EC4899]/15 to-transparent blur-[140px]" />
        <div className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full bg-[#10B981]/15 blur-[150px]" />
        <div className="absolute top-[1500px] -right-40 h-[600px] w-[600px] rounded-full bg-[#A855F7]/15 blur-[150px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-8 sm:pb-12">
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto space-y-5">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-wider text-white">
              Agentic Living Workspace
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="font-clash text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] [text-shadow:_0_2px_12px_rgba(0,0,0,0.9)]"
          >
            Build, ship and think in <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#818CF8] via-[#EC4899] to-[#10B981] bg-clip-text text-transparent">
              one living agentic workspace.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="text-base sm:text-lg text-white/90 max-w-2xl font-normal leading-relaxed drop-shadow-md"
          >
            Notes, goals, encrypted vault, direct messages, and autonomous AI tools sharing the exact same workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="pt-2 flex items-center justify-center gap-3 w-auto"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#6366F1] text-white font-bold text-sm sm:text-base border border-[#818CF8]/50 shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:bg-[#5254E8] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Open App' : 'Get Started Free'}</span>
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => openAgenticDrawer({ prompt: 'Show me around the workspace tools' })}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#161412] text-white font-bold text-sm sm:text-base border border-white/20 hover:border-[#EC4899]/60 hover:bg-[#1C1A18] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Bot size={18} className="text-[#EC4899]" />
              <span>Ask Kylie</span>
            </button>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            SUB-HERO HIGHLIGHT CARDS ROW (RESTORED & ELEGANTLY VISIBLE)
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-10 sm:mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto"
        >
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161412]/80 border border-white/20 backdrop-blur-md hover:border-[#10B981]/50 transition-all space-y-1.5 shadow-lg">
            <div className="flex items-center gap-2 text-[#10B981]">
              <ShieldCheck size={18} />
              <span className="font-clash font-bold text-xs sm:text-sm text-white">Local & Encrypted</span>
            </div>
            <p className="text-[11px] sm:text-xs text-white/70 leading-normal">
              AES-256 client vault & offline local database.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161412]/80 border border-white/20 backdrop-blur-md hover:border-[#EC4899]/50 transition-all space-y-1.5 shadow-lg">
            <div className="flex items-center gap-2 text-[#EC4899]">
              <Bot size={18} />
              <span className="font-clash font-bold text-xs sm:text-sm text-white">Kylie AI Copilot</span>
            </div>
            <p className="text-[11px] sm:text-xs text-white/70 leading-normal">
              WebMCP browser tools & autonomous task execution.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161412]/80 border border-white/20 backdrop-blur-md hover:border-[#3B82F6]/50 transition-all space-y-1.5 shadow-lg">
            <div className="flex items-center gap-2 text-[#3B82F6]">
              <MessageSquare size={18} />
              <span className="font-clash font-bold text-xs sm:text-sm text-white">P2P Messaging</span>
            </div>
            <p className="text-[11px] sm:text-xs text-white/70 leading-normal">
              Direct messages & Nostr protocol integration.
            </p>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#161412]/80 border border-white/20 backdrop-blur-md hover:border-[#A855F7]/50 transition-all space-y-1.5 shadow-lg">
            <div className="flex items-center gap-2 text-[#A855F7]">
              <Server size={18} />
              <span className="font-clash font-bold text-xs sm:text-sm text-white">1-Command Self Host</span>
            </div>
            <p className="text-[11px] sm:text-xs text-white/70 leading-normal">
              Zero cloud lock-in. AGPL-3.0 open source.
            </p>
          </div>
        </motion.div>

        {/* ─────────────────────────────────────────────────────────────
            2. REAL-TIME 1:1 SCALED MOCKUPS (DESKTOP & MOBILE RESPONSIVE)
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
          className="mt-10 sm:mt-14 relative max-w-6xl mx-auto"
        >
          {/* DESKTOP 1:1 MOCKUP FRAME (VISIBLE ON MEDIUM + LARGE SCREENS) */}
          <div className="hidden md:block relative rounded-[24px] sm:rounded-[28px] bg-[#000000] p-2 border-2 border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden">
            {/* Topbar Replica */}
            <div className="w-full bg-[#000000] border-b-2 border-white/20 px-3.5 py-2.5 rounded-t-[20px] flex items-center justify-between gap-3 text-xs font-satoshi">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-[#6366F1] flex items-center justify-center font-clash font-black text-white text-sm shadow-[0_0_12px_rgba(99,102,241,0.5)]">
                  K
                </div>
                <span className="font-clash font-black text-white text-base tracking-tight">Kylrix</span>
              </div>

              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#161412] border border-white/15 text-xs font-bold text-white/80 shadow-inner max-w-md w-full justify-start">
                <Search size={14} className="text-white/60 shrink-0" />
                <span className="truncate">Search workspace notes, vault, goals...</span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => openAgenticDrawer({ prompt: 'Show active workspace session' })}
                  className="w-8 h-8 rounded-xl bg-[#161412] border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center hover:bg-[#1C1A18] transition-colors cursor-pointer"
                  title="Kylie Assistant"
                >
                  <Bot size={16} />
                </button>
                <button
                  type="button"
                  className="w-8 h-8 rounded-xl bg-[#161412] border border-white/15 text-white/80 flex items-center justify-center"
                  title="Notifications"
                >
                  <Bell size={16} />
                </button>
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#EC4899] p-0.5 flex items-center justify-center font-bold text-xs text-white">
                  U
                </div>
              </div>
            </div>

            {/* Desktop Shell Body */}
            <div className="relative min-h-[480px] bg-[#000000] flex flex-row overflow-hidden">
              {/* Left Sidebar */}
              <div className="w-[200px] bg-[#000000] border-r border-white/15 p-3 flex flex-col justify-between shrink-0 font-satoshi">
                <div className="space-y-3">
                  <div className="p-2.5 rounded-xl bg-[#161412] border border-white/15 flex items-center justify-between text-xs font-bold text-white">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md bg-[#6366F1]/20 text-[#818CF8] flex items-center justify-center text-[10px] font-black shrink-0">
                        P
                      </div>
                      <span className="truncate text-xs">Personal Space</span>
                    </div>
                    <ChevronRight size={14} className="text-white/40 shrink-0" />
                  </div>

                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ideas')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all text-left ${
                        activeTab === 'ideas'
                          ? 'bg-[#161412] text-[#EC4899] border border-[#EC4899]/40 shadow-[0_2px_10px_rgba(236,72,153,0.15)]'
                          : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <FileText size={15} className="text-[#EC4899]" />
                      <span>Ideas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('forms')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all text-left ${
                        activeTab === 'forms'
                          ? 'bg-[#161412] text-[#F59E0B] border border-[#F59E0B]/40 shadow-[0_2px_10px_rgba(245,158,11,0.15)]'
                          : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <FileSpreadsheet size={15} className="text-[#F59E0B]" />
                      <span>Forms</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                    >
                      <Target size={15} className="text-[#A855F7]" />
                      <span>Goals</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                    >
                      <Lock size={15} className="text-[#10B981]" />
                      <span>Vault</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                    >
                      <MessageSquare size={15} className="text-[#3B82F6]" />
                      <span>Connect</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                    >
                      <Settings size={15} className="text-white/60" />
                      <span>Settings</span>
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/10 text-xs font-bold">
                  <a
                    href="/sponsor"
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/20"
                  >
                    <Heart size={13} />
                    <span>Sponsor Project</span>
                  </a>
                </div>
              </div>

              {/* Main Content Canvas */}
              <div className="flex-1 p-4 bg-[#000000] overflow-y-auto space-y-4">
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-1.5 p-1 bg-[#000000] border-2 border-white/20 rounded-2xl select-none">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ideas')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                        activeTab === 'ideas'
                          ? 'bg-[#EC4899] text-white border border-[#EC4899] shadow-[0_4px_12px_rgba(236,72,153,0.25)]'
                          : 'text-white/80 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <FileText size={14} />
                      <span>Ideas</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('forms')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                        activeTab === 'forms'
                          ? 'bg-[#F59E0B] text-white border border-[#F59E0B] shadow-[0_4px_12px_rgba(245,158,11,0.25)]'
                          : 'text-white/80 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <FileSpreadsheet size={14} />
                      <span>Forms</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('workflows')}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer transition-all ${
                        activeTab === 'workflows'
                          ? 'bg-[#3B82F6] text-white border border-[#3B82F6] shadow-[0_4px_12px_rgba(59,130,246,0.25)]'
                          : 'text-white/80 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <GitFork size={14} />
                      <span>Workflows</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-extrabold bg-[#EC4899] text-white hover:bg-[#db2777] active:scale-95 transition-all shadow-[0_4px_14px_rgba(236,72,153,0.3)] select-none shrink-0 cursor-pointer"
                  >
                    <Plus size={15} strokeWidth={2.5} />
                    <span>New Item</span>
                  </button>
                </div>

                <div className="overflow-x-auto scrollbar-none p-2 bg-[#000000] border-2 border-white/20 rounded-[18px] flex items-center gap-2 select-none">
                  <Tag size={13} className="text-[#EC4899] ml-1 shrink-0" />
                  {[
                    { name: 'Roadmap', active: true },
                    { name: 'Architecture', active: false },
                    { name: 'Security', active: false },
                    { name: 'Q3-Goals', active: false },
                  ].map((t, idx) => (
                    <span
                      key={idx}
                      className={`whitespace-nowrap px-3 py-1 rounded-xl text-[11px] font-bold border shrink-0 ${
                        t.active
                          ? 'bg-[#EC4899] border-white text-white'
                          : 'bg-[#161412] border-white/20 text-white/80'
                      }`}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#EC4899]/60 transition-all space-y-2.5 shadow-lg min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold">
                        Roadmap
                      </span>
                      <Pin size={13} className="text-[#EC4899] fill-[#EC4899]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-clash font-bold text-xs sm:text-sm text-white truncate">#Q3-Milestones & Strategic Plan</h4>
                      <p className="text-[11px] text-white/70 leading-relaxed mt-1 line-clamp-2">
                        Local-first sync engine with client-side AES-256 encryption.
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/10 font-mono">
                      <span>#strategy</span>
                      <span>Updated 2m ago</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#10B981]/60 transition-all space-y-2.5 shadow-lg min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                        Vault Credential
                      </span>
                      <ShieldCheck size={14} className="text-[#10B981]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-clash font-bold text-xs sm:text-sm text-white truncate">Production DB Key</h4>
                      <p className="text-[10px] font-mono text-white/80 bg-black/60 p-1.5 rounded-lg border border-white/10 mt-1 truncate">
                        postgres://admin:••••••••••••@db.prod
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#10B981] pt-2 border-t border-white/10 font-mono">
                      <span>AES-256 Protected</span>
                      <span className="hover:underline cursor-pointer">Reveal Key</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kylie Agentic Right Sidebar (Always visible on desktop mockup) */}
              <div className="w-[300px] bg-[#161412] border-l border-white/20 flex flex-col justify-between font-satoshi shrink-0 max-h-[480px]">
                <div className="px-3.5 py-2.5 border-b border-white/20 bg-[#0E0D0C] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center font-clash font-black text-xs">
                      K
                    </div>
                    <div>
                      <h4 className="text-white font-extrabold text-xs font-clash leading-tight">Kylie Copilot</h4>
                      <p className="text-[#9B9691] text-[9px] font-semibold">Autonomous Assistant</p>
                    </div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                </div>

                <div className="p-3 space-y-2 flex-1 overflow-y-auto max-h-[340px]">
                  {agentMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-1.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-5 h-5 rounded bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          K
                        </div>
                      )}
                      <div
                        className={`max-w-[90%] rounded-xl p-2 text-[10px] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#1C1A18] border border-white/20 text-white'
                            : 'bg-[#000000] border border-white/20 text-white/95'
                        }`}
                      >
                        <p>{msg.content}</p>

                        {msg.tools && (
                          <div className="mt-1.5 space-y-1">
                            {msg.tools.map((t, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-white/20 bg-black/40 p-1 text-[9px]"
                              >
                                <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[#9B9691]">
                                  <Zap size={9} className="text-[#818CF8]" />
                                  <span>{t.toolKey}</span>
                                  <span className="text-emerald-400 ml-auto">{t.status}</span>
                                </div>
                                <p className="text-[#9B9691] mt-0.5 text-[9px]">{t.resultSummary}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {agentRunning && (
                    <div className="flex justify-start gap-1.5 items-center text-[10px] text-white/70">
                      <div className="w-5 h-5 rounded bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center text-[9px] font-bold">
                        K
                      </div>
                      <div className="p-1.5 rounded-xl bg-[#000000] border border-white/20 flex items-center gap-1.5">
                        <RotateCw size={10} className="animate-spin text-[#818CF8]" />
                        <span>Working…</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-2 border-t border-white/20 bg-[#0E0D0C]">
                  <div className="flex items-center gap-1 rounded-xl bg-[#000000] border border-white/20 px-2 py-1">
                    <button
                      type="button"
                      className="w-5 h-5 rounded flex items-center justify-center text-white/50 hover:text-white"
                    >
                      <Paperclip size={12} />
                    </button>
                    <input
                      type="text"
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runSimulatedAgentTask()}
                      placeholder="Ask Kylie..."
                      className="flex-1 bg-transparent border-none text-[10px] text-white placeholder:text-white/40 focus:outline-none px-1"
                    />
                    <button
                      type="button"
                      onClick={() => runSimulatedAgentTask()}
                      className="w-5 h-5 rounded-full bg-[#6366F1] text-white flex items-center justify-center hover:bg-[#5254E8] cursor-pointer shrink-0"
                    >
                      <Send size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE 1:1 SCALED DEVICE MOCKUP (PROPORTIONAL & PERFECTLY ALIGNED WITH BOTTOM NAVBAR) */}
          <div className="block md:hidden max-w-[360px] mx-auto rounded-[32px] bg-[#000000] p-2 border-2 border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden">
            {/* Mobile Topbar Replica */}
            <div className="w-full bg-[#000000] border-b border-white/20 px-3 py-2 flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#6366F1] flex items-center justify-center font-clash font-black text-white text-xs">
                  K
                </div>
                <span className="font-clash font-black text-white text-sm">Kylrix</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openAgenticDrawer({ prompt: 'Show mobile session' })}
                  className="w-7 h-7 rounded-lg bg-[#161412] border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center"
                >
                  <Bot size={14} />
                </button>
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#EC4899] p-0.5 flex items-center justify-center font-bold text-[10px] text-white">
                  U
                </div>
              </div>
            </div>

            {/* Mobile Content Canvas (Proportional scaled UI elements) */}
            <div className="p-3 bg-[#000000] space-y-3 min-h-[380px]">
              {/* Compact Tab Switcher */}
              <div className="flex items-center justify-between gap-1.5 p-1 bg-[#161412] border border-white/20 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('ideas')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all ${
                    activeTab === 'ideas'
                      ? 'bg-[#EC4899] text-white shadow-sm'
                      : 'text-white/70'
                  }`}
                >
                  <FileText size={12} />
                  <span>Ideas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('forms')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all ${
                    activeTab === 'forms'
                      ? 'bg-[#F59E0B] text-white shadow-sm'
                      : 'text-white/70'
                  }`}
                >
                  <FileSpreadsheet size={12} />
                  <span>Forms</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('workflows')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all ${
                    activeTab === 'workflows'
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : 'text-white/70'
                  }`}
                >
                  <GitFork size={12} />
                  <span>Flows</span>
                </button>
              </div>

              {/* Scaled Cards */}
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[#141418] border border-white/20 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold">
                      Roadmap
                    </span>
                    <Pin size={11} className="text-[#EC4899]" />
                  </div>
                  <h5 className="font-clash font-bold text-xs text-white truncate">#Q3-Milestones & Plan</h5>
                  <p className="text-[10px] text-white/70 leading-normal line-clamp-2">
                    Local-first sync engine with client-side AES-256 encryption.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#141418] border border-white/20 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                      Vault
                    </span>
                    <ShieldCheck size={12} className="text-[#10B981]" />
                  </div>
                  <h5 className="font-clash font-bold text-xs text-white truncate">Production DB Key</h5>
                  <p className="text-[9px] font-mono text-white/80 bg-black/60 p-1.5 rounded border border-white/10 truncate">
                    postgres://admin:••••••••••••@db.prod
                  </p>
                </div>
              </div>
            </div>

            {/* Mobile Bottom Navigation Bar (1:1 UnifiedBottomBar Replica) */}
            <div className="w-full bg-[#000000] border-t border-white/20 rounded-b-[24px] px-2 py-2">
              <nav className="flex items-center justify-around h-[48px]">
                <div className="flex flex-col items-center gap-0.5 text-[#EC4899]">
                  <FileText size={18} strokeWidth={2.3} />
                  <span className="text-[9px] font-bold">Notes</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-white/60">
                  <Target size={18} strokeWidth={1.8} />
                  <span className="text-[9px] font-bold">Goals</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-white/60">
                  <Lock size={18} strokeWidth={1.8} />
                  <span className="text-[9px] font-bold">Vault</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 text-white/60">
                  <Settings size={18} strokeWidth={1.8} />
                  <span className="text-[9px] font-bold">Settings</span>
                </div>
              </nav>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. ONE-CLICK SELF-HOST & AGENTIC FLOWS (NON-OVERFLOWING)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">

          {/* ONE-CLICK SELF HOST BOX */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141418] border-2 border-white/20 shadow-2xl flex flex-col justify-between space-y-6 min-w-0 overflow-hidden">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-mono font-bold">
                <Server size={14} />
                <span>One-Command Self Host</span>
              </div>
              <h3 className="font-clash text-2xl sm:text-3xl font-black text-white">
                Run Kylrix locally in 60s.
              </h3>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                Bundled local Appwrite + Kylrix backend. Zero cloud dependencies required.
              </p>
            </div>

            {/* Terminal Command Box (Responsive flex layout, non-overflowing) */}
            <div className="p-3.5 rounded-2xl bg-[#000000] border border-white/20 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
              <span className="break-all select-all text-white/90 font-mono text-[11px] sm:text-xs leading-relaxed flex-1 min-w-0">
                curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyText(
                    'curl -fsSL https://raw.githubusercontent.com/Kylrix/kylrix/master/selfhost.sh | bash',
                    'selfhost'
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border border-white/10 self-end sm:self-auto"
              >
                {copiedSelfHost ? (
                  <>
                    <Check size={13} className="text-[#10B981]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono text-white/70">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 min-w-0">
                <span className="block text-white font-bold truncate">App Server</span>
                <span className="text-[#818CF8] truncate block">http://localhost:5003</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 min-w-0">
                <span className="block text-white font-bold truncate">Local API</span>
                <span className="text-[#10B981] truncate block">http://localhost:8080</span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 col-span-2 sm:col-span-1 min-w-0">
                <span className="block text-white font-bold truncate">License</span>
                <span className="text-[#EC4899] truncate block">AGPL-3.0 Open Source</span>
              </div>
            </div>
          </div>

          {/* AGENTIC MCP & SKILLS INTEGRATION */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141418] border-2 border-white/20 shadow-2xl flex flex-col justify-between space-y-6 min-w-0 overflow-hidden">
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#818CF8] text-xs font-mono font-bold">
                <Cpu size={14} />
                <span>Agent Tools & MCP Integration</span>
              </div>
              <h3 className="font-clash text-2xl sm:text-3xl font-black text-white">
                Wire IDEs, Cursor, & Browser Agents.
              </h3>
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                Connect external assistants directly via MCP, WebMCP browser standard, or REST API keys.
              </p>
            </div>

            {/* Install Skills Command Box */}
            <div className="p-3.5 rounded-2xl bg-[#000000] border border-white/20 font-mono text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
              <span className="break-all select-all text-white/90 font-mono text-[11px] sm:text-xs leading-relaxed flex-1 min-w-0">
                npx skills add kylrix/kylrix --skill mcp --skill api --skill agents
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyText(
                    'npx skills add kylrix/kylrix --skill mcp --skill api --skill agents',
                    'mcp'
                  )
                }
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border border-white/10 self-end sm:self-auto"
              >
                {copiedMcp ? (
                  <>
                    <Check size={13} className="text-[#10B981]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-satoshi">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="font-bold text-white block">WebMCP (Browser Native)</span>
                <p className="text-white/60 text-[11px]">
                  Zero-config <code className="text-[#818CF8]">navigator.modelContext</code> tool execution inside Chrome.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="font-bold text-white block">PAT & Agent Keys</span>
                <p className="text-white/60 text-[11px]">
                  Grant agents their own workspace or delegate access on your behalf.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. WORKSPACE ESSENTIALS (CLEAN PRODUCT TERMINOLOGY)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Workspace Essentials.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/80">
            Notes, vault credentials, goals, forms, and calendar events working seamlessly together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Ideas & Notes */}
          <div className="p-5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#EC4899]/60 transition-all space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#EC4899]/20 text-[#EC4899] font-bold flex items-center gap-1.5">
                <Tag size={12} />
                Ideas & Notes
              </span>
              <Pin size={14} className="text-[#EC4899] fill-[#EC4899]" />
            </div>
            <h3 className="font-clash text-base sm:text-lg font-bold text-white">#Q3-Milestones & Architecture</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Autonomic local-first sync with AES-256 encryption. Seamlessly shareable across workspace team members.
            </p>
            <div className="flex items-center justify-between text-xs text-white/50 pt-2.5 border-t border-white/10 font-mono">
              <span>Tags: #strategy #q3</span>
              <span>2 Attachments</span>
            </div>
          </div>

          {/* Card 2: Vault Passwords */}
          <div className="p-5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#10B981]/60 transition-all space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#10B981]/20 text-[#10B981] font-bold flex items-center gap-1.5">
                <Lock size={12} />
                Encrypted Vault
              </span>
              <ShieldCheck size={16} className="text-[#10B981]" />
            </div>
            <h3 className="font-clash text-base sm:text-lg font-bold text-white">Production Credentials</h3>
            <p className="text-xs font-mono text-white/80 bg-black/50 p-2.5 rounded-xl border border-white/10 truncate">
              postgres://admin:••••••••••••@db.prod
            </p>
            <div className="flex items-center justify-between text-xs text-[#10B981] pt-2.5 border-t border-white/10 font-mono">
              <span>Client AES-256</span>
              <span className="hover:underline cursor-pointer">Reveal Key</span>
            </div>
          </div>

          {/* Card 3: Goals & Deliverables */}
          <div className="p-5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#A855F7]/60 transition-all space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#A855F7]/20 text-[#A855F7] font-bold flex items-center gap-1.5">
                <Target size={12} />
                Goals & Tasks
              </span>
              <CheckSquare size={16} className="text-[#A855F7]" />
            </div>
            <h3 className="font-clash text-base sm:text-lg font-bold text-white">Launch Agentic Integration</h3>
            <div className="space-y-1.5 text-xs text-white/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={13} className="text-[#A855F7]" />
                <span className="line-through text-white/50">Setup workspace permissions</span>
              </div>
              <div className="flex items-center gap-2">
                <Circle size={13} className="text-white/40" />
                <span>Publish WebMCP tools to browser</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-[#A855F7] pt-2.5 border-t border-white/10 font-mono">
              <span>1 of 2 Complete</span>
              <span>75% Progress</span>
            </div>
          </div>

          {/* Card 4: Forms & Surveys */}
          <div className="p-5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#F59E0B]/60 transition-all space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B] font-bold flex items-center gap-1.5">
                <Layers size={12} />
                Forms & Collect
              </span>
              <Share2 size={14} className="text-[#F59E0B]" />
            </div>
            <h3 className="font-clash text-base sm:text-lg font-bold text-white">Feedback & Security Inquiry</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Collect response data directly into your workspace. Responses sync in real-time.
            </p>
            <div className="flex items-center justify-between text-xs text-[#F59E0B] pt-2.5 border-t border-white/10 font-mono">
              <span>18 Submissions</span>
              <span>Public Link</span>
            </div>
          </div>

          {/* Card 5: Events & Schedule */}
          <div className="p-5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#3B82F6]/60 transition-all space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6] font-bold flex items-center gap-1.5">
                <Calendar size={12} />
                Events & Schedule
              </span>
              <Globe size={14} className="text-[#3B82F6]" />
            </div>
            <h3 className="font-clash text-base sm:text-lg font-bold text-white">Weekly Team Huddle & Sync</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Recurring workspace meeting with inbuilt call link & shared agenda notes.
            </p>
            <div className="flex items-center justify-between text-xs text-[#3B82F6] pt-2.5 border-t border-white/10 font-mono">
              <span>Fridays @ 10:00 AM</span>
              <span>5 Attending</span>
            </div>
          </div>

          {/* Card 6: Autonomous AI Agents */}
          <div className="p-5 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#818CF8]/60 transition-all space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#818CF8]/20 text-[#818CF8] font-bold flex items-center gap-1.5">
                <Bot size={12} />
                Autonomous AI Agents
              </span>
              <MoreVertical size={14} className="text-[#818CF8]" />
            </div>
            <h3 className="font-clash text-base sm:text-lg font-bold text-white">Kylie Agentic Copilot</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Dedicated autonomous agent workspace. Executes background workflows independently.
            </p>
            <div className="flex items-center justify-between text-xs text-[#818CF8] pt-2.5 border-t border-white/10 font-mono">
              <span>Agent Key Active</span>
              <span>4 Tools Connected</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. BOTTOM CALL TO ACTION
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 text-center">
        <div className="p-8 sm:p-12 rounded-[32px] bg-[#141418] border-2 border-white/20 shadow-2xl relative overflow-hidden">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to build in one living workspace?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/80 max-w-lg mx-auto">
            Get started right now on the cloud or run locally in one command.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#6366F1] text-white font-bold text-sm sm:text-base border border-[#818CF8]/50 shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:bg-[#5254E8] hover:scale-105 transition-all cursor-pointer"
            >
              {isAuthenticated ? 'Open Workspace' : 'Get Started Free'}
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. FOOTER
         ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <span className="font-clash font-bold text-white text-sm">Kylrix</span>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms-of-service" className="hover:text-white transition-colors">
              Terms
            </Link>
            <a
              href="https://github.com/Kylrix/kylrix"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
