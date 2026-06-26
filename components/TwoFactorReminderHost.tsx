'use client';

import { useEffect, useMemo, useState } from 'react';
import { account } from '@/lib/appwrite';
import { useAuth } from '@/context/auth/AuthContext';
import { TwoFactorDrawer } from '@/components/overlays/TwoFactorDrawer';
import { isMfaFullyEnabled, listCurrentMfaFactors, resolveLoginMethod } from '@/lib/mfa';

const REMINDER_KEY_PREFIX = 'kylrix_two_factor_reminder_last_prompt_';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

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
        const [session, factors] = await Promise.all([
          account.getSession('current'),
          listCurrentMfaFactors(),
        ]);

        if (!mounted) return;
        setLoginMethod(resolveLoginMethod((session as { provider?: string | null })?.provider));

        if (isMfaFullyEnabled(factors)) {
          setOpen(false);
          return;
        }

        if (!reminderKey) return;
        const lastPrompt = Number(localStorage.getItem(reminderKey) || '0');
        const due = !lastPrompt || Date.now() - lastPrompt > SEVEN_DAYS;
        if (due) {
          setOpen(true);
        }
      } catch {
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
      emailVerified={Boolean((user as { emailVerification?: boolean })?.emailVerification)}
      loginMethod={loginMethod}
      mode="reminder"
      onEnabled={handleClose}
    />
  );
}
