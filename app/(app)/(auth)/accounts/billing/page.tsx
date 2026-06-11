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
  Clock
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { account, AppwriteService } from '@/lib/appwrite';
import { listCouponsAction as getMyCouponsAction } from '../actions/coupons';
import { getUserBillingRegionAction } from '../actions/billing';
import toast from 'react-hot-toast';

export default function BillingPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  // Plan states
  const [isPro, setIsPro] = useState(false);
  const [currentTier, setCurrentTier] = useState('FREE');
  const [loadingPlan, setLoadingPlan] = useState(true);

  // Region states
  const [region, setRegion] = useState('');
  const [loadingRegion, setLoadingRegion] = useState(true);
  const [savingRegion, setSavingRegion] = useState(false);

  // Coupon states
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(true);

  // Gift states
  const [giftUsername, setGiftUsername] = useState('');
  const [giftMonths, setGiftMonths] = useState('1');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      resolveUserRegion();
      loadSubscriptionStatus();
      loadCoupons();
    }
  }, [user]);

  const resolveUserRegion = async () => {
    try {
      setLoadingRegion(true);
      
      // Try to determine country from client-side logs first
      const logList = await account.listLogs();
      const logs = logList.logs || [];
      const validLogs = logs.filter(l => l.countryCode && l.countryCode !== '—');
      
      if (validLogs.length > 0) {
        // Find the most frequent country code in logs
        const counts: Record<string, number> = {};
        validLogs.forEach(l => {
          counts[l.countryCode] = (counts[l.countryCode] || 0) + 1;
        });
        const resolvedCountry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
        if (resolvedCountry) {
          setRegion(resolvedCountry);
          setLoadingRegion(false);
          return;
        }
      }

      const jwtRes = await account.createJWT().then(res => res.jwt).catch(() => undefined);
      const secureRegion = await getUserBillingRegionAction(jwtRes);
      if (secureRegion) {
        setRegion(secureRegion);
        setLoadingRegion(false);
        return;
      }
    } catch (err) {
      console.warn('Failed to resolve secure billing region:', err);
    }
    if (user?.prefs?.region) {
      setRegion(user.prefs.region);
    } else {
      setRegion('US');
    }
    setLoadingRegion(false);
  };

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

  const handleSaveRegion = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    setRegion(selected);
    if (!user) return;
    setSavingRegion(true);
    try {
      const currentPrefs = user.prefs || {};
      await account.updatePrefs({ ...currentPrefs, region: selected });
      toast.success(`Billing region updated to ${selected}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update billing region');
    } finally {
      setSavingRegion(false);
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
            Manage your local regional settings, active coupons, subscription details, and gift options.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left / Main Section (Plan, Region, Coupons) */}
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

            {/* Region Card */}
            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-white/8 pb-4">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center text-[#F59E0B]">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">Billing Region</h3>
                  <p className="text-xs text-white/40 font-bold">Configure your country settings for checkout routing</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-white/40 uppercase tracking-wider block">Country / Territory</label>
                <div className="relative">
                  <select
                    value={region}
                    onChange={handleSaveRegion}
                    disabled={savingRegion || loadingRegion}
                    className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-3.5 text-sm font-semibold text-white focus:outline-none appearance-none cursor-pointer"
                  >
                    {loadingRegion ? (
                      <option value="" disabled>Loading secure billing region...</option>
                    ) : (
                      <>
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="AU">Australia</option>
                        <option value="SG">Singapore</option>
                        <option value="CH">Switzerland</option>
                        <option value="NL">Netherlands</option>
                        <option value="ZA">South Africa</option>
                        <option value="NG">Nigeria</option>
                      </>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/30">
                    ▼
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
