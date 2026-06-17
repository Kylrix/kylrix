'use client';

import React, { useState, useEffect } from 'react';
import { X, ExternalLink, Info } from 'lucide-react';
import { createCryptoInvoiceAction, getActivePendingCryptoInvoiceAction } from '@/app/(app)/(auth)/accounts/actions/checkout';
import { account } from '@/lib/appwrite/client';
import toast from 'react-hot-toast';

interface CryptoPaymentDrawerProps {
  onClose: () => void;
  months: number;
  countryCode: string;
  planId: string;
}

export const CryptoPaymentDrawer: React.FC<CryptoPaymentDrawerProps> = ({
  onClose,
  months,
  countryCode,
  planId
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCheckoutRedirect = async () => {
    setLoading(true);
    setPaymentError(null);

    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
      
      const res = await createCryptoInvoiceAction({
        planId,
        months,
        countryCode,
        jwt,
        baseUrl: window.location.origin
      });

      if (res.success && res.paymentUrl) {
        window.location.href = res.paymentUrl;
      } else {
        setPaymentError(res.error || 'Failed to generate checkout session');
      }
    } catch (err: any) {
      setPaymentError('An unexpected error occurred connecting to BlockBee.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[10000] transition-opacity duration-300 ease-in-out cursor-default"
        onClick={onClose}
      />
      
      <div className="fixed bottom-0 md:bottom-auto md:top-0 right-0 left-0 md:left-auto w-full md:w-[480px] h-[40vh] md:h-screen bg-gradient-to-b from-[#161412] to-[#0B0A09] border-t md:border-t-0 md:border-l border-white/5 shadow-[0_-12px_36px_rgba(0,0,0,0.5),0_16px_48px_rgba(0,0,0,0.7)] z-[10001] text-white p-6 md:p-8 flex flex-col gap-6 animate-slide-in-right overflow-y-auto font-satoshi">
        
        <div className="absolute top-0 right-0 left-0 h-64 bg-radial-glow pointer-events-none opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle at top, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
             
        <div className="w-10 h-1 bg-white/10 rounded-[2px] mx-auto mb-2 flex-shrink-0 md:hidden" />
 
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-white text-xl font-black font-clash tracking-tight leading-tight">
              Pay with Cryptocurrency
            </h3>
            <p className="text-[#6366F1] text-[10px] font-black mt-1 uppercase tracking-widest font-mono">
              Secure Hosted Checkout
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all hover:scale-105 border border-white/5"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col justify-center relative z-10 gap-6">
          
          {paymentError && (
            <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-red-400">
                <Info size={16} />
                <span className="text-xs font-black font-mono uppercase tracking-wider">Gateway Error</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed font-satoshi">
                {paymentError}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-white/70">
              You will be redirected to our secure payment partner, BlockBee, to complete your cryptocurrency transaction.
            </p>
            
            <button
              onClick={handleCheckoutRedirect}
              disabled={loading}
              className="w-full py-4 bg-[#6366F1] hover:bg-[#5356e3] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-black text-white transition-all uppercase tracking-wider font-mono shadow-[0_4px_12px_rgba(99,102,241,0.2)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Generating Session...
                </>
              ) : (
                <>
                  Proceed to BlockBee <ExternalLink size={16} />
                </>
              )}
            </button>
          </div>

          <div className="pt-6 border-t border-white/5 text-center flex justify-between items-center text-[9px] text-white/30 uppercase font-black tracking-widest font-mono mt-auto">
            <span>🔒 Secure Encryption</span>
            <span>Powered by BlockBee</span>
          </div>
        </div>
      </div>
    </>
  );
};
