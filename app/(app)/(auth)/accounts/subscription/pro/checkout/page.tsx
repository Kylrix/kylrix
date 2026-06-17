'use client';

import React, { useEffect, useState, Suspense, useMemo } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Rocket, Heart, Globe, Clock } from 'lucide-react';
import { calculateSubscriptionPrice, PPP_DATA } from '@/lib/subscription/ppp';
import { createBillingCheckoutSessionAction } from '../../../actions/billing';
import { account } from '@/lib/appwrite/client';

function LoadingSpinner({ size = 28 }: { size?: number }) {
  return (
    <svg 
      className="animate-spin text-[#6366F1]" 
      xmlns="http://www.w3.org/2000/svg" 
      fill="none" 
      viewBox="0 0 24 24"
      style={{ width: size, height: size }}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

function CheckoutContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const planId = searchParams.get('planId') || 'PRO_MONTH';
  const months = parseInt(searchParams.get('months') || '1');
  const giftRecipientId = searchParams.get('giftRecipientId') || '';
  const giftRecipientName = searchParams.get('giftRecipientName') || '';
  const giftMessage = searchParams.get('giftMessage') || '';
  const couponId = searchParams.get('couponId') || '';
  const countryCode = 'US';

  const expectedPrice = useMemo(() => {
    return calculateSubscriptionPrice(planId, countryCode, 'CRYPTO', months);
  }, [planId, countryCode, months]);

  const monthlyPrice = useMemo(() => {
    return calculateSubscriptionPrice('PRO_MONTH', countryCode, 'CRYPTO', 1);
  }, [countryCode]);

  const markBillingSyncPending = (userId: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`kylrix:subscription:sync-pending:${userId}`, JSON.stringify({ ts: Date.now() }));
  };

  useEffect(() => {
    const startCheckout = async () => {
      if (authLoading || !user || initializing) return;
      
      setInitializing(true);
      try {
        const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => '');
        const session = await createBillingCheckoutSessionAction({
          planId,
          method: 'CRYPTO',
          countryCode,
          months,
          giftRecipientId: giftRecipientId || undefined,
          giftRecipientName: giftRecipientName || undefined,
          giftMessage: giftMessage || undefined,
          couponId: couponId || undefined,
          jwt: jwt || undefined,
        });

        if (session.url) {
          markBillingSyncPending(user.$id);
          router.push(session.url);
        } else {
          const sessionError = 'error' in session ? session.error : undefined;
          setError(typeof sessionError === 'string' ? sessionError : 'Failed to create checkout session');
          setInitializing(false);
        }
      } catch (err) {
        setError('An unexpected error occurred. Please try again.');
        console.error('Checkout error:', err);
        setInitializing(false);
      }
    };

    startCheckout();
  }, [user, authLoading, initializing, planId, countryCode, months, giftMessage, giftRecipientId, giftRecipientName, couponId, router]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (typeof window !== 'undefined') {
        const currentUrl = window.location.href;
        router.push(`/accounts/login?source=${encodeURIComponent(currentUrl)}`);
      }
    }
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#0A0908]">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A0908] text-white flex items-center justify-center py-8">
      <div className="w-full max-w-lg px-4">
        <div className="p-8 md:p-12 rounded-[40px] bg-white/[0.02] border border-white/[0.05] backdrop-blur-[20px]">
          <div className="space-y-8">
            <div className="text-center">
              <div className="inline-flex p-4 rounded-[20px] bg-[#6366F1]/10 text-[#6366F1] mb-6">
                <Rocket size={32} />
              </div>
              <h1 className="text-2xl md:text-3xl font-black mb-2 tracking-tight">
                {giftRecipientId ? 'Confirm Gift Subscription' : 'Confirm Subscription'}
              </h1>
              <p className="text-white/60 text-sm">
                {giftRecipientId
                  ? `Finalizing a gift for ${giftRecipientName || giftRecipientId}.`
                  : `Finalizing your ${months} month ${months >= 12 ? 'yearly' : 'monthly'} access.`}
              </p>
            </div>

            <div className="p-6 rounded-[24px] bg-white/[0.02] border border-white/[0.05]">
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-[#6366F1]" />
                    <span className="text-sm font-semibold">Territory Rate</span>
                  </div>
                  <span className="text-sm text-white/80">Universal Global</span>
                </div>

                {months > 1 && (
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-[#6366F1]" />
                      <span className="text-sm font-semibold">Monthly Rate</span>
                    </div>
                    <span className="text-sm text-white/80">${monthlyPrice.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Heart size={18} className="text-[#6366F1]" />
                    <span className="text-sm font-semibold">Total Amount</span>
                  </div>
                  <span className="text-lg font-black font-mono">${expectedPrice.toFixed(2)}</span>
                </div>

                <hr className="border-white/5" />

                <div className="flex gap-4">
                  <Clock size={20} className="text-[#6366F1] flex-shrink-0 mt-0.5" />
                  <p className="text-[13px] text-white/50 leading-relaxed">
                    {giftRecipientId
                      ? 'This checkout will create a gift coupon for the recipient. Their account will claim it automatically on login.'
                      : 'Kylrix uses a flexible model. Any amount you send is converted into Pro time. If you send less than the suggested value, your subscription duration will be automatically adjusted to match your payment.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-center">
              {error ? (
                <div>
                  <p className="text-red-500 mb-6 text-sm">{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-6 py-2.5 text-white border border-white/10 rounded-[12px] hover:bg-white/5 transition-all text-sm font-semibold"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <LoadingSpinner size={28} />
                  <p className="text-sm text-white/40">
                    Redirecting to secure payment portal...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ProCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-screen bg-[#0A0908]">
        <LoadingSpinner size={32} />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
