'use client';

import { useEffect, useMemo, useState } from 'react';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/context/AuthContext';
import { TwoFactorDrawer } from '@/components/overlays/TwoFactorDrawer';

const REMINDER_KEY_PREFIX = 'kylrix_two_factor_reminder_last_prompt_';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function resolveLoginMethod(provider?: string | null) {
  const value = (provider || '').toLowerCase();
  if (value.includes('email')) return 'email-otp' as const;
  if (value.includes('oauth')) return 'oauth2' as const;
  if (value.includes('password')) return 'password' as const;
  return 'unknown' as const;
}

export default function TwoFactorReminderHost() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email-otp' | 'oauth2' | 'password' | 'unknown'>('unknown');

  const reminderKey = useMemo(() => {
    if (!user?.$id) return null;
    return `${REMINDER_KEY_PREFIX}${user.$id}`;
  }, [user?.$id]);

  useEffect(() => {
    let mounted = true;
    if (!user?.$id) {
      setOpen(false);
      return;
    }

    (async () => {
      try {
        const [session, freshUser] = await Promise.all([
          account.getSession('current'),
          account.get(),
        ]);

        if (!mounted) return;
        setLoginMethod(resolveLoginMethod((session as any)?.provider));

        const mfaEnabledAt = (freshUser as any)?.prefs?.mfaEnabledAt;
        if (mfaEnabledAt) {
          setOpen(false);
          return;
        }

        if (!reminderKey) return;
        const lastPrompt = Number(localStorage.getItem(reminderKey) || '0');
        const due = !lastPrompt || Date.now() - lastPrompt > SEVEN_DAYS;
        if (due) {
          setOpen(true);
        }
      } catch (_err) {
        if (mounted) {
          setOpen(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [reminderKey, user]);

  const handleClose = () => {
    if (reminderKey) {
      localStorage.setItem(reminderKey, Date.now().toString());
    }
    setOpen(false);
  };

  if (!user?.$id) return null;

  return (
    <TwoFactorDrawer
      open={open}
      onClose={handleClose}
      userId={user.$id}
      emailVerified={Boolean((user as any)?.emailVerification)}
      loginMethod={loginMethod}
      mode="reminder"
      onEnabled={handleClose}
    />
  );
}

