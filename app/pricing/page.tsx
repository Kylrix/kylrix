'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  MessageSquare,
  Folder,
  Share2,
  Mic,
  Lightbulb,
  CheckSquare,
  Key,
  FileText,
  Calendar,
  Layers,
  Bot,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { account } from '@/lib/appwrite/client';
import { createBillingCheckoutSessionAction } from '@/lib/actions/billing/billing';
import { calculateTotalSubscriptionPrice, getBundledFreeMonths, getYearlyDiscountedPrice, getYearlyListPrice } from '@/lib/subscription/ppp';

const CHECKOUT_CACHE_KEY = 'kylrix_pricing_checkout_v1';

type PendingCheckout = {
  planId: string;
  months: number;
  countryCode: string;
  tier: 'PRO' | 'TEAMS';
};

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const [months, setMonths] = useState(1);
  const [selectedTier, setSelectedTier] = useState<'PRO' | 'TEAMS'>('PRO');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const resumeAttemptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tier = new URLSearchParams(window.location.search).get('tier');
    if (tier?.toLowerCase() === 'teams') {
      setSelectedTier('TEAMS');
    }
  }, []);

  const yearlyListPrice = useMemo(() => getYearlyListPrice(selectedTier), [selectedTier]);
  const yearlyDiscountedPrice = useMemo(() => getYearlyDiscountedPrice(selectedTier), [selectedTier]);
  const freeMonthsIncluded = useMemo(() => getBundledFreeMonths(months), [months]);
  const isYearly = months >= 12;

  const totalPrice = useMemo(() => {
    return calculateTotalSubscriptionPrice(selectedTier, months, 'CRYPTO');
  }, [months, selectedTier]);

  const proceedToBlockBee = useCallback(async (planId: string, checkoutMonths: number, countryCode: string) => {
    setCheckoutLoading(true);
    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
      const session = await createBillingCheckoutSessionAction({
        planId,
        method: 'CRYPTO',
        countryCode,
        months: checkoutMonths,
        jwt,
      });

      if (session?.url) {
        sessionStorage.removeItem(CHECKOUT_CACHE_KEY);
        window.location.href = session.url;
        return;
      }

      const sessionError = 'error' in session ? session.error : undefined;
      toast.error(typeof sessionError === 'string' ? sessionError : 'Failed to start checkout');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect to the payment provider');
    } finally {
      setCheckoutLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || resumeAttemptedRef.current) return;

    const raw = sessionStorage.getItem(CHECKOUT_CACHE_KEY);
    if (!raw) return;

    try {
      const intent = JSON.parse(raw) as PendingCheckout;
      resumeAttemptedRef.current = true;
      if (intent.months) setMonths(intent.months);
      if (intent.tier) setSelectedTier(intent.tier);
      void proceedToBlockBee(intent.planId, intent.months, intent.countryCode || 'US');
    } catch {
      sessionStorage.removeItem(CHECKOUT_CACHE_KEY);
    }
  }, [user, proceedToBlockBee]);

  const handleSubscribe = () => {
    const planId = months >= 12 ? `${selectedTier}_YEAR` : `${selectedTier}_MONTH`;

    if (!isAuthenticated) {
      const intent: PendingCheckout = {
        planId,
        months,
        countryCode: 'US',
        tier: selectedTier,
      };
      sessionStorage.setItem(CHECKOUT_CACHE_KEY, JSON.stringify(intent));
      openUnified('login');
      return;
    }

    void proceedToBlockBee(planId, months, 'US');
  };

  const proFeatures = [
    { icon: Lightbulb, text: 'Unlimited ideas & notes' },
    { icon: CheckSquare, text: 'Unlimited tasks & goals' },
    { icon: Key, text: 'Unlimited passwords & vaults' },
    { icon: FileText, text: 'Unlimited forms & responses' },
    { icon: Calendar, text: 'Unlimited events & calendar sync' },
    { icon: Layers, text: 'Unlimited workspaces & collaboration' },
    { icon: MessageSquare, text: 'Private chats & Hangouts' },
    { icon: ShieldCheck, text: 'Moments & feeds' },
    { icon: Folder, text: 'Cloud file storage & attachments' },
    { icon: Bot, text: 'Intelligent AI Sidekick & Agents' },
    { icon: Sparkles, text: 'Neural graph exploration' },
    { icon: Mic, text: 'Audio messages & voice notes' },
    { icon: Share2, text: 'Direct link sharing & duplication' },
  ];

  const teamsFeatures = [
    { icon: Users, text: 'All Pro features for multiple team members' },
    { icon: Layers, text: 'Shared team workspaces & permissions' },
    { icon: Lightbulb, text: 'Unlimited shared ideas & notes' },
    { icon: CheckSquare, text: 'Unlimited team goals & tracking' },
    { icon: Key, text: 'Unlimited shared vaults & credentials' },
    { icon: FileText, text: 'Unlimited team forms & workflows' },
    { icon: Folder, text: 'Team cloud file storage & asset sharing' },
    { icon: Bot, text: 'Shared AI agents & automated tooling' },
    { icon: MessageSquare, text: 'Team discussion channels & Hangouts' },
    { icon: Share2, text: 'Custom team access controls' },
  ];

  const currentFeatures = selectedTier === 'PRO' ? proFeatures : teamsFeatures;

  return (
    <div className="min-h-screen bg-black text-white pt-10 pb-20 px-4 md:px-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 bg-[#161412] text-white/80 hover:text-white border border-white/6 rounded-xl flex items-center justify-center transition-colors cursor-pointer self-start"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Header */}
        <div className="text-center flex flex-col items-center gap-2">
          <h1 className="text-white font-black text-3xl md:text-5xl tracking-tight font-clash">
            Kylrix {selectedTier === 'PRO' ? 'Pro' : 'Teams'}
          </h1>
          <p className="text-white/60 text-sm md:text-base font-satoshi max-w-md">
            Full private suite. All core features unlimited.
          </p>
        </div>

        {/* Tier Selector */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-[#161412] border border-white/6 rounded-2xl">
            <button
              onClick={() => setSelectedTier('PRO')}
              className={`px-5 py-2 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                selectedTier === 'PRO'
                  ? 'bg-[#6366F1] text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Kylrix Pro
            </button>
            <button
              onClick={() => setSelectedTier('TEAMS')}
              className={`px-5 py-2 rounded-xl text-xs md:text-sm font-black transition-all cursor-pointer ${
                selectedTier === 'TEAMS'
                  ? 'bg-[#6366F1] text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Kylrix Teams
            </button>
          </div>
        </div>

        {/* Main Pricing Box */}
        <div className="bg-[#161412] border border-white/6 rounded-3xl p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            {/* Left: Duration Slider & Features */}
            <div className="flex flex-col gap-6">
              <div className="bg-[#0A0908] border border-white/6 rounded-2xl p-4">
                <span className="text-[10px] text-white/55 font-bold uppercase tracking-wider block mb-1">
                  Plan Duration
                </span>
                <h3 className="text-white text-lg md:text-xl font-black font-clash mb-3">
                  {months} {months === 1 ? 'Month' : 'Months'}
                </h3>

                <input
                  type="range"
                  min={1}
                  max={24}
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#6366F1] focus:outline-none"
                />

                {isYearly && (
                  <p className="mt-2.5 text-xs font-bold text-emerald-400">
                    {freeMonthsIncluded} {freeMonthsIncluded === 1 ? 'month' : 'months'} free included
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-[10px] text-white/55 font-bold uppercase tracking-wider px-1">
                  Included Features
                </span>
                <div className="grid grid-cols-1 gap-2">
                  {currentFeatures.map((feat, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0A0908] border border-white/4">
                      <div className="w-7 h-7 rounded-lg bg-[#161412] flex items-center justify-center shrink-0 text-[#6366F1]">
                        <feat.icon size={15} />
                      </div>
                      <span className="text-xs font-bold text-white/90 font-satoshi">{feat.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Checkout Summary Tile */}
            <div className="p-6 rounded-2xl bg-[#0A0908] border border-white/6 flex flex-col items-center justify-center gap-4 text-center sticky top-6">
              <div>
                <span className="text-white/40 text-xs font-bold block mb-1">
                  Total for {months} {months === 1 ? 'month' : 'months'}
                </span>
                <span className="text-4xl md:text-5xl font-black text-white font-mono leading-none tracking-tight">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs font-semibold">
                <span className="line-through text-white/30 font-mono">${yearlyListPrice}</span>
                <span className="text-white/70 font-mono">${yearlyDiscountedPrice}</span>
                <span className="text-white/40">/year</span>
                <span className="text-white/20">·</span>
                <span className="text-emerald-400">2 months free</span>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={checkoutLoading}
                className="w-full py-3.5 bg-white hover:bg-white/90 disabled:opacity-50 text-black font-black text-sm rounded-xl transition-all cursor-pointer"
              >
                {checkoutLoading ? 'Starting checkout…' : 'Continue to Checkout'}
              </button>

              <p className="text-[11px] text-white/40 font-satoshi px-2 leading-relaxed">
                Crypto payments are automatically converted into active {selectedTier === 'PRO' ? 'Pro' : 'Teams'} duration.
              </p>
            </div>
          </div>
        </div>

        {/* Plan Switching Note */}
        <div className="rounded-2xl border border-white/6 bg-[#161412] p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1.5">
            Plan Switching
          </p>
          <p className="text-xs text-white/70 font-satoshi leading-relaxed">
            One account holds one active paid tier at a time. Upgrading from Pro to Teams (or vice versa) queues the new plan to start automatically when your current period ends.
          </p>
        </div>

        {/* Continue Free Section */}
        <div className="rounded-2xl bg-[#161412] border border-white/6 p-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex flex-col gap-1 text-center sm:text-left">
            <span className="text-sm font-black text-white font-clash">
              Kylrix Free is unlimited forever.
            </span>
            <span className="text-xs text-white/50 font-satoshi">
              Includes unlimited ideas, tasks, vaults, forms, events, workspaces, and chats.
            </span>
          </div>

          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-2 text-white bg-white/10 hover:bg-white/15 border border-white/10 font-black text-xs px-5 py-3 rounded-xl transition-all group shrink-0 cursor-pointer"
          >
            <span>Continue Free</span>
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

