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
  Play,
  RotateCw,
  Send,
  Sparkles,
  Pin,
  Tag,
  Paperclip,
  Clock,
  UserCheck,
  Monitor,
  Smartphone,
  X,
  History,
  Download,
  Plus,
  Search,
  MoreHorizontal,
  Share2,
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

  // Interactive Live Simulation States
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Setup workspace & team permissions', completed: true, category: 'Setup' },
    { id: '2', title: 'Store private vault passwords & security keys', completed: false, category: 'Security' },
    { id: '3', title: 'Connect identity & direct message channel', completed: true, category: 'Messages' },
    { id: '4', title: 'Run smart assistant daily workspace summary', completed: false, category: 'Assistant' },
  ]);
  const [showVaultSecret, setShowVaultSecret] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Smart Assistant Session Simulation
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentCompleted, setAgentCompleted] = useState(true);
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

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const runSimulatedAgentTask = (promptText?: string) => {
    const textToSend = promptText || agentInput || 'Summarize workspace updates';
    if (!textToSend.trim() || agentRunning) return;

    setAgentRunning(true);
    setAgentInput('');

    const userMsg = { id: `u-${Date.now()}`, role: 'user' as const, content: textToSend };
    setAgentMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const assistantMsg = {
        id: `a-${Date.now()}`,
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
      };
      setAgentMessages((prev) => [...prev, assistantMsg]);
      setAgentRunning(false);
      setAgentCompleted(true);
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
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-50">
        <div className="absolute -top-40 left-1/2 h-[650px] w-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#6366F1]/25 via-[#EC4899]/20 to-transparent blur-[140px]" />
        <div className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full bg-[#10B981]/20 blur-[150px]" />
        <div className="absolute top-[1500px] -right-40 h-[600px] w-[600px] rounded-full bg-[#A855F7]/20 blur-[150px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION WITH PROMINENT FAINT BACKGROUND SCREENS
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14 pb-16 lg:pb-24">

        {/* PROMINENT FAINT SLANTED MOCK SCREENS PROVIDING FORM & DEPTH */}
        <div className="pointer-events-none absolute inset-x-0 top-2 sm:top-6 bottom-0 z-0 flex justify-center items-start overflow-hidden opacity-60 sm:opacity-75">
          <div className="relative w-full max-w-6xl h-[520px]">
            {/* Left Slanted Screen: Kylie Desktop Sidebar Frame */}
            <div className="absolute top-2 left-0 sm:left-4 w-[85%] sm:w-[560px] rounded-3xl bg-[#161412] border-2 border-white/25 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)] transform -rotate-6 -skew-y-2 backdrop-blur-sm">
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
                <div className="p-3 rounded-2xl bg-[#000000] border border-white/15 text-xs text-white/90">
                  <div className="text-[10px] text-white/50 font-mono mb-1">User request</div>
                  Scan workspace and create milestone summary
                </div>
                <div className="p-3 rounded-2xl bg-[#000000] border border-[#6366F1]/40 text-xs text-white">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#818CF8] mb-1">
                    <Zap size={10} /> Tool · workspace_summarizer [success]
                  </div>
                  Summary generated & encrypted in Vault
                </div>
              </div>
            </div>

            {/* Right Slanted Screen: Workspace App Main View */}
            <div className="absolute top-8 right-0 sm:right-4 w-[85%] sm:w-[560px] rounded-3xl bg-[#0D0D10] border-2 border-white/25 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.8)] transform rotate-6 skew-y-2 backdrop-blur-sm">
              <div className="flex items-center justify-between pb-3 border-b border-white/15 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="h-2 w-24 rounded-full bg-white/20" />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#141418] border border-white/15 space-y-1.5">
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold">
                    Note
                  </span>
                  <div className="h-3 w-28 rounded bg-white/30" />
                  <div className="h-2 w-20 rounded bg-white/15" />
                </div>
                <div className="p-3 rounded-2xl bg-[#141418] border border-white/15 space-y-1.5">
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

        {/* CONCISE, IMPACTFUL HERO CONTENT */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-5"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              All-in-One Workspace
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="font-clash text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]"
          >
            Notes, Vault & Assistant <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#818CF8] via-[#EC4899] to-[#10B981] bg-clip-text text-transparent">
              In One Unified App.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="mt-5 text-base sm:text-lg text-white/80 max-w-xl font-normal leading-relaxed"
          >
            Manage notes, goals, passwords, and team chats with an inbuilt smart assistant that completes work instantly.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#6366F1] text-white font-bold text-sm sm:text-base border border-[#818CF8]/50 shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:bg-[#5254E8] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Open Workspace' : 'Start Free Workspace'}</span>
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => openAgenticDrawer({ prompt: 'Show me around the workspace tools' })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#161412] text-white font-bold text-sm sm:text-base border border-white/20 hover:border-[#EC4899]/60 hover:bg-[#1C1A18] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Bot size={18} className="text-[#EC4899]" />
              <span>Ask Smart Assistant</span>
            </button>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. 1:1 PIXEL-PERFECT ADAPTIVE DEMO SCREENSHOT MOCKUPS
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 sm:mt-16 relative max-w-6xl mx-auto"
        >
          {/* Controls Bar: Device Switcher & Feature Tabs */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4 px-2">
            {/* Feature Selectors */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
              {[
                { id: 'agents', label: 'Smart Assistant (Kylie)', icon: Bot, color: '#6366F1' },
                { id: 'notes', label: 'Notes & Ideas', icon: FileText, color: '#EC4899' },
                { id: 'vault', label: 'Encrypted Vault', icon: Lock, color: '#10B981' },
                { id: 'goals', label: 'Tasks & Goals', icon: Target, color: '#A855F7' },
                { id: 'chat', label: 'Direct Messages', icon: MessageSquare, color: '#3B82F6' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#18181C] text-white border-2'
                        : 'bg-white/5 text-white/70 border border-white/10 hover:border-white/30 hover:text-white'
                    }`}
                    style={{ borderColor: isActive ? tab.color : undefined }}
                  >
                    <Icon size={15} style={{ color: tab.color }} />
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

          {/* Device Chassis Frame */}
          <div className="relative rounded-[24px] sm:rounded-[32px] bg-[#0A0A0C] p-2.5 sm:p-5 border-2 border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.95)] transition-all">
            {/* Top Desktop Browser Bar */}
            {deviceMode === 'desktop' && (
              <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-t-[20px] bg-[#141418] border-b border-white/10 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
                  <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                  <span className="w-3 h-3 rounded-full bg-[#10B981]" />
                </div>

                <div className="flex items-center gap-2 px-5 py-1 rounded-xl bg-[#000000] border border-white/15 text-xs font-mono text-white/90">
                  <Lock size={12} className="text-[#10B981]" />
                  <span className="font-bold text-white">kylrix.space</span>
                  <span className="text-white/40">/</span>
                  <span className="text-[#818CF8]">app</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-white/60">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                  <span className="hidden sm:inline">Workspace Active</span>
                </div>
              </div>
            )}

            {/* Mobile Notch Bar */}
            {deviceMode === 'mobile' && (
              <div className="flex items-center justify-between px-4 py-2 rounded-t-[20px] bg-[#141418] border-b border-white/10 mb-3 text-xs text-white/70 font-mono">
                <span>9:41</span>
                <div className="w-16 h-3 rounded-full bg-black border border-white/20" />
                <span>100%</span>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                1:1 MOCKUP 1: SMART ASSISTANT (KYLIE)
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'agents' && (
              <div
                className={`relative bg-[#161412] rounded-2xl overflow-hidden border border-white/15 min-h-[480px] flex ${
                  deviceMode === 'desktop' ? 'flex-row' : 'flex-col'
                }`}
              >
                {/* Workspace Main Canvas (Left in Desktop, Top in Mobile) */}
                <div className="flex-1 p-4 sm:p-6 bg-[#000000] flex flex-col justify-between border-r border-white/10">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#EC4899]/20 border border-[#EC4899]/40 flex items-center justify-center text-[#EC4899]">
                          <FileText size={16} />
                        </div>
                        <div>
                          <h4 className="font-clash font-bold text-sm text-white">#Q3-Milestones</h4>
                          <p className="text-[11px] text-white/50">Auto-generated by Kylie Smart Assistant</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#10B981]/20 text-[#10B981] text-[10px] font-mono font-bold">
                        Encrypted & Saved
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 space-y-3">
                      <h5 className="font-bold text-xs text-white uppercase tracking-wider text-[#818CF8]">
                        Workspace Summary
                      </h5>
                      <ul className="space-y-2 text-xs text-white/80 leading-relaxed">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-[#10B981] shrink-0 mt-0.5" />
                          <span>Offline sync engine initialized with 100% document cache.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-[#10B981] shrink-0 mt-0.5" />
                          <span>Vault credentials backed up locally with AES-256 encryption.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 size={14} className="text-[#10B981] shrink-0 mt-0.5" />
                          <span>Team direct message channel configured & ready.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/50 font-mono">
                    <span>Status: Autonomic Sync Active</span>
                    <span className="text-[#818CF8]">1:1 Agentic Session</span>
                  </div>
                </div>

                {/* 1:1 KYLIE SIDEBAR (Desktop) OR FLOATING BOTTOM DRAWER (Mobile) */}
                <div
                  className={`${
                    deviceMode === 'desktop'
                      ? 'w-[360px] border-l border-white/20'
                      : 'w-full border-t-2 border-white/20 mt-2'
                  } bg-[#161412] flex flex-col justify-between`}
                >
                  {/* Sticky Kylie Header (Exact match to AgenticPanelContent) */}
                  <div className="px-4 py-3 border-b border-white/20 bg-[#0E0D0C] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center font-clash font-black text-sm">
                        K
                      </div>
                      <div>
                        <h4 className="text-white font-extrabold text-sm font-clash leading-tight">Kylie</h4>
                        <p className="text-[#9B9691] text-[10px] font-semibold">Smart Workspace Assistant</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-white/60">
                      <button type="button" className="p-1.5 rounded-lg bg-[#161412] border border-white/15">
                        <History size={14} />
                      </button>
                      <button type="button" className="p-1.5 rounded-lg bg-[#161412] border border-white/15">
                        <Download size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Chat Session Messages */}
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[300px]">
                    {agentMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center text-[10px] font-bold shrink-0 mt-1">
                            K
                          </div>
                        )}
                        <div
                          className={`max-w-[90%] rounded-2xl p-3 text-xs leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#1C1A18] border border-white/20 text-white'
                              : 'bg-[#000000] border border-white/20 text-white/95'
                          }`}
                        >
                          <p>{msg.content}</p>

                          {/* 1:1 Tool Execution Box */}
                          {msg.tools && (
                            <div className="mt-2.5 space-y-1.5">
                              {msg.tools.map((t, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl border border-white/20 bg-black/40 p-2 text-[10px]"
                                >
                                  <div className="flex items-center gap-1 font-bold uppercase tracking-wider text-[#9B9691]">
                                    <Zap size={10} className="text-[#818CF8]" />
                                    <span>Tool · {t.toolKey}</span>
                                    <span className="text-emerald-400 ml-auto">{t.status}</span>
                                  </div>
                                  <p className="text-[#9B9691] mt-1 text-[11px] font-semibold">
                                    {t.resultSummary}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 1:1 Next Step Action Pills */}
                          {msg.nextSteps && (
                            <div className="mt-2.5 space-y-1">
                              <span className="text-[9px] uppercase font-bold text-[#9B9691] tracking-wider">
                                Next with Kylie
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {msg.nextSteps.map((step, sIdx) => (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => runSimulatedAgentTask(step)}
                                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[10px] font-semibold text-white/90 cursor-pointer transition-all"
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
                      <div className="flex justify-start gap-2 items-center text-xs text-white/70">
                        <div className="w-6 h-6 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/50 text-[#818CF8] flex items-center justify-center text-[10px] font-bold">
                          K
                        </div>
                        <div className="p-2.5 rounded-2xl bg-[#000000] border border-white/20 flex items-center gap-2">
                          <RotateCw size={12} className="animate-spin text-[#818CF8]" />
                          <span>Kylie is on it…</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 1:1 OpenBricks 4.0 Pill Input Bar */}
                  <div className="p-3 border-t border-white/20 bg-[#0E0D0C]">
                    <div className="flex items-center gap-1 rounded-[22px] bg-[#000000] border-2 border-white/20 px-2 py-1.5">
                      <button
                        type="button"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10"
                      >
                        <Paperclip size={16} />
                      </button>
                      <input
                        type="text"
                        value={agentInput}
                        onChange={(e) => setAgentInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && runSimulatedAgentTask()}
                        placeholder="Ask Kylie to help you with anything…"
                        className="flex-1 bg-transparent border-none text-xs text-white placeholder:text-white/40 focus:outline-none px-1"
                      />
                      <button
                        type="button"
                        onClick={() => runSimulatedAgentTask()}
                        className="w-8 h-8 rounded-full bg-[#6366F1] text-white flex items-center justify-center hover:bg-[#5254E8] cursor-pointer"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                1:1 MOCKUP 2: NOTES & DOCUMENTS
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'notes' && (
              <div className="p-4 sm:p-6 bg-[#000000] rounded-2xl border border-white/15 min-h-[440px] space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-bold text-white/70">Workspace Notes & Documents</span>
                  <button type="button" className="text-xs font-bold text-[#EC4899] cursor-pointer">
                    + New Note
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Note Card 1 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold flex items-center gap-1">
                        <Tag size={10} />
                        Project Plan
                      </span>
                      <Pin size={12} className="text-[#EC4899] fill-[#EC4899]" />
                    </div>
                    <h4 className="font-bold text-sm text-white">Q3 Product Roadmap</h4>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Implement offline sync, fast search indexing, and collaborative workspace tagging.
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-white/40 pt-2 border-t border-white/10">
                      <span>2 attachments</span>
                      <span>Updated 5m ago</span>
                    </div>
                  </div>

                  {/* Note Card 2 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#818CF8]/20 text-[#818CF8] font-bold">
                        Meeting Notes
                      </span>
                      <span className="text-[10px] text-white/40">2h ago</span>
                    </div>
                    <h4 className="font-bold text-sm text-white">Design Sync & Layout</h4>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Streamline action buttons, refine dark theme card borders, and standardize UI.
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#818CF8] pt-2 border-t border-white/10">
                      <span>Shared with Team</span>
                      <ArrowUpRight size={13} />
                    </div>
                  </div>

                  {/* Note Card 3 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold flex items-center gap-1">
                        <Lock size={10} />
                        Encrypted
                      </span>
                      <span className="text-[10px] text-white/40">Yesterday</span>
                    </div>
                    <h4 className="font-bold text-sm text-white">Private Strategy Draft</h4>
                    <p className="text-xs text-white/70 leading-relaxed">
                      Encrypted content sealed locally with personal master key.
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-[#10B981] pt-2 border-t border-white/10 font-mono">
                      <span>AES-256</span>
                      <ShieldCheck size={13} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                1:1 MOCKUP 3: ENCRYPTED VAULT
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'vault' && (
              <div className="p-4 sm:p-6 bg-[#000000] rounded-2xl border border-white/15 min-h-[440px] space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-bold text-white/70">Encrypted Credentials & Keys</span>
                  <button
                    type="button"
                    onClick={() => setShowVaultSecret(!showVaultSecret)}
                    className="inline-flex items-center gap-1 text-xs text-[#10B981] font-bold cursor-pointer"
                  >
                    {showVaultSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{showVaultSecret ? 'Hide Secrets' : 'Reveal Secrets'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Vault Item 1 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Password</span>
                      <KeyRound size={14} className="text-[#10B981]" />
                    </div>
                    <h4 className="font-bold text-sm text-white">Production Database</h4>
                    <p className="text-xs font-mono text-white/80">
                      {showVaultSecret ? 'postgres://admin:sec3te#9@db' : '••••••••••••••••••••'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopy('postgres://admin:sec3te#9@db', 1)}
                      className="w-full flex items-center justify-between text-xs font-mono text-white/70 hover:text-white pt-2 border-t border-white/10 cursor-pointer"
                    >
                      <span>{copiedIndex === 1 ? 'Copied!' : 'Copy connection string'}</span>
                      {copiedIndex === 1 ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                    </button>
                  </div>

                  {/* Vault Item 2 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Authenticator</span>
                      <ShieldCheck size={14} className="text-[#10B981]" />
                    </div>
                    <h4 className="font-bold text-sm text-white">Account 2FA Code</h4>
                    <p className="text-xl font-mono font-bold text-white tracking-wider">
                      {showVaultSecret ? '849 201' : '••• •••'}
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-mono text-white/40 pt-2 border-t border-white/10">
                      <span>AES-256</span>
                      <span>Refreshes in 18s</span>
                    </div>
                  </div>

                  {/* Vault Item 3 */}
                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Identity Key</span>
                      <Lock size={14} className="text-[#10B981]" />
                    </div>
                    <h4 className="font-bold text-sm text-white">Security Key</h4>
                    <p className="text-xs font-mono text-white/80">
                      {showVaultSecret ? 'nsec1w9k2...88a' : 'nsec1••••••••••••'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopy('nsec1w9k288a', 3)}
                      className="w-full flex items-center justify-between text-xs font-mono text-white/70 hover:text-white pt-2 border-t border-white/10 cursor-pointer"
                    >
                      <span>{copiedIndex === 3 ? 'Copied!' : 'Copy key'}</span>
                      {copiedIndex === 3 ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                1:1 MOCKUP 4: TASKS & GOALS
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'goals' && (
              <div className="p-4 sm:p-6 bg-[#000000] rounded-2xl border border-white/15 min-h-[440px] space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span className="text-xs font-bold text-white/70">Active Tasks & Goals</span>
                  <span className="text-xs font-bold text-[#A855F7]">
                    {tasks.filter((t) => t.completed).length} of {tasks.length} Completed
                  </span>
                </div>

                <div className="space-y-2.5">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => toggleTask(task.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        task.completed
                          ? 'bg-[#141418]/60 border-white/10 opacity-70'
                          : 'bg-[#141418] border-white/20 hover:border-[#A855F7]/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {task.completed ? (
                          <CheckCircle2 size={18} className="text-[#A855F7] shrink-0" />
                        ) : (
                          <Circle size={18} className="text-white/40 shrink-0" />
                        )}
                        <span
                          className={`text-xs sm:text-sm font-medium ${
                            task.completed ? 'line-through text-white/50' : 'text-white'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                        {task.category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                1:1 MOCKUP 5: DIRECT MESSAGES
               ───────────────────────────────────────────────────────────── */}
            {activeTab === 'chat' && (
              <div className="p-4 sm:p-6 bg-[#000000] rounded-2xl border border-white/15 min-h-[440px] space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-[#3B82F6]" />
                    <span className="text-xs font-bold text-white">Direct Chat with Alex</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#3B82F6]">Private Channel</span>
                </div>

                <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between min-h-[300px]">
                  <div className="space-y-3 mb-4 overflow-y-auto max-h-[220px] pr-1">
                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex flex-col ${msg.isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`px-3.5 py-2 rounded-2xl text-xs max-w-[80%] ${
                            msg.isUser
                              ? 'bg-[#3B82F6] text-white rounded-br-xs'
                              : 'bg-[#222228] text-white/90 rounded-bl-xs border border-white/10'
                          }`}
                        >
                          {msg.text}
                        </div>
                        <span className="text-[10px] text-white/40 mt-1 px-1">{msg.time}</span>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 pt-3 border-t border-white/10">
                    <input
                      type="text"
                      value={newChatText}
                      onChange={(e) => setNewChatText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 rounded-xl bg-[#000000] border border-white/15 text-xs text-white focus:outline-none focus:border-[#3B82F6]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-[#3B82F6] text-white text-xs font-bold hover:bg-[#2563EB] cursor-pointer"
                    >
                      <Send size={13} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. FEATURE HIGHLIGHTS
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Designed for real work.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-white/80">
            Clean tools that help you focus and complete tasks faster.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#EC4899]/15 text-[#EC4899] flex items-center justify-center border border-[#EC4899]/30">
              <Zap size={20} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Instant Offline Access</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Create and edit notes offline. Your workspace saves instantly and syncs when online.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/30">
              <Lock size={20} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Private & Encrypted</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Store confidential notes and passwords safely. Your data is protected so only you can unlock it.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-[#6366F1]/15 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/30">
              <Bot size={20} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Smart Assistant</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Use built-in smart tools to summarize notes, organize tasks, and execute workspace actions.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. BOTTOM CALL TO ACTION
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
        <div className="p-8 sm:p-12 rounded-[32px] bg-[#141418] border-2 border-white/20 shadow-2xl relative overflow-hidden">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to organize your workspace?
          </h2>
          <p className="mt-3 text-base sm:text-lg text-white/80 max-w-lg mx-auto">
            Get started right now. Free to use anytime.
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
          5. FOOTER
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
