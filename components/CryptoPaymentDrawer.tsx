'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Info, Coins } from 'lucide-react';
import { createCryptoInvoiceAction, checkCryptoTransactionStatusAction, getActivePendingCryptoInvoiceAction, getActiveBlockBeeCoinsAction } from '@/app/(app)/(auth)/accounts/actions/checkout';
import { account } from '@/lib/appwrite/client';
import toast from 'react-hot-toast';

interface CryptoPaymentDrawerProps {
  onClose: () => void;
  months: number;
  countryCode: string;
  planId: string;
}
const getCoinLogoUrl = (ticker: string) => {
  let cleanTicker = ticker.toLowerCase();
  cleanTicker = cleanTicker.split('/').pop() || cleanTicker;
  if (cleanTicker.includes('usdt')) {
    cleanTicker = 'usdt';
  } else if (cleanTicker.includes('usdc')) {
    cleanTicker = 'usdc';
  }
  return `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${cleanTicker}.png`;
};

export const CryptoPaymentDrawer: React.FC<CryptoPaymentDrawerProps> = ({
  onClose,
  months,
  countryCode,
  planId
}) => {
  const [coins, setCoins] = useState<Array<{ id: string; name: string; symbol: string }>>([]);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [localMonths, setLocalMonths] = useState(months);
  const [upsellDetails, setUpsellDetails] = useState<{
    ticker: string;
    minimumLimit: number;
    expectedCrypto: number;
    expectedUsd: number;
  } | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);

  const handleCloseAttempt = () => {
    if (selectedCoin || invoice) {
      setShowConfirmExit(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCloseAttempt();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCoin, invoice]);

  useEffect(() => {
    const initializeDrawer = async () => {
      try {
        setLoading(true);
        const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
        
        // Fetch active merchant coins from BlockBee
        const coinsRes = await getActiveBlockBeeCoinsAction({ jwt });
        if (coinsRes.success && coinsRes.coins) {
          setCoins(coinsRes.coins);
        }

        const pending = await getActivePendingCryptoInvoiceAction({ jwt });
        if (pending && pending.success) {
          const tick = pending.ticker?.toLowerCase() || '';
          setSelectedCoin(tick.includes('usdt') ? 'trc20/usdt' : (tick.includes('sol') ? 'sol/sol' : tick || null));
          setInvoice(pending);
        }
      } catch {} finally {
        setLoading(false);
      }
    };

    initializeDrawer();
  }, []);

  const handleSelectCoin = async (coinId: string, overrideMonths?: number) => {
    const activeMonths = overrideMonths !== undefined ? overrideMonths : localMonths;
    const activePlanId = activeMonths >= 12 ? 'PRO_YEAR' : 'PRO_MONTH';

    setSelectedCoin(coinId);
    setLoading(true);
    setInvoice(null);
    setPaymentStatus('pending');
    setPaymentError(null);
    setUpsellDetails(null);

    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
      const res = await createCryptoInvoiceAction({
        ticker: coinId,
        planId: activePlanId,
        months: activeMonths,
        countryCode,
        jwt,
        baseUrl: window.location.origin
      });

      if (res.success) {
        setInvoice(res);
      } else if (res.minimum_transaction_coin) {
        setUpsellDetails({
          ticker: res.ticker || coinId.toUpperCase(),
          minimumLimit: res.minimum_transaction_coin,
          expectedCrypto: res.expected_crypto || 0,
          expectedUsd: res.expected_usd || 0,
        });
      } else {
        setPaymentError(res.error || 'Failed to generate invoice');
        setSelectedCoin(null);
      }
    } catch (err: any) {
      setPaymentError('An unexpected error occurred generating payment details');
      setSelectedCoin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!invoice?.paymentId || paymentStatus === 'completed') return;

    const interval = setInterval(async () => {
      try {
        const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
        const res = await checkCryptoTransactionStatusAction({
          paymentId: invoice.paymentId,
          jwt
        });

        if (res.status === 'completed' || res.status === 'success') {
          setPaymentStatus('completed');
          toast.success('Subscription successfully upgraded! Refreshing...');
          clearInterval(interval);
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else if (res.status === 'pending_confirmation') {
          setPaymentStatus('pending_confirmation');
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [invoice, paymentStatus]);

  const copyToClipboard = (text: string, isAddress: boolean) => {
    navigator.clipboard.writeText(text);
    if (isAddress) {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else {
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 2000);
    }
    toast.success('Copied to clipboard');
  };

  return (
    <>
      {/* Backdrop with Blur */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[10000] transition-opacity duration-300 ease-in-out cursor-default"
        onClick={handleCloseAttempt}
      />
      
      {/* Responsive Slide-up Drawer (Mobile) or Right-side Sidebar (Desktop) */}
      <div className="fixed bottom-0 md:bottom-auto md:top-0 right-0 left-0 md:left-auto w-full md:w-[480px] h-[60vh] md:h-screen bg-gradient-to-b from-[#161412] to-[#0B0A09] border-t md:border-t-0 md:border-l border-white/5 shadow-[0_-12px_36px_rgba(0,0,0,0.5),0_16px_48px_rgba(0,0,0,0.7)] z-[10001] text-white p-6 md:p-8 flex flex-col gap-6 animate-slide-in-right overflow-y-auto font-satoshi">
        
        {/* Spotlight Ambient Glow */}
        <div className="absolute top-0 right-0 left-0 h-64 bg-radial-glow pointer-events-none opacity-20" 
             style={{ backgroundImage: 'radial-gradient(circle at top, rgba(99,102,241,0.15) 0%, transparent 70%)' }} />
             
        <div className="w-10 h-1 bg-white/10 rounded-[2px] mx-auto mb-2 flex-shrink-0 md:hidden" />
 
        {/* Title / Close Header */}
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div>
            <h3 className="text-white text-xl font-black font-clash tracking-tight leading-tight">
              Pay with Cryptocurrency
            </h3>
            <p className="text-[#6366F1] text-[10px] font-black mt-1 uppercase tracking-widest font-mono">
              Secure P2P Consensus Checkout
            </p>
          </div>
          <button 
            onClick={handleCloseAttempt}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all hover:scale-105 border border-white/5"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col justify-between relative z-10 gap-6">
          
          {paymentError && (
            <div className="flex-1 flex flex-col justify-center gap-5 py-4 animate-slide-in-right">
              <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-400">
                  <Info size={16} />
                  <span className="text-xs font-black font-mono uppercase tracking-wider">Payment Limit Warning</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed font-satoshi">
                  {paymentError}
                </p>
              </div>
              <button
                onClick={() => setPaymentError(null)}
                className="w-full py-3.5 bg-[#6366F1] hover:bg-[#5356e3] active:scale-[0.98] rounded-xl text-xs font-black text-white transition-all uppercase tracking-wider font-mono shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
              >
                Choose Another Asset
              </button>
            </div>
          )}

          {upsellDetails && (
            <div className="flex-1 flex flex-col justify-center gap-5 py-4 animate-slide-in-right">
              <div className="p-5 rounded-2xl bg-[#161412] border border-white/5 flex flex-col gap-4 shadow-lg">
                <div className="flex items-center gap-2 text-amber-400">
                  <Info size={16} />
                  <span className="text-xs font-black font-mono uppercase tracking-wider">Payment Limit Intercept</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed font-satoshi">
                  {upsellDetails.ticker.replace('TRX_', '')} requires a minimum checkout of <code className="font-mono text-amber-400 font-bold">{upsellDetails.minimumLimit} {upsellDetails.ticker.replace('TRX_', '')}</code>.
                </p>
                <p className="text-xs text-white/50 leading-relaxed font-satoshi">
                  To unlock {upsellDetails.ticker.replace('TRX_', '')} checkout, you can extend your plan duration to meet this limit, or choose a low-fee asset like LTC or SOL.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    const nextMonths = localMonths < 3 ? 3 : 12;
                    setLocalMonths(nextMonths);
                    await handleSelectCoin(selectedCoin!, nextMonths);
                  }}
                  className="w-full py-3.5 bg-[#6366F1] hover:bg-[#5356e3] active:scale-[0.98] rounded-xl text-xs font-black text-white transition-all uppercase tracking-wider font-mono shadow-[0_4px_12px_rgba(99,102,241,0.2)]"
                >
                  Upgrade to {localMonths < 3 ? '3-Month Plan' : '12-Month Plan'}
                </button>
                <button
                  onClick={() => {
                    setUpsellDetails(null);
                    setSelectedCoin(null);
                  }}
                  className="w-full py-3.5 border border-white/5 hover:border-white/10 bg-white/2 hover:bg-white/4 rounded-xl text-xs font-black text-white/60 hover:text-white transition-all uppercase tracking-wider font-mono"
                >
                  Pay with LTC / SOL Instead
                </button>
              </div>
            </div>
          )}

          {!paymentError && !upsellDetails && !selectedCoin && (
            <div className="flex flex-col gap-4 py-2">
              <span className="text-[10px] text-white/40 font-black uppercase tracking-wider block font-mono">
                Select Network Asset
              </span>
              <div className="flex flex-col gap-3">
                {coins.map(coin => (
                  <button
                    key={coin.id}
                    onClick={() => handleSelectCoin(coin.id)}
                    className="w-full p-5 rounded-[20px] border border-white/5 hover:border-[#6366F1]/40 bg-[#161412] hover:bg-[#6366F1]/5 flex items-center justify-between transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-[0_0_16px_rgba(99,102,241,0.15)] group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/30 group-hover:text-white transition-all overflow-hidden relative">
                        <img
                          src={getCoinLogoUrl(coin.id)}
                          alt={coin.symbol}
                          className="w-7 h-7 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <div className="coin-fallback hidden">
                          <Coins size={20} />
                        </div>
                      </div>
                      <span className="text-sm font-extrabold">{coin.name}</span>
                    </div>
                    <span className="text-xs font-bold text-[#6366F1] font-mono tracking-wider bg-[#6366F1]/10 px-2.5 py-1 rounded-md">{coin.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedCoin && !upsellDetails && loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
              <div className="w-8 h-8 border-2 border-white/20 border-t-[#6366F1] rounded-full animate-spin" />
              <span className="text-white/40 text-xs font-bold font-mono">Requesting secure invoice...</span>
            </div>
          )}

          {selectedCoin && !upsellDetails && !loading && invoice && (
            <div className="flex flex-col gap-5">
              <div className="p-5 rounded-2xl bg-[#0B0A09] border border-white/5 flex flex-col gap-4 shadow-inner">
                
                <div>
                  <span className="text-[10px] text-white/40 font-black uppercase tracking-wider block font-mono mb-1.5">
                    Send Exactly
                  </span>
                  <div className="flex items-center justify-between gap-3 bg-[#161412] rounded-xl px-4 py-3.5 border border-white/5">
                    <code className="text-sm font-black font-mono text-white leading-none truncate">
                      {invoice.expected_crypto} {selectedCoin.toUpperCase().replace('TRX_', '')}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(invoice.expected_crypto.toString(), false)}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      {copiedAmount ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-white/40 font-black uppercase tracking-wider block font-mono mb-1.5">
                    Destination Address
                  </span>
                  <div className="flex items-center justify-between gap-3 bg-[#161412] rounded-xl px-4 py-3.5 border border-white/5">
                    <code className="text-xs font-bold font-mono text-white/80 leading-none truncate select-all">
                      {invoice.address_in}
                    </code>
                    <button 
                      onClick={() => copyToClipboard(invoice.address_in, true)}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      {copiedAddress ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-center py-5 bg-[#161412] rounded-xl border border-white/5 shadow-inner">
                  {(() => {
                    const cleanTicker = selectedCoin.toLowerCase().split('/').pop() || '';
                    const paymentUri = cleanTicker === 'btc' ? `bitcoin:${invoice.address_in}?amount=${invoice.expected_crypto}` :
                                       cleanTicker === 'ltc' ? `litecoin:${invoice.address_in}?amount=${invoice.expected_crypto}` :
                                       cleanTicker === 'eth' ? `ethereum:${invoice.address_in}?amount=${invoice.expected_crypto}` :
                                       cleanTicker === 'sol' ? `solana:${invoice.address_in}?amount=${invoice.expected_crypto}` :
                                       invoice.address_in;
                    return (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(paymentUri)}`}
                        alt="Invoice QR Code"
                        className="rounded-lg bg-white p-2.5 shadow-md border border-white/10"
                      />
                    );
                  })()}
                </div>

                <div className="flex gap-2.5 items-start text-[11px] text-white/40 leading-relaxed font-medium">
                  <Info size={14} className="flex-shrink-0 mt-0.5 text-[#6366F1]" />
                  <p>
                    Payments below {invoice.minimum_transaction_coin} {selectedCoin.toUpperCase().replace('TRX_', '')} will be ignored. Confirm the transaction fee in your wallet to ensure the final payload reaches this consensus limit.
                  </p>
                </div>

              </div>

              {/* Status Section */}
              <div className="p-4 rounded-xl bg-[#0B0A09] border border-white/5 text-center flex flex-col items-center justify-center gap-2">
                {paymentStatus === 'pending_confirmation' ? (
                  <div className="flex items-center gap-2.5 text-[#6366F1]">
                    <div className="w-4 h-4 border-2 border-[#6366F1]/20 border-t-[#6366F1] rounded-full animate-spin" />
                    <span className="text-xs font-black font-mono">Payment detected! Waiting for block confirmation...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-white/40">
                    <div className="w-3.5 h-3.5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                    <span className="text-xs font-bold font-mono">Waiting for payment on network...</span>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedCoin(null)}
                className="w-full py-3.5 border border-white/5 hover:border-white/20 bg-white/2 hover:bg-white/4 rounded-[14px] text-xs font-black text-white/60 hover:text-white transition-all uppercase tracking-wider font-mono"
              >
                Choose different coin
              </button>
            </div>
          )}

          {/* Persistent Footer details */}
          <div className="pt-4 border-t border-white/5 text-center flex justify-between items-center text-[9px] text-white/30 uppercase font-black tracking-widest font-mono">
            <span>🔒 Direct P2P Payment</span>
            <span>Powered by BlockBee</span>
          </div>

        </div>

      </div>

      {showConfirmExit && (
        <ConfirmationDrawer
          onConfirm={onClose}
          onCancel={() => setShowConfirmExit(false)}
          title="Abandon Checkout?"
          description="If you have already sent cryptocurrency, closing this drawer will cancel active payment tracking. Are you sure you want to exit?"
        />
      )}
    </>
  );
};

export const ConfirmationDrawer: React.FC<{
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  description: string;
}> = ({ onConfirm, onCancel, title, description }) => {
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/80 z-[10002] transition-opacity duration-300 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed bottom-0 left-0 right-0 w-full max-h-[40vh] bg-[#161412] border-t border-white/10 rounded-t-[32px] p-6 flex flex-col gap-5 z-[10003] animate-slide-up text-white font-satoshi shadow-[0_-16px_48px_rgba(0,0,0,0.8)]">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-2 flex-shrink-0" />
        <div className="flex flex-col gap-2">
          <h4 className="text-white text-lg font-black font-clash tracking-tight">
            {title}
          </h4>
          <p className="text-white/60 text-xs leading-relaxed font-medium">
            {description}
          </p>
        </div>
        <div className="flex gap-3 mt-2">
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 active:scale-[0.98] rounded-xl text-xs font-black text-white transition-all uppercase tracking-wider font-mono shadow-[0_4px_12px_rgba(239,68,68,0.2)]"
          >
            Yes, Exit
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/4 rounded-xl text-xs font-black text-white/80 transition-all uppercase tracking-wider font-mono"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
};
