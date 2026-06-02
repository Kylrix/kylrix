"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Button, CircularProgress, Paper, Stack, Typography } from '@/lib/mui-tailwind/material';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useSudo } from '@/context/SudoContext';
import { resetMasterpassAndWipe } from '@/lib/appwrite';
import toast from 'react-hot-toast';

export default function MasterpassResetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAppwriteVault();
  const { promptSudo } = useSudo();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const callbackUrl = searchParams.get('callbackUrl');

  useEffect(() => {
    if (user === null) {
      router.replace('/vault');
    }
  }, [router, user]);

  const verifyAndConfirm = async () => {
    const allowed = await promptSudo('reset');
    if (allowed) setConfirmed(true);
  };

  const runReset = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await resetMasterpassAndWipe(user.$id);
      localStorage.removeItem(`passkey_skip_${user.$id}`);
      toast.success('Vault wiped. Set a new master password.');
      const target = callbackUrl ? `/dashboard?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/vault';
      router.replace(target);
    } catch {
      toast.error('Failed to reset master password');
      setLoading(false);
    }
  };

  if (user === undefined) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#000' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) return null;

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#000', p: 3 }}>
      <Paper sx={{ p: 4, borderRadius: 3, width: '100%', maxWidth: 480, bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Stack spacing={2.5}>
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900 }}>Reset Master Password</Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)' }}>
            This irreversibly wipes encrypted vault data. Verify identity first, then confirm reset.
          </Typography>
          {!confirmed ? (
            <Button variant="contained" onClick={verifyAndConfirm} sx={{ bgcolor: '#FF4D4D', '&:hover': { bgcolor: '#D32F2F' } }}>
              Verify Identity
            </Button>
          ) : (
            <Button variant="contained" disabled={loading} onClick={runReset} sx={{ bgcolor: '#FF4D4D', '&:hover': { bgcolor: '#D32F2F' } }}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Confirm Reset'}
            </Button>
          )}
          <Button variant="text" onClick={() => router.back()} sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Cancel
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
