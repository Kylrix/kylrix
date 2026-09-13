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
  const [activeTab, setActiveTab] = useState<'notes' | 'goals' | 'vault' | 'agents'>('notes');
  const [tasks, setTasks] = useState([
    { id: '1', title: 'Launch workspace & configure agent tools', completed: true, category: 'Setup' },
    { id: '2', title: 'Encrypt personal vault credentials', completed: false, category: 'Security' },
    { id: '3', title: 'Connect Nostr identity & P2P relay', completed: true, category: 'Network' },
    { id: '4', title: 'Schedule autonomous agent daily summary', completed: false, category: 'Agents' },
  ]);
  const [showVaultSecret, setShowVaultSecret] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([
    'Agent initialized • Ready for tasks',
  ]);

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
    setAgentLogs(['Initializing autonomous task solver...']);

    setTimeout(() => {
      setAgentLogs(prev => [...prev, 'Scanning workspace notes & task dependencies...']);
    }, 800);

    setTimeout(() => {
      setAgentLogs(prev => [...prev, 'Extracted 3 pending action items. Synthesizing briefing...']);
    }, 1600);

    setTimeout(() => {
      setAgentLogs(prev => [...prev, '✔ Briefing generated! Saved to Notes.']);
      setAgentRunning(false);
    }, 2400);
  };

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#6366F1]/30 selection:text-white font-sans overflow-x-hidden relative">
      {/* Background Claimer */}
      <ThreadNoteClaimer />

      {/* Spatial Ambient Glows */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-50">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#6366F1]/20 via-[#EC4899]/15 to-transparent blur-[140px]" />
        <div className="absolute top-[800px] -left-40 h-[600px] w-[600px] rounded-full bg-[#10B981]/15 blur-[150px]" />
        <div className="absolute top-[1500px] -right-40 h-[600px] w-[600px] rounded-full bg-[#A855F7]/15 blur-[150px]" />
      </div>


      {/* ─────────────────────────────────────────────────────────────
          1. HERO SECTION WITH INTEGRATED FAINT DEVICE BACKDROP
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-20 lg:pb-28">

        {/* FAINT SCREEN GRAPHICS BACKGROUND LAYER (Elevated underneath text without obstructing) */}
        <div className="pointer-events-none absolute inset-x-0 top-12 sm:top-16 bottom-0 z-0 opacity-15 sm:opacity-20 flex justify-center overflow-hidden">
          <div className="w-full max-w-5xl transform -rotate-1 scale-95 sm:scale-100">
            {/* Faint Desktop Chassis Visual */}
            <div className="rounded-[32px] bg-[#161412] p-4 border border-white/20 shadow-2xl">
              <div className="flex items-center gap-2 pb-3 border-b border-white/10 mb-4">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                <div className="ml-4 h-4 w-48 rounded-full bg-white/10" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="h-32 rounded-xl bg-white/5 border border-white/10" />
                <div className="h-32 rounded-xl bg-white/5 border border-white/10" />
                <div className="h-32 rounded-xl bg-white/5 border border-white/10" />
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
              Next-Gen Intelligent Workspace
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="font-clash text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.08]"
          >
            Think faster. Work freely. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#818CF8] via-[#EC4899] to-[#10B981] bg-clip-text text-transparent">
              Own your workspace.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-6 text-lg sm:text-xl text-white/80 max-w-2xl font-normal leading-relaxed"
          >
            Notes, tasks, live goals, encrypted vault, and autonomous background AI agents—unified into one clean, lightning-fast app.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4 w-full sm:w-auto"
          >
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-[#6366F1] text-white font-bold text-base border border-[#818CF8]/50 shadow-[0_0_35px_rgba(99,102,241,0.4)] hover:bg-[#5254E8] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>{isAuthenticated ? 'Enter Workspace' : 'Launch Workspace Free'}</span>
              <ChevronRight size={18} strokeWidth={2.5} />
            </button>

            <button
              type="button"
              onClick={() => openAgenticDrawer({ prompt: 'Demonstrate system capabilities and workspace status' })}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-[#161412] text-white font-bold text-base border border-white/20 hover:border-[#EC4899]/60 hover:bg-[#1C1A18] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Bot size={20} className="text-[#EC4899]" />
              <span>Ask System Agent</span>
            </button>
          </motion.div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            2. REAL SIMULATION DEMO: Interactive Device Chassis
           ───────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-14 sm:mt-20 relative max-w-6xl mx-auto"
        >
          {/* Ambient Glow */}
          <div className="absolute -inset-2 bg-gradient-to-r from-[#6366F1]/30 via-[#EC4899]/20 to-[#10B981]/30 rounded-[38px] blur-2xl opacity-70" />

          {/* Realistic Desktop Chassis Window */}
          <div className="relative rounded-[28px] sm:rounded-[36px] bg-[#0A0A0C] p-3 sm:p-5 border-2 border-white/20 shadow-[0_30px_90px_rgba(0,0,0,0.95)]">
            {/* Header Controls Bar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 rounded-t-[22px] bg-[#141418] border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span className="w-3 h-3 rounded-full bg-[#10B981]" />
              </div>

              {/* Address Bar */}
              <div className="hidden sm:flex items-center gap-2 px-5 py-1 rounded-xl bg-[#000000] border border-white/15 text-xs font-mono text-white/90">
                <Lock size={12} className="text-[#10B981]" />
                <span className="font-bold text-white">kylrix.space</span>
                <span className="text-white/40">/</span>
                <span className="text-[#818CF8]">workspace</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-white/50">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                <span className="hidden sm:inline">Live Engine</span>
              </div>
            </div>

            {/* Interactive Workspace Screen Simulation */}
            <div className="relative rounded-b-[22px] bg-[#000000] p-4 sm:p-7 min-h-[480px]">
              {/* Tab Selector Buttons */}
              <div className="flex items-center gap-2 overflow-x-auto pb-4 border-b border-white/10 mb-6 scrollbar-none">
                {[
                  { id: 'notes', label: 'Ideas & Notes', icon: FileText, color: '#EC4899' },
                  { id: 'goals', label: 'Tasks & Goals', icon: Target, color: '#A855F7' },
                  { id: 'vault', label: 'Encrypted Vault', icon: Lock, color: '#10B981' },
                  { id: 'agents', label: 'AI Agent Runtime', icon: Bot, color: '#6366F1' },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shrink-0 cursor-pointer ${
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

              {/* SIMULATION PANEL 1: NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/60">Interactive Note Card Simulation</span>
                    <span className="text-xs font-mono text-[#EC4899] font-bold">+ New Note</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all flex flex-col justify-between h-44">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EC4899]/20 text-[#EC4899] font-bold">
                            Markdown Note
                          </span>
                          <span className="text-[10px] text-white/50">Just now</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">Product Roadmap 2025</h4>
                        <p className="text-xs text-white/70 mt-1 line-clamp-2">
                          Offline synchronization layer and local database replication. Instant search.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#EC4899] pt-2 border-t border-white/10">
                        <span>/notes/roadmap</span>
                        <ArrowUpRight size={14} />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all flex flex-col justify-between h-44">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#6366F1]/20 text-[#818CF8] font-bold">
                            E2EE Document
                          </span>
                          <span className="text-[10px] text-white/50">2h ago</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">System Architecture Notes</h4>
                        <p className="text-xs text-white/70 mt-1 line-clamp-2">
                          Zero-knowledge client-side encryption primitives. Argon2id key derivation.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#818CF8] pt-2 border-t border-white/10">
                        <span>/notes/architecture</span>
                        <ArrowUpRight size={14} />
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 hover:border-[#EC4899]/60 transition-all flex flex-col justify-between h-44">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                            Public Share
                          </span>
                          <span className="text-[10px] text-white/50">Yesterday</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">API Integration Contract</h4>
                        <p className="text-xs text-white/70 mt-1 line-clamp-2">
                          WebMCP tool registration endpoints and HTTP REST handlers.
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#10B981] pt-2 border-t border-white/10">
                        <span>/share/api-contract</span>
                        <ArrowUpRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SIMULATION PANEL 2: TASKS & GOALS */}
              {activeTab === 'goals' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/60">Live Interactive Task List (Click to toggle)</span>
                    <span className="text-xs font-mono text-[#A855F7] font-bold">
                      {tasks.filter(t => t.completed).length}/{tasks.length} Completed
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          task.completed
                            ? 'bg-[#141418]/60 border-white/10 opacity-75'
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
                            className={`text-sm font-medium ${
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

              {/* SIMULATION PANEL 3: ENCRYPTED VAULT */}
              {activeTab === 'vault' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/60">Zero-Knowledge Encrypted Vault</span>
                    <button
                      type="button"
                      onClick={() => setShowVaultSecret(!showVaultSecret)}
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-[#10B981] font-bold cursor-pointer"
                    >
                      {showVaultSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                      <span>{showVaultSecret ? 'Hide Secrets' : 'Reveal Secrets'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Item 1 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between h-40">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-[#10B981] uppercase font-bold">Password</span>
                          <KeyRound size={14} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-sm text-white">Production DB Credentials</h4>
                        <p className="text-xs font-mono text-white/60 mt-2">
                          {showVaultSecret ? 'postgres://admin:x9kL#29mP@prod' : '••••••••••••••••••••'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy('postgres://admin:x9kL#29mP@prod', 1)}
                        className="flex items-center justify-between text-xs font-mono text-white/70 hover:text-white pt-2 border-t border-white/10 cursor-pointer"
                      >
                        <span>{copiedIndex === 1 ? 'Copied to clipboard!' : 'Copy connection string'}</span>
                        {copiedIndex === 1 ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                      </button>
                    </div>

                    {/* Item 2 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between h-40">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-[#10B981] uppercase font-bold">2FA Authenticator</span>
                          <ShieldCheck size={14} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-sm text-white">AWS Infrastructure TOTP</h4>
                        <p className="text-xl font-mono font-bold text-white mt-1 tracking-wider">
                          {showVaultSecret ? '849 201' : '••• •••'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-white/50 pt-2 border-t border-white/10">
                        <span>AES-GCM-256</span>
                        <span>Refreshes in 12s</span>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 flex flex-col justify-between h-40">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-[#10B981] uppercase font-bold">Nostr Key</span>
                          <Lock size={14} className="text-[#10B981]" />
                        </div>
                        <h4 className="font-bold text-sm text-white">P2P Private Key (nsec)</h4>
                        <p className="text-xs font-mono text-white/60 mt-2">
                          {showVaultSecret ? 'nsec1k8m2...91x0a' : 'nsec1••••••••••••'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy('nsec1k8m291x0a', 3)}
                        className="flex items-center justify-between text-xs font-mono text-white/70 hover:text-white pt-2 border-t border-white/10 cursor-pointer"
                      >
                        <span>{copiedIndex === 3 ? 'Copied key!' : 'Copy private key'}</span>
                        {copiedIndex === 3 ? <Check size={13} className="text-[#10B981]" /> : <Copy size={13} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SIMULATION PANEL 4: AI AGENT RUNTIME */}
              {activeTab === 'agents' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/60">Autonomous Agent Simulation</span>
                    <button
                      type="button"
                      onClick={runSimulatedAgent}
                      disabled={agentRunning}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#6366F1] text-white text-xs font-bold cursor-pointer hover:bg-[#5254E8] disabled:opacity-50 transition-all"
                    >
                      {agentRunning ? <RotateCw size={13} className="animate-spin" /> : <Play size={13} />}
                      <span>{agentRunning ? 'Running Agent...' : 'Run Simulation'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#141418] border border-white/15 font-mono text-xs space-y-2 min-h-[160px]">
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
          3. REFINED FEATURE SHOWCASE: Pure Visuals & Real Simulation
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-white/10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Designed for real productivity.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/80">
            No endless setup menus. Powerful capabilities right out of the box.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#EC4899]/15 text-[#EC4899] flex items-center justify-center border border-[#EC4899]/30">
              <Zap size={22} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Instant Offline Engine</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Type instantly without waiting on network connections. Data syncs seamlessly in the background.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center border border-[#10B981]/30">
              <Lock size={22} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Client-Side Encryption</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Your sensitive credentials and notes remain locked with master keys only your client holds.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-3xl bg-[#141418] border border-white/15 hover:border-white/40 transition-all space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#6366F1]/15 text-[#818CF8] flex items-center justify-center border border-[#6366F1]/30">
              <Bot size={22} />
            </div>
            <h3 className="font-clash text-xl font-bold text-white">Autonomous Agents</h3>
            <p className="text-sm text-white/70 leading-relaxed">
              Let background AI agents execute tools, summarize tasks, and manage workflows directly inside your workspace.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. BOTTOM CTA BLOCK
         ───────────────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <div className="p-8 sm:p-14 rounded-[36px] bg-[#141418] border-2 border-white/20 shadow-2xl relative overflow-hidden">
          <h2 className="font-clash text-3xl sm:text-5xl font-black text-white tracking-tight">
            Ready to experience your workspace?
          </h2>
          <p className="mt-4 text-base sm:text-lg text-white/80 max-w-lg mx-auto">
            Get started immediately. Free to launch anytime.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="px-8 py-4 rounded-2xl bg-[#6366F1] text-white font-bold text-base border border-[#818CF8]/50 shadow-[0_0_30px_rgba(99,102,241,0.5)] hover:bg-[#5254E8] hover:scale-105 transition-all cursor-pointer"
            >
              {isAuthenticated ? 'Open App Workspace' : 'Get Started Free'}
            </button>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. CLEAN MODERN FOOTER
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
