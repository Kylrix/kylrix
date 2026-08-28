'use client';

import React, { useState, useEffect } from 'react';
import {
  Heart,
  Sparkles,
  Zap,
  Check,
  Copy,
  ExternalLink,
  ArrowRight,
  Globe,
  MessageSquare,
  User,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { account } from '@/lib/appwrite/client';
import {
  createSponsorshipCheckoutAction,
  getPublicSponsorsAction,
  getUserBadgesAction,
} from '@/lib/actions/sponsor-actions';
import {
  BadgeTier,
  Sponsorship,
  UserBadge,
  resolveBadgeForAmount,
} from '@/lib/types/badges';
import { BadgeChip, BadgesShowcaseGrid, getBadgeIcon } from '@/components/sponsor/SponsorBadges';
import toast from 'react-hot-toast';

const PRESET_TIERS: { tier: BadgeTier; amount: number; label: string; desc: string; icon: string }[] = [
  {
    tier: 'supporter',
    amount: 5,
    label: 'Supporter',
    desc: 'Micro-tip & community backer badge',
    icon: 'heart',
  },
  {
    tier: 'patron',
    amount: 25,
    label: 'Patron',
    desc: 'Sovereign patron badge on profile',
    icon: 'sparkles',
  },
  {
    tier: 'builder',
    amount: 100,
    label: 'Builder',
    desc: 'Ecosystem builder badge & priority',
    icon: 'hammer',
  },
  {
    tier: 'sovereign',
    amount: 500,
    label: 'Founding Sponsor',
    desc: 'Top-tier founding sponsor distinction',
    icon: 'crown',
  },
];

const DIRECT_ADDRESSES = [
  {
    label: 'Bitcoin (BTC / Lightning)',
    address: 'bc1qlw48y8x37szu4v623dsv2y79j24s4v42r7k24f',
    network: 'Bitcoin Native SegWit',
  },
  {
    label: 'Ethereum & EVM (ETH, USDT, USDC)',
    address: '0x221370B36C8145Fa6263B0d13Ce04eE605fB0a22',
    network: 'Ethereum, Base, Arbitrum, Polygon',
  },
  {
    label: 'Solana (SOL, USDC)',
    address: 'KylrX9J29v47szP19n8Z7M42U87X113o9Sg8vL32p9X',
    network: 'Solana Mainnet',
  },
];

export default function SponsorPage() {
  const { user } = useAuth();

  const [selectedTier, setSelectedTier] = useState<BadgeTier>('patron');
  const [customAmount, setCustomAmount] = useState<string>('25');
  const [sponsorName, setSponsorName] = useState<string>('');
  const [sponsorUrl, setSponsorUrl] = useState<string>('');
  const [sponsorMessage, setSponsorMessage] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'sponsor' | 'zap' | 'wall'>('sponsor');
  const [publicSponsors, setPublicSponsors] = useState<Sponsorship[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loadingSponsors, setLoadingSponsors] = useState<boolean>(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const currentAmount = parseFloat(customAmount) || 0;
  const currentBadge = resolveBadgeForAmount(currentAmount);

  useEffect(() => {
    if (user?.name && !sponsorName) {
      setSponsorName(user.name);
    }
  }, [user?.name, sponsorName]);

  useEffect(() => {
    async function loadData() {
      setLoadingSponsors(true);
      try {
        const sponsors = await getPublicSponsorsAction();
        setPublicSponsors(sponsors || []);
      } catch (err) {
        console.warn('Failed to load public sponsors:', err);
      } finally {
        setLoadingSponsors(false);
      }

      if (user?.$id) {
        try {
          const badges = await getUserBadgesAction(user.$id);
          setUserBadges(badges || []);
        } catch (err) {
          console.warn('Failed to load user badges:', err);
        }
      }
    }
    loadData();
  }, [user?.$id]);

  const handleTierSelect = (tier: BadgeTier, amount: number) => {
    setSelectedTier(tier);
    setCustomAmount(amount.toString());
  };

  const handleCustomAmountChange = (val: string) => {
    setCustomAmount(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const b = resolveBadgeForAmount(num);
      setSelectedTier(b?.tier || 'custom');
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Address copied to clipboard');
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2500);
  };

  const handleStartCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentAmount < 1) {
      toast.error('Minimum sponsorship amount is $1.00 USD');
      return;
    }

    setIsSubmitting(true);
    try {
      const jwt = await account.createJWT().then((res: any) => res?.jwt || '').catch(() => '');

      const res = await createSponsorshipCheckoutAction({
        amountUsd: currentAmount,
        tier: selectedTier,
        sponsorName: isAnonymous ? 'Anonymous' : sponsorName.trim() || undefined,
        sponsorUrl: sponsorUrl.trim() || undefined,
        sponsorMessage: sponsorMessage.trim() || undefined,
        isPublic: !isAnonymous && isPublic,
        isAnonymous,
        jwt: jwt || undefined,
      });

      if (res?.url) {
        toast.success('Redirecting to secure crypto checkout...');
        window.location.href = res.url;
      } else {
        toast.error('Failed to initiate checkout session');
        setIsSubmitting(false);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error(err?.message || 'Error creating sponsorship session');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#000000] text-[#F5F2ED] font-satoshi py-8 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-[#6366F1] tracking-wider uppercase mb-2">
          <Heart className="w-3.5 h-3.5 fill-[#6366F1]" />
          <span>Sovereignty & Open Source</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-clash font-semibold text-white tracking-tight mb-2">
          Sponsor Kylrix
        </h1>
        <p className="text-sm sm:text-base text-white/60 max-w-2xl leading-relaxed">
          Kylrix is sovereign, local-first, and 100% open source. Direct sponsorships fund continuous development,
          zero-trust encryption research, and native Model Context Protocol (MCP) tooling.
        </p>

        {/* User Badges Banner if awarded */}
        {userBadges.length > 0 && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#161412] border border-[#6366F1]/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Sparkles className="w-4 h-4 text-[#818CF8] shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-white block truncate">Your Awarded Sponsor Badges</span>
                <span className="text-[11px] text-white/50 block">These badges appear on your public user profile</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 shrink-0">
              {userBadges.map((b) => (
                <BadgeChip key={b.$id} badge={b} size="sm" />
              ))}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-2 mt-6 border-b border-white/[0.06] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('sponsor')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'sponsor'
                ? 'bg-[#161412] text-white border border-white/10'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Become a Sponsor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('zap')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'zap'
                ? 'bg-[#161412] text-white border border-white/10'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Lightning & Crypto Zaps
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wall')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === 'wall'
                ? 'bg-[#161412] text-white border border-white/10'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <span>Wall of Sponsors</span>
            {publicSponsors.length > 0 && (
              <span className="px-1.5 py-0.2 bg-white/10 text-[10px] rounded-full font-mono">
                {publicSponsors.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'sponsor' && (
        <div className="space-y-8">
          {/* Main Sponsor Card */}
          <div className="p-6 rounded-2xl bg-[#161412] border border-white/[0.06]">
            <form onSubmit={handleStartCheckout} className="space-y-6">
              {/* Preset Tier Picker */}
              <div>
                <label className="text-[10px] font-bold tracking-wider uppercase text-white/50 block mb-3">
                  Select Sponsorship Tier
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {PRESET_TIERS.map((pt) => {
                    const isSelected = selectedTier === pt.tier && currentAmount === pt.amount;
                    return (
                      <button
                        key={pt.tier}
                        type="button"
                        onClick={() => handleTierSelect(pt.tier, pt.amount)}
                        className={`p-4 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'bg-[#0A0908] border-[#6366F1] ring-1 ring-[#6366F1]'
                            : 'bg-[#0A0908] border-white/[0.06] hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="p-1.5 rounded-lg bg-[#161412] border border-white/[0.06] text-[#818CF8]">
                            {getBadgeIcon(pt.icon, 'w-4 h-4')}
                          </div>
                          <span className="text-sm font-clash font-semibold text-white">${pt.amount}</span>
                        </div>
                        <div className="text-xs font-medium text-white mb-0.5">{pt.label}</div>
                        <div className="text-[11px] text-white/50 leading-snug">{pt.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Amount */}
              <div className="p-4 rounded-xl bg-[#0A0908] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <label className="text-xs font-medium text-white block">Custom Contribution Amount</label>
                  <span className="text-[11px] text-white/50 block">Enter any custom USD amount ($1 minimum)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/50 font-mono text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    className="w-28 px-3 py-1.5 rounded-lg bg-[#161412] border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-[#6366F1]"
                    placeholder="25"
                  />
                  <span className="text-xs text-white/50 font-mono">USD</span>
                </div>
              </div>

              {/* Resolved Badge Preview */}
              {currentBadge && (
                <div className="p-3.5 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Awarded Badge</span>
                    <BadgeChip tier={currentBadge.tier} size="md" />
                  </div>
                  <span className="text-[11px] text-white/50 hidden sm:inline">{currentBadge.description}</span>
                </div>
              )}

              {/* Sponsor Details Form */}
              <div className="space-y-4 pt-2 border-t border-white/[0.04]">
                <div className="text-[10px] font-bold tracking-wider uppercase text-white/50">
                  Sponsor Identity & Recognition
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-white/80 block mb-1">
                      Display Name <span className="text-white/40">(optional)</span>
                    </label>
                    <div className="relative">
                      <User className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        disabled={isAnonymous}
                        value={sponsorName}
                        onChange={(e) => setSponsorName(e.target.value)}
                        placeholder={user?.name || 'Your name or handle'}
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0A0908] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-white/80 block mb-1">
                      Website or Social Link <span className="text-white/40">(optional)</span>
                    </label>
                    <div className="relative">
                      <Globe className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="url"
                        disabled={isAnonymous}
                        value={sponsorUrl}
                        onChange={(e) => setSponsorUrl(e.target.value)}
                        placeholder="https://yourwebsite.com"
                        className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0A0908] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1] disabled:opacity-40"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-white/80 block mb-1">
                    Public Message or Dedication <span className="text-white/40">(optional)</span>
                  </label>
                  <div className="relative">
                    <MessageSquare className="w-3.5 h-3.5 text-white/40 absolute left-3 top-3" />
                    <textarea
                      rows={2}
                      value={sponsorMessage}
                      onChange={(e) => setSponsorMessage(e.target.value)}
                      placeholder="Keep up the great work on sovereign local-first software!"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0A0908] border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#6366F1]"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col sm:flex-row gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      disabled={isAnonymous}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="w-4 h-4 rounded bg-[#0A0908] border-white/20 text-[#6366F1] focus:ring-0"
                    />
                    <span className="text-xs text-white/70">Show on public Wall of Sponsors</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAnonymous}
                      onChange={(e) => {
                        setIsAnonymous(e.target.checked);
                        if (e.target.checked) setIsPublic(false);
                      }}
                      className="w-4 h-4 rounded bg-[#0A0908] border-white/20 text-[#6366F1] focus:ring-0"
                    />
                    <span className="text-xs text-white/70">Donate anonymously</span>
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-[11px] text-white/50">
                  Processed via multi-chain BlockBee checkout (BTC, ETH, SOL, LTC, USDT, USDC).
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || currentAmount < 1}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#6366F1] hover:bg-[#5558E6] text-white font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Checkout...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Crypto Checkout (${currentAmount})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Badge Tiers Showcase */}
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-white/50 mb-3">
              Available User Badges & Recognition Tiers
            </div>
            <BadgesShowcaseGrid />
          </div>
        </div>
      )}

      {activeTab === 'zap' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161412] border border-white/[0.06] space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#F59E0B] uppercase tracking-wider mb-1">
                <Zap className="w-3.5 h-3.5 fill-[#F59E0B]" />
                <span>Instant Micro-Tips & Zaps</span>
              </div>
              <h3 className="text-lg font-clash font-medium text-white mb-1">Direct Lightning & On-Chain Addresses</h3>
              <p className="text-xs text-white/60 leading-relaxed">
                Prefer direct peer-to-peer micro-tips? Send a Nostr Zap or on-chain transfer to the addresses below.
              </p>
            </div>

            <div className="space-y-3">
              {DIRECT_ADDRESSES.map((da, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#0A0908] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-white">{da.label}</span>
                    <span className="text-[10px] font-mono text-white/40">{da.network}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#161412] border border-white/[0.06] font-mono text-xs text-white/90">
                    <span className="truncate">{da.address}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(da.address, `addr-${idx}`)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-sans border transition-all cursor-pointer ${
                          copiedKey === `addr-${idx}`
                            ? 'bg-[#10B981]/20 border-[#10B981]/40 text-[#10B981]'
                            : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80'
                        }`}
                      >
                        {copiedKey === `addr-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-[#10B981]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 opacity-60" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'wall' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#161412] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-clash font-medium text-white">Wall of Sponsors</h3>
                <p className="text-xs text-white/60">Community members and organizations supporting Kylrix.</p>
              </div>
            </div>

            {loadingSponsors ? (
              <div className="py-12 text-center text-xs text-white/40 font-mono">Loading sponsor ledger...</div>
            ) : publicSponsors.length === 0 ? (
              <div className="py-12 text-center">
                <Heart className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-xs text-white/50 mb-3">Be the first founding sponsor on the wall!</p>
                <button
                  type="button"
                  onClick={() => setActiveTab('sponsor')}
                  className="px-4 py-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-medium"
                >
                  Become a Sponsor
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {publicSponsors.map((s) => (
                  <div
                    key={s.$id}
                    className="p-4 rounded-xl bg-[#0A0908] border border-white/[0.06] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm text-white truncate">
                            {s.sponsorName || 'Supporter'}
                          </span>
                          {s.sponsorUrl && (
                            <a
                              href={s.sponsorUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-white/40 hover:text-white transition-colors"
                              title="Visit Website"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <BadgeChip tier={s.tier} size="sm" />
                      </div>
                      {s.sponsorMessage && (
                        <p className="text-xs text-white/70 italic leading-relaxed mb-3">
                          &ldquo;{s.sponsorMessage}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-white/40 pt-2 border-t border-white/[0.04]">
                      <span>${s.amount} USD</span>
                      <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
