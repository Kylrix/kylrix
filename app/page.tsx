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
  CheckSquare,
  Clock,
  UserCheck,
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

  // Interactive Live Simulation States
  const [activeTab, setActiveTab] = useState<'notes' | 'goals' | 'vault' | 'agents' | 'chat'>('notes');
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Setup workspace & set up team permissions', completed: true, category: 'Setup' },
    { id: '2', title: 'Store private vault passwords & security keys', completed: false, category: 'Security' },
    { id: '3', title: 'Connect identity & direct message channel', completed: true, category: 'Messages' },
    { id: '4', title: 'Run smart assistant daily workspace summary', completed: false, category: 'Assistant' },
  ]);
  const [showVaultSecret, setShowVaultSecret] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([
    'Assistant ready • Waiting for instructions',
  ]);
  const [chatMessages, setChatMessages] = useState([
    { sender: 'Alex', text: 'Hey, did you review the project outline for this week?', time: '10:14 AM', isUser: false },
    { sender: 'You', text: 'Yes, just checked it! Added notes and pinned the key tasks.', time: '10:15 AM', isUser: true },
    { sender: 'Alex', text: 'Awesome! Everything looks clear and organized.', time: '10:16 AM', isUser: false },
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
    setTasks(prev =>
      prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const runSimulatedAgent = () => {
    if (agentRunning) return;
    setAgentRunning(true);
    setAgentLogs(['Starting task scan...']);

    setTimeout(() => {
      setAgentLogs(prev => [...prev, 'Checking active notes and goal list...']);
    }, 800);

    setTimeout(() => {
      setAgentLogs(prev => [...prev, 'Found 2 upcoming tasks. Creating summary note...']);
    }, 1600);

    setTimeout(() => {
      setAgentLogs(prev => [...prev, 'Done! Summary created and saved to Notes.']);
      setAgentRunning(false);
    }, 2400);
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
    setChatMessages(prev => [...prev, msg]);
    setNewChatText('');
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#6366F1]/30 selection:text-white font-sans overflow-x-hidden relative">
      {/* Background Claimer */}
      <ThreadNoteClaimer />

      {/* Spatial Soft Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#6366F1]/20 via-[#EC4899]/15 to-transparent blur-[140px]" />
        <div className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full bg-[#10B981]/15 blur-[150px]" />
        <div className="absolute top-[1500px] -right-40 h-[600px] w-[600px] rounded-full bg-[#A855F7]/15 blur-[150px]" />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION WITH SLANTED, FAINT OVERLAPPING MOCK SCREENS
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-20 lg:pb-28">

        {/* TWO OVERLAPPING SLANTED FAINT MOCK SCREENS IN BACKGROUND */}
        <div className="pointer-events-none absolute inset-x-0 top-6 sm:top-10 bottom-0 z-0 flex justify-center items-start overflow-hidden opacity-25 sm:opacity-30">
          <div className="relative w-full max-w-5xl h-[450px]">
            {/* Screen 1: Left Slanted Background Screen (Notes Card Visual) */}
            <div className="absolute top-4 left-2 sm:left-10 w-[78%] sm:w-[540px] rounded-3xl bg-[#141418] border border-white/20 p-4 shadow-2xl transform -rotate-6 -skew-y-2 blur-[1px]">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="h-3 w-32 rounded-full bg-white/15" />
              </div>
              <div className="space-y-2.5">
                <div className="h-14 rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="h-3 w-36 rounded bg-white/20" />
                    <div className="h-2 w-24 rounded bg-white/10" />
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#EC4899]/20 text-[10px] text-[#EC4899]">Idea</span>
                </div>
                <div className="h-14 rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="h-3 w-44 rounded bg-white/20" />
                    <div className="h-2 w-28 rounded bg-white/10" />
                  </div>
                  <span className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[10px] text-[#10B981]">Vault</span>
                </div>
              </div>
            </div>

            {/* Screen 2: Right Slanted Background Screen (Tasks & Chat Visual) */}
            <div className="absolute top-10 right-2 sm:right-10 w-[78%] sm:w-[540px] rounded-3xl bg-[#141418] border border-white/20 p-4 shadow-2xl transform rotate-6 skew-y-2 blur-[1px]">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="h-3 w-28 rounded-full bg-white/15" />
              </div>
              <div className="space-y-2.5">
                <div className="h-12 rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-[#A855F7]" />
                  <div className="h-3 w-40 rounded bg-white/20" />
                </div>
                <div className="h-12 rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border border-white/30" />
                  <div className="h-3 w-52 rounded bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* HERO CONTENT FRONT & CENTER */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/15 backdrop-blur-md mb-6"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Simple & Powerful Workspace
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="font-clash text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]"
          >
            Organize notes, goals, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#818CF8] via-[#EC4899] to-[#10B981] bg-clip-text text-transparent">
              and team chats in one place.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-6 text-base sm:text-xl text-white/80 max-w-2xl font-normal leading-relaxed"
          >
            Keep your thoughts clear, track daily tasks, save passwords safely, and chat directly with your team—all in one fast, private app.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 sm:px-8 sm:py-4 rounded-2xl bg-[#6366F1] text-white font-bold text-sm sm:text-base border border-[#818CF8]/50 shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:bg-[#5254E8] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Open Workspace' : 'Start Free Workspace'}</span>
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => openAgenticDrawer({ prompt: 'Show me around the workspace tools' })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 sm:px-7 sm:py-4 rounded-2xl bg-[#161412] text-white font-bold text-sm sm:text-base border border-white/20 hover:border-[#EC4899]/60 hover:bg-[#1C1A18] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Bot size={18} className="text-[#EC4899]" />
              <span>Try Smart Assistant</span>
            </button>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. INTERACTIVE DEMO SCREEN: Mirroring Actual Application UI
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-14 sm:mt-20 relative max-w-6xl mx-auto"
        >
          {/* Ambient Outer Glow */}
          <div className="absolute -inset-2 bg-gradient-to-r from-[#6366F1]/30 via-[#EC4899]/20 to-[#10B981]/30 rounded-[34px] blur-2xl opacity-70" />

          {/* Device Chassis Frame */}
          <div className="relative rounded-[24px] sm:rounded-[32px] bg-[#0A0A0C] p-2.5 sm:p-5 border-2 border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
            {/* Top Navigation Window Bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-t-[20px] bg-[#141418] border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span className="w-3 h-3 rounded-full bg-[#10B981]" />
              </div>

              {/* Address indicator */}
              <div className="hidden sm:flex items-center gap-2 px-5 py-1 rounded-xl bg-[#000000] border border-white/15 text-xs font-mono text-white/90">
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

            {/* Application Mock Body */}
            <div className="relative rounded-b-[20px] bg-[#000000] p-3 sm:p-6 min-h-[460px]">
              {/* Feature Tab Switches */}
              <div className="flex items-center gap-2 overflow-x-auto pb-3 border-b border-white/10 mb-5 scrollbar-none">
                {[
                  { id: 'notes', label: 'Notes & Documents', icon: FileText, color: '#EC4899' },
                  { id: 'goals', label: 'Tasks & Goals', icon: Target, color: '#A855F7' },
                  { id: 'vault', label: 'Encrypted Vault', icon: Lock, color: '#10B981' },
                  { id: 'chat', label: 'Direct Messages', icon: MessageSquare, color: '#3B82F6' },
                  { id: 'agents', label: 'Smart Assistant', icon: Bot, color: '#6366F1' },
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
                          ? 'bg-[#18181C] text-white border-2'
                          : 'bg-transparent text-white/70 border border-white/10 hover:border-white/30 hover:text-white'
                      }`}
                      style={{ borderColor: isActive ? tab.color : undefined }}
                    >
                      <Icon size={16} style={{ color: tab.color }} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: MOCK NOTES SCREEN (Mirroring ObjectCard & NoteCard) */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Recent Notes</span>
                    <span className="text-[#EC4899] font-bold cursor-pointer">+ New Note</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Note Card 1 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all flex flex-col justify-between min-h-[170px]">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold flex items-center gap-1">
                            <Tag size={10} />
                            Project Plan
                          </span>
                          <Pin size={12} className="text-[#EC4899] fill-[#EC4899]" />
                        </div>
                        <h4 className="font-bold text-sm text-white">Q3 Product Goals</h4>
                        <p className="text-xs text-white/70 mt-1.5 leading-relaxed line-clamp-3">
                          Implement offline sync, quick note search, and collaborative tags for team projects.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/50 pt-3 border-t border-white/10 mt-3">
                        <span className="flex items-center gap-1">
                          <Paperclip size={11} /> 2 files
                        </span>
                        <span>Updated 5m ago</span>
                      </div>
                    </div>

                    {/* Note Card 2 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all flex flex-col justify-between min-h-[170px]">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#818CF8]/20 text-[#818CF8] font-bold">
                            Meeting Notes
                          </span>
                          <span className="text-[10px] text-white/40">2h ago</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">Design & UX Sync</h4>
                        <p className="text-xs text-white/70 mt-1.5 leading-relaxed line-clamp-3">
                          Streamline layout buttons, ensure clean typography, and refine dark theme card borders.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-white/50 pt-3 border-t border-white/10 mt-3">
                        <span>Shared with Team</span>
                        <ArrowUpRight size={13} className="text-[#818CF8]" />
                      </div>
                    </div>

                    {/* Note Card 3 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all flex flex-col justify-between min-h-[170px]">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold flex items-center gap-1">
                            <Lock size={10} />
                            Protected
                          </span>
                          <span className="text-[10px] text-white/40">Yesterday</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">Private Draft</h4>
                        <p className="text-xs text-white/70 mt-1.5 leading-relaxed line-clamp-3">
                          Encrypted content sealed locally with personal master key.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#10B981] pt-3 border-t border-white/10 mt-3 font-mono">
                        <span>Encrypted</span>
                        <ShieldCheck size={13} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MOCK TASKS SCREEN (Mirroring GoalObjectRow & TaskList) */}
              {activeTab === 'goals' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Active Tasks & Priorities</span>
                    <span className="text-[#A855F7] font-bold">
                      {tasks.filter(t => t.completed).length} of {tasks.length} Completed
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {tasks.map(task => (
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
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                            {task.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: MOCK VAULT SCREEN (Mirroring Encrypted Vault UI) */}
              {activeTab === 'vault' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Encrypted Credentials & Keys</span>
                    <button
                      type="button"
                      onClick={() => setShowVaultSecret(!showVaultSecret)}
                      className="inline-flex items-center gap-1.5 text-xs text-[#10B981] font-bold cursor-pointer"
                    >
                      {showVaultSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showVaultSecret ? 'Hide Secrets' : 'Reveal Secrets'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Vault Item 1 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between min-h-[160px]">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Password</span>
                          <KeyRound size={14} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-sm text-white">Database Access</h4>
                        <p className="text-xs font-mono text-white/70 mt-2">
                          {showVaultSecret ? 'postgres://user:sec3te#9@db' : '••••••••••••••••••••'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy('postgres://user:sec3te#9@db', 1)}
                        className="flex items-center justify-between text-xs font-mono text-white/70 hover:text-white pt-2 border-t border-white/10 cursor-pointer"
                      >
                        <span>{copiedIndex === 1 ? 'Copied!' : 'Copy connection string'}</span>
                        {copiedIndex === 1 ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                      </button>
                    </div>

                    {/* Vault Item 2 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between min-h-[160px]">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Authenticator</span>
                          <ShieldCheck size={14} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-sm text-white">Account 2FA Code</h4>
                        <p className="text-xl font-mono font-bold text-white mt-1.5 tracking-wider">
                          {showVaultSecret ? '639 104' : '••• •••'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-white/50 pt-2 border-t border-white/10">
                        <span>AES-256</span>
                        <span>Refreshes in 18s</span>
                      </div>
                    </div>

                    {/* Vault Item 3 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between min-h-[160px]">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-[#10B981] font-bold uppercase">Identity Key</span>
                          <Lock size={14} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-sm text-white">Private Security Key</h4>
                        <p className="text-xs font-mono text-white/70 mt-2">
                          {showVaultSecret ? 'nsec1w9k2...88a' : 'nsec1••••••••••••'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy('nsec1w9k288a', 3)}
                        className="flex items-center justify-between text-xs font-mono text-white/70 hover:text-white pt-2 border-t border-white/10 cursor-pointer"
                      >
                        <span>{copiedIndex === 3 ? 'Copied!' : 'Copy key'}</span>
                        {copiedIndex === 3 ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: MOCK DIRECT MESSAGES SCREEN (Mirroring ChatWindow & Hangouts) */}
              {activeTab === 'chat' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span className="flex items-center gap-1.5 text-white font-bold">
                      <UserCheck size={14} className="text-[#3B82F6]" />
                      Direct Chat with Alex
                    </span>
                    <span className="text-[11px] text-[#3B82F6] font-mono">Private Channel</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between min-h-[220px]">
                    <div className="space-y-3 mb-4 max-h-[160px] overflow-y-auto pr-1">
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
                        onChange={e => setNewChatText(e.target.value)}
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

              {/* TAB 5: MOCK AI ASSISTANT SCREEN */}
              {activeTab === 'agents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span className="flex items-center gap-1.5 text-white font-bold">
                      <Sparkles size={14} className="text-[#6366F1]" />
                      Smart Workspace Assistant
                    </span>
                    <button
                      type="button"
                      onClick={runSimulatedAgent}
                      disabled={agentRunning}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6366F1] text-white text-xs font-bold cursor-pointer hover:bg-[#5254E8] disabled:opacity-50 transition-all"
                    >
                      {agentRunning ? <RotateCw size={13} className="animate-spin" /> : <Play size={13} />}
                      <span>{agentRunning ? 'Running Action...' : 'Run Quick Summary'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 font-mono text-xs space-y-2.5 min-h-[180px]">
                    {agentLogs.map((log, i) => (
                      <div key={i} className="flex items-center gap-2 text-white/80">
                        <span className="text-[#818CF8]">&gt;</span>
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. SIMPLE & PROFESSIONAL FEATURE HIGHLIGHTS
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Designed for real work.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/80">
            Clean tools that help you focus and finish tasks faster.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EC4899]/15 text-[#EC4899] flex items-center justify-center border border-[#EC4899]/30">
              <Zap size={22} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Instant Offline Access</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Create and edit notes even without internet. Your workspace saves instantly and syncs when online.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/30">
              <Lock size={22} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Private & Encrypted</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Store confidential notes and passwords safely. Your data is protected so only you can unlock it.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/15 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/30">
              <Bot size={22} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Smart Assistant</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Use built-in smart tools to summarize notes, organize task lists, and answer workspace questions.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. BOTTOM CALL TO ACTION
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <div className="p-8 sm:p-14 rounded-[32px] sm:rounded-[36px] bg-[#141418] border-2 border-white/20 shadow-2xl relative overflow-hidden">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to organize your workspace?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/80 max-w-lg mx-auto">
            Get started right now. Free to use anytime.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto px-4 sm:px-0">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto px-5 py-3.5 sm:px-8 sm:py-4 rounded-2xl bg-[#6366F1] text-white font-bold text-sm sm:text-base border border-[#818CF8]/50 shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:bg-[#5254E8] hover:scale-105 transition-all cursor-pointer"
            >
              {isAuthenticated ? 'Open App Workspace' : 'Get Started Free'}
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. FOOTER
         ───────────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/10 py-10 px-4">
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
