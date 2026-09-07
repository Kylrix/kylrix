'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  ArrowRight,
  X,
  Bot,
  HardDrive,
  Users,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import {
  getPublicPricingPlansOrDefault,
  type PublicPricingPlan,
} from '@/lib/config/pricing-plans-client';

const FEATURE_CONTEXT_HIGHLIGHTS: Record<string, { desc: string; fix: string; title?: string }> = {
  'Voice recording': {
    title: 'Voice Notes & Audio Attachments',
    desc: 'Voice notes, transcription, and audio streaming are enabled on paid plans.',
    fix: 'Pick a plan to capture, attach, and stream voice updates.',
  },
  'Discussions': {
    title: 'Collaborative Discussions',
    desc: 'Real-time collaborative discussions require a paid workspace.',
    fix: 'Upgrade to join and start discussions on any object.',
  },
  'New Project': {
    title: 'Unlimited Workspaces & Projects',
    desc: 'You have reached the workspace limit.',
    fix: 'Upgrade for unlimited workspaces and dedicated projects.',
  },
  'New Channel': {
    title: 'Shared Group Channels',
    desc: 'Shared group channels and hangouts are part of paid plans.',
    fix: 'Upgrade to create shared and dedicated channels.',
  },
  'Collaborators': {
    title: 'Workspace Collaboration',
    desc: 'Multi-member real-time collaboration requires a paid subscription.',
    fix: 'Upgrade to invite collaborators across your workspace.',
  },
  'Project Collaboration': {
    title: 'Project-Level Invitations',
    desc: 'Direct project invitations and shared scopes are on paid tiers.',
    fix: 'Upgrade to co-author and share full project workspaces.',
  },
  'Pinned Notes': {
    title: 'Unlimited Pinned Items',
    desc: 'Keep essential objects front and center.',
    fix: 'Upgrade to pin unlimited ideas, notes, goals, and forms.',
  },
  'Article Mode': {
    title: 'Long-Form Article Publishing',
    desc: 'Long-form article formatting requires a paid plan.',
    fix: 'Upgrade for article publishing and extended note layouts.',
  },
  'Kylie Assist': {
    title: 'Kylie Assist & Agents',
    desc: 'Smart drafting and custom agents need a paid plan.',
    fix: 'Upgrade to unlock Kylie assist and agent personas.',
  },
  'AI features': {
    title: 'Kylie Assist & Agents',
    desc: 'Smart drafting and custom agents need a paid plan.',
    fix: 'Upgrade to unlock Kylie assist and agent personas.',
  },
  'File upload': {
    title: 'Cloud File & Media Storage',
    desc: 'Direct file uploads and cloud archives are on paid plans.',
    fix: 'Upgrade to upload images, PDFs, archives, and files.',
  },
  'Form File Uploads': {
    title: 'Form File Attachment Fields',
    desc: 'Collecting file submissions on forms requires a paid plan.',
    fix: 'Upgrade to let respondents attach documents to forms.',
  },
  'Sign in with Kylrix (OAuth 2.1 Provider)': {
    title: 'OAuth Provider & Developer Tools',
    desc: 'Issuing developer tokens and acting as an identity provider requires a paid plan.',
    fix: 'Upgrade to build external apps with Kylrix sign-in.',
  },
};

const FALLBACK_GROUPS = [
  {
    title: 'Autonomous AI Agents',
    icon: Bot,
    color: 'text-[#6366F1]',
    bg: 'bg-[#6366F1]/10',
    border: 'border-[#6366F1]/20',
    pro: 'Unlimited AI agents (Kylie & custom personas), background tool calling & daily compute',
  },
  {
    title: 'Storage & File Uploads',
    icon: HardDrive,
    color: 'text-[#10B981]',
    bg: 'bg-[#10B981]/10',
    border: 'border-[#10B981]/20',
    pro: 'Unlimited images/storage and file uploads, voice notes & attachment archives',
  },
  {
    title: 'Workspaces & Collaboration',
    icon: Users,
    color: 'text-[#F59E0B]',
    bg: 'bg-[#F59E0B]/10',
    border: 'border-[#F59E0B]/20',
    pro: 'Unlimited projects, workspaces, team collaborators & real-time discussions',
  },
  {
    title: 'Objects, Tools & Pins',
    icon: Layers,
    color: 'text-[#EC4899]',
    bg: 'bg-[#EC4899]/10',
    border: 'border-[#EC4899]/20',
    pro: 'Unlimited pinned items, forms, goals, automations & developer tokens',
  },
  {
    title: 'Privacy & Secure Vault',
    icon: Shield,
    color: 'text-[#38BDF8]',
    bg: 'bg-[#38BDF8]/10',
    border: 'border-[#38BDF8]/20',
    pro: 'Private vault, passkey sync & secure calls',
  },
];

export function ProUpgradeDrawer() {
  const { showProUpgrade, closeProUpgrade, feature } = useProUpgrade();
  const { open: openUnified } = useUnifiedDrawer();
  const [isExpanded, setIsExpanded] = useState(false);
  const pricingPlans = useMemo(() => getPublicPricingPlansOrDefault(), []);
  const [selectedLedger, setSelectedLedger] = useState(
    () => pricingPlans[0]?.ledgerKey || 'PRO',
  );

  const selectedPlan: PublicPricingPlan | undefined = useMemo(
    () => pricingPlans.find((p) => p.ledgerKey === selectedLedger) || pricingPlans[0],
    [pricingPlans, selectedLedger],
  );

  useEffect(() => {
    if (!showProUpgrade) setIsExpanded(false);
  }, [showProUpgrade]);

  useEffect(() => {
    if (showProUpgrade) {
      document.body.style.overflow = 'hidden';
      // Prefer Teams when feature is project/collab oriented
      const f = String(feature || '').toLowerCase();
      if ((f.includes('project') || f.includes('channel') || f.includes('collaborat')) &&
          pricingPlans.some((p) => p.ledgerKey === 'TEAMS')) {
        setSelectedLedger('TEAMS');
      }
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showProUpgrade, feature, pricingPlans]);

  if (!showProUpgrade) return null;

  const highlight = feature
    ? FEATURE_CONTEXT_HIGHLIGHTS[feature] || {
        title: feature,
        desc: `${feature} needs a paid plan.`,
        fix: 'Pick a plan below to unlock it.',
      }
    : null;

  const handleGoPricing = () => {
    closeProUpgrade();
    openUnified('pricing', {
      featureHighlight: feature,
      tier: selectedPlan?.ledgerKey || 'PRO',
    });
  };

  const planFeatures = selectedPlan?.exclusiveFeatures || [];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/75 z-[99998] transition-opacity duration-300 pointer-events-auto"
        onClick={closeProUpgrade}
        aria-hidden="true"
      />

      <div
        className={`fixed z-[99999] pointer-events-auto flex flex-col bg-[#161412] border border-white/10 shadow-2xl transition-all duration-300 ${
          isExpanded
            ? 'inset-0 h-[100dvh] max-h-[100dvh] w-full rounded-none'
            : 'inset-x-0 bottom-0 h-[72dvh] max-h-[72dvh] md:h-auto md:max-h-[85vh] md:w-[480px] md:right-6 md:bottom-6 md:left-auto rounded-t-[32px] md:rounded-[32px]'
        }`}
      >
        <div className="flex-shrink-0 px-6 pt-4 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative w-11 h-11 rounded-2xl bg-[#000000] border border-white/15 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-[#6366F1]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-black font-clash text-white tracking-tight leading-tight m-0 truncate">
                  {highlight?.title ? `Unlock ${highlight.title}` : 'Upgrade your plan'}
                </h3>
                <p className="text-[11px] text-white font-mono m-0 mt-0.5">
                  {highlight ? 'Choose a plan to enable this' : 'Pick Pro or Teams — switch anytime'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setIsExpanded((v) => !v)}
                className="hidden md:flex p-2 rounded-xl hover:bg-white/5 text-white transition-colors cursor-pointer"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
              <button
                type="button"
                onClick={closeProUpgrade}
                className="p-2 rounded-xl hover:bg-white/5 text-white transition-colors cursor-pointer"
                aria-label="Close upgrade drawer"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 space-y-4 min-h-0">
          {highlight && (
            <div className="p-4 rounded-2xl bg-[#000000] border border-[#6366F1]/25 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-[#6366F1] block">
                {feature}
              </span>
              <p className="text-xs font-bold text-white m-0 font-sans">{highlight.desc}</p>
              <p className="text-[11px] text-white m-0 leading-relaxed font-sans">{highlight.fix}</p>
            </div>
          )}

          {/* Tier switcher */}
          {pricingPlans.length > 1 ? (
            <div className="inline-flex p-1 bg-[#000000] border border-white/20 rounded-2xl w-full">
              {pricingPlans.map((plan) => (
                <button
                  key={plan.ledgerKey}
                  type="button"
                  onClick={() => setSelectedLedger(plan.ledgerKey)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    selectedLedger === plan.ledgerKey
                      ? 'bg-[#6366F1] text-white'
                      : 'text-white hover:bg-white/5'
                  }`}
                >
                  {plan.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center justify-between p-4 rounded-2xl bg-[#000000] border border-white/20">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-white block">
                {selectedPlan?.name || 'Plan'}
              </span>
              <span className="text-xl font-black text-white font-clash">
                ${selectedPlan?.priceUsd ?? 10}
                <span className="text-sm font-bold text-white ml-1">/ month</span>
              </span>
              {selectedPlan?.description ? (
                <p className="text-[11px] text-white m-0 mt-1">{selectedPlan.description}</p>
              ) : null}
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/25 font-bold uppercase shrink-0">
              Cancel anytime
            </span>
          </div>

          <div className="space-y-2.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white block px-1">
              What you unlock
            </span>

            {planFeatures.length > 0
              ? planFeatures.map((feat) => (
                  <div
                    key={feat.id}
                    className="p-3.5 rounded-2xl bg-[#000000] border border-white/20 space-y-1"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center shrink-0">
                        <Sparkles size={14} className="text-[#6366F1]" />
                      </div>
                      <h4 className="text-xs font-extrabold text-white font-clash truncate m-0">
                        {feat.label}
                      </h4>
                    </div>
                  </div>
                ))
              : FALLBACK_GROUPS.map((group, idx) => {
                  const Icon = group.icon;
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-[#000000] border border-white/20 space-y-1.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg ${group.bg} ${group.border} border flex items-center justify-center shrink-0`}
                        >
                          <Icon size={14} className={group.color} />
                        </div>
                        <h4 className="text-xs font-extrabold text-white font-clash truncate m-0">
                          {group.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-white font-sans leading-relaxed m-0 pl-9">
                        {group.pro}
                      </p>
                    </div>
                  );
                })}
          </div>
        </div>

        <div className="flex-shrink-0 p-5 bg-[#161412] border-t border-white/10">
          <button
            type="button"
            onClick={handleGoPricing}
            className="w-full h-12 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Continue with {selectedPlan?.name || 'Pro'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}
