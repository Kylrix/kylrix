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
  MessageSquare,
  Zap,
  ShieldCheck,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  RotateCw,
  Send,
  Pin,
  Tag,
  Paperclip,
  UserCheck,
  Monitor,
  Smartphone,
  History,
  Download,
  Cpu,
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
  X,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { ThreadNoteClaimer } from '@/components/landing/ThreadNoteClaimer';

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const { openAgenticDrawer } = useAgenticDrawer();

  // Copy states
  const [copiedSelfHost, setCopiedSelfHost] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Interactive Tasks state in 1:1 demo
  const [showVaultSecret, setShowVaultSecret] = useState(false);

  // Smart Assistant Session Simulation in 1:1 Mockup
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
        'Analyzed 14 workspace notes and 4 active goals. Generated project summary note "#Q3-Milestones" and encrypted backup key inside Vault.',
      tools: [
        {
          toolKey: 'workspace_summarizer',
          status: 'success',
          resultSummary: 'Scanned 14 items • Summary note saved & encrypted',
        },
      ],
      nextSteps: ['Open #Q3-Milestones note', 'Share summary with team'],
    },
  ]);

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      router.push('/app');
    } else {
      openUnified('login');
    }
  };

  const handleCopyText = (text: string, type: 'selfhost' | 'mcp' | number) => {
    navigator.clipboard.writeText(text);
    if (type === 'selfhost') {
      setCopiedSelfHost(true);
      setTimeout(() => setCopiedSelfHost(false), 2000);
    } else if (type === 'mcp') {
      setCopiedMcp(true);
      setTimeout(() => setCopiedMcp(false), 2000);
    } else if (typeof type === 'number') {
      setCopiedIndex(type);
      setTimeout(() => setCopiedIndex(null), 2000);
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
              resultSummary: 'Executed requested action • Updated 3 workspace records',
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

      {/* Spatial Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-30">
        <div className="absolute -top-40 left-1/2 h-[650px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#6366F1]/20 via-[#EC4899]/15 to-transparent blur-[140px]" />
        <div className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full bg-[#10B981]/15 blur-[150px]" />
        <div className="absolute top-[1500px] -right-40 h-[600px] w-[600px] rounded-full bg-[#A855F7]/15 blur-[150px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-16 pb-10 sm:pb-16">
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-5"
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
            className="font-clash text-3xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08] [text-shadow:_0_2px_12px_rgba(0,0,0,0.9)]"
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
            className="mt-4 sm:mt-5 text-sm sm:text-lg text-white/90 max-w-2xl font-normal leading-relaxed drop-shadow-md"
          >
            Notes, goals, encrypted vault, direct messages, and autonomous AI tools sharing the exact same workspace.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="mt-6 sm:mt-8 flex items-center justify-center gap-3 w-auto"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-7 sm:py-3.5 rounded-2xl bg-[#6366F1] text-white font-bold text-xs sm:text-base border border-[#818CF8]/50 shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:bg-[#5254E8] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Open App' : 'Get Started'}</span>
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => openAgenticDrawer({ prompt: 'Show me around the workspace tools' })}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-7 sm:py-3.5 rounded-2xl bg-[#161412] text-white font-bold text-xs sm:text-base border border-white/20 hover:border-[#EC4899]/60 hover:bg-[#1C1A18] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Bot size={18} className="text-[#EC4899]" />
              <span>Ask Kylie</span>
            </button>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. REAL-TIME 1:1 SCALED MOCKUP MATCHING /app EXACTLY
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="mt-10 sm:mt-14 relative max-w-6xl mx-auto"
        >
          {/* 1:1 SCALED APPLICATION FRAME */}
          <div className="relative rounded-[24px] sm:rounded-[28px] bg-[#000000] p-1.5 sm:p-2.5 border-2 border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.95)] overflow-hidden">

            {/* 1:1 CONNECT TOPBAR REPLICA */}
            <div className="w-full bg-[#000000] border-b-2 border-white/20 px-3 py-3 rounded-t-[20px] flex items-center justify-between gap-3 text-xs font-satoshi">
              {/* Left: App Logo / Name */}
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-[#6366F1] flex items-center justify-center font-clash font-black text-white text-sm shadow-[0_0_12px_rgba(99,102,241,0.5)]">
                  K
                </div>
                <span className="font-clash font-black text-white text-base tracking-tight">Kylrix</span>
              </div>

              {/* Center: Search Island */}
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#161412] border border-white/15 text-xs font-bold text-white/80 shadow-inner max-w-md w-full justify-center sm:justify-start">
                <Search size={14} className="text-white/60 shrink-0" />
                <span className="truncate">Search ecosystem...</span>
              </div>

              {/* Right: Actions & User Avatar */}
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

            {/* MAIN APP SHELL CONTENT LAYOUT */}
            <div className="relative min-h-[500px] bg-[#000000] flex flex-col md:flex-row overflow-hidden">

              {/* DESKTOP 1:1 UNIFIED LEFT SIDEBAR */}
              <div className="hidden md:flex w-[210px] bg-[#000000] border-r border-white/15 p-3 flex-col justify-between shrink-0 font-satoshi">
                <div className="space-y-3.5">
                  {/* Workspace Selector */}
                  <div className="p-2.5 rounded-xl bg-[#161412] border border-white/15 flex items-center justify-between text-xs font-bold text-white shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md bg-[#6366F1]/20 text-[#818CF8] flex items-center justify-center text-[10px] font-black shrink-0">
                        P
                      </div>
                      <span className="truncate text-xs">Personal Space</span>
                    </div>
                    <ChevronRight size={14} className="text-white/40 shrink-0" />
                  </div>

                  {/* Nav Items */}
                  <div className="space-y-1">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all text-left bg-[#161412] text-[#EC4899] border border-[#EC4899]/40 shadow-[0_2px_10px_rgba(236,72,153,0.15)]"
                    >
                      <FileText size={15} className="text-[#EC4899]" />
                      <span>Ideas</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <FileSpreadsheet size={15} className="text-[#F59E0B]" />
                      <span>Forms</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <Target size={15} className="text-[#A855F7]" />
                      <span>Goals</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <Lock size={15} className="text-[#10B981]" />
                      <span>Vault</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <MessageSquare size={15} className="text-[#3B82F6]" />
                      <span>Connect</span>
                    </button>

                    <button
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left text-white/70 hover:text-white hover:bg-white/5"
                    >
                      <Settings size={15} className="text-white/60" />
                      <span>Settings</span>
                    </button>
                  </div>
                </div>

                {/* Sidebar Footer link */}
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

              {/* MAIN CANVAS CONTENT AREA (1:1 IDEAS VIEW FROM /app) */}
              <div className="flex-1 p-3 sm:p-5 bg-[#000000] overflow-y-auto min-h-[460px] space-y-5">
                {/* Top Nav Switcher */}
                <div className="flex items-center justify-between gap-3 w-full">
                  <div className="flex items-center gap-1.5 p-1.5 bg-[#000000] border-2 border-white/20 rounded-2xl select-none shadow-md overflow-x-auto scrollbar-none">
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-[#EC4899] text-white border border-[#EC4899] shadow-[0_4px_12px_rgba(236,72,153,0.25)] shrink-0">
                      <FileText size={15} />
                      <span>Ideas</span>
                    </span>
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white/80 border border-white/10 hover:bg-white/5 shrink-0">
                      <FileSpreadsheet size={15} />
                      <span>Forms</span>
                    </span>
                    <span className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold text-white/80 border border-white/10 hover:bg-white/5 shrink-0">
                      <GitFork size={15} />
                      <span>Workflows</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#EC4899] text-white hover:bg-[#db2777] active:scale-95 transition-all shadow-[0_4px_14px_rgba(236,72,153,0.3)] select-none shrink-0 cursor-pointer"
                  >
                    <Plus size={16} strokeWidth={2.5} />
                    <span className="hidden sm:inline">New Idea</span>
                  </button>
                </div>

                {/* Tags Filter Row */}
                <div className="overflow-x-auto scrollbar-none p-2 bg-[#000000] border-2 border-white/20 rounded-[20px] flex items-center gap-2 select-none shadow-md">
                  <Tag size={14} className="text-[#EC4899] ml-2 shrink-0" />
                  {[
                    { name: 'Roadmap', color: '#EC4899', active: true },
                    { name: 'Architecture', color: '#3B82F6', active: false },
                    { name: 'Security', color: '#10B981', active: false },
                    { name: 'Q3-Goals', color: '#A855F7', active: false },
                  ].map((t, idx) => (
                    <span
                      key={idx}
                      className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold border shrink-0 ${
                        t.active
                          ? 'bg-[#EC4899] border-white text-white shadow-sm'
                          : 'bg-[#161412] border-white/25 text-white/80'
                      }`}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>

                {/* REAL IDEAS OBJECT CARDS GRID (1:1 NoteCard styling) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Card 1 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#EC4899]/60 transition-all space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-[#EC4899]/20 text-[#EC4899] font-bold">
                        Roadmap
                      </span>
                      <Pin size={13} className="text-[#EC4899] fill-[#EC4899]" />
                    </div>
                    <div>
                      <h4 className="font-clash font-bold text-sm text-white">#Q3-Milestones & Architecture</h4>
                      <p className="text-xs text-white/70 leading-relaxed mt-1 line-clamp-2">
                        Local-first sync engine with client-side AES-256 encryption. Seamless sharing across workspace members.
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-white/40 pt-2 border-t border-white/10 font-mono">
                      <span>#strategy #q3</span>
                      <span>Updated 2m ago</span>
                    </div>
                  </div>

                  {/* Card 2 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border-2 border-white/20 hover:border-[#10B981]/60 transition-all space-y-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-md bg-[#10B981]/20 text-[#10B981] font-bold">
                        Vault
                      </span>
                      <ShieldCheck size={14} className="text-[#10B981]" />
                    </div>
                    <div>
                      <h4 className="font-clash font-bold text-sm text-white">Encrypted Credential Backup</h4>
                      <p className="text-xs font-mono text-white/80 bg-black/60 p-2 rounded-lg border border-white/10 mt-1">
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

              {/* DESKTOP 1:1 KYLIE AGENTIC SIDEBAR PANEL */}
              <div className="hidden lg:flex w-[320px] bg-[#161412] border-l border-white/20 flex-col justify-between font-satoshi shrink-0 max-h-[500px]">
                {/* Sticky Header */}
                <div className="px-3.5 py-3 border-b border-white/20 bg-[#0E0D0C] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center font-clash font-black text-xs">
                      K
                    </div>
                    <div>
                      <h4 className="text-white font-extrabold text-xs font-clash leading-tight">Kylie</h4>
                      <p className="text-[#9B9691] text-[9px] font-semibold">Smart Workspace Assistant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-white/60">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[360px]">
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
                        className={`max-w-[88%] rounded-2xl p-2.5 text-[11px] leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#1C1A18] border border-white/20 text-white'
                            : 'bg-[#000000] border border-white/20 text-white/95'
                        }`}
                      >
                        <p>{msg.content}</p>

                        {msg.tools && (
                          <div className="mt-2 space-y-1">
                            {msg.tools.map((t, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-white/20 bg-black/40 p-1.5 text-[9px]"
                              >
                                <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[#9B9691]">
                                  <Zap size={9} className="text-[#818CF8]" />
                                  <span>Tool · {t.toolKey}</span>
                                  <span className="text-emerald-400 ml-auto">{t.status}</span>
                                </div>
                                <p className="text-[#9B9691] mt-0.5 text-[10px]">
                                  {t.resultSummary}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {msg.nextSteps && (
                          <div className="mt-2 space-y-1">
                            <span className="text-[8px] uppercase font-bold text-[#9B9691] tracking-wider">
                              Next with Kylie
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {msg.nextSteps.map((step, sIdx) => (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => runSimulatedAgentTask(step)}
                                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-[9px] font-semibold text-white/90 cursor-pointer transition-all"
                                >
                                  {step}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {agentRunning && (
                    <div className="flex justify-start gap-1.5 items-center text-[11px] text-white/70">
                      <div className="w-5 h-5 rounded bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center text-[9px] font-bold">
                        K
                      </div>
                      <div className="p-2 rounded-xl bg-[#000000] border border-white/20 flex items-center gap-1.5">
                        <RotateCw size={11} className="animate-spin text-[#818CF8]" />
                        <span>Kylie is working…</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pill Input Bar */}
                <div className="p-2.5 border-t border-white/20 bg-[#0E0D0C]">
                  <div className="flex items-center gap-1 rounded-[20px] bg-[#000000] border border-white/20 px-2 py-1">
                    <button
                      type="button"
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white"
                    >
                      <Paperclip size={13} />
                    </button>
                    <input
                      type="text"
                      value={agentInput}
                      onChange={(e) => setAgentInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && runSimulatedAgentTask()}
                      placeholder="Ask Kylie..."
                      className="flex-1 bg-transparent border-none text-[11px] text-white placeholder:text-white/40 focus:outline-none px-1"
                    />
                    <button
                      type="button"
                      onClick={() => runSimulatedAgentTask()}
                      className="w-6 h-6 rounded-full bg-[#6366F1] text-white flex items-center justify-center hover:bg-[#5254E8] cursor-pointer shrink-0"
                    >
                      <Send size={12} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. ONE-CLICK SELF-HOST & AGENTIC FLOWS (COMMAND BOXES FIT PERFECTLY)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 border-t border-white/10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

          {/* ONE-CLICK SELF HOST BOX */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141418] border-2 border-white/20 shadow-2xl flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-xs font-mono font-bold">
                <Server size={14} />
                <span>One-Command Self Host</span>
              </div>
              <h3 className="font-clash text-2xl sm:text-3xl font-black text-white">
                Run standard Kylrix locally in 60s.
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Bundled local Appwrite + Kylrix backend. Zero cloud dependencies required.
              </p>
            </div>

            {/* Terminal Command Box (Fits without scrolling) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#000000] border border-white/20 font-mono text-xs text-[#10B981] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
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
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border border-white/10 self-end sm:self-auto"
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono text-white/70">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="block text-white font-bold">App Server</span>
                <span className="text-[#818CF8]">http://localhost:5003</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                <span className="block text-white font-bold">Local API</span>
                <span className="text-[#10B981]">http://localhost:8080/v1</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 col-span-2 sm:col-span-1">
                <span className="block text-white font-bold">License</span>
                <span className="text-[#EC4899]">AGPL-3.0 Open Source</span>
              </div>
            </div>
          </div>

          {/* AGENTIC MCP & SKILLS INTEGRATION */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#141418] border-2 border-white/20 shadow-2xl flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#818CF8] text-xs font-mono font-bold">
                <Cpu size={14} />
                <span>Agent Tools & MCP Integration</span>
              </div>
              <h3 className="font-clash text-2xl sm:text-3xl font-black text-white">
                Wire IDEs, Cursor, & Browser Agents.
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                Connect external assistants directly via MCP, WebMCP browser standard, or REST API keys.
              </p>
            </div>

            {/* Install Skills Command Box (Fits without scrolling) */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#000000] border border-white/20 font-mono text-xs text-[#818CF8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
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
                className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 border border-white/10 self-end sm:self-auto"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-satoshi">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                <span className="font-bold text-white block">WebMCP (Browser Native)</span>
                <p className="text-white/60 text-[11px]">
                  Zero-config <code className="text-[#818CF8]">navigator.modelContext</code> tool execution inside Chrome.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
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
          4. 1:1 REAL WORLD OBJECT CARDS (NOTES, VAULT, GOALS, FORMS, EVENTS)
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Real-world object cards.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-white/80">
            See exactly how notes, vault passwords, tasks, forms, and events look inside the workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Real Object Card 1: Note / Idea */}
          <div className="p-5 rounded-3xl bg-[#141418] border-2 border-white/20 hover:border-[#EC4899]/60 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#EC4899]/20 text-[#EC4899] font-bold flex items-center gap-1.5">
                <Tag size={12} />
                Idea Object
              </span>
              <Pin size={14} className="text-[#EC4899] fill-[#EC4899]" />
            </div>
            <h3 className="font-clash text-lg font-bold text-white">#Q3-Milestones & Strategic Plan</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Autonomic local-first sync with AES-256 encryption. Seamlessly shareable across workspace team members.
            </p>
            <div className="flex items-center justify-between text-xs text-white/50 pt-3 border-t border-white/10 font-mono">
              <span>Tags: #strategy #q3</span>
              <span>2 Attachments</span>
            </div>
          </div>

          {/* Real Object Card 2: Vault Password */}
          <div className="p-5 rounded-3xl bg-[#141418] border-2 border-white/20 hover:border-[#10B981]/60 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#10B981]/20 text-[#10B981] font-bold flex items-center gap-1.5">
                <Lock size={12} />
                Vault Credential
              </span>
              <ShieldCheck size={16} className="text-[#10B981]" />
            </div>
            <h3 className="font-clash text-lg font-bold text-white">Production DB Credentials</h3>
            <p className="text-xs font-mono text-white/80 bg-black/50 p-2.5 rounded-xl border border-white/10">
              postgres://admin:••••••••••••@db.prod
            </p>
            <div className="flex items-center justify-between text-xs text-[#10B981] pt-3 border-t border-white/10 font-mono">
              <span>Client AES-256</span>
              <span>Click to reveal</span>
            </div>
          </div>

          {/* Real Object Card 3: Goal & Tasks */}
          <div className="p-5 rounded-3xl bg-[#141418] border-2 border-white/20 hover:border-[#A855F7]/60 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#A855F7]/20 text-[#A855F7] font-bold flex items-center gap-1.5">
                <Target size={12} />
                Goal Deliverable
              </span>
              <CheckSquare size={16} className="text-[#A855F7]" />
            </div>
            <h3 className="font-clash text-lg font-bold text-white">Launch Agentic Integration</h3>
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
            <div className="flex items-center justify-between text-xs text-[#A855F7] pt-3 border-t border-white/10 font-mono">
              <span>1 of 2 Complete</span>
              <span>75% Progress</span>
            </div>
          </div>

          {/* Real Object Card 4: Form */}
          <div className="p-5 rounded-3xl bg-[#141418] border-2 border-white/20 hover:border-[#F59E0B]/60 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B] font-bold flex items-center gap-1.5">
                <Layers size={12} />
                Form Object
              </span>
              <Share2 size={14} className="text-[#F59E0B]" />
            </div>
            <h3 className="font-clash text-lg font-bold text-white">Feedback & Security Inquiry</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Collect response data directly into your workspace. Responses sync in real-time.
            </p>
            <div className="flex items-center justify-between text-xs text-[#F59E0B] pt-3 border-t border-white/10 font-mono">
              <span>18 Submissions</span>
              <span>Public Link</span>
            </div>
          </div>

          {/* Real Object Card 5: Event */}
          <div className="p-5 rounded-3xl bg-[#141418] border-2 border-white/20 hover:border-[#3B82F6]/60 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6] font-bold flex items-center gap-1.5">
                <Calendar size={12} />
                Calendar Event
              </span>
              <Globe size={14} className="text-[#3B82F6]" />
            </div>
            <h3 className="font-clash text-lg font-bold text-white">Weekly Team Huddle & Sync</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Recurring workspace meeting with inbuilt call link & shared agenda notes.
            </p>
            <div className="flex items-center justify-between text-xs text-[#3B82F6] pt-3 border-t border-white/10 font-mono">
              <span>Fridays @ 10:00 AM</span>
              <span>5 Attending</span>
            </div>
          </div>

          {/* Real Object Card 6: Workspace Container */}
          <div className="p-5 rounded-3xl bg-[#141418] border-2 border-white/20 hover:border-[#818CF8]/60 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-[#818CF8]/20 text-[#818CF8] font-bold flex items-center gap-1.5">
                <Bot size={12} />
                Agent Workspace
              </span>
              <MoreVertical size={14} className="text-[#818CF8]" />
            </div>
            <h3 className="font-clash text-lg font-bold text-white">Kylie Agentic Container</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Dedicated autonomous agent workspace. Executes background workflows independently.
            </p>
            <div className="flex items-center justify-between text-xs text-[#818CF8] pt-3 border-t border-white/10 font-mono">
              <span>Agent Key Active</span>
              <span>4 Tools Connected</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. BOTTOM CALL TO ACTION
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
        <div className="p-8 sm:p-12 rounded-[32px] bg-[#141418] border-2 border-white/20 shadow-2xl relative overflow-hidden">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to build in one living workspace?
          </h2>
          <p className="mt-3 text-base sm:text-lg text-white/80 max-w-lg mx-auto">
            Get started right now on the cloud or run locally in one command.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
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
      <footer className="relative z-10 border-t border-white/10 py-8 px-4">
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
