'use client';

import React from 'react';
import { CheckCircle2, ShieldCheck, Zap, Globe, AlertCircle } from 'lucide-react';
import NextLink from 'next/link';
import { useAuth } from '@/context/auth/AuthContext';
import { account } from '@/lib/appwrite/client';
import { verifyProEntitlementAction } from '../../actions/billing';

type VerifyState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'verified'; expiresAt: string | null; source: string }
  | { status: 'not_entitled' };

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

import { getLastActiveAppRedirectUrl } from '@/lib/sdk/ecosystem/useLastActiveApp';

export default function ProSuccessPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [verify, setVerify] = React.useState<VerifyState>({ status: 'loading' });
  const [dashboardUrl] = React.useState(() => {
    if (typeof window !== 'undefined') {
        return getLastActiveAppRedirectUrl(window.location.origin);
    }
    return '/connect';
  });

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (authLoading) return;
      if (!user) {
        if (!cancelled) setVerify({ status: 'unauthenticated' });
        return;
      }
      try {
        const jwt = await account.createJWT().then((res: { jwt?: string }) => res?.jwt || '').catch(() => '');
        const result = await verifyProEntitlementAction(jwt || undefined);
        if (cancelled) return;
        if (!result.authenticated) {
          setVerify({ status: 'unauthenticated' });
          return;
        }
        if (result.active) {
          setVerify({
            status: 'verified',
            expiresAt: result.expiresAt,
            source: result.source,
          });
        } else {
          setVerify({ status: 'not_entitled' });
        }
      } catch {
        if (!cancelled) setVerify({ status: 'not_entitled' });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (!authLoading && !user) {
    return (
      <main className="min-h-screen bg-[#0A0908] text-white flex items-center py-20">
        <div className="w-full max-w-3xl mx-auto px-4">
          <div className="p-8 md:p-12 rounded-[40px] bg-gradient-to-b from-[#6366F1]/5 to-transparent border border-white/5 text-center">
            <div className="mb-8 flex justify-center text-[#F59E0B]">
              <AlertCircle size={48} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black mb-4 tracking-tight">
              Sign in to continue
            </h1>
            <p className="text-white/65 text-sm md:text-base mb-8 max-w-xl mx-auto">
              This page can&apos;t confirm a subscription until you&apos;re signed in. Pro access is never granted just by opening a link.
            </p>
            <NextLink
              href="/accounts/login"
              className="inline-block py-3 px-8 rounded-[16px] bg-[#6366F1] hover:bg-[#6366F1]/90 text-black font-black text-sm md:text-base transition-all"
            >
              Sign in
            </NextLink>
          </div>
        </div>
      </main>
    );
  }

  if (authLoading || verify.status === 'loading') {
    return (
      <main className="min-h-screen bg-[#0A0908] text-white flex items-center py-20">
        <div className="w-full max-w-lg mx-auto px-4 text-center flex flex-col items-center">
          <LoadingSpinner size={32} />
          <p className="mt-4 text-white/70 text-sm">Confirming your subscription…</p>
        </div>
      </main>
    );
  }

  if (verify.status === 'unauthenticated') {
    return (
      <main className="min-h-screen bg-[#0A0908] text-white flex items-center py-20">
        <div className="w-full max-w-3xl mx-auto px-4">
          <div className="p-8 md:p-12 rounded-[40px] bg-gradient-to-b from-[#6366F1]/5 to-transparent border border-white/5 text-center">
            <div className="mb-8 flex justify-center text-[#F59E0B]">
              <AlertCircle size={48} />
            </div>
            <h1 className="text-2xl md:text-3xl font-black mb-4 tracking-tight">
              We couldn&apos;t verify your session
            </h1>
            <p className="text-white/65 text-sm md:text-base mb-8 max-w-xl mx-auto">
              Sign in again so we can confirm your subscription against your account.
            </p>
            <NextLink
              href="/accounts/login"
              className="inline-block py-3 px-8 rounded-[16px] bg-[#6366F1] hover:bg-[#6366F1]/90 text-black font-black text-sm md:text-base transition-all"
            >
              Sign in
            </NextLink>
          </div>
        </div>
      </main>
    );
  }

  if (verify.status === 'not_entitled') {
    return (
      <main className="min-h-screen bg-[#0A0908] text-white flex items-center py-20">
        <div className="w-full max-w-3xl mx-auto px-4">
          <div className="p-8 md:p-16 rounded-[40px] bg-gradient-to-b from-[#6366F1]/5 to-transparent border border-white/5 text-center">
            <div className="mb-8 flex justify-center text-[#F59E0B]">
              <AlertCircle size={56} />
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4 tracking-tight">
              No active Pro subscription found
            </h1>
            <p className="text-white/60 text-base md:text-lg mb-8 max-w-xl mx-auto font-medium leading-relaxed">
              We couldn&apos;t verify paid Pro time on your account. If you just completed checkout, wait a minute for the payment to
              confirm, then refresh. Otherwise you can start or resume checkout from pricing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <NextLink
                href="/pricing"
                className="py-4 px-10 rounded-[16px] bg-[#6366F1] hover:bg-[#6366F1]/90 text-black font-black text-sm md:text-base transition-all"
              >
                View pricing
              </NextLink>
              <NextLink
                href="/accounts/subscription/pro/checkout?planId=PRO_MONTH&months=1&countryCode=US&paymentMethod=CRYPTO"
                className="py-4 px-10 rounded-[16px] border border-white/20 hover:bg-white/5 text-white font-black text-sm md:text-base transition-all"
              >
                Go to checkout
              </NextLink>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const expLabel =
    verify.expiresAt &&
    verify.source !== 'prefs_lifetime' &&
    !Number.isNaN(new Date(verify.expiresAt).getTime())
      ? new Date(verify.expiresAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : null;

  return (
    <main className="min-h-screen bg-[#0A0908] text-white flex items-center py-20">
      <div className="w-full max-w-3xl mx-auto px-4">
        <div className="p-8 md:p-16 rounded-[40px] bg-gradient-to-b from-[#6366F1]/5 to-transparent border border-white/5 backdrop-blur-[30px] text-center relative overflow-hidden">
          <div
            className="absolute -top-[100px] -left-[100px] w-[300px] h-[300px] rounded-full bg-[#6366F1]/10 blur-[50px] pointer-events-none"
          />

          <div className="mb-12 flex justify-center">
            <div
              className="w-[100px] h-[100px] rounded-[30px] bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center border border-[#6366F1]/20 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
            >
              <CheckCircle2 size={50} />
            </div>
          </div>

          <h1
            className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 tracking-tight leading-none"
          >
            Welcome to Pro
          </h1>

          <p className="text-white/60 text-base md:text-lg mb-4 max-w-xl mx-auto leading-relaxed">
            Your subscription is active. You have full access to the high-fidelity Kylrix workspace features included in your plan.
          </p>

          {expLabel && (
            <p className="text-xs text-white/45 mb-8">
              Current period ends {expLabel}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { icon: <ShieldCheck />, title: 'Advanced Security', desc: 'Zero-knowledge DMs and vault isolation' },
              { icon: <Zap />, title: 'Intelligence', desc: 'Neural Knowledge Graph and AI expansion' },
              { icon: <Globe />, title: 'Universal', desc: 'Active across all Kylrix applications' }].map((feature, i) => (
                <div key={i} className="p-6 rounded-[24px] bg-white/[0.02] border border-white/[0.03] flex flex-col items-center text-center">
                  <div className="text-[#6366F1] mb-4">{feature.icon}</div>
                  <h3 className="font-extrabold mb-2 text-sm md:text-base">{feature.title}</h3>
                  <p className="text-white/50 text-xs leading-relaxed">{feature.desc}</p>
                </div>
            ))}
          </div>

          <NextLink
            href={dashboardUrl}
            className="inline-block py-4 px-10 rounded-[16px] bg-white hover:bg-neutral-100 !text-black font-black text-base md:text-lg transition-all hover:-translate-y-0.5 shadow-lg"
          >
            Launch Dashboard
          </NextLink>
        </div>
      </div>
    </main>
  );
}
