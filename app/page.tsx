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

  // Mode & Tab switches for adaptive device previews
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'agents' | 'notes' | 'vault' | 'goals' | 'chat'>('agents');

  // Copy states
  const [copiedSelfHost, setCopiedSelfHost] = useState(false);
  const [copiedMcp, setCopiedMcp] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Interactive Tasks state in 1:1 demo
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Setup workspace & team permissions', completed: true, category: 'Setup' },
    { id: '2', title: 'Store private vault passwords & security keys', completed: false, category: 'Security' },
    { id: '3', title: 'Connect identity & direct message channel', completed: true, category: 'Messages' },
    { id: '4', title: 'Run smart assistant daily workspace summary', completed: false, category: 'Assistant' },
  ]);
  const [showVaultSecret, setShowVaultSecret] = useState(false);

  // Smart Assistant Session Simulation
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
      nextSteps: ['Open #Q3-Milestones note', 'Share summary with team', 'View Vault backup key'],
    },
  ]);

  // Chat tab state
  const [chatMessages, setChatMessages] = useState([
    { sender: 'Alex', text: 'Hey, did you review the project outline for this week?', time: '10:14 AM', isUser: false },
    { sender: 'You', text: 'Yes! Added notes and pinned key tasks.', time: '10:15 AM', isUser: true },
    { sender: 'Alex', text: 'Awesome! Everything looks clear.', time: '10:16 AM', isUser: false },
  ]);
  const [newChatText, setNewChatText] = useState('');

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      router.push('/app');
    } else {
      openUnified('login');
    }
  };

  const toggleTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
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

  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatText.trim()) return;
    const msg = {
      sender: 'You',
      text: newChatText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isUser: true,
    };
    setChatMessages((prev) => [...prev, msg]);
    setNewChatText('');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#6366F1]/30 selection:text-white font-sans overflow-x-hidden relative">
      {/* Background Claimer */}
      <ThreadNoteClaimer />

      {/* Spatial Soft Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
        <div className="absolute -top-40 left-1/2 h-[650px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#6366F1]/20 via-[#EC4899]/15 to-transparent blur-[140px]" />
        <div className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full bg-[#10B981]/15 blur-[150px]" />
        <div className="absolute top-[1500px] -right-40 h-[600px] w-[600px] rounded-full bg-[#A855F7]/15 blur-[150px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION WITH TRANSPARENT FAINT SLANTED BACKGROUND SCREENS
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 pt-6 sm:pt-12 pb-12 sm:pb-20">

        {/* PROMINENT FAINT SLANTED MOCK SCREENS WITH REDUCED OPACITY & BACKDROP BLUR */}
        <div className="pointer-events-none absolute inset-x-0 top-1 sm:top-4 bottom-0 z-0 flex justify-center items-start overflow-hidden opacity-30 sm:opacity-40">
          <div className="relative w-full max-w-6xl h-[500px]">
            {/* Left Slanted Screen: Kylie Agentic Sidebar Frame */}
            <div className="absolute top-2 left-0 sm:left-4 w-[85%] sm:w-[540px] rounded-3xl bg-[#161412]/80 border-2 border-white/20 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)] transform -rotate-6 -skew-y-2 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-white/15 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center font-bold text-xs">
                    K
                  </div>
                  <span className="text-xs font-bold text-white">Kylie · Smart Assistant</span>
                </div>
                <div className="h-2 w-20 rounded-full bg-white/20" />
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-[#000000]/90 border border-white/15 text-xs text-white/90">
                  <div className="text-[10px] text-white/50 font-mono mb-1">User request</div>
                  Scan workspace and create milestone summary
                </div>
                <div className="p-3 rounded-2xl bg-[#000000]/90 border border-[#6366F1]/40 text-xs text-white">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#818CF8] mb-1">
                    <Zap size={10} /> Tool · workspace_summarizer [success]
                  </div>
                  Summary generated & encrypted in Vault
                </div>
              </div>
            </div>

            {/* Right Slanted Screen: Workspace App Main View */}
            <div className="absolute top-8 right-0 sm:right-4 w-[85%] sm:w-[540px] rounded-3xl bg-[#0D0D10]/80 border-2 border-white/20 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)] transform rotate-6 skew-y-2 backdrop-blur-md">
              <div className="flex items-center justify-between pb-3 border-b border-white/15 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="h-2 w-24 rounded-full bg-white/20" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#141418]/90 border border-white/15 space-y-1.5">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold">
                    Note
                  </span>
                  <div className="h-3 w-28 rounded bg-white/30" />
                  <div className="h-2 w-20 rounded bg-white/15" />
                </div>
                <div className="p-3 rounded-2xl bg-[#141418]/90 border border-white/15 space-y-1.5">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                    Vault
                  </span>
                  <div className="h-3 w-24 rounded bg-white/30" />
                  <div className="h-2 w-16 rounded bg-white/15" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HERO CONTENT WITH CRISP TYPOGRAPHY & COMPACT MOBILE BUTTONS */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-4"
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

          {/* COMPACT BUTTONS ON MOBILE */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="mt-6 sm:mt-8 flex items-center justify-center gap-2.5 sm:gap-3.5 w-auto"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#6366F1] text-white font-bold text-xs sm:text-base border border-[#818CF8]/50 shadow-[0_0_25px_rgba(99,102,241,0.4)] hover:bg-[#5254E8] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Open App' : 'App'}</span>
              <ChevronRight size={16} strokeWidth={2.5} className="hidden sm:inline" />
            </button>

            <button
              type="button"
              onClick={() => openAgenticDrawer({ prompt: 'Show me around the workspace tools' })}
              className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:px-6 sm:py-3.5 rounded-xl sm:rounded-2xl bg-[#161412] text-white font-bold text-xs sm:text-base border border-white/20 hover:border-[#EC4899]/60 hover:bg-[#1C1A18] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Bot size={15} className="text-[#EC4899] sm:w-[18px] sm:h-[18px]" />
              <span>Ask Kylie</span>
            </button>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. 1:1 SCALED REPLICA OF THE ACTUAL APPLICATION
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 sm:mt-14 relative max-w-6xl mx-auto"
        >
          {/* Controls Bar: Device Mode & Feature Navigation Tabs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 px-2">
            {/* Feature Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
              {[
                { id: 'agents', label: 'Smart Assistant (Kylie)', icon: Bot, color: '#6366F1' },
                { id: 'notes', label: 'Ideas & Notes', icon: FileText, color: '#EC4899' },
                { id: 'vault', label: 'Encrypted Vault', icon: Lock, color: '#10B981' },
                { id: 'goals', label: 'Goals & Tasks', icon: Target, color: '#A855F7' },
                { id: 'chat', label: 'Direct Messages', icon: MessageSquare, color: '#3B82F6' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#18181C] text-white border-2'
                        : 'bg-white/5 text-white/70 border border-white/10 hover:border-white/30 hover:text-white'
                    }`}
                    style={{ borderColor: isActive ? tab.color : undefined }}
                  >
                    <Icon size={14} style={{ color: tab.color }} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Desktop / Mobile Adaptive Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[#141418] border border-white/15 self-center sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setDeviceMode('desktop')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  deviceMode === 'desktop'
                    ? 'bg-[#6366F1] text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Monitor size={14} />
                <span>Desktop View</span>
              </button>

              <button
                type="button"
                onClick={() => setDeviceMode('mobile')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  deviceMode === 'mobile'
                    ? 'bg-[#6366F1] text-white shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone size={14} />
                <span>Mobile View</span>
              </button>
            </div>
          </div>

          {/* 1:1 SCALED APPLICATION FRAME */}
          <div className="relative rounded-[24px] sm:rounded-[28px] bg-[#000000] p-1.5 sm:p-3 border-2 border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.95)] transition-all overflow-hidden">

            {/* 1:1 CONNECT TOPBAR REPLICA */}
            <div className="w-full bg-[#000000] border-b-2 border-white/20 px-3 py-2.5 rounded-t-[20px] flex items-center justify-between gap-2 text-xs font-satoshi">
              {/* Left: App Logo / Name */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#6366F1] flex items-center justify-center font-clash font-black text-white text-xs">
                  K
                </div>
                <span className="font-clash font-black text-white text-sm">Kylrix</span>
              </div>

              {/* Center: Search Island */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#161412] border border-white/15 text-[11px] font-bold text-white/80">
                <Search size={13} className="text-white/60" />
                <span className="hidden sm:inline">Search ecosystem...</span>
                <span className="sm:hidden">Search...</span>
              </div>

              {/* Right: Actions & User Avatar */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openAgenticDrawer({ prompt: 'Show active workspace session' })}
                  className="w-7 h-7 rounded-xl bg-[#161412] border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center hover:bg-[#1C1A18] transition-colors"
                >
                  <Bot size={14} />
                </button>
                <button
                  type="button"
                  className="w-7 h-7 rounded-xl bg-[#161412] border border-white/15 text-white/80 flex items-center justify-center"
                >
                  <Bell size={14} />
                </button>
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6366F1] to-[#EC4899] p-0.5 flex items-center justify-center font-bold text-[10px] text-white">
                  U
                </div>
              </div>
            </div>

            {/* MAIN APP SHELL CONTENT LAYOUT (SIDEBAR + MAIN CANVAS + AGENTIC SIDEBAR) */}
            <div className="relative min-h-[460px] bg-[#000000] flex flex-col md:flex-row overflow-hidden">

              {/* DESKTOP 1:1 UNIFIED LEFT SIDEBAR (Shown when in desktop mode) */}
              {deviceMode === 'desktop' && (
                <div className="hidden md:flex w-[200px] bg-[#000000] border-r border-white/15 p-2.5 flex-col justify-between shrink-0 font-satoshi">
                  <div className="space-y-3">
                    {/* Workspace Selector */}
                    <div className="p-2 rounded-xl bg-[#161412] border border-white/15 flex items-center justify-between text-xs font-bold text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center text-[10px] font-black">
                          P
                        </div>
                        <span className="truncate text-[11px]">Personal Space</span>
                      </div>
                      <ChevronRight size={12} className="text-white/40" />
                    </div>

                    {/* Nav Items */}
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('notes')}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                          activeTab === 'notes'
                            ? 'bg-[#161412] text-[#EC4899] border border-[#EC4899]/30'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <FileText size={14} className="text-[#EC4899]" />
                        <span>Ideas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('goals')}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                          activeTab === 'goals'
                            ? 'bg-[#161412] text-[#A855F7] border border-[#A855F7]/30'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Target size={14} className="text-[#A855F7]" />
                        <span>Goals</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('vault')}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                          activeTab === 'vault'
                            ? 'bg-[#161412] text-[#10B981] border border-[#10B981]/30'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Lock size={14} className="text-[#10B981]" />
                        <span>Vault</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setActiveTab('agents')}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                          activeTab === 'agents'
                            ? 'bg-[#161412] text-[#6366F1] border border-[#6366F1]/30'
                            : 'text-white/70 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Bot size={14} className="text-[#6366F1]" />
                        <span>Agents</span>
                      </button>

                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white/70 hover:text-white hover:bg-white/5 text-left"
                      >
                        <Settings size={14} className="text-[#6366F1]" />
                        <span>Settings</span>
                      </button>
                    </div>
                  </div>

                  {/* Sidebar Footer links */}
                  <div className="space-y-1 pt-2 border-t border-white/10 text-[11px] font-bold">
                    <a
                      href="/sponsor"
                      className="flex items-center gap-2 px-2 py-1 rounded bg-[#EC4899]/10 text-[#EC4899] border border-[#EC4899]/20"
                    >
                      <Heart size={12} />
                      <span>Sponsor</span>
                    </a>
                  </div>
                </div>
              )}

              {/* MAIN CANVAS CONTENT AREA */}
              <div className="flex-1 p-3 sm:p-5 bg-[#000000] overflow-y-auto min-h-[400px]">
                {/* TAB 1: AGENTS ACTIVE VIEW */}
                {activeTab === 'agents' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/40 flex items-center justify-center text-[#818CF8]">
                          <Bot size={15} />
                        </div>
                        <div>
                          <h4 className="font-clash font-bold text-xs text-white">Smart Assistant Workspace</h4>
                          <p className="text-[10px] text-white/50">Active agentic session & live MCP tool executions</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-[#10B981]/20 text-[#10B981] text-[10px] font-mono font-bold">
                        Online · Local First
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#141418] border border-white/15 space-y-2.5">
                      <h5 className="font-bold text-[11px] text-[#818CF8] uppercase tracking-wider">
                        #Q3-Milestones Summary
                      </h5>
                      <p className="text-xs text-white/80 leading-relaxed">
                        Kylie scanned workspace notes, created #Q3-Milestones, and encrypted backup keys inside Vault.
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-[#10B981]">
                        <CheckCircle2 size={12} />
                        <span>Tool execution completed successfully</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: NOTES & IDEAS ACTIVE VIEW */}
                {activeTab === 'notes' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-white/80">Ideas & Notes</span>
                      <button type="button" className="text-xs font-bold text-[#EC4899]">
                        + New Idea
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-2xl bg-[#141418] border border-white/15 space-y-2 hover:border-[#EC4899]/50 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold">
                            Roadmap
                          </span>
                          <Pin size={11} className="text-[#EC4899] fill-[#EC4899]" />
                        </div>
                        <h4 className="font-bold text-xs text-white">Q3 Product Architecture</h4>
                        <p className="text-[11px] text-white/70 leading-relaxed">
                          Offline sync engine, fast search indexing, and collaborative workspace tagging.
                        </p>
                        <div className="text-[10px] text-white/40 pt-1 border-t border-white/10 flex justify-between">
                          <span>2 attachments</span>
                          <span>Updated 5m ago</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#141418] border border-white/15 space-y-2 hover:border-[#EC4899]/50 transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#818CF8]/20 text-[#818CF8] font-bold">
                            Meeting
                          </span>
                          <span className="text-[10px] text-white/40">2h ago</span>
                        </div>
                        <h4 className="font-bold text-xs text-white">UI Sync & Dark Theme</h4>
                        <p className="text-[11px] text-white/70 leading-relaxed">
                          Streamline action buttons, refine dark theme card borders, and standardize UI.
                        </p>
                        <div className="text-[10px] text-[#818CF8] pt-1 border-t border-white/10 flex justify-between">
                          <span>Shared with Team</span>
                          <ArrowUpRight size={11} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: ENCRYPTED VAULT ACTIVE VIEW */}
                {activeTab === 'vault' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-white/80">Encrypted Credentials</span>
                      <button
                        type="button"
                        onClick={() => setShowVaultSecret(!showVaultSecret)}
                        className="inline-flex items-center gap-1 text-xs text-[#10B981] font-bold cursor-pointer"
                      >
                        {showVaultSecret ? <EyeOff size={13} /> : <Eye size={13} />}
                        <span>{showVaultSecret ? 'Hide' : 'Reveal'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-2xl bg-[#141418] border border-white/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-[#10B981] font-bold uppercase">Password</span>
                          <KeyRound size={12} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-xs text-white">Database Key</h4>
                        <p className="text-[11px] font-mono text-white/80">
                          {showVaultSecret ? 'postgres://admin:sec3te#9@db' : '••••••••••••••••••••'}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCopyText('postgres://admin:sec3te#9@db', 1)}
                          className="w-full flex items-center justify-between text-[10px] font-mono text-white/70 hover:text-white pt-1.5 border-t border-white/10 cursor-pointer"
                        >
                          <span>{copiedIndex === 1 ? 'Copied!' : 'Copy key'}</span>
                          {copiedIndex === 1 ? <Check size={11} className="text-[#10B981]" /> : <Copy size={11} />}
                        </button>
                      </div>

                      <div className="p-3 rounded-2xl bg-[#141418] border border-white/15 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-[#10B981] font-bold uppercase">Authenticator</span>
                          <ShieldCheck size={12} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-xs text-white">2FA Code</h4>
                        <p className="text-base font-mono font-bold text-white tracking-wider">
                          {showVaultSecret ? '849 201' : '••• •••'}
                        </p>
                        <div className="text-[10px] font-mono text-white/40 pt-1.5 border-t border-white/10 flex justify-between">
                          <span>AES-256</span>
                          <span>18s remaining</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: GOALS ACTIVE VIEW */}
                {activeTab === 'goals' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-white/80">Goals & Tasks</span>
                      <span className="text-xs font-bold text-[#A855F7]">
                        {tasks.filter((t) => t.completed).length} of {tasks.length} Done
                      </span>
                    </div>

                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            task.completed
                              ? 'bg-[#141418]/60 border-white/10 opacity-70'
                              : 'bg-[#141418] border-white/20 hover:border-[#A855F7]/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {task.completed ? (
                              <CheckCircle2 size={16} className="text-[#A855F7] shrink-0" />
                            ) : (
                              <Circle size={16} className="text-white/40 shrink-0" />
                            )}
                            <span
                              className={`text-xs font-medium ${
                                task.completed ? 'line-through text-white/50' : 'text-white'
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
                            {task.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 5: DIRECT MESSAGES ACTIVE VIEW */}
                {activeTab === 'chat' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={14} className="text-[#3B82F6]" />
                        <span className="text-xs font-bold text-white">Direct Chat with Alex</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#3B82F6]">Encrypted Channel</span>
                    </div>

                    <div className="p-3 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between min-h-[260px]">
                      <div className="space-y-2.5 mb-3 overflow-y-auto max-h-[180px] pr-1">
                        {chatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
                          >
                            <div
                              className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] ${
                                msg.isUser
                                  ? 'bg-[#3B82F6] text-white rounded-br-xs'
                                  : 'bg-[#222228] text-white/90 rounded-bl-xs border border-white/10'
                              }`}
                            >
                              {msg.text}
                            </div>
                            <span className="text-[9px] text-white/40 mt-0.5 px-1">{msg.time}</span>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 pt-2 border-t border-white/10">
                        <input
                          type="text"
                          value={newChatText}
                          onChange={(e) => setNewChatText(e.target.value)}
                          placeholder="Type a message..."
                          className="flex-1 px-3 py-1.5 rounded-xl bg-[#000000] border border-white/15 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-xl bg-[#3B82F6] text-white text-xs font-bold hover:bg-[#2563EB] cursor-pointer"
                        >
                          <Send size={12} />
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>

              {/* DESKTOP 1:1 KYLIE AGENTIC SIDEBAR PANEL (Active in Desktop View) */}
              {deviceMode === 'desktop' && (
                <div className="w-[320px] bg-[#161412] border-l border-white/20 flex flex-col justify-between font-satoshi shrink-0">
                  {/* Sticky Header */}
                  <div className="px-3 py-2.5 border-b border-white/20 bg-[#0E0D0C] flex items-center justify-between">
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
                      <button type="button" className="p-1 rounded bg-[#161412] border border-white/15">
                        <History size={12} />
                      </button>
                      <button type="button" className="p-1 rounded bg-[#161412] border border-white/15">
                        <Download size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[300px]">
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
                          <span>Kylie is on it…</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* OpenBricks 4.0 Pill Input Bar */}
                  <div className="p-2 border-t border-white/20 bg-[#0E0D0C]">
                    <div className="flex items-center gap-1 rounded-[20px] bg-[#000000] border border-white/20 px-2 py-1">
                      <button
                        type="button"
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10"
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
                        className="w-6 h-6 rounded-full bg-[#6366F1] text-white flex items-center justify-center hover:bg-[#5254E8] cursor-pointer"
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MOBILE 1:1 UNIFIED BOTTOM BAR (Shown in Mobile Mode) */}
            {deviceMode === 'mobile' && (
              <div className="w-full bg-[#000000] border-t-2 border-white/30 rounded-b-[20px] px-2 py-1.5 flex items-center justify-around text-xs font-satoshi">
                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 ${
                    activeTab === 'notes' ? 'text-[#EC4899]' : 'text-white/70'
                  }`}
                >
                  <FileText size={18} />
                  <span className="text-[10px] font-bold mt-0.5">Ideas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('goals')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 ${
                    activeTab === 'goals' ? 'text-[#A855F7]' : 'text-white/70'
                  }`}
                >
                  <Target size={18} />
                  <span className="text-[10px] font-bold mt-0.5">Goals</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('vault')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 ${
                    activeTab === 'vault' ? 'text-[#10B981]' : 'text-white/70'
                  }`}
                >
                  <Lock size={18} />
                  <span className="text-[10px] font-bold mt-0.5">Vault</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`flex flex-col items-center justify-center flex-1 py-1 ${
                    activeTab === 'chat' ? 'text-[#3B82F6]' : 'text-white/70'
                  }`}
                >
                  <MessageSquare size={18} />
                  <span className="text-[10px] font-bold mt-0.5">Connect</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. ONE-CLICK SELF-HOST & AGENTIC FLOWS (IMMEDIATELY AFTER HERO)
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

            {/* Copyable Terminal Box */}
            <div className="relative p-4 rounded-2xl bg-[#000000] border border-white/20 font-mono text-xs text-[#10B981] overflow-x-auto">
              <div className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap select-all text-white/90">
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
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
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

            {/* Install Skills Command Box */}
            <div className="relative p-4 rounded-2xl bg-[#000000] border border-white/20 font-mono text-xs text-[#818CF8] overflow-x-auto">
              <div className="flex items-center justify-between gap-2">
                <span className="whitespace-nowrap select-all text-white/90">
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
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
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
