'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Copy, RefreshCw, Ticket } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { createCouponAction, listCouponsAction } from '../../actions/coupons';
import { useAuth } from '@/context/auth/AuthContext';

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
  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { getJWT } = useAuth();
  const [form, setForm] = useState({
    targetUserIds: '',
    discountPercent: '50',
    status: 'active',
    expiresAt: '',
    title: '',
    note: '',
    redemptionLimit: '1',
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

  const createCoupon = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const jwt = await getJWT();
      const targetUserIds = form.targetUserIds.split(',').map((id) => id.trim()).filter(Boolean);
      const data = await createCouponAction({
        userIds: targetUserIds.length > 0 ? targetUserIds : undefined,
        discountPercent: Number.parseInt(form.discountPercent, 10) || 0,
        status: form.status,
        expiresAt: form.expiresAt || undefined,
        title: form.title || undefined,
        note: form.note || undefined,
        redemptionLimit: Number.parseInt(form.redemptionLimit, 10) || 1,
        metadata: {
          scope: targetUserIds.length > 0 ? 'targeted' : 'open',
        },
      }, jwt || undefined);
      setSuccess(`Created ${data.count || 1} coupon(s).`);
      setForm((prev) => ({ ...prev, targetUserIds: '', title: '', note: '', redemptionLimit: '1' }));
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
            <div className="space-y-1.5">
              <span className="text-[10px] text-white/40 font-bold font-mono uppercase tracking-wider block">Target User IDs</span>
              <input
                type="text"
                placeholder="Comma separated IDs"
                value={form.targetUserIds}
                onChange={(event) => setForm((prev) => ({ ...prev, targetUserIds: event.target.value }))}
                className="w-full bg-[#0A0908] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:border-[#6366F1] focus:ring-4 focus:ring-[#6366F1]/10 focus:outline-none transition-all"
              />
              <span className="text-[10px] text-white/30 block">Leave blank for open claim</span>
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Link href={`/accounts/coupon/${coupon.$id}`} passHref legacyBehavior>
                    <a className="px-4 py-2.5 rounded-full text-xs font-black text-[#6366F1] hover:text-[#5254E8] transition-colors cursor-pointer">
                      Open Coupon Page
                    </a>
                  </Link>
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
