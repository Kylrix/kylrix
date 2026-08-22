'use client';

import { useEffect, useMemo, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ticket,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Gift,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { claimCouponAction } from '@/lib/actions/billing/billing';
import { account } from '@/lib/appwrite/client';

type CouponClaimResponse = {
  ok?: boolean;
  claimed?: boolean;
  alreadyClaimed?: boolean;
  requiresPayment?: boolean;
  couponId?: string;
  discountPercent?: number;
  planId?: string;
  months?: number;
  currentPeriodEnd?: string;
  message?: string;
  error?: string;
};

function formatFriendlyError(error: any): string {
  const msg = String(error?.message || error || '').toLowerCase();
  if (msg.includes('not found')) {
    return 'This pass code could not be found or does not exist.';
  }
  if (msg.includes('no longer valid') || msg.includes('expired') || msg.includes('depleted') || msg.includes('revoked')) {
    return 'This pass has expired or is no longer active.';
  }
  if (msg.includes('limit reached')) {
    return 'This pass has already reached its maximum redemptions.';
  }
  if (msg.includes('reserved') || msg.includes('another account')) {
    return 'This pass is reserved for a specific account.';
  }
  if (msg.includes('authentication') || msg.includes('unauthorized')) {
    return 'Please sign in to your Kylrix account to claim this pass.';
  }
  return 'This pass is currently unavailable. Please verify the link or try another code.';
}

export default function CouponLandingPage(props: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const params = use(props.params);
  const { user, isLoading: isAuthLoading } = useAuth();
  const rawId = useMemo(() => (params.id || '').trim(), [params.id]);
  const [couponId, setCouponId] = useState(rawId);

  const [state, setState] = useState<'loading' | 'ready' | 'claimed' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [coupon, setCoupon] = useState<CouponClaimResponse | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const checkedRef = useRef<string | null>(null);

  const checkCoupon = async (targetId: string) => {
    if (!targetId) {
      setState('error');
      setErrorMessage('No pass code specified.');
      return;
    }
    setState('loading');
    setErrorMessage('');
    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => '');
      const data = (await claimCouponAction(targetId, jwt || undefined, true)) as CouponClaimResponse;

      setCoupon(data);
      if (data.alreadyClaimed) {
        setState('claimed');
      } else {
        setState('ready');
      }
    } catch (error: any) {
      setState('error');
      setErrorMessage(formatFriendlyError(error));
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      const url = new URL('/', window.location.origin);
      url.searchParams.set('source', window.location.href);
      url.searchParams.set('return_to', `/billing/coupon/${encodeURIComponent(rawId)}`);
      router.push(url.toString());
      return;
    }

    if (checkedRef.current === rawId) return;
    checkedRef.current = rawId;
    void checkCoupon(rawId);
  }, [rawId, isAuthLoading, user, router]);

  const handleClaim = async () => {
    if (!couponId || isClaiming) return;
    setIsClaiming(true);
    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => '');
      const data = (await claimCouponAction(couponId, jwt || undefined, false)) as CouponClaimResponse;

      setCoupon(data);

      if (data.requiresPayment && data.couponId) {
        const checkoutUrl = new URL('/billing/checkout', window.location.origin);
        checkoutUrl.searchParams.set('planId', data.planId || 'PRO_MONTH');
        checkoutUrl.searchParams.set('months', String(data.months || 1));
        checkoutUrl.searchParams.set('countryCode', (user?.prefs as any)?.region || 'US');
        checkoutUrl.searchParams.set('couponId', data.couponId);
        router.push(checkoutUrl.toString());
        return;
      }

      setState('claimed');
      const successUrl = new URL('/billing/success', window.location.origin);
      successUrl.searchParams.set('success', 'true');
      router.replace(successUrl.toString());
    } catch (error: any) {
      setState('error');
      setErrorMessage(formatFriendlyError(error));
    } finally {
      setIsClaiming(false);
    }
  };

  const discountPercent = coupon?.discountPercent ?? 100;
  const months = coupon?.months ?? 1;
  const isFullFree = discountPercent === 100;

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F2ED] flex items-center justify-center p-4 selection:bg-[#6366F1]/30">
      <div className="w-full max-w-md bg-[#161412] border border-white/5 rounded-[28px] p-6 sm:p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
        
        {/* Loading State */}
        {state === 'loading' && (
          <div className="w-full flex flex-col items-center py-6 space-y-5 animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-[#0A0908] border border-white/5 flex items-center justify-center text-[#6366F1]">
              <Loader2 className="w-6 h-6 animate-spin text-[#6366F1]" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/40">
                Kylrix Access Pass
              </span>
              <h1 className="font-clash text-2xl font-bold text-white tracking-tight">
                Checking Pass
              </h1>
              <p className="font-satoshi text-xs text-white/50 max-w-xs">
                Verifying your code with your account…
              </p>
            </div>

            <div className="w-full bg-[#0A0908] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                <Ticket className="w-4 h-4 text-white/40" />
              </div>
              <div className="text-left truncate flex-1 min-w-0">
                <span className="text-[10px] font-mono text-white/30 uppercase block">Code ID</span>
                <span className="text-xs font-mono font-bold text-white/70 truncate block">{couponId}</span>
              </div>
            </div>
          </div>
        )}

        {/* Ready to Claim State */}
        {state === 'ready' && (
          <div className="w-full flex flex-col items-center space-y-6 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-[#0A0908] border border-white/5 flex items-center justify-center text-[#6366F1]">
              <Sparkles className="w-7 h-7 text-[#6366F1]" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                Valid Pass
              </span>
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isFullFree ? 'Pro Access Pass' : `${discountPercent}% Discount`}
              </h1>
              <p className="font-satoshi text-xs text-white/60">
                {isFullFree
                  ? `Claim ${months} month${months > 1 ? 's' : ''} of Kylrix Pro subscription for free.`
                  : `Apply a ${discountPercent}% discount to your Pro subscription.`}
              </p>
            </div>

            {/* Pass Details Child Tile */}
            <div className="w-full bg-[#0A0908] border border-white/5 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-xs text-white/40 font-satoshi">Discount</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {isFullFree ? '100% Free' : `${discountPercent}% Off`}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-white/5">
                <span className="text-xs text-white/40 font-satoshi">Duration</span>
                <span className="text-xs font-mono font-bold text-white">
                  {months} Month{months > 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-xs text-white/40 font-satoshi">Plan</span>
                <span className="text-xs font-mono font-bold text-[#6366F1]">
                  {coupon?.planId === 'PRO_YEAR' ? 'Kylrix Pro (Yearly)' : 'Kylrix Pro'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                onClick={handleClaim}
                disabled={isClaiming}
                className="w-full py-3.5 px-6 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-satoshi font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-lg"
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Applying Pass…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isFullFree ? 'Redeem Pass' : 'Apply to Checkout'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="w-full py-2.5 px-4 rounded-xl text-white/40 hover:text-white text-xs font-satoshi transition-colors cursor-pointer"
              >
                Cancel and return to Settings
              </button>
            </div>
          </div>
        )}

        {/* Claimed / Active State */}
        {state === 'claimed' && (
          <div className="w-full flex flex-col items-center space-y-6 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-[#0A0908] border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400">
                Pass Active
              </span>
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Subscription Active
              </h1>
              <p className="font-satoshi text-xs text-white/60 max-w-xs">
                This pass is currently active on your account. All Pro features are unlocked.
              </p>
            </div>

            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (coupon?.requiresPayment && coupon.couponId) {
                    const checkoutUrl = new URL('/billing/checkout', window.location.origin);
                    checkoutUrl.searchParams.set('planId', coupon.planId || 'PRO_MONTH');
                    checkoutUrl.searchParams.set('months', String(coupon.months || 1));
                    checkoutUrl.searchParams.set('couponId', coupon.couponId);
                    router.push(checkoutUrl.toString());
                  } else {
                    router.push('/settings');
                  }
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-satoshi font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <span>{coupon?.requiresPayment ? 'Proceed to Checkout' : 'Go to Settings'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error / Unavailable State */}
        {state === 'error' && (
          <div className="w-full flex flex-col items-center space-y-6 animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-[#0A0908] border border-white/5 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-7 h-7 text-amber-400" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-400">
                Pass Status
              </span>
              <h1 className="font-clash text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Pass Unavailable
              </h1>
              <p className="font-satoshi text-xs text-white/60 max-w-xs leading-relaxed">
                {errorMessage || 'This pass is no longer active, has reached its redemption limit, or belongs to another account.'}
              </p>
            </div>

            {/* Input to try a different code */}
            <div className="w-full bg-[#0A0908] border border-white/5 rounded-2xl p-4 space-y-3 text-left">
              <label className="text-[10px] font-mono uppercase tracking-wider text-white/40 block">
                Try Another Pass Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter code ID"
                  value={couponId}
                  onChange={(e) => setCouponId(e.target.value.trim())}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder:text-white/20 focus:outline-none focus:border-[#6366F1] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => checkCoupon(couponId)}
                  disabled={!couponId}
                  className="px-4 py-2 bg-[#6366F1] hover:bg-[#5254E8] text-white font-satoshi font-bold text-xs rounded-xl disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Verify
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3 pt-2">
              <button
                type="button"
                onClick={() => router.push('/settings')}
                className="w-full py-3 px-6 rounded-xl bg-[#0A0908] border border-white/10 hover:border-white/20 text-white font-satoshi font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Return to Settings</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

