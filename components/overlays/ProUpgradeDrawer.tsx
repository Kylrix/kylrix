'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {
  Sparkles,
  ArrowRight,
  Check,
  X,
  Bot,
  HardDrive,
  Users,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const FEATURE_CONTEXT_HIGHLIGHTS: Record<string, { desc: string; fix: string }> = {
  'Voice recording': {
    desc: 'Voice notes and attachments are part of Pro capabilities.',
    fix: 'Upgrade to Pro to capture, attach, and stream voice updates seamlessly.',
  },
  'Discussions': {
    desc: 'Real-time collaborative discussions require an active Pro workspace.',
    fix: 'Upgrade to Pro to participate and spin discussions on any object.',
  },
  'New Project': {
    desc: 'You have hit the free workspace limit.',
    fix: 'Upgrade to Pro for unlimited workspaces and projects.',
  },
  'New Channel': {
    desc: 'Shared group communication channels are part of Pro & Teams.',
    fix: 'Upgrade to create unlimited shared and dedicated channels.',
  },
  'Collaborators': {
    desc: 'Multi-member real-time collaboration requires a Pro subscription.',
    fix: 'Upgrade to Pro to invite unlimited collaborators across your workspace.',
  },
  'Project Collaboration': {
    desc: 'Direct project-level invitations and shared scopes are enabled on paid tiers.',
    fix: 'Upgrade to Pro to co-author and share full project workspaces.',
  },
  'Pinned Notes': {
    desc: 'Free tier limits the number of pinned items.',
    fix: 'Upgrade to Pro to pin unlimited notes, goals, forms, and tools to the top.',
  },
  'Article Mode': {
    desc: 'Long-form article formatting and rich publishing require Pro.',
    fix: 'Upgrade to Pro for article publishing and extended note layouts.',
  },
  'Kylie Assist': {
    desc: 'Autonomous agent partners and custom AI compute require Pro.',
    fix: 'Upgrade to Pro to unlock Kylie and unmetered custom agent personas.',
  },
};

const PLAN_BENEFIT_GROUPS = [
  {
    title: 'Autonomous AI Agents',
    icon: Bot,
    color: 'text-[#6366F1]',
    bg: 'bg-[#6366F1]/10',
    border: 'border-[#6366F1]/20',
    free: 'Basic system guidance',
    pro: 'Unlimited AI agents (Kylie & custom personas), background tool calling & daily compute',
  },
  {
    title: 'Storage & File Uploads',
    icon: HardDrive,
    color: 'text-[#10B981]',
    bg: 'bg-[#10B981]/10',
    border: 'border-[#10B981]/20',
    free: 'Standard media view',
    pro: 'Unlimited images/storage and file uploads, voice notes & attachment archives',
  },
  {
    title: 'Workspaces & Collaboration',
    icon: Users,
    color: 'text-[#F59E0B]',
    bg: 'bg-[#F59E0B]/10',
    border: 'border-[#F59E0B]/20',
    free: 'Personal private workspace',
    pro: 'Unlimited projects, workspaces, team collaborators & real-time discussions',
  },
  {
    title: 'Objects, Tools & Pins',
    icon: Layers,
    color: 'text-[#EC4899]',
    bg: 'bg-[#EC4899]/10',
    border: 'border-[#EC4899]/20',
    free: 'Standard creation limits',
    pro: 'Unlimited pinned items, forms, goals, automations & developer PATs',
  },
  {
    title: 'Privacy & Cryptographic Vault',
    icon: Shield,
    color: 'text-[#38BDF8]',
    bg: 'bg-[#38BDF8]/10',
    border: 'border-[#38BDF8]/20',
    free: 'Local-first offline copy',
    pro: 'Zero-knowledge T5 Argon2id vault, passkey biometric sync & P2P WebRTC calls',
  },
];

export function ProUpgradeDrawer() {
  const router = useRouter();
  const { showProUpgrade, closeProUpgrade, feature } = useProUpgrade();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!showProUpgrade) setIsExpanded(false);
  }, [showProUpgrade]);

  useEffect(() => {
    if (showProUpgrade) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showProUpgrade]);

  if (!showProUpgrade) return null;

  const highlight = feature ? FEATURE_CONTEXT_HIGHLIGHTS[feature] : null;

  const handleGoPricing = () => {
    closeProUpgrade();
    router.push('/pricing');
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[99998] transition-opacity duration-300 pointer-events-auto"
        onClick={closeProUpgrade}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        className={`fixed z-[99999] pointer-events-auto flex flex-col bg-[#161412] border border-white/10 shadow-2xl transition-all duration-300 ${
          isExpanded
            ? 'inset-0 h-[100dvh] max-h-[100dvh] w-full rounded-none'
            : 'inset-x-0 bottom-0 h-[72dvh] max-h-[72dvh] md:h-auto md:max-h-[85vh] md:w-[480px] md:right-6 md:bottom-6 md:left-auto rounded-t-[32px] md:rounded-[32px]'
        }`}
      >
        {/* Mobile Pull Bar & Header */}
        <div className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-white/5">
          <div
            className="flex md:hidden justify-center pb-2 cursor-pointer"
            onClick={() => setIsExpanded((v) => !v)}
            role="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="relative flex items-center justify-center">
                {/* Brand Glow Aura */}
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#6366F1] via-[#EC4899] to-[#10B981] opacity-40 blur-md animate-pulse" />
                
                {/* Logo Frame */}
                <div className="relative w-11 h-11 rounded-2xl bg-[#0A0908] border border-white/15 flex items-center justify-center p-2 shadow-xl shadow-[#6366F1]/20">
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 100 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                  >
                    {/* Outer Boundary Edges */}
                    <line x1="15" y1="30" x2="50" y2="10" stroke="#EC4899" strokeWidth="4" strokeLinecap="round" />
                    <line x1="50" y1="10" x2="85" y2="30" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />
                    <line x1="85" y1="30" x2="85" y2="70" stroke="#EC4899" strokeWidth="4" strokeLinecap="round" />
                    <line x1="85" y1="70" x2="50" y2="90" stroke="#A855F7" strokeWidth="4" strokeLinecap="round" />
                    <line x1="50" y1="90" x2="15" y2="70" stroke="#EC4899" strokeWidth="4" strokeLinecap="round" />
                    <line x1="15" y1="70" x2="15" y2="30" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />

                    {/* Inner Seam Edges */}
                    <line x1="50" y1="50" x2="15" y2="30" stroke="#A855F7" strokeWidth="4" strokeLinecap="round" />
                    <line x1="50" y1="50" x2="85" y2="30" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
                    <line x1="50" y1="50" x2="50" y2="90" stroke="#10B981" strokeWidth="4" strokeLinecap="round" />

                    {/* Vertices */}
                    <circle cx="50" cy="10" r="5" fill="#6366F1" stroke="#000000" strokeWidth="2" />
                    <circle cx="85" cy="30" r="5" fill="#6366F1" stroke="#000000" strokeWidth="2" />
                    <circle cx="85" cy="70" r="5" fill="#6366F1" stroke="#000000" strokeWidth="2" />
                    <circle cx="50" cy="90" r="5" fill="#6366F1" stroke="#000000" strokeWidth="2" />
                    <circle cx="15" cy="70" r="5" fill="#6366F1" stroke="#000000" strokeWidth="2" />
                    <circle cx="15" cy="30" r="5" fill="#6366F1" stroke="#000000" strokeWidth="2" />
                    
                    {/* Core Hub */}
                    <circle cx="50" cy="50" r="6" fill="#6366F1" stroke="#000000" strokeWidth="2.5" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight m-0">
                  Upgrade to Kylrix Pro
                </h3>
                <p className="text-[11px] text-white/40 font-mono m-0 mt-0.5">
                  Supercharge your living agentic workspace
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="hidden md:flex p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors cursor-pointer"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              <button
                type="button"
                onClick={closeProUpgrade}
                className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors cursor-pointer"
                aria-label="Close upgrade drawer"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Benefits List */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4 min-h-0">
          {/* Contextual Pain Point Alert if triggered by a specific feature */}
          {highlight && (
            <div className="p-4 rounded-2xl bg-[#0A0908] border border-[#6366F1]/25 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-[#6366F1] block">
                {feature}
              </span>
              <p className="text-xs font-bold text-white m-0 font-sans">{highlight.desc}</p>
              <p className="text-[11px] text-white/50 m-0 leading-relaxed font-sans">{highlight.fix}</p>
            </div>
          )}

          {/* Value Header Banner */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#6366F1]/10 to-transparent border border-white/5">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white/40 block">
                One Clean Subscription
              </span>
              <span className="text-xl font-black text-white font-clash">$10 / month</span>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
              Cancel Anytime
            </span>
          </div>

          {/* 5 Categorized Core Benefits */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40 block px-1">
              What You Unlock
            </span>

            {PLAN_BENEFIT_GROUPS.map((group, idx) => {
              const Icon = group.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#0A0908] border border-white/[0.06] hover:border-white/10 transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg ${group.bg} ${group.border} border flex items-center justify-center shrink-0`}>
                        <Icon size={14} className={group.color} />
                      </div>
                      <h4 className="text-xs font-extrabold text-white font-clash truncate m-0">
                        {group.title}
                      </h4>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#6366F1]/15 text-[#6366F1] font-bold shrink-0">
                      UNLIMITED
                    </span>
                  </div>

                  <p className="text-[11px] text-white/70 font-sans leading-relaxed m-0 pl-9">
                    {group.pro}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 p-5 bg-[#0A0908] border-t border-white/5 rounded-b-[32px]">
          <button
            type="button"
            onClick={handleGoPricing}
            className="w-full h-12 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-[#6366F1]/20 transition-all cursor-pointer"
          >
            <span>Upgrade to Pro Now</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
