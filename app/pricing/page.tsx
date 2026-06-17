'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Globe, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { account } from '@/lib/appwrite/client';
import { createBillingCheckoutSessionAction } from '@/app/(app)/(auth)/accounts/actions/billing';
import { calculateSubscriptionPrice } from '@/lib/subscription/ppp';

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

  const basePrice = useMemo(() => {
    return calculateSubscriptionPrice(selectedTier, 'US', 'CRYPTO');
  }, [selectedTier]);

  const isYearly = months >= 12;

  const totalPrice = useMemo(() => {
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return years * 10 * basePrice + remainingMonths * basePrice;
    }
    return months * basePrice;
  }, [months, basePrice]);

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
        baseUrl: `${window.location.origin}/accounts`,
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

  return (
    <div className="min-h-screen bg-black text-white relative pt-12 pb-20 px-4 md:px-6">
      <div className="max-w-4xl mx-auto relative z-10">
        <button
          onClick={() => router.back()}
          className="w-11 h-11 mb-6 bg-[#161412] text-white border border-white/6 rounded-[14px] flex items-center justify-center hover:bg-[#1C1A18] hover:-translate-x-0.5 transition-all"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="text-center mb-6">
          <h1 className="text-white font-black text-4xl md:text-6xl tracking-tight leading-tight mb-3 font-mono">
            Kylrix {selectedTier === 'PRO' ? 'Pro' : 'Teams'}
          </h1>
          <p className="text-white/60 text-sm md:text-base font-medium max-w-xl mx-auto leading-relaxed">
            Get full access to the ecosystem with a plan that scales with you.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 bg-[#161514] border border-white/8 rounded-[16px]">
            <button
              onClick={() => setSelectedTier('PRO')}
              className={`px-6 py-2 rounded-[12px] text-xs md:text-sm font-black transition-all ${
                selectedTier === 'PRO'
                  ? 'bg-[#6366F1] text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Kylrix Pro
            </button>
            <button
              onClick={() => setSelectedTier('TEAMS')}
              className={`px-6 py-2 rounded-[12px] text-xs md:text-sm font-black transition-all ${
                selectedTier === 'TEAMS'
                  ? 'bg-[#6366F1] text-black'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Kylrix Teams
            </button>
          </div>
        </div>

        <div className="bg-[#161514] border border-white/8 rounded-[28px] p-6 md:p-10 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-[10px] text-[#6366F1] font-black uppercase tracking-wider block mb-2 font-mono">
                  Plan Duration
                </span>
                <h3 className="text-white text-xl md:text-2xl font-black tracking-tight leading-tight mb-4">
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
                  <div className="mt-4 p-3 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 inline-flex">
                    <Sparkles size={16} className="text-emerald-400 flex-shrink-0" />
                    <span className="text-emerald-400 text-xs font-black">
                      Yearly Discount: 2 Months Free applied
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3.5 pt-2">
                {(selectedTier === 'PRO'
                  ? [
                      { icon: ShieldCheck, text: 'Unlimited Vault & Notes storage' },
                      { icon: Globe, text: 'Universal Identity across all apps' },
                      { icon: Sparkles, text: 'Full AI Neural Graph access' },
                      { icon: ShieldCheck, text: 'Up to 10 Projects (Free gets 1)' },
                      { icon: ShieldCheck, text: 'Up to 3 collaborators per object/project' },
                    ]
                  : [
                      { icon: ShieldCheck, text: 'Unlimited Projects & Vault' },
                      { icon: ShieldCheck, text: 'Unlimited Collaborators & team members' },
                      { icon: Sparkles, text: 'Full AI Neural Graph access' },
                      { icon: Globe, text: 'Universal Identity across all apps' },
                    ]
                ).map((feat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <feat.icon size={18} className="text-[#6366F1] flex-shrink-0" />
                    <span className="text-sm font-bold text-white/80">{feat.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-[24px] bg-[#1F1D1B] border border-white/8 text-center flex flex-col items-center justify-center gap-4 min-h-[200px]">
              <div>
                <span className="text-white/40 text-[11px] font-bold block mb-1">
                  Total Amount ({selectedTier})
                </span>
                <span className="text-4xl md:text-5xl font-black text-white font-mono leading-none tracking-tight">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1">
                <span className="text-[#6366F1] font-black text-xs">Universal Global Rate</span>
              </div>

              <button
                onClick={handleSubscribe}
                disabled={checkoutLoading}
                className="w-full py-3.5 mt-4 bg-white hover:bg-neutral-200 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black text-sm md:text-base rounded-[16px] transition-all shadow-[0_4px_12px_rgba(255,255,255,0.05)]"
              >
                {checkoutLoading ? 'Starting checkout…' : 'Continue to Checkout'}
              </button>

              <p className="text-[10px] text-white/30 font-medium leading-normal px-2 mt-2">
                Your subscription time is calculated based on your contribution. Any payment amount is
                automatically converted into active {selectedTier === 'PRO' ? 'Pro' : 'Teams'} time.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 py-3.5 rounded-full bg-[#1F1D1B] border border-white/8">
            <span className="text-sm font-bold text-white">Kylrix Free is free forever. No pressure.</span>

            <div className="hidden sm:block w-px h-5 bg-white/10" />

            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-1.5 text-black bg-[#6366F1] hover:bg-[#6366F1]/90 font-black text-xs px-4 py-2 rounded-full transition-all group"
            >
              <span>Continue Free</span>
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
