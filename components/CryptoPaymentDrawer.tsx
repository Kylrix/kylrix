'use client';

import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Info, Coins } from 'lucide-react';
import { createCryptoInvoiceAction, checkCryptoTransactionStatusAction, getActivePendingCryptoInvoiceAction } from '@/app/(app)/(auth)/accounts/actions/checkout';
import { account } from '@/lib/appwrite/client';
import toast from 'react-hot-toast';

interface CryptoPaymentDrawerProps {
  onClose: () => void;
  months: number;
  countryCode: string;
  planId: string;
}

const SUPPORTED_COINS = [
  { id: 'ltc', name: 'Litecoin', symbol: 'LTC' },
  { id: 'btc', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'trx_usdt', name: 'Tether (TRC20)', symbol: 'USDT' }
];

export const CryptoPaymentDrawer: React.FC<CryptoPaymentDrawerProps> = ({
  onClose,
  months,
  countryCode,
  planId
}) => {
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('pending');

  useEffect(() => {
    const restorePendingInvoice = async () => {
      try {
        setLoading(true);
        const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
        const pending = await getActivePendingCryptoInvoiceAction({ jwt });
        if (pending && pending.success) {
          setSelectedCoin(pending.ticker?.toLowerCase() === 'usdt' ? 'trx_usdt' : pending.ticker?.toLowerCase() || null);
          setInvoice(pending);
        }
      } catch {} finally {
        setLoading(false);
      }
    };

    restorePendingInvoice();
  }, []);

  const handleSelectCoin = async (coinId: string) => {
    setSelectedCoin(coinId);
    setLoading(true);
    setInvoice(null);
    setPaymentStatus('pending');

    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => undefined);
      const res = await createCryptoInvoiceAction({
        ticker: coinId,
        planId,
        months,
        countryCode,
        jwt,
        baseUrl: window.location.origin
      });

      if (res.success) {
        setInvoice(res);
      } else {
        toast.error(res.error || 'Failed to generate invoice');
        setSelectedCoin(null);
      }
    } catch (err: any) {
      toast.error('An unexpected error occurred generating payment details');
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
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 ease-in-out cursor-default"
        onClick={onClose}
      />
      
      <div className="fixed bottom-0 left-0 right-0 max-h-[90vh] bg-gradient-to-b from-[#1F1D1B] to-[#161412] border-t border-white/8 rounded-t-[28px] z-[100] text-white p-6 md:p-8 flex flex-col gap-5 animate-slide-up overflow-y-auto">
        <div className="w-10 h-1 bg-white/12 rounded-[2px] mx-auto mb-2 flex-shrink-0" />

        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-white text-lg font-black tracking-tight leading-tight">
              Pay with Cryptocurrency
            </h3>
            <p className="text-white/40 text-[11px] font-bold mt-1 uppercase tracking-wider font-mono">
              In-app Direct Checkout
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {!selectedCoin && (
          <div className="flex flex-col gap-3 py-4">
            <span className="text-[10px] text-white/40 font-black uppercase tracking-wider block mb-1">
              Select Asset
            </span>
            {SUPPORTED_COINS.map(coin => (
              <button
                key={coin.id}
                onClick={() => handleSelectCoin(coin.id)}
                className="w-full p-4 rounded-[16px] border border-white/8 hover:border-[#6366F1] bg-white/2 hover:bg-[#6366F1]/5 flex items-center justify-between transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/40 group-hover:text-white transition-all">
                    <Coins size={18} />
                  </div>
                  <span className="text-sm font-extrabold">{coin.name}</span>
                </div>
                <span className="text-xs font-bold text-white/40 font-mono tracking-wider">{coin.symbol}</span>
              </button>
            ))}
          </div>
        )}

        {selectedCoin && loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            <span className="text-white/40 text-xs font-bold font-mono">Requesting secure invoice...</span>
          </div>
        )}

        {selectedCoin && !loading && invoice && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-4">
              
              <div>
                <span className="text-[10px] text-white/40 font-black uppercase tracking-wider block mb-1">
                  Send Exactly
                </span>
                <div className="flex items-center justify-between gap-3 bg-white/4 rounded-xl px-4 py-3 border border-white/5">
                  <code className="text-sm font-black font-mono text-white/90 truncate">
                    {invoice.expected_crypto} {selectedCoin.toUpperCase().replace('TRX_', '')}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(invoice.expected_crypto.toString(), false)}
                    className="text-white/40 hover:text-white flex-shrink-0"
                  >
                    {copiedAmount ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-white/40 font-black uppercase tracking-wider block mb-1">
                  Destination Address
                </span>
                <div className="flex items-center justify-between gap-3 bg-white/4 rounded-xl px-4 py-3 border border-white/5">
                  <code className="text-xs font-bold font-mono text-white/80 truncate select-all">
                    {invoice.address_in}
                  </code>
                  <button 
                    onClick={() => copyToClipboard(invoice.address_in, true)}
                    className="text-white/40 hover:text-white flex-shrink-0"
                  >
                    {copiedAddress ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-center py-4 bg-white/2 rounded-xl border border-white/5">
                <img
                  src={`https://api.blockbee.io/${selectedCoin.toLowerCase()}/qrcode/?address=${invoice.address_in}&value=${invoice.expected_crypto}&size=180&apikey=${process.env.BLOCKBEE_API || ''}`}
                  alt="Invoice QR Code"
                  className="rounded-lg bg-white p-2"
                />
              </div>

              <div className="flex gap-2.5 items-start text-[11px] text-white/40 leading-relaxed font-medium">
                <Info size={14} className="flex-shrink-0 mt-0.5 text-[#6366F1]" />
                <p>
                  Payments below {invoice.minimum_transaction_coin} {selectedCoin.toUpperCase().replace('TRX_', '')} will be ignored. Confirm the transaction fee in your wallet to ensure the final payload reaches this consensus limit.
                </p>
              </div>

            </div>

            <div className="p-4 rounded-xl bg-white/2 border border-white/5 text-center flex flex-col items-center justify-center gap-2">
              {paymentStatus === 'pending_confirmation' ? (
                <div className="flex items-center gap-2 text-[#6366F1]">
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
              className="w-full py-3 border border-white/8 hover:border-white/20 rounded-[14px] text-xs font-black text-white/60 hover:text-white transition-all uppercase tracking-wider"
            >
              Choose different coin
            </button>
          </div>
        )}

        <div className="pt-2 border-t border-white/8 text-center flex justify-between items-center text-[10px] text-white/30 uppercase font-black tracking-wider">
          <span>🔒 Direct P2P Payment</span>
          <span>Powered by BlockBee</span>
        </div>
      </div>
    </>
  );
};
