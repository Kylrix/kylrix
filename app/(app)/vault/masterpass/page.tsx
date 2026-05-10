"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppwriteVault } from '@/context/appwrite-context';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { masterPassCrypto } from '@/lib/masterpass-crypto';
import { AppwriteService, setMasterpassFlag } from '@/lib/appwrite';
import toast from 'react-hot-toast';

/**
 * /masterpass - Master Password Management Page
 * Handles first-time MasterPass setup and recovery from missing-keychain states.
 */
export default function MasterPassPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAppwriteVault();
  const [checking, setChecking] = useState(true);
  const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const callbackUrl = useMemo(() => {
    const raw = searchParams.get('callbackUrl');
    if (!raw) return '/vault/dashboard';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    try {
      const url = new URL(raw, origin || 'https://kylrix.space');
      if (origin && url.origin !== origin) return '/vault/dashboard';
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return '/vault/dashboard';
    }
  }, [searchParams]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/vault');
      return;
    }
    if (!user?.$id) return;

    let cancelled = false;
    setChecking(true);
    AppwriteService.listKeychainEntries(user.$id)
      .then((entries: Array<{ type?: string }>) => {
        if (cancelled) return;
        const passwordPresent = entries.some((entry) => entry.type === 'password');
        setHasMasterpass(passwordPresent);
        if (passwordPresent) {
          router.replace(callbackUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setHasMasterpass(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, loading, router, callbackUrl]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.$id || !user.email) return;
    if (password.length < 8) {
      toast.error('Master password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const success = await masterPassCrypto.unlock(password, user.$id, true);
      if (!success) {
        toast.error('Could not initialize master password.');
        return;
      }
      await setMasterpassFlag(user.$id, user.email);
      toast.success('Master password configured.');
      router.replace(callbackUrl);
    } catch {
      toast.error('Failed to set up master password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: 'calc(100vh - 88px)', bgcolor: '#0A0908', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: '24px', bgcolor: '#161412', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Stack spacing={2.5} component="form" onSubmit={handleSubmit}>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: '1.35rem' }}>
                Set up MasterPass
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.56)', mt: 0.75, fontSize: '0.9rem' }}>
                First-time setup is required before Vault and chat decryption can work reliably.
              </Typography>
            </Box>

            {checking || hasMasterpass === null ? (
              <Box sx={{ py: 3, display: 'grid', placeItems: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <>
                <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                  Save this password safely. It cannot be recovered.
                </Alert>
                <TextField
                  fullWidth
                  type="password"
                  label="Master password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <TextField
                  fullWidth
                  type="password"
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={submitting}
                  sx={{ bgcolor: '#10B981', color: '#000', fontWeight: 800, borderRadius: '12px', py: 1.35 }}
                >
                  {submitting ? <CircularProgress size={20} color="inherit" /> : 'Initialize MasterPass'}
                </Button>
              </>
            )}
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
