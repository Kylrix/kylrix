'use client';

import React, { useState } from 'react';
import { 
  GitFork, 
  Plus, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  Store, 
  Cpu, 
  Sliders, 
  Download, 
  Star,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface WorkflowPlugin {
  id: string;
  name: string;
  description: string;
  category: 'System' | 'Automation' | 'Modifier' | 'Synergy';
  author: string;
  version: string;
  isPaid: boolean;
  price?: string;
  enabled: boolean;
  stars: number;
}

const SYSTEM_WORKFLOWS: WorkflowPlugin[] = [
  {
    id: 'wf_auto_sweep',
    name: 'Auto-Sweep Tag Modifier',
    description: 'Automatically aggregates tagged ecosystem items across Notes, Vault, and Connect into dedicated project threads.',
    category: 'System',
    author: 'Kylrix Core',
    version: 'v2.4.0',
    isPaid: false,
    enabled: true,
    stars: 498,
  },
  {
    id: 'wf_decrypt_guard',
    name: 'Masterpass Sudo Shield',
    description: 'Enforces high-entropy memory locks on client-side encrypted payload reads and key derivations.',
    category: 'System',
    author: 'Kylrix Core',
    version: 'v3.1.0',
    isPaid: false,
    enabled: true,
    stars: 842,
  },
  {
    id: 'wf_ghost_relay',
    name: 'Ghost Note Polymorphic Dispatcher',
    description: 'Streams unpersisted local thread comments directly to ephemeral peer channels without database overhead.',
    category: 'Automation',
    author: 'Kylrix Core',
    version: 'v1.8.2',
    isPaid: false,
    enabled: false,
    stars: 312,
  },
  {
    id: 'wf_telegram_bridge',
    name: 'Telegram Realtime Push Bridge',
    description: 'Routes urgent activity triggers and security notifications directly to registered Telegram bots.',
    category: 'Modifier',
    author: 'Kylrix Core',
    version: 'v2.0.1',
    isPaid: true,
    price: '$4.99/mo',
    enabled: false,
    stars: 620,
  },
];

export default function WorkflowsDashboardPage() {
  const [plugins, setPlugins] = useState<WorkflowPlugin[]>(SYSTEM_WORKFLOWS);
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');

  const togglePlugin = (id: string) => {
    setPlugins(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  return (
    <div className="min-h-screen bg-[#0A0908] text-white/90 font-satoshi relative overflow-x-hidden pt-4 md:pt-8 px-4 md:px-6 pb-24">
      {/* Spotlight ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[280px] bg-gradient-to-b from-[#6366F1]/[0.08] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 bg-white/[0.01] border border-white/8 rounded-[32px] shadow-2xl relative mb-8">
          <div className="absolute top-[-1px] left-[10%] right-[10%] h-[1px] bg-gradient-to-r from-transparent via-[#6366F1] to-transparent" />
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center text-[#818CF8]">
              <GitFork size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight font-mono">
                  Workflows & Plugins
                </h1>
                <span className="bg-[#6366F1]/10 text-[#818CF8] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-[#6366F1]/20">
                  MODIFIERS
                </span>
              </div>
              <p className="text-white/40 text-xs font-semibold leading-normal font-sans mt-0.5">
                Extend, automate, and compose functional hooks across your entire Kylrix workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button className="h-10 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_16px_rgba(99,102,241,0.3)]">
              <Plus size={16} />
              <span>Create Workflow</span>
            </button>
          </div>
        </header>

        {/* Tab switcher */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/5 rounded-2xl w-fit select-none">
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === 'installed'
                  ? 'bg-[#6366F1] text-white shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Cpu size={15} />
              <span>Active Engines ({plugins.filter(p => p.enabled).length})</span>
            </button>
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === 'marketplace'
                  ? 'bg-[#6366F1] text-white shadow-[0_4px_12px_rgba(99,102,241,0.25)]'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
            >
              <Store size={15} />
              <span>Marketplace</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-white/30 text-xs font-mono">
            <ShieldCheck size={14} className="text-[#10B981]" />
            <span>Isolated Execution Sandbox</span>
          </div>
        </div>

        {/* Plugins Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plugins
            .filter(p => activeTab === 'marketplace' || p.enabled)
            .map((plugin) => (
              <div
                key={plugin.id}
                className="p-6 rounded-[32px] bg-[#161412] border border-white/5 hover:border-white/10 transition-all duration-300 flex flex-col justify-between min-h-[220px] relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#818CF8]">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h3 className="text-white text-base font-black tracking-tight font-mono leading-tight">
                          {plugin.name}
                        </h3>
                        <span className="text-[10px] text-white/40 font-bold font-mono">
                          {plugin.author} • {plugin.version}
                        </span>
                      </div>
                    </div>

                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/60">
                      {plugin.category}
                    </span>
                  </div>

                  <p className="text-xs text-white/60 leading-relaxed font-medium mb-4">
                    {plugin.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 font-mono">
                      <Star size={13} className="fill-amber-400" />
                      <span>{plugin.stars}</span>
                    </div>
                    {plugin.isPaid && (
                      <span className="text-[10px] font-extrabold text-[#EC4899] bg-[#EC4899]/10 px-2 py-0.5 rounded border border-[#EC4899]/20 font-mono">
                        {plugin.price}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => togglePlugin(plugin.id)}
                    className={`h-9 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      plugin.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                        : 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {plugin.enabled ? 'Enabled' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
