'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CreditCard, 
  Gift, 
  Globe, 
  Tag, 
  ChevronLeft, 
  Check, 
  ArrowRight,
  Sparkles,
  Ticket,
  Clock,
  Printer,
  Search
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { account, AppwriteService } from '@/lib/appwrite';
import { listCouponsAction as getMyCouponsAction } from '../actions/coupons';
import { listBillingTransactionsAction } from '../actions/billing';
import toast from 'react-hot-toast';

export default function BillingPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // Plan states
  const [isPro, setIsPro] = useState(false);
  const [currentTier, setCurrentTier] = useState('FREE');
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Global settings
  const region = 'DEFAULT';

  // Coupon states
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);

  // Gift states
  const [giftUsername, setGiftUsername] = useState('');
  const [giftMonths, setGiftMonths] = useState('1');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);

  // Transaction History States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const loadTransactions = async () => {
    if (!user?.$id) return;
    try {
      setLoadingTransactions(true);
      const jwtRes = await account.createJWT().then(res => res.jwt).catch(() => undefined);
      const res = await listBillingTransactionsAction(jwtRes);
      if (res.success && res.transactions) {
        setTransactions(res.transactions);
      }
    } catch (err) {
      console.warn('Failed to load transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadSubscriptionStatus();
      loadCoupons();
      loadTransactions();
    }
  }, [user]);

  const loadSubscriptionStatus = async () => {
    if (!user?.$id) return;
    try {
      setLoadingPlan(true);
      const status = await AppwriteService.getGlobalProfileStatus(user.$id);
      if (status?.profile) {
        const tier = status.profile.tier || 'FREE';
        setCurrentTier(tier);
        setIsPro(tier === 'PRO' || tier === 'LIFETIME' || tier === 'ORG');
      }
    } catch (err) {
      console.warn('Failed to load subscription plan status:', err);
    } finally {
      setLoadingPlan(false);
    }
  };

  const loadCoupons = async () => {
    if (!user?.$id) return;
    try {
      setLoadingCoupons(true);
      const jwtRes = await account.createJWT().then(res => res.jwt).catch(() => undefined);
      const list = await getMyCouponsAction(jwtRes);
      setCoupons(list || []);
    } catch (err) {
      console.warn('Failed to load user coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  };

  const handleGiftCheckout = useCallback(async () => {
    const recipientQuery = giftUsername.trim();
    if (!recipientQuery) {
      setGiftError('Enter a recipient username.');
      return;
    }

    setGiftLoading(true);
    setGiftError(null);

    try {
      const matches = await AppwriteService.searchGlobalProfiles(recipientQuery, 1);
      const recipient = (matches[0] as any) || null;

      let recipientUserId = recipient?.userId || null;
      let recipientLabel = recipient?.displayName || recipient?.username || null;

      if (!recipientUserId) {
        const directLookup = await AppwriteService.getGlobalProfileStatus(recipientQuery);
        recipientUserId = directLookup?.profile?.userId || null;
        recipientLabel = directLookup?.profile?.displayName || directLookup?.profile?.username || recipientLabel;
      }

      if (!recipientUserId) {
        throw new Error('No matching account found for that username or user ID.');
      }

      const normalizedMonths = Math.max(1, Number.parseInt(giftMonths || '1', 10) || 1);
      const checkoutUrl = new URL('/accounts/subscription/pro/checkout', window.location.origin);
      checkoutUrl.searchParams.set('planId', normalizedMonths >= 12 ? 'PRO_YEAR' : 'PRO_MONTH');
      checkoutUrl.searchParams.set('months', String(normalizedMonths));
      checkoutUrl.searchParams.set('giftRecipientId', recipientUserId);
      checkoutUrl.searchParams.set('giftRecipientName', recipientLabel || recipientUserId);

      router.push(checkoutUrl.toString());
    } catch (error: unknown) {
      setGiftError((error as Error)?.message || 'Failed to start gift checkout.');
    } finally {
      setGiftLoading(false);
    }
  }, [giftMonths, giftUsername, router]);

  const printSingleReceipt = (tx: any) => {
    const w = window.open('', '_blank');
    if (!w) return;
    
    const formattedDate = new Date(tx.createdAt || tx.$createdAt).toLocaleDateString();
    const amount = tx.amountUsd || `$${(tx.amountCents / 100).toFixed(2)}`;

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${tx.paymentId}</title>
        <style>
          body { font-family: monospace; color: #000; padding: 40px; max-width: 600px; margin: auto; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
          .brand { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
          .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .section { margin-bottom: 20px; }
          .meta-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .meta-table td { padding: 8px 0; border-bottom: 1px dashed #ccc; }
          .meta-table td:last-child { text-align: right; }
          .total-box { border-top: 2px solid #000; padding-top: 10px; margin-top: 20px; display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; }
          .footer { text-align: center; font-size: 10px; color: #666; margin-top: 60px; border-top: 1px solid #eee; padding-top: 20px; }
          .btn-print { margin-bottom: 20px; background: #000; color: #fff; border: none; padding: 8px 16px; font-family: monospace; cursor: pointer; }
          @media print {
            .btn-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
        <div class="header">
          <div>
            <div class="brand">KYLRIX</div>
            <div style="font-size: 11px; color: #555;">Sovereign Infrastructure</div>
          </div>
          <div style="text-align: right;">
            <div class="title">OFFICIAL RECEIPT</div>
            <div style="font-size: 11px;">Date: ${formattedDate}</div>
          </div>
        </div>

        <div class="section">
          <strong>Customer Details:</strong><br />
          User ID: ${tx.userId}<br />
          Email: ${user?.email || 'N/A'}
        </div>

        <table class="meta-table">
          <tr>
            <td><strong>Transaction ID</strong></td>
            <td>${tx.paymentId}</td>
          </tr>
          <tr>
            <td><strong>Subscription Plan</strong></td>
            <td>${String(tx.plan).toUpperCase()}</td>
          </tr>
          <tr>
            <td><strong>Duration</strong></td>
            <td>${tx.months} ${tx.months === 1 ? 'Month' : 'Months'}</td>
          </tr>
          <tr>
            <td><strong>Provider</strong></td>
            <td>${tx.provider || 'BlockBee Crypto'}</td>
          </tr>
          <tr>
            <td><strong>Status</strong></td>
            <td>${String(tx.status).toUpperCase()}</td>
          </tr>
        </table>

        <div class="total-box">
          <span>TOTAL PAID</span>
          <span>${amount}</span>
        </div>

        <div class="footer">
          Kylrix open-source workspace suite. Provided strictly as is. No dedicated support. Thank you for your self-sovereign contribution.
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          }
        </script>
      </body>
      </html>
    `);
    w.document.close();
  };

  const printCumulativeInvoice = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const completedTxs = transactions.filter(tx => String(tx.status).toLowerCase() === 'completed');
    
    let totalCents = 0;
    let detailsHtml = '';

    completedTxs.forEach(tx => {
      const amtStr = tx.amountUsd || '';
      const cleanAmt = parseFloat(amtStr.replace(/[^0-9.]/g, '')) || 0;
      totalCents += Math.round(cleanAmt * 100);
      
      const formattedDate = new Date(tx.createdAt || tx.$createdAt).toLocaleDateString();
      detailsHtml += `
        <tr>
          <td>${formattedDate}</td>
          <td>${tx.paymentId}</td>
          <td>${String(tx.plan).toUpperCase()} (${tx.months}m)</td>
          <td style="text-align: right;">$${cleanAmt.toFixed(2)}</td>
        </tr>
      `;
    });

    const totalUsd = (totalCents / 100).toFixed(2);
    const currentDate = new Date().toLocaleDateString();

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cumulative Subscription Statement - Kylrix</title>
        <style>
          body { font-family: monospace; color: #000; padding: 40px; max-width: 800px; margin: auto; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
          .brand { font-size: 20px; font-weight: 900; letter-spacing: 2px; }
          .title { font-size: 16px; font-weight: bold; text-transform: uppercase; }
          .section { margin-bottom: 20px; }
          .tx-table { width: 100%; border-collapse: collapse; margin: 30px 0; }
          .tx-table th { padding: 10px 8px; border-bottom: 2px solid #000; text-align: left; font-weight: bold; }
          .tx-table td { padding: 10px 8px; border-bottom: 1px dashed #ccc; }
          .total-box { border-top: 2px solid #000; padding-top: 15px; margin-top: 20px; display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; }
          .footer { text-align: center; font-size: 10px; color: #666; margin-top: 60px; border-top: 1px solid #eee; padding-top: 20px; }
          .btn-print { margin-bottom: 20px; background: #000; color: #fff; border: none; padding: 8px 16px; font-family: monospace; cursor: pointer; }
          @media print {
            .btn-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <button class="btn-print" onclick="window.print()">Print / Save PDF</button>
        <div class="header">
          <div>
            <div class="brand">KYLRIX</div>
            <div style="font-size: 11px; color: #555;">Sovereign Infrastructure</div>
          </div>
          <div style="text-align: right;">
            <div class="title">CUMULATIVE SUBSCRIPTION STATEMENT</div>
            <div style="font-size: 11px;">As of: ${currentDate}</div>
          </div>
        </div>

        <div class="section">
          <strong>Customer Details:</strong><br />
          User ID: ${user?.$id || 'N/A'}<br />
          Email: ${user?.email || 'N/A'}
        </div>

        <table class="tx-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Transaction ID</th>
              <th>Description / Plan</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${detailsHtml || '<tr><td colspan="4" style="text-align: center; color: #888;">No completed subscription transactions found.</td></tr>'}
          </tbody>
        </table>

        <div class="total-box">
          <span>LIFETIME VALUE CUMULATIVE TOTAL</span>
          <span>$${totalUsd}</span>
        </div>

        <div class="footer">
          Kylrix open-source workspace suite. Provided strictly as is. No dedicated support. Thank you for your self-sovereign contribution.
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          }
        </script>
      </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-[#0A0908] text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button 
            onClick={() => router.push('/accounts/settings/profile')}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm font-bold bg-transparent border-none cursor-pointer"
          >
            <ChevronLeft size={16} />
            <span>Back to Settings</span>
          </button>
        </div>

        <div>
          <h1 className="text-3xl md:text-4xl font-black font-clash tracking-tight text-white">
            Billing & Subscriptions
          </h1>
          <p className="text-white/40 text-sm mt-2 font-medium">
            Manage your active coupons, subscription details, and gift options at the universal global rate.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left / Main Section (Plan, Billing, Coupons) */}
          <div className="md:col-span-2 space-y-8">
            
            {/* Plan Info Card */}
            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-white/8 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center text-[#6366F1]">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">Ecosystem Tier</h3>
                    <p className="text-xs text-white/40 font-bold">Your active privileges status</p>
                  </div>
                </div>
                {isPro && (
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#6366F1] bg-[#6366F1]/10 px-3 py-1.5 rounded-full">
                    <Sparkles size={10} />
                    PRO ACCOUNT
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-white/40 font-black tracking-widest uppercase block mb-1">
                    Active Plan
                  </span>
                  <span className="text-2xl font-black text-white">
                    {loadingPlan ? 'Resolving...' : `${currentTier} PLAN`}
                  </span>
                </div>

                {!isPro && !loadingPlan && (
                  <button
                    onClick={() => router.push('/pricing')}
                    className="px-6 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all flex items-center gap-2 border-none cursor-pointer animate-pulse"
                  >
                    <span>Upgrade to Pro</span>
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Billing Card */}
            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/8 pb-4">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Billing Settings</h3>
                  <p className="text-xs text-white/40 font-bold">Standard fixed rate for all territories</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-white/40 uppercase tracking-wider block">Territory Group</label>
                <div className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-3.5 text-sm font-semibold text-white/90">
                  <div className="flex justify-between items-center">
                    <span>Universal Global ($)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Passive Coupons List */}
            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/8 pb-4">
                <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
                  <Ticket size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Your Coupons</h3>
                  <p className="text-xs text-white/40 font-bold">Coupons and gift promotions sent directly to you</p>
                </div>
              </div>

              {loadingCoupons ? (
                <div className="flex justify-center items-center py-6">
                  <div className="w-6 h-6 border-2 border-[#10B981] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-8 text-white/30">
                  <Ticket size={24} className="mx-auto opacity-20 mb-2" />
                  <p className="text-xs font-bold font-mono uppercase">No Coupons Received</p>
                  <p className="text-[11px] text-white/20 mt-1">Coupons sent by other users or admins will appear here passively.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coupons.map((coupon) => {
                    const isRedeemed = coupon.redemptionCount >= coupon.redemptionLimit || coupon.status === 'redeemed';
                    const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                    const isActive = coupon.status === 'active' && !isRedeemed && !isExpired;

                    return (
                      <div key={coupon.$id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-white">
                              {coupon.title || 'Kylrix Promo Coupon'}
                            </span>
                            <span className="text-[10px] font-black font-mono text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded">
                              {coupon.discountPercent}% OFF
                            </span>
                          </div>
                          {coupon.note && (
                            <p className="text-xs text-white/50 mt-1">{coupon.note}</p>
                          )}
                          {coupon.expiresAt && (
                            <span className="text-[10px] text-white/30 font-mono block mt-1.5 uppercase">
                              Expires: {new Date(coupon.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/accounts/coupon/${coupon.$id}`)}
                            className="py-2 px-4 rounded-xl bg-[#10B981] hover:bg-[#0D9F6E] text-black font-black text-xs transition-colors cursor-pointer border-none flex-shrink-0"
                          >
                            Activate Coupon
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-white/20 uppercase tracking-wider flex-shrink-0">
                            {isRedeemed ? 'Redeemed' : isExpired ? 'Expired' : coupon.status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Transaction History & Receipts */}
            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/8 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center text-[#6366F1]">
                    <Clock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight">Transaction History</h3>
                    <p className="text-xs text-white/40 font-bold">Print receipts for accountants and bookkeeping</p>
                  </div>
                </div>
                {transactions.length > 0 && (
                  <button
                    onClick={printCumulativeInvoice}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-black text-xs transition-all border border-white/10 cursor-pointer"
                  >
                    Cumulative Lifetime Receipt
                  </button>
                )}
              </div>

              {/* Search Bar */}
              {transactions.length > 0 && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search transactions by ID or Plan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold text-white focus:outline-none placeholder:text-white/20"
                  />
                  <div className="absolute left-3.5 top-3 text-white/30">
                    <Search size={14} />
                  </div>
                </div>
              )}

              {loadingTransactions ? (
                <div className="flex justify-center items-center py-6">
                  <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-white/30">
                  <Clock size={24} className="mx-auto opacity-20 mb-2" />
                  <p className="text-xs font-bold font-mono uppercase">No Transactions Found</p>
                  <p className="text-[11px] text-white/20 mt-1">Your payments and coupon activations ledger will log here.</p>
                </div>
              ) : (() => {
                const filtered = transactions.filter(tx => 
                  String(tx.paymentId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  String(tx.plan || '').toLowerCase().includes(searchQuery.toLowerCase())
                );

                if (filtered.length === 0) {
                  return (
                    <p className="text-xs text-white/30 font-bold text-center py-4">No matching records found.</p>
                  );
                }

                return (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {filtered.map(tx => (
                      <div key={tx.$id} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex justify-between items-center gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-white font-mono">
                              {tx.paymentId}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded font-mono ${
                              String(tx.status).toLowerCase() === 'completed' || String(tx.status).toLowerCase() === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-white/10 text-white/40'
                            }`}>
                              {tx.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-white/40">
                            Plan: <strong className="text-white/60">{String(tx.plan).toUpperCase()}</strong> ({tx.months}m) &bull; {new Date(tx.createdAt || tx.$createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-white font-mono">
                            {tx.amountUsd || `$${(tx.amountCents / 100).toFixed(2)}`}
                          </span>
                          <button
                            onClick={() => printSingleReceipt(tx)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer border border-white/10"
                            title="Print receipt"
                          >
                            <Printer size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

          </div>

          {/* Right Section (Gift Pro) */}
          <div className="space-y-8">
            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/8 pb-4">
                <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center text-[#6366F1]">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Gift Pro Tier</h3>
                  <p className="text-xs text-white/40 font-bold">Send a subscription gift to another node</p>
                </div>
              </div>

              <p className="text-xs text-[#9B9691] leading-relaxed font-satoshi">
                Recipient account will automatically claim the active Pro subscription period on their next logon sequence.
              </p>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/40 uppercase">Recipient Username</label>
                  <input
                    type="text"
                    placeholder="Username or Handle"
                    value={giftUsername}
                    onChange={(e) => setGiftUsername(e.target.value)}
                    className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-white/40 uppercase">Subscription Period (Months)</label>
                  <input
                    type="number"
                    placeholder="Months"
                    min={1}
                    value={giftMonths}
                    onChange={(e) => setGiftMonths(e.target.value)}
                    className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none"
                  />
                </div>

                {giftError && (
                  <p className="text-xs text-red-500 font-bold font-mono">{giftError}</p>
                )}

                <button
                  type="button"
                  onClick={() => void handleGiftCheckout()}
                  disabled={giftLoading}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white text-xs font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 border-none cursor-pointer"
                >
                  {giftLoading ? 'Preparing Checkout...' : 'Gift Pro Subscription'}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
