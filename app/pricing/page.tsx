'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Info, Sparkles, Globe, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';

import Logo from '@/components/Logo';
import PaymentMethodDrawer from '@/components/PaymentMethodDrawer';
import { useAuth } from '@/context/auth/AuthContext';
import { getEcosystemUrl } from '@/lib/ecosystem';
import { useSubscription } from '@/context/subscription/SubscriptionContext';

export default function PricingPage() {
  const router = useRouter();
  const { isAuthenticated, openIDMWindow } = useAuth();
  const { prices, detectedRegion } = useSubscription();
  const [months, setMonths] = useState(1);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);

  const basePrice = prices['PRO'] || 10;
  const isYearly = months >= 12;
  
  // Calculate display price: if 12+ months, apply the 10-for-12 discount
  const totalPrice = useMemo(() => {
    if (months >= 12) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return (years * 10 * basePrice) + (remainingMonths * basePrice);
    }
    return months * basePrice;
  }, [months, basePrice]);

  const handleSubscribe = () => {
    setPaymentDrawerOpen(true);
  };

  const handlePaymentMethodSelect = (method: 'kylrix' | 'external') => {
    const planId = months >= 12 ? 'PRO_YEAR' : 'PRO_MONTH';
    const checkoutUrl = `${getEcosystemUrl('accounts')}/subscription/pro/checkout?planId=${planId}&months=${months}&countryCode=${detectedRegion.countryCode}&paymentMethod=${method}&source=${encodeURIComponent(window.location.href)}`;
    
    if (!isAuthenticated) {
      openIDMWindow(checkoutUrl);
      return;
    }
    
    setIsRedirecting(true);
    router.push(checkoutUrl);
  };

  return (
    <div className="min-h-screen bg-black text-white relative pt-12 pb-20 px-4 md:px-6">
      
      {/* Conditionally Render Drawer (Global Unmount Policy) */}
      {paymentDrawerOpen && (
        <PaymentMethodDrawer
          onClose={() => setPaymentDrawerOpen(false)}
          months={months}
          totalPrice={totalPrice}
          onPaymentMethodSelect={handlePaymentMethodSelect}
        />
      )}

      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="w-11 h-11 mb-6 bg-[#161412] text-white border border-white/6 rounded-[14px] flex items-center justify-center hover:bg-[#1C1A18] hover:-translate-x-0.5 transition-all"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Header Section */}
        <div className="text-center mb-10 md:mb-14">
          <h1 className="text-white font-black text-4xl md:text-6xl tracking-tight leading-tight mb-3 font-mono">
            Kylrix Pro
          </h1>
          <p className="text-white/60 text-sm md:text-base font-medium max-w-xl mx-auto leading-relaxed">
            Get full access to the ecosystem with a plan that scales with you and respects your local economy.
          </p>
        </div>

        {/* Main Box Card */}
        <div className="bg-[#161514] border border-white/8 rounded-[28px] p-6 md:p-10 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
            
            {/* Left Options/Features */}
            <div className="flex flex-col gap-6">
              <div>
                <span className="text-[10px] text-[#6366F1] font-black uppercase tracking-wider block mb-2 font-mono">
                  Plan Duration
                </span>
                <h3 className="text-white text-xl md:text-2xl font-black tracking-tight leading-tight mb-4">
                  {months} {months === 1 ? 'Month' : 'Months'}
                </h3>
                
                {/* Native Custom Styled Slider */}
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

              {/* Feature Checklist */}
              <div className="flex flex-col gap-3.5 pt-2">
                {[
                  { icon: ShieldCheck, text: 'Unlimited Vault & Notes storage' },
                  { icon: Globe, text: 'Universal Identity across all apps' },
                  { icon: Sparkles, text: 'Full AI Neural Graph access' }
                ].map((feat, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <feat.icon size={18} className="text-[#6366F1] flex-shrink-0" />
                    <span className="text-sm font-bold text-white/80">{feat.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pricing Summary Box */}
            <div className="p-6 rounded-[24px] bg-[#1F1D1B] border border-white/8 text-center flex flex-col items-center justify-center gap-4">
              <div>
                <span className="text-white/40 text-[11px] font-bold block mb-1">
                  Total Amount
                </span>
                <span className="text-4xl md:text-5xl font-black text-white font-mono leading-none tracking-tight">
                  ${totalPrice.toFixed(2)}
                </span>
              </div>

              {detectedRegion.countryCode !== 'US' && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[#6366F1] font-black text-xs">
                    Regional Price Applied ({detectedRegion.name})
                  </span>
                  <span className="text-[10px] text-white/40 font-semibold">
                    Prices are adjusted to be fair everywhere.
                  </span>
                </div>
              )}

              <button 
                onClick={handleSubscribe}
                disabled={isRedirecting}
                className="w-full py-3.5 mt-4 bg-white hover:bg-neutral-200 disabled:opacity-40 text-black font-black text-sm md:text-base rounded-[16px] transition-all shadow-[0_4px_12px_rgba(255,255,255,0.05)]"
              >
                {isRedirecting ? 'Redirecting...' : 'Continue to Checkout'}
              </button>
              
              <p className="text-[10px] text-white/30 font-medium leading-normal px-2 mt-2">
                Your subscription time is calculated based on your contribution. Any payment amount is automatically converted into active Pro time.
              </p>
            </div>

          </div>
        </div>

        {/* Free Plan Callout */}
        <div className="mt-8 text-center">
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-6 py-3.5 rounded-full bg-[#1F1D1B] border border-white/8">
            <span className="text-sm font-bold text-white">
              Kylrix Free is free forever. No pressure.
            </span>
            
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
