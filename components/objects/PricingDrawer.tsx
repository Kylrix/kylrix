'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Sparkles,
  ShieldCheck,
  X,
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
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { account } from '@/lib/appwrite/client';
import { createBillingCheckoutSessionAction } from '@/lib/actions/billing/billing';
import { recordPaymentIntentAction } from '@/lib/actions/billing/payment-intent';
import { calculateTotalSubscriptionPrice, getBundledFreeMonths, getYearlyDiscountedPrice, getYearlyListPrice } from '@/lib/subscription/ppp';

const CHECKOUT_CACHE_KEY = 'kylrix_pricing_checkout_v1';

type PendingCheckout = {
  planId: string;
  months: number;
  countryCode: string;
  tier: 'PRO' | 'TEAMS';
};

interface PricingDrawerProps {
  onClose?: () => void;
  initialTier?: 'PRO' | 'TEAMS';
  featureHighlight?: string | null;
}

export function PricingDrawer({ onClose, initialTier = 'PRO', featureHighlight }: PricingDrawerProps) {
  const { isAuthenticated, user } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();
  const [months, setMonths] = useState(1);
  const [monthsInput, setMonthsInput] = useState('1');
  const [selectedTier, setSelectedTier] = useState<'PRO' | 'TEAMS'>(initialTier);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const resumeAttemptedRef = useRef(false);

  const yearlyListPrice = useMemo(() => getYearlyListPrice(selectedTier), [selectedTier]);
  const yearlyDiscountedPrice = useMemo(() => getYearlyDiscountedPrice(selectedTier), [selectedTier]);
  const freeMonthsIncluded = useMemo(() => getBundledFreeMonths(months), [months]);
  const isYearly = months >= 12;

  const totalPrice = useMemo(() => {
    return calculateTotalSubscriptionPrice(selectedTier, months, 'CRYPTO');
  }, [months, selectedTier]);

  const updateMonths = useCallback((newMonths: number) => {
    const clamped = Math.max(1, Math.min(24, newMonths));
    setMonths(clamped);
    setMonthsInput(String(clamped));
  }, []);

  const handleMonthsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMonthsInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 24) {
      setMonths(parsed);
    }
  };

  const handleMonthsInputBlur = () => {
    const parsed = parseInt(monthsInput, 10);
    if (isNaN(parsed) || parsed < 1) {
      updateMonths(1);
    } else if (parsed > 24) {
      updateMonths(24);
    } else {
      updateMonths(parsed);
    }
  };

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

        // Record intent for smart reminder
        await recordPaymentIntentAction({
          tier: selectedTier,
          months: checkoutMonths,
          planId,
          checkoutUrl: session.url,
          jwt,
        }).catch(() => {});

        // Open BlockBee checkout in new tab on both desktop and mobile
        window.open(session.url, '_blank', 'noopener,noreferrer');
        toast.success('Checkout opened in new tab');
        onClose?.();
        return;
      }

      const sessionError = 'error' in session ? session.error : undefined;
      toast.error(typeof sessionError === 'string' ? sessionError : 'Failed to start checkout');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect to the payment provider');
    } finally {
      setCheckoutLoading(false);
    }
  }, [selectedTier, onClose]);

  useEffect(() => {
    if (!user || resumeAttemptedRef.current) return;

    const raw = sessionStorage.getItem(CHECKOUT_CACHE_KEY);
    if (!raw) return;

    try {
      const intent = JSON.parse(raw) as PendingCheckout;
      resumeAttemptedRef.current = true;
      if (intent.months) updateMonths(intent.months);
      if (intent.tier) setSelectedTier(intent.tier);
      void proceedToBlockBee(intent.planId, intent.months, intent.countryCode || 'US');
    } catch {
      sessionStorage.removeItem(CHECKOUT_CACHE_KEY);
    }
  }, [user, proceedToBlockBee, updateMonths]);

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
    <div className="h-full flex flex-col bg-[#161412] text-white overflow-hidden select-none">
      {/* Header */}
      <div className="p-5 border-b border-white/6 flex items-center justify-between gap-3 shrink-0 bg-[#161412]">
        <div className="min-w-0">
          <h2 className="text-white font-black text-xl font-clash tracking-tight truncate">
            Kylrix {selectedTier === 'PRO' ? 'Pro' : 'Teams'}
          </h2>
          <p className="text-white/50 text-xs font-satoshi truncate">
            Full private suite. All core features unlimited.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#0A0908] border border-white/8 text-white/50 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">
        {featureHighlight && (
          <div className="p-3.5 rounded-2xl bg-[#0A0908] border border-[#6366F1]/30 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6366F1] block">
                Feature Locked
              </span>
              <p className="text-xs font-bold text-white font-satoshi truncate">
                Upgrade to unlock {featureHighlight}
              </p>
            </div>
          </div>
        )}

        {/* Tier Selector */}
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-[#0A0908] border border-white/6 rounded-2xl w-full">
            <button
              onClick={() => setSelectedTier('PRO')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedTier === 'PRO'
                  ? 'bg-[#6366F1] text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Kylrix Pro
            </button>
            <button
              onClick={() => setSelectedTier('TEAMS')}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                selectedTier === 'TEAMS'
                  ? 'bg-[#6366F1] text-white'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Kylrix Teams
            </button>
          </div>
        </div>

        {/* Duration Slider & Custom Number Stepper Well */}
        <div className="bg-[#0A0908] border border-white/6 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-white/55 font-bold uppercase tracking-wider">
              Plan Duration (Months)
            </span>

            {/* Custom Input Stepper with UP/DOWN Controls */}
            <div className="flex items-center gap-1.5 bg-[#161412] border border-white/8 rounded-xl p-1">
              <input
                type="text"
                inputMode="numeric"
                value={monthsInput}
                onChange={handleMonthsInputChange}
                onBlur={handleMonthsInputBlur}
                className="w-8 text-center bg-transparent font-mono font-black text-sm text-white focus:outline-none"
              />
              <div className="flex flex-col gap-0.5 border-l border-white/8 pl-1">
                <button
                  type="button"
                  onClick={() => updateMonths(months + 1)}
                  disabled={months >= 24}
                  className="w-4 h-3 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => updateMonths(months - 1)}
                  disabled={months <= 1}
                  className="w-4 h-3 flex items-center justify-center text-white/40 hover:text-white disabled:opacity-20 transition-colors cursor-pointer"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={24}
            value={months}
            onChange={(e) => updateMonths(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#6366F1] focus:outline-none"
          />

          {isYearly && (
            <p className="text-xs font-bold text-emerald-400">
              {freeMonthsIncluded} {freeMonthsIncluded === 1 ? 'month' : 'months'} free included
            </p>
          )}
        </div>

        {/* Total Price & Checkout */}
        <div className="p-5 rounded-2xl bg-[#0A0908] border border-white/6 text-center space-y-3">
          <div>
            <span className="text-white/40 text-[11px] font-bold block mb-1">
              Total for {months} {months === 1 ? 'month' : 'months'}
            </span>
            <span className="text-3xl md:text-4xl font-black text-white font-mono leading-none tracking-tight">
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
            {checkoutLoading ? 'Starting checkout…' : 'Continue to Checkout (Opens in new tab)'}
          </button>
        </div>

        {/* Features List */}
        <div className="space-y-2.5">
          <span className="text-[10px] text-white/55 font-bold uppercase tracking-wider px-1">
            Included Capabilities
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

        {/* Plan Switching Note */}
        <div className="rounded-2xl border border-white/6 bg-[#0A0908] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-1">
            Plan Switching
          </p>
          <p className="text-xs text-white/70 font-satoshi leading-relaxed">
            One account holds one active paid tier at a time. Switching tiers queues the new plan to start automatically when your current period ends.
          </p>
        </div>
      </div>
    </div>
  );
}
