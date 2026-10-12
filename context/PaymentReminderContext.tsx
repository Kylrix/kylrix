'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import {
  checkAndRemindPaymentIntentAction,
  clearPaymentIntentAction,
  PaymentIntentRecord,
} from '@/lib/actions/billing/payment-intent';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { hasEffectivePaidAccess } from '@/lib/utils';
import { account } from '@/lib/appwrite/client';

interface PaymentReminderContextType {
  pendingIntent: PaymentIntentRecord | null;
  dismissReminder: () => void;
  resumeCheckout: () => void;
}

const PaymentReminderContext = createContext<PaymentReminderContextType | undefined>(undefined);

export function PaymentReminderProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { currentTier } = useSubscription();
  const { open: openUnified } = useUnifiedDrawer();
  const [pendingIntent, setPendingIntent] = useState<PaymentIntentRecord | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const checkedRef = useRef(false);

  const isPaid = hasEffectivePaidAccess(user, currentTier);

  // If user is paid, automatically clear any pending checkout intent
  useEffect(() => {
    if (isAuthenticated && isPaid) {
      account.createJWT().then((res: any) => {
        const jwt = res?.jwt || undefined;
        void clearPaymentIntentAction(jwt);
      }).catch(() => {});
      setPendingIntent(null);
      setShowDrawer(false);
    }
  }, [isAuthenticated, isPaid]);

  // Check for >= 1 hour pending intents once per session
  useEffect(() => {
    if (!isAuthenticated || isPaid || checkedRef.current) return;
    checkedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
        const res = await checkAndRemindPaymentIntentAction(jwt);
        if (res.hasPending && res.record) {
          setPendingIntent(res.record);
          setShowDrawer(true);
        }
      } catch {
        // silent
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isPaid]);

  const dismissReminder = async () => {
    setShowDrawer(false);
    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
      await clearPaymentIntentAction(jwt);
      setPendingIntent(null);
    } catch {}
  };

  const resumeCheckout = () => {
    setShowDrawer(false);
    if (pendingIntent) {
      if (pendingIntent.checkoutUrl) {
        window.open(pendingIntent.checkoutUrl, '_blank', 'noopener,noreferrer');
      } else {
        openUnified('pricing', { tier: pendingIntent.tier });
      }
    }
  };

  return (
    <PaymentReminderContext.Provider value={{ pendingIntent, dismissReminder, resumeCheckout }}>
      {children}
      {showDrawer && pendingIntent && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[9999] max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="p-4 rounded-2xl bg-[#161412] border border-white/10 shadow-2xl space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center shrink-0">
                  <Sparkles size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-white font-clash truncate">
                    Finish upgrading your workspace
                  </h4>
                  <p className="text-[10px] text-white/50 font-satoshi truncate">
                    You started an upgrade to {pendingIntent.tier === 'TEAMS' ? 'Teams' : 'Pro'} earlier.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissReminder}
                className="w-6 h-6 rounded-lg bg-[#0A0908] text-white/40 hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={dismissReminder}
                className="flex-1 py-2 rounded-xl bg-[#0A0908] border border-white/6 hover:bg-[#1C1A18] text-white/70 text-xs font-bold font-satoshi transition-all cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={resumeCheckout}
                className="flex-1 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white text-xs font-bold font-satoshi flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-[#6366F1]/20 cursor-pointer"
              >
                <span>Finish Up</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </PaymentReminderContext.Provider>
  );
}

export function usePaymentReminder() {
  const context = useContext(PaymentReminderContext);
  if (!context) {
    return {
      pendingIntent: null,
      dismissReminder: () => {},
      resumeCheckout: () => {},
    };
  }
  return context;
}
