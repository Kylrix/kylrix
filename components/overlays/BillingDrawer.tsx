'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Gift,
  Tag,
  Check,
  ArrowRight,
  Sparkles,
  Clock,
  Printer,
  Search,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { AppwriteService } from '@/lib/appwrite';
import { account } from '@/lib/appwrite/client';
import { getMyCouponsAction } from '@/app/(app)/(auth)/accounts/actions/coupons';
import { listBillingTransactionsAction } from '@/app/(app)/(auth)/accounts/actions/billing';

interface BillingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BillingDrawer({ isOpen, onClose }: BillingDrawerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { currentTier, expiresAt, isLoading: planLoading } = useSubscription();
  const [isExpanded, setIsExpanded] = useState(false);

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

  const loadCoupons = useCallback(async () => {
    if (!user?.$id) return;
    try {
      setLoadingCoupons(true);
      const jwtRes = await account.createJWT().then(r => r.jwt).catch(() => undefined);
      const list = await getMyCouponsAction(jwtRes);
      // Only show active coupons
      const active = (list || []).filter((c: any) => {
        const s = String(c.status || '').toLowerCase();
        return s === 'active';
      });
      setCoupons(active);
    } catch (err) {
      console.warn('Failed to load coupons:', err);
    } finally {
      setLoadingCoupons(false);
    }
  }, [user?.$id]);

  const loadTransactions = useCallback(async () => {
    if (!user?.$id) return;
    try {
      setLoadingTransactions(true);
      const jwtRes = await account.createJWT().then(r => r.jwt).catch(() => undefined);
      const res = await listBillingTransactionsAction(jwtRes);
      if (res.success && res.transactions) {
        setTransactions(res.transactions);
      }
    } catch (err) {
      console.warn('Failed to load transactions:', err);
    } finally {
      setLoadingTransactions(false);
    }
  }, [user?.$id]);

  useEffect(() => {
    if (user && isOpen) {
      loadCoupons();
      loadTransactions();
    }
  }, [user, isOpen, loadCoupons, loadTransactions]);

  // Reset expand state when closed
  useEffect(() => {
    if (!isOpen) setIsExpanded(false);
  }, [isOpen]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

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
      if (!recipientUserId) throw new Error('No matching account found for that username or user ID.');
      const normalizedMonths = Math.max(1, Number.parseInt(giftMonths || '1', 10) || 1);
      const checkoutUrl = new URL(`${window.location.origin}/accounts/subscription/pro/checkout`);
      checkoutUrl.searchParams.set('giftRecipientId', recipientUserId);
      checkoutUrl.searchParams.set('giftRecipientName', recipientLabel || recipientUserId);
      checkoutUrl.searchParams.set('months', String(normalizedMonths));
      onClose();
      router.push(checkoutUrl.toString());
    } catch (error) {
      setGiftError((error as Error)?.message || 'Failed to start gift checkout.');
    } finally {
      setGiftLoading(false);
    }
  }, [giftMonths, giftUsername, router, onClose]);

  const printStatement = () => {
    const w = window.open();
    if (!w) return;
    const currentDate = new Date().toLocaleDateString();
    const filtered = filteredTx;
    const detailsHtml = filtered.map(tx => `
      <tr>
        <td>${new Date(tx.createdAt || tx.$createdAt).toLocaleDateString()}</td>
        <td>${tx.$id}</td>
        <td>${String(tx.plan || 'PRO').replace('_', ' ')} — ${tx.months || 1} Month(s)${tx.isGift ? ' (Gift)' : ''}</td>
        <td style="text-align:right">$${tx.amountUsd || (tx.amountCents ? (tx.amountCents / 100).toFixed(2) : '0.00')}</td>
      </tr>
    `).join('');
    w.document.write(`<!DOCTYPE html><html><head><title>Statement - Kylrix</title>
      <style>body{font-family:monospace;color:#000;padding:40px;max-width:800px;margin:auto}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th{font-weight:900;border-bottom:2px solid #000}.total{font-weight:900;font-size:16px;margin-top:20px;display:flex;justify-content:space-between}@media print{button{display:none}}</style>
      </head><body>
      <button onclick="window.print()" style="margin-bottom:20px;padding:8px 16px;cursor:pointer">Print / Save PDF</button>
      <h2>KYLRIX — Subscription Statement</h2>
      <p>Customer: ${user?.email || 'N/A'} (${user?.$id || ''})</p>
      <p>Generated: ${currentDate}</p>
      <table><thead><tr><th>Date</th><th>ID</th><th>Plan</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${detailsHtml || '<tr><td colspan="4" style="text-align:center;color:#888">No transactions.</td></tr>'}</tbody></table>
      <div class="total"><span>Total</span><span>$${filtered.reduce((a, t) => a + (t.amountCents || 0), 0) / 100 || '0.00'}</span></div>
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}</script>
      </body></html>`);
    w.document.close();
  };

  const filteredTx = transactions.filter(tx =>
    tx.$id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (tx.plan || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isPro = currentTier === 'PRO' || currentTier === 'LIFETIME' || currentTier === 'ORG';
  const isTeams = currentTier === 'TEAMS';

  const tierBadgeColor =
    isTeams ? 'text-amber-400 bg-amber-500/10' :
    isPro ? 'text-[#6366F1] bg-[#6366F1]/10' :
    'text-white/40 bg-white/5';

  const parseMeta = (val: any) => { try { return JSON.parse(val || '{}'); } catch { return {}; } };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        style={{ zIndex: 99998 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Drawer Panel */}
      <div
        className="fixed bottom-0 left-0 right-0 flex flex-col bg-[#0A0908] border border-white/8 border-b-0 rounded-t-[28px] overflow-hidden"
        style={{
          zIndex: 99999,
          height: isExpanded ? '100dvh' : '60dvh',
          maxHeight: '100dvh',
          transition: 'height 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Drag Handle + Header */}
        <div className="flex-shrink-0">
          {/* Drag handle — clicking toggles expand */}
          <div
            className="flex justify-center pt-3 pb-1 cursor-pointer"
            onClick={() => setIsExpanded(v => !v)}
            role="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 flex items-center justify-center">
                <CreditCard size={16} className="text-[#6366F1]" />
              </div>
              <div>
                <h3 className="text-base font-black font-clash text-white leading-tight">Billing & Subscriptions</h3>
                <p className="text-[10px] text-white/40 font-mono">Manage your plan and coupons</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsExpanded(v => !v)}
                className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer"
                aria-label={isExpanded ? 'Collapse' : 'Expand to full screen'}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-all cursor-pointer"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-8 space-y-4 min-h-0">

          {/* Active Plan Card */}
          <div className="bg-[#161412] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard size={16} className="text-[#6366F1]" />
                <div>
                  <h4 className="font-extrabold text-sm text-white">Your Plan</h4>
                  <p className="text-[10px] text-white/40">Active subscription privileges</p>
                </div>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 ${tierBadgeColor}`}>
                <Sparkles size={9} />
                {planLoading ? '…' : currentTier}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <span className="text-[9px] text-white/40 font-black tracking-widest uppercase block">Active Plan</span>
                <span className="text-2xl font-black text-white">
                  {planLoading ? 'Resolving…' : `${currentTier} PLAN`}
                </span>
                {!planLoading && (isPro || isTeams) && (
                  <span className="text-[10px] text-white/40 font-mono block mt-0.5">
                    {isTeams ? '$50/mo' : '$10/mo'}
                  </span>
                )}
                {expiresAt && (isPro || isTeams) && (
                  <span className="text-[10px] text-white/40 font-mono block mt-0.5">
                    Active until {new Date(expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              {!isPro && !isTeams && !planLoading && (
                <button
                  type="button"
                  onClick={() => { onClose(); router.push('/pricing'); }}
                  className="px-4 py-2 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Upgrade</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>

            {/* Pricing Reference */}
            {!isPro && !isTeams && !planLoading && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
                <div className="p-3 rounded-xl bg-[#6366F1]/5 border border-[#6366F1]/10">
                  <span className="text-[10px] font-black text-[#6366F1] uppercase tracking-wider block">Pro</span>
                  <span className="text-lg font-black text-white">$10</span>
                  <span className="text-[9px] text-white/40 block">/month</span>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">Teams</span>
                  <span className="text-lg font-black text-white">$50</span>
                  <span className="text-[9px] text-white/40 block">/month</span>
                </div>
              </div>
            )}
          </div>

          {/* Coupons — active only, clickable */}
          <div className="bg-[#161412] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Tag size={16} className="text-[#10B981]" />
              <div>
                <h4 className="font-extrabold text-sm text-white">Your Coupons</h4>
                <p className="text-[10px] text-white/40">Active promotional codes — click to claim</p>
              </div>
            </div>

            {loadingCoupons ? (
              <div className="animate-pulse h-10 bg-white/5 rounded-xl" />
            ) : coupons.length === 0 ? (
              <p className="text-xs text-white/40 font-medium">No active coupons on this account.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {coupons.map((coupon, idx) => {
                  const meta = parseMeta(coupon.metadata);
                  const title = meta.coupon?.title || coupon.title || coupon.$id;
                  const discountPercent = coupon.discountPercent ?? coupon.discountPercentage ?? 0;
                  const months = meta.months || 1;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        onClose();
                        router.push(`/accounts/coupon/${coupon.$id}`);
                      }}
                      className="flex justify-between items-center bg-white/[0.02] border border-[#10B981]/20 hover:border-[#10B981]/40 hover:bg-[#10B981]/5 p-3.5 rounded-xl transition-all text-left cursor-pointer group w-full"
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white font-mono uppercase tracking-wider truncate block">{title}</span>
                        <span className="block text-[9px] text-[#10B981] font-extrabold mt-0.5 uppercase tracking-wider font-mono">
                          {discountPercent}% Off · {months} Month(s)
                        </span>
                        {coupon.$createdAt && (
                          <span className="block text-[8px] text-white/30 font-medium mt-0.5">
                            Issued: {new Date(coupon.$createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-3">
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-extrabold uppercase px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                          <Check size={8} /> Active
                        </span>
                        <span className="text-[9px] text-[#10B981] font-black group-hover:underline">Claim →</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gift Pro Tier */}
          <div className="bg-[#161412] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <Gift size={16} className="text-[#EC4899]" />
              <div>
                <h4 className="font-extrabold text-sm text-white">Gift Pro Subscription</h4>
                <p className="text-[10px] text-white/40">Send Pro access to a teammate</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-white/40 font-black uppercase tracking-wider block mb-1">Recipient Username or ID</label>
                <input
                  type="text"
                  placeholder="e.g. janesmith"
                  value={giftUsername}
                  onChange={e => setGiftUsername(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#6366F1] transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/40 font-black uppercase tracking-wider block mb-1">Gift Duration</label>
                <select
                  value={giftMonths}
                  onChange={e => setGiftMonths(e.target.value)}
                  className="w-full bg-[#1C1A18] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#6366F1] transition-all"
                >
                  <option value="1">1 Month — $10</option>
                  <option value="3">3 Months — $30</option>
                  <option value="6">6 Months — $60</option>
                  <option value="12">12 Months — $96 (Yearly)</option>
                </select>
              </div>
              {giftError && <p className="text-xs text-red-500 font-bold font-mono">{giftError}</p>}
              <button
                type="button"
                onClick={handleGiftCheckout}
                disabled={giftLoading}
                className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs transition-all disabled:opacity-40 cursor-pointer"
              >
                {giftLoading ? 'Preparing Checkout…' : 'Gift Pro Subscription'}
              </button>
            </div>
          </div>

          {/* Transaction History — user-scoped */}
          <div className="bg-[#161412] border border-white/5 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock size={16} className="text-[#3B82F6]" />
                <div>
                  <h4 className="font-extrabold text-sm text-white">Statements & Invoices</h4>
                  <p className="text-[10px] text-white/40">Your subscription history</p>
                </div>
              </div>
              {transactions.length > 0 && (
                <button
                  type="button"
                  onClick={printStatement}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer"
                  title="Print Statement"
                >
                  <Printer size={14} />
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search transactions…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#6366F1] transition-all"
              />
            </div>

            {loadingTransactions ? (
              <div className="animate-pulse h-12 bg-white/5 rounded-xl" />
            ) : filteredTx.length === 0 ? (
              <p className="text-xs text-white/40 font-medium">No transactions found.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredTx.map((tx, idx) => {
                  const displayDate = tx.createdAt || tx.$createdAt
                    ? new Date(tx.createdAt || tx.$createdAt).toLocaleDateString()
                    : 'N/A';
                  const rawPlan = String(tx.plan || 'PRO').replace('_', ' ');
                  const months = tx.months || 1;
                  const amountStr = tx.amountUsd || (tx.amountCents != null ? `$${(tx.amountCents / 100).toFixed(2)}` : '$0.00');
                  const statusStr = String(tx.status || 'completed');
                  return (
                    <div key={idx} className="flex justify-between items-start bg-white/[0.02] border border-white/5 p-3 rounded-xl text-xs">
                      <div className="min-w-0">
                        <span className="font-extrabold text-white uppercase truncate block">{rawPlan} — {months} Mo</span>
                        <span className="block text-[9px] text-white/40 mt-0.5">{displayDate} · {statusStr}</span>
                      </div>
                      <span className="font-black text-white font-mono flex-shrink-0 ml-3">{amountStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
