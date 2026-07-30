'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/auth/AuthContext';
import { UsersService, buildUsernameHandleSuggestions, invalidateUsersProfileRowCache } from '@/lib/services/users';
import { KeychainService } from '@/lib/appwrite/keychain';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { usePathname } from 'next/navigation';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import toast from 'react-hot-toast';

type SetupStep = 'none' | 'masterpass' | 'username' | 'passkey' | 'identity';

interface SetupContextType {
  currentStep: SetupStep;
  isLoading: boolean;
  profile: any;
  hasMasterpass: boolean | null;
  hasPasskey: boolean | null;
  triggerCheck: () => Promise<void>;
  dismissStep: (step: SetupStep, durationDays?: number) => void;
  silentPublishUsername: () => Promise<boolean>;
}

const SetupContext = createContext<SetupContextType | undefined>(undefined);

const USERNAME_DISMISS_KEY = 'kylrix_setup_dismiss_username_';
const MP_DISMISS_KEY = 'kylrix_setup_dismiss_masterpass_';
const PASSKEY_DISMISS_KEY = 'kylrix_setup_dismiss_passkey_';

function routeSuppressesSetup(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname.startsWith('/connect')) return true;
  if (pathname.includes('/settings')) return true;
  if (pathname.startsWith('/vault/masterpass')) return true;
  if (pathname.startsWith('/vault/reset')) return true;
  return false;
}

export const SetupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const { activeContent } = useUnifiedDrawer();
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState<SetupStep>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
  const [hasPasskey, setHasPasskey] = useState<boolean | null>(null);
  const checkInflight = useRef(false);

  const dismissStep = useCallback((step: SetupStep, durationDays?: number) => {
    if (user?.$id) {
      const expiresAt = Date.now() + (durationDays ?? 7) * 24 * 60 * 60 * 1000;
      
      if (step === 'username') {
        localStorage.setItem(`${USERNAME_DISMISS_KEY}${user.$id}`, String(expiresAt));
      } else if (step === 'masterpass') {
        localStorage.setItem(`${MP_DISMISS_KEY}${user.$id}`, String(expiresAt));
      } else if (step === 'passkey') {
        localStorage.setItem(`${PASSKEY_DISMISS_KEY}${user.$id}`, String(expiresAt));
      }
    }
    
    setCurrentStep('none');
  }, [user?.$id]);

  const silentPublishUsername = useCallback(async (): Promise<boolean> => {
    if (!user?.$id) return false;
    
    const emailPrefix = user.email ? user.email.split('@')[0] : '';
    let cleanHandle = emailPrefix.toLowerCase().replace(/[^a-z_]/g, '');
    
    if (cleanHandle.length < 3) {
      const nameClean = (user.name || '').toLowerCase().replace(/[^a-z_]/g, '');
      if (nameClean.length >= 3) {
        cleanHandle = nameClean;
      } else {
        return false;
      }
    }

    const candidates = [
      cleanHandle,
      `${cleanHandle}_v`,
      `${cleanHandle}_key`
    ].filter(c => c.length >= 3);

    for (const handle of candidates) {
      try {
        const isAvailable = await UsersService.isUsernameAvailable(handle);
        if (isAvailable) {
          const displayName = user.name || (handle.charAt(0).toUpperCase() + handle.slice(1));
          
          let publicKey: string | undefined;
          try {
            if (ecosystemSecurity.status.isUnlocked) {
              const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
              if (pub) publicKey = pub;
            }
          } catch {
            // Best effort
          }

          if (profile?.$id) {
            await UsersService.updateProfile(user.$id, {
              username: handle,
              displayName,
              ...(publicKey ? { publicKey } : {}),
            });
          } else {
            await UsersService.createProfile(user.$id, handle, {
              displayName,
              ...(publicKey ? { publicKey } : {}),
            });
          }
          
          invalidateUsersProfileRowCache(user.$id);
          const p = await UsersService.getProfileById(user.$id);
          setProfile(p);
          toast.success(`Automatically set handle: @${handle}`);
          return true;
        }
      } catch (err) {
        console.warn('[SetupProvider] Failed silent username registration candidate:', handle, err);
      }
    }
    return false;
  }, [user, profile]);

  const triggerCheck = useCallback(async () => {
    if (!user?.$id || checkInflight.current) return;
    checkInflight.current = true;
    setIsLoading(true);

    try {
      if (activeContent === 'login') {
        setCurrentStep('none');
        return;
      }

      const [prof, mpOk] = await Promise.all([
        UsersService.getProfileById(user.$id),
        KeychainService.hasMasterpass(user.$id).catch(() => false),
      ]);

      setProfile(prof);
      setHasMasterpass(mpOk);

      const keychainRes = await KeychainService.listKeychainEntries(user.$id).catch(() => []);
      const lastAuthMethod = typeof window !== 'undefined' ? localStorage.getItem('kylrix_last_auth_method') : null;
      const cachedHasPasskey = typeof window !== 'undefined' && localStorage.getItem(`kylrix_has_passkey_${user.$id}`) === 'true';
      const passkeyOk = keychainRes.some((e: any) => e.type === 'passkey') || lastAuthMethod === 'passkey' || cachedHasPasskey;
      setHasPasskey(passkeyOk);

      const now = Date.now();
      const suppress = routeSuppressesSetup(pathname);

      if (suppress) {
        setCurrentStep('none');
        return;
      }

      if (!mpOk) {
        const dismissedStr = localStorage.getItem(`${MP_DISMISS_KEY}${user.$id}`);
        const dismissedUntil = dismissedStr ? parseInt(dismissedStr, 10) : 0;
        if (now > dismissedUntil) {
          setCurrentStep('masterpass');
          return;
        }
      }

      const handle = prof?.username ? String(prof.username).trim() : '';
      if (handle.length < 3) {
        const silenced = await silentPublishUsername();
        if (!silenced) {
          const dismissedStr = localStorage.getItem(`${USERNAME_DISMISS_KEY}${user.$id}`);
          const dismissedUntil = dismissedStr ? parseInt(dismissedStr, 10) : 0;
          if (now > dismissedUntil) {
            setCurrentStep('username');
            return;
          }
        }
      }

      if (mpOk && !passkeyOk) {
        const dismissedStr = localStorage.getItem(`${PASSKEY_DISMISS_KEY}${user.$id}`);
        const dismissedUntil = dismissedStr ? parseInt(dismissedStr, 10) : 0;
        if (now > dismissedUntil) {
          setCurrentStep('passkey');
          return;
        }
      }

      if (mpOk && ecosystemSecurity.status.isUnlocked) {
        const hasPubKey = prof?.publicKey && prof.publicKey.length > 5;
        if (!hasPubKey) {
          try {
            const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
            if (pub) {
              await UsersService.updateProfile(user.$id, {
                publicKey: pub});
              invalidateUsersProfileRowCache(user.$id);
              const updated = await UsersService.getProfileById(user.$id);
              setProfile(updated);
              toast.success('Secure identity successfully published');
            }
          } catch (err) {
            console.warn('[SetupProvider] Failed E2E identity publication:', err);
          }
        }
      }

      setCurrentStep('none');
    } catch (err) {
      console.error('[SetupProvider] Error in setup checker:', err);
    } finally {
      setIsLoading(false);
      checkInflight.current = false;
    }
  }, [user, pathname, silentPublishUsername, activeContent]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.$id) {
      setCurrentStep('none');
      setProfile(null);
      setHasMasterpass(null);
      setHasPasskey(null);
      setIsLoading(false);
      return;
    }

    void triggerCheck();
  }, [user?.$id, authLoading, pathname, triggerCheck]);

  useEffect(() => {
    const unsub = ecosystemSecurity.onStatusChange(() => {
      void triggerCheck();
    });
    return unsub;
  }, [triggerCheck]);

  return (
    <SetupContext.Provider
      value={{
        currentStep,
        isLoading,
        profile,
        hasMasterpass,
        hasPasskey,
        triggerCheck,
        dismissStep,
        silentPublishUsername}}
    >
      {children}
    </SetupContext.Provider>
  );
};

export const useSetup = () => {
  const context = useContext(SetupContext);
  if (!context) throw new Error('useSetup must be used within SetupProvider');
  return context;
};
