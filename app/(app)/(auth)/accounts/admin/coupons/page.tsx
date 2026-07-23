'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, RefreshCw, Ticket, Search, Check, X, Loader2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { createCouponAction, listCouponsAction, invalidateCouponAction } from '../../actions/coupons';
import { getAdminUserByIdAction, searchAdminUserByIdAction, searchAdminUserByEmailAction } from '../../actions/admin';
import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { AppwriteService } from '@/lib/appwrite';

export const dynamic = 'force-dynamic';

type CouponRow = {
  $id: string;
  userId?: string | null;
  relatedUserId?: string | null;
  actorId?: string | null;
  status?: string | null;
  discountPercent?: number | null;
  expiresAt?: string | null;
  metadata?: string | null;
  $createdAt?: string;
};

function parseMetadata(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function formatScope(row: CouponRow) {
  const metadata = parseMetadata(row.metadata);
  const scope = metadata?.coupon?.scope || (row.relatedUserId ? 'targeted' : 'open');
  return String(scope);
}

export default function AdminCouponsPage() {
  const { open: openUnified } = useUnifiedDrawer();
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { getJWT } = useAuth();
  
  const [profileQuery, setProfileQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingProfiles, setSearchingProfiles] = useState(false);
  const [selectedTargets, setSelectedTargets] = useState<any[]>([]);
  type SearchMode = 'username' | 'userid' | 'email';
  const [searchMode, setSearchMode] = useState<SearchMode>('username');

  const [form, setForm] = useState({
    discountPercent: '50',
    status: 'active',
    expiresAt: '',
    title: '',
    note: '',
    redemptionLimit: '1',
    months: '1',
    planId: 'PRO_MONTH',
  });

  const loadCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const jwt = await getJWT();
      const rows = await listCouponsAction(jwt || undefined);
      setCoupons(rows as any[]);
    } catch (err: any) {
      setError(err?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, [getJWT]);

  useEffect(() => {
    let active = true;
    if (!profileQuery.trim()) {
      setSearchResults([]);
      return;
    }
    if (searchMode !== 'username') {
      // userid and email modes use manual trigger – clear dropdown
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingProfiles(true);
      try {
        const docs = await AppwriteService.searchGlobalProfiles(profileQuery.trim(), 5);
        if (active) setSearchResults(docs || []);
      } catch (err) {
        console.error('Failed to search profiles:', err);
      } finally {
        if (active) setSearchingProfiles(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [profileQuery, searchMode]);

  /** Manually trigger search for userid/email modes */
  const handleManualSearch = async () => {
    const q = profileQuery.trim();
    if (!q) return;
    setSearchingProfiles(true);
    setError(null);
    try {
      const jwt = await getJWT();
      if (searchMode === 'userid') {
        const result = await searchAdminUserByIdAction(q, jwt || undefined);
        setSelectedTargets(prev => {
          if (prev.some(t => t.id === result.id)) return prev;
          return [...prev, {
            id: result.id,
            name: result.name || result.displayName || result.username || 'User',
            email: result.email,
            username: result.username,
          }];
        });
        setProfileQuery('');
      } else if (searchMode === 'email') {
        const result = await searchAdminUserByEmailAction(q, jwt || undefined);
        if (!result) {
          setError('No account found for that email address.');
          return;
        }
        setSelectedTargets(prev => {
          if (prev.some(t => t.id === result.id)) return prev;
          return [...prev, {
            id: result.id,
            name: result.name || result.displayName || result.username || 'User',
            email: result.email,
            username: result.username,
          }];
        });
        setProfileQuery('');
      }
    } catch (err: any) {
      setError(err?.message || 'User not found.');
    } finally {
      setSearchingProfiles(false);
    }
  };

  const selectProfile = async (profile: any) => {
    if (selectedTargets.some(t => t.id === profile.userId)) {
      setProfileQuery('');
      setSearchResults([]);
      return;
    }
    setError(null);
    try {
      const jwt = await getJWT();
      const userData = await getAdminUserByIdAction(profile.userId, jwt || undefined);
      setSelectedTargets(prev => [...prev, {
        id: userData.id,
        name: userData.name || profile.displayName || profile.username || 'User',
        email: userData.email,
        username: profile.username
      }]);
      setProfileQuery('');
      setSearchResults([]);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch target user details');
    }
  };

  const removeProfile = (userId: string) => {
    setSelectedTargets(prev => prev.filter(t => t.id !== userId));
  };

  const createCoupon = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const jwt = await getJWT();
      const targetUserIds = selectedTargets.map(t => t.id);
      const data = await createCouponAction({
        userIds: targetUserIds.length > 0 ? targetUserIds : undefined,
        discountPercent: Number.parseInt(form.discountPercent, 10) || 0,
        status: form.status,
        expiresAt: form.expiresAt || undefined,
        title: form.title || undefined,
        note: form.note || undefined,
        redemptionLimit: Number.parseInt(form.redemptionLimit, 10) || 1,
        months: Number.parseInt(form.months, 10) || 1,
        planId: form.planId || 'PRO_MONTH',
        metadata: {
          scope: targetUserIds.length > 0 ? 'targeted' : 'open',
        },
      }, jwt || undefined);
      if (data) {
        setSuccess(`Created ${data.count || 1} coupon(s).`);
      }
      setForm((prev) => ({ 
        ...prev, 
        title: '', 
        note: '', 
        redemptionLimit: '1',
        months: '1',
        planId: 'PRO_MONTH'
      }));
      setSelectedTargets([]);
      await loadCoupons();
    } catch (err: any) {
      setError(err?.message || 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (id: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(`${window.location.origin}/accounts/coupon/${id}`);
    setSuccess('Coupon link copied.');
  };

  const revokeCoupon = (id: string) => {
    openUnified('delete-confirm', {
      title: 'Revoke Coupon?',
      description: 'This will invalidate the coupon and prevent any future claims. Existing subscriptions created with this coupon will not be affected.',
      resourceName: 'this coupon',
      confirmLabel: 'Revoke Coupon',
      onConfirm: async () => {
        setLoading(true);
        setError(null);
        try {
          const jwt = await getJWT();
          await invalidateCouponAction(id, jwt || undefined);
          setSuccess('Coupon revoked successfully.');
          await loadCoupons();
        } catch (err: any) {
          setError(err?.message || 'Failed to revoke coupon');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const totalCoupons = useMemo(() => coupons.length, [coupons]);

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6 text-white font-satoshi">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-black font-clash text-white tracking-tight leading-tight">
              Coupons
            </h2>
            <p className="text-sm text-white/45 mt-1">
              Create open or targeted coupons. Open coupons are first-claim wins, targeted coupons are restricted to named users.
            </p>
          </div>
          <button
            type="button"
            onClick={loadCoupons}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/10 text-white font-bold text-xs hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold">
            {error}
          </div>
        )}
        {success && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
            {success}
          </div>
        )}

        {/* Coupon Creator Card */}
        <div className="p-6 rounded-[28px] bg-[#161412] border border-white/5 flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5 relative col-span-1 md:col-span-2">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Target Users</span>
              {/* Search mode toggle */}
              <div className="flex gap-1.5 mb-2">
                {(['username', 'userid', 'email'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setSearchMode(mode); setProfileQuery(''); setSearchResults([]); }}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      searchMode === mode
                        ? 'bg-[#6366F1] text-black'
                        : 'bg-white/[0.03] border border-white/10 text-white/40 hover:border-[#6366F1]/30 hover:text-white/70'
                    }`}
                  >
                    {mode === 'username' ? 'Username' : mode === 'userid' ? 'User ID' : 'Email'}
                  </button>
                ))}
              </div>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
                    {searchingProfiles ? (
                      <Loader2 size={14} className="text-[#6366F1] animate-spin" />
                    ) : (
                      <Search size={14} className="text-white/40" />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder={
                      searchMode === 'username' ? 'Search username or display name...'
                      : searchMode === 'userid' ? 'Paste exact user ID...'
                      : 'Enter email address...'
                    }
                    value={profileQuery}
                    onChange={(e) => setProfileQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && searchMode !== 'username') handleManualSearch(); }}
                    className="w-full bg-[#0A0908] pl-10 pr-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
                  />
                </div>
                {searchMode !== 'username' && (
                  <button
                    type="button"
                    onClick={handleManualSearch}
                    disabled={!profileQuery.trim() || searchingProfiles}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] disabled:opacity-40 text-black font-black text-xs transition-all cursor-pointer"
                  >
                    {searchingProfiles ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  </button>
                )}
              </div>
              <span className="text-[10px] text-white/30 block">Leave blank for open claim</span>
              
              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1 mt-2">
                  {searchResults.map((p) => (
                    <div
                      key={p.$id}
                      onClick={() => selectProfile(p)}
                      className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        selectedTargets.some(t => t.id === p.userId)
                          ? 'bg-[#6366F1]/10 border-[#6366F1]/25'
                          : 'bg-white/[0.02] border-white/5 hover:border-[#6366F1]/30 hover:bg-[#6366F1]/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#6366F1] text-black font-black flex items-center justify-center text-xs flex-shrink-0">
                          {(p.displayName || p.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <span className="block text-sm font-extrabold text-white truncate">
                            {p.displayName || p.username}
                          </span>
                          <span className="block text-[11px] text-[#9B9691] font-medium font-mono truncate">
                            @{p.username}
                          </span>
                        </div>
                      </div>
                      {selectedTargets.some(t => t.id === p.userId) ? (
                        <span className="flex items-center gap-1 px-3 py-1.5 bg-[#6366F1]/20 text-[#6366F1] font-black text-[10px] rounded-lg flex-shrink-0">
                          <Check size={12} />
                          <span>Added</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectProfile(p);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#6366F1] hover:bg-[#5458E8] text-black font-black text-[10px] rounded-lg transition-all cursor-pointer flex-shrink-0"
                        >
                          <Check size={12} />
                          <span>Select</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Targets Chips */}
              {selectedTargets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 max-h-28 overflow-y-auto">
                  {selectedTargets.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 pl-1.5 pr-1.5 py-1 rounded-full bg-white/[0.04] border border-white/5">
                      <div className="w-5 h-5 rounded-full bg-[#6366F1] text-black font-black flex items-center justify-center text-[8px] flex-shrink-0">
                        {(t.name || t.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] font-bold text-[#6366F1]">@{t.username}</span>
                      <span className="text-[9px] text-white/40 truncate max-w-[90px]" title={t.email}>{t.email}</span>
                      <button
                        type="button"
                        onClick={() => removeProfile(t.id)}
                        className="p-0.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Discount %</span>
              <input
                type="number"
                value={form.discountPercent}
                onChange={(event) => setForm((prev) => ({ ...prev, discountPercent: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Status</span>
              <input
                type="text"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Max Redemptions</span>
              <input
                type="number"
                value={form.redemptionLimit}
                onChange={(event) => setForm((prev) => ({ ...prev, redemptionLimit: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
              <span className="text-[10px] text-white/30 block">Required for open links</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Title</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Note</span>
              <input
                type="text"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Expires At</span>
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Active Months</span>
              <input
                type="number"
                value={form.months}
                onChange={(event) => setForm((prev) => ({ ...prev, months: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Target Plan</span>
              <select
                value={form.planId}
                onChange={(event) => setForm((prev) => ({ ...prev, planId: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              >
                <option value="PRO_MONTH">Pro Monthly (default)</option>
                <option value="PRO_YEAR">Pro Yearly</option>
                <option value="TEAMS_MONTH">Teams Monthly</option>
                <option value="TEAMS_YEAR">Teams Yearly</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={createCoupon}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-black font-black text-xs transition-all duration-200 cursor-pointer disabled:opacity-50 w-fit"
          >
            <Ticket size={16} />
            <span>{saving ? 'Creating...' : 'Create Coupon'}</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-white/50 text-sm">{totalCoupons} coupons</span>
        </div>

        {/* Coupons List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
            </div>
          ) : coupons.length ? (
            coupons.map((coupon) => (
              <div key={coupon.$id} className="p-6 rounded-[28px] bg-[#161412] border border-white/5 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h4 className="font-extrabold text-base text-white">
                      {parseMetadata(coupon.metadata)?.coupon?.title || coupon.$id}
                    </h4>
                    <p className="text-xs text-white/40 mt-1 font-mono">
                      /accounts/coupon/{coupon.$id}
                    </p>
                    {coupon.$createdAt && (
                      <p className="text-[10px] text-white/30 mt-1 font-mono">
                        Issued: {new Date(coupon.$createdAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border bg-white/5 border-white/10 text-white/60">
                      {(coupon as any).redemptionCount || 0} / {(coupon as any).redemptionLimit || 1} uses
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                      formatScope(coupon) === 'open' 
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}>
                      {formatScope(coupon)}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border bg-indigo-500/10 border-indigo-500/20 text-indigo-400">
                      {coupon.discountPercent || parseMetadata(coupon.metadata)?.coupon?.discountPercent || 0}% Off
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border bg-amber-500/10 border-amber-500/20 text-amber-400">
                      {parseMetadata(coupon.metadata)?.planId || 'PRO_MONTH'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                      {parseMetadata(coupon.metadata)?.months || 1} Month(s)
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border bg-white/5 border-white/10 text-white/60">
                      {String(coupon.status || 'active')}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-white/65 leading-relaxed">
                  {parseMetadata(coupon.metadata)?.note || 'No note provided.'}
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => copyLink(coupon.$id)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/10 text-white font-bold text-xs hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer"
                  >
                    <Copy size={14} />
                    <span>Copy Link</span>
                  </button>
                  <Link
                    href={`/accounts/coupon/${coupon.$id}`}
                    className="px-4 py-2.5 rounded-full text-xs font-black text-[#6366F1] hover:text-[#5254E8] transition-colors cursor-pointer"
                  >
                    Open Coupon Page
                  </Link>
                  {String(coupon.status || 'active') !== 'revoked' && (
                    <button
                      type="button"
                      onClick={() => revokeCoupon(coupon.$id)}
                      className="px-4 py-2.5 rounded-full text-xs font-black text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer ml-auto"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 rounded-[28px] bg-[#161412] border border-white/5 text-center text-sm text-white/55">
              No coupons yet.
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
