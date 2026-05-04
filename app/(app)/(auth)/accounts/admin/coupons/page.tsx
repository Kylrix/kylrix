'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, TextField, Typography, alpha } from '@mui/material';
import { Copy, RefreshCw, Ticket } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

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
  const [form, setForm] = useState({
    targetUserIds: '',
    discountPercent: '50',
    status: 'active',
    expiresAt: '',
    title: '',
    note: '',
  });

  const loadCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/coupons', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load coupons');
      setCoupons(data.coupons || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const createCoupon = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const targetUserIds = form.targetUserIds.split(',').map((id) => id.trim()).filter(Boolean);
      const response = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: targetUserIds.length > 0 ? targetUserIds : undefined,
          discountPercent: Number.parseInt(form.discountPercent, 10) || 0,
          status: form.status,
          expiresAt: form.expiresAt || undefined,
          title: form.title || undefined,
          note: form.note || undefined,
          metadata: {
            scope: targetUserIds.length > 0 ? 'targeted' : 'open',
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create coupon');
      setSuccess(`Created ${data.count || 1} coupon(s).`);
      setForm((prev) => ({ ...prev, targetUserIds: '', title: '', note: '' }));
      await loadCoupons();
    } catch (err: any) {
      setError(err?.message || 'Failed to create coupon');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async (id: string) => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(`${window.location.origin}/coupon/${id}`);
    setSuccess('Coupon link copied.');
  };

  const totalCoupons = useMemo(() => coupons.length, [coupons]);

  return (
    <AdminLayout>
      <Stack spacing={4}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 900, letterSpacing: '-0.02em' }}>
              Coupons
            </Typography>
            <Typography sx={{ color: alpha('#FFFFFF', 0.45), mt: 1 }}>
              Create open or targeted coupons. Open coupons are first-claim wins, targeted coupons are restricted to named users.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              onClick={loadCoupons}
              startIcon={<RefreshCw size={16} />}
              sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 800, color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Paper sx={{ p: 3, borderRadius: 4, bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Stack spacing={2.5}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Target user IDs"
                helperText="Leave blank for an open coupon. Separate multiple IDs with commas."
                value={form.targetUserIds}
                onChange={(event) => setForm((prev) => ({ ...prev, targetUserIds: event.target.value }))}
              />
              <TextField
                label="Discount %"
                type="number"
                value={form.discountPercent}
                onChange={(event) => setForm((prev) => ({ ...prev, discountPercent: event.target.value }))}
                sx={{ width: { xs: '100%', md: 180 } }}
              />
              <TextField
                label="Status"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                sx={{ width: { xs: '100%', md: 180 } }}
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
              <TextField
                fullWidth
                label="Note"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
              <TextField
                label="Expires at"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
                sx={{ width: { xs: '100%', md: 260 } }}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Button
              onClick={createCoupon}
              disabled={saving}
              variant="contained"
              startIcon={<Ticket size={16} />}
              sx={{ alignSelf: 'flex-start', borderRadius: 999, textTransform: 'none', fontWeight: 800, bgcolor: '#6366F1', '&:hover': { bgcolor: '#4F46E5' } }}
            >
              {saving ? 'Creating...' : 'Create coupon'}
            </Button>
          </Stack>
        </Paper>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ color: alpha('#FFFFFF', 0.5), fontSize: '0.9rem' }}>
            {totalCoupons} coupons
          </Typography>
        </Box>

        <Stack spacing={2}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: '#6366F1' }} />
            </Box>
          ) : coupons.length ? (
            coupons.map((coupon) => (
              <Paper key={coupon.$id} sx={{ p: 3, borderRadius: 4, bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box>
                      <Typography sx={{ fontWeight: 900, fontSize: '1rem' }}>
                        {parseMetadata(coupon.metadata)?.coupon?.title || coupon.$id}
                      </Typography>
                      <Typography sx={{ color: alpha('#FFFFFF', 0.5), fontSize: '0.8rem' }}>
                        /coupon/{coupon.$id}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                      <Chip label={formatScope(coupon)} color={formatScope(coupon) === 'open' ? 'info' : 'default'} size="small" />
                      <Chip label={`${coupon.discountPercent || parseMetadata(coupon.metadata)?.coupon?.discountPercent || 0}%`} color="primary" size="small" />
                      <Chip label={String(coupon.status || 'active')} size="small" />
                    </Stack>
                  </Stack>
                  <Typography sx={{ color: alpha('#FFFFFF', 0.65), fontSize: '0.9rem' }}>
                    {parseMetadata(coupon.metadata)?.note || 'No note provided.'}
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      variant="outlined"
                      onClick={() => copyLink(coupon.$id)}
                      startIcon={<Copy size={16} />}
                      sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 800, color: '#fff', borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      Copy link
                    </Button>
                    <Button
                      component={Link}
                      href={`/coupon/${coupon.$id}`}
                      variant="text"
                      sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 800, color: '#6366F1' }}
                    >
                      Open coupon page
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))
          ) : (
            <Paper sx={{ p: 4, borderRadius: 4, bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Typography sx={{ color: alpha('#FFFFFF', 0.55) }}>No coupons yet.</Typography>
            </Paper>
          )}
        </Stack>
      </Stack>
    </AdminLayout>
  );
}
