'use client';

import { useEffect, useState, useCallback, use, useMemo } from 'react';
import { account, AppwriteService } from '@/lib/appwrite';
import { useRouter } from 'next/navigation';
import PreferencesManager from '@/components/PreferencesManager';
import SessionsManager from '@/components/SessionsManager';
import ActivityLogs from '@/components/ActivityLogs';
import ConnectedIdentities from '@/components/ConnectedIdentities';
import MasterPassManager from '@/components/MasterPassManager';
import PinManager from '@/components/PinManager';
import ProfileManager from '@/components/ProfileManager';
import ReferralManager from '@/components/ReferralManager';
import SudoModal from '@/components/overlays/SudoModal';
import { TwoFactorDrawer } from '@/components/overlays/TwoFactorDrawer';
import { AccountsBottomChrome } from '../../components/layout/AccountsBottomChrome';
import toast from 'react-hot-toast';
import { 
  UserCircle as ProfileIcon,
  ShieldCheck as SecurityIcon,
  MonitorSmartphone as SessionsIcon,
  History as ActivityIcon,
  Fingerprint as IdentityIcon,
  Sliders as PreferencesIcon,
  Settings2 as RootAccountIcon,
  ShieldAlert as AdminIcon,
  AlertTriangle
} from 'lucide-react';
import { isUserAdmin } from '@/lib/actions/admin/check-admin';
import { useAuth } from '@/context/auth/AuthContext';

interface UserData {
  email: string;
  name: string;
  userId: string;
  lastUsernameEdit?: string;
  profilePicId?: string | null;
  emailVerified?: boolean;
}

interface MfaFactorsState {
  email: boolean;
  totp: boolean;
  phone: boolean;
}

export default function SubSettingsPage(props: { params: Promise<{ subsettings: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const subsettings = params?.subsettings || 'profile';

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserData | null>(null);
  const [loginMethod, setLoginMethod] = useState<'email-otp' | 'oauth2' | 'password' | 'unknown'>('unknown');
  const [twoFactorSudoOpen, setTwoFactorSudoOpen] = useState(false);
  const [twoFactorDrawerOpen, setTwoFactorDrawerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<MfaFactorsState | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ label: string, color: string } | null>(null);
  const [giftUsername, setGiftUsername] = useState('');
  const [giftMonths, setGiftMonths] = useState('1');
  const [giftLoading, setGiftLoading] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sudoModalOpen, setSudoModalOpen] = useState(false);
  const [sudoAction, setSudoAction] = useState<'export' | 'delete' | null>(null);
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { getJWT } = useAuth();

  useEffect(() => {
    let active = true;
    async function checkAdmin() {
      try {
        const jwt = await getJWT();
        const result = await isUserAdmin(jwt || undefined);
        if (active) setIsAdmin(result);
      } catch (err) {
        console.error('Failed to check admin status:', err);
      }
    }
    checkAdmin();
    return () => {
      active = false;
    };
  }, [getJWT]);

  const navItems = useMemo(() => {
    const items = [
      { value: 'profile', label: 'Profile', icon: ProfileIcon, path: '/accounts/settings/profile' },
      { value: 'security', label: 'Security', icon: SecurityIcon, path: '/accounts/settings/security' },
      { value: 'sessions', label: 'Sessions', icon: SessionsIcon, path: '/accounts/settings/sessions' },
      { value: 'activity', label: 'Activity', icon: ActivityIcon, path: '/accounts/settings/activity' },
      { value: 'identities', label: 'Identities', icon: IdentityIcon, path: '/accounts/settings/identities' },
      { value: 'preferences', label: 'Preferences', icon: PreferencesIcon, path: '/accounts/settings/preferences' },
      { value: 'account', label: 'Account', icon: RootAccountIcon, path: '/accounts/settings/account' }
    ];
    if (isAdmin) {
      items.push({ value: 'admin', label: 'Admin Panel', icon: AdminIcon, path: '/accounts/admin' });
    }
    return items;
  }, [isAdmin]);

  const checkInitialStatus = useCallback(async (userId: string, email?: string) => {
    try {
      const status = await AppwriteService.getGlobalProfileStatus(userId);
      if (!status.exists) {
        const suggestion = email?.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '') || 'user';
        setProfileStatus({ 
          label: `Profile missing from directory. Clicking below will link you as @${suggestion}.`, 
          color: '#6366F1' 
        });
      } else {
        setProfileStatus({ 
          label: `Correctly linked in directory as @${status.profile?.username || 'user'}`, 
          color: '#10b981' 
        });
      }
    } catch (_e: unknown) {
      setProfileStatus({ label: 'Unable to verify directory status.', color: '#ef4444' });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const [userData, session, factors] = await Promise.all([
          account.get(),
          account.getSession('current').catch(() => null),
          account.listMfaFactors().catch(() => null)]);
        if (mounted) {
          const normalizedFactors = factors
            ? {
                email: Boolean((factors as any).email),
                totp: Boolean((factors as any).totp),
                phone: Boolean((factors as any).phone),
              }
            : null;
          setUser({
            email: userData.email,
            name: userData.prefs?.username || userData.name || userData.email.split('@')[0],
            userId: userData.$id,
            lastUsernameEdit: userData.prefs?.last_username_edit,
            profilePicId: userData.prefs?.profilePicId || null,
            emailVerified: Boolean((userData as any)?.emailVerification),
          });
          setMfaFactors(normalizedFactors);
          setLoginMethod(((session as any)?.provider || '').toLowerCase().includes('email')
            ? 'email-otp'
            : ((session as any)?.provider || '').toLowerCase().includes('oauth')
              ? 'oauth2'
              : ((session as any)?.provider || '').toLowerCase().includes('password')
                ? 'password'
                : 'unknown');
          setLoading(false);
          checkInitialStatus(userData.$id, userData.email);

          // Force-repair profile preview cache when viewing profile tab
          const fileId = userData.prefs?.profilePicId || userData.$id;
          if (fileId && subsettings === 'profile') {
            (async () => {
              try {
                const { fetchProfilePreview } = await import('@/lib/profile-preview');
                const PREVIEW_STORE_KEY = 'kylrix_avatar_cache_v2';
                if (typeof window !== 'undefined') {
                  try {
                    const stored = sessionStorage.getItem(PREVIEW_STORE_KEY);
                    if (stored) {
                      const parsed = JSON.parse(stored);
                      delete parsed[fileId];
                      sessionStorage.setItem(PREVIEW_STORE_KEY, JSON.stringify(parsed));
                    }
                  } catch {}
                }
                await fetchProfilePreview(fileId);
              } catch (err) {
                console.warn('Failed to repair profile preview cache:', err);
              }
            })();
          }
        }
      } catch (_err) {
        if (mounted) router.push('/accounts/login');
      }
    }
    init();
    return () => { mounted = false; };
  }, [router, checkInitialStatus]);

  useEffect(() => {
    // Handle hash scrolling
    if (!loading && window.location.hash) {
      const id = window.location.hash.substring(1);
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [loading, subsettings]);

  const handleFixDiscoverability = async () => {
    setSyncing(true);
    setSyncSuccess(false);
    try {
      const userData = await account.get();
      const result = await AppwriteService.ensureGlobalProfile(userData);
      setSyncSuccess(true);
      setProfileStatus({ 
        label: `Successfully synced! Your global username is now @${result?.username || 'user'}`, 
        color: '#10b981' 
      });
      setUser(prev => prev ? { ...prev, name: result?.username || prev.name } : null);
      setTimeout(() => setSyncSuccess(false), 5000);
    } catch (err: unknown) {
      console.error('Manual sync failed:', err);
    } finally {
      setSyncing(false);
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

  const refreshTwoFactorStatus = useCallback(async () => {
    try {
      const [freshUser, factors] = await Promise.all([
        account.get(),
        account.listMfaFactors().catch(() => null)]);
      const normalizedFactors = factors
        ? {
            email: Boolean((factors as any).email),
            totp: Boolean((factors as any).totp),
            phone: Boolean((factors as any).phone),
          }
        : null;
      setMfaFactors(normalizedFactors);
      setUser(prev => prev ? {
        ...prev,
        emailVerified: Boolean((freshUser as any)?.emailVerification),
      } : null);
    } catch {
      // keep current UI state
    }
  }, []);

  const handleTwoFactorSuccess = useCallback(() => {
    setTwoFactorSudoOpen(false);
    setTwoFactorDrawerOpen(true);
  }, []);

  const handleSudoSuccess = useCallback(async () => {
    setSudoModalOpen(false);
    if (sudoAction === 'export') {
      try {
        const [appPrefs, sessions] = await Promise.all([
          account.getPrefs().catch(() => ({})),
          account.listSessions().catch(() => ({ rows: [] }))
        ]);
        
        const exportData = {
          profile: {
            userId: user?.userId,
            email: user?.email,
            name: user?.name,
          },
          preferences: appPrefs,
          sessions: (sessions as any).rows || [],
          exportDate: new Date().toISOString(),
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `kylrix_account_export_${user?.userId}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        toast.success('Account data exported successfully.');
      } catch (err: any) {
        toast.error(err.message || 'Export failed.');
      }
    } else if (sudoAction === 'delete') {
      try {
        toast.loading('Purging identity data...', { id: 'delete-purge' });
        const { executeMasterPurgeSecure } = await import('@/lib/actions/secure-ops');
        await executeMasterPurgeSecure();
        await account.deleteSession('current').catch(() => {});
        toast.success('Identity purged. Redirecting...', { id: 'delete-purge' });
        router.push('/accounts/login');
      } catch (err: any) {
        toast.error(err.message || 'Purge failed.', { id: 'delete-purge' });
      }
    }
    setSudoAction(null);
  }, [sudoAction, user, router]);

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center py-12 bg-black min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
      </div>
    );
  }

  const accountMfaEnabled = Boolean(mfaFactors?.email && mfaFactors?.totp);

  return (
    <div className="animate-fadeIn bg-black min-h-screen p-4 md:p-8 text-white">
      {/* Header (Desktop Only) */}
      <div className="mb-8 hidden md:block">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black font-clash text-white tracking-tight leading-tight capitalize">
          {subsettings} Configuration
        </h1>
        <p className="text-[#9B9691] mt-1.5 text-sm font-semibold max-w-[600px] font-satoshi">
          Manage your global {subsettings} protocols and ecosystem preferences.
        </p>
      </div>

      <div className="md:grid md:grid-cols-[240px_1fr] md:gap-10 items-start">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden md:block space-y-6 sticky top-24">
          <div className="space-y-2">
            <span className="text-[10px] text-[#9B9691] font-bold font-mono uppercase tracking-wider px-3">
              Settings Protocols
            </span>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = subsettings === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => router.push(item.path)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold font-satoshi transition-all cursor-pointer text-left w-full ${
                      isActive
                        ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20'
                        : 'text-white/60 hover:bg-white/[0.02] hover:text-white border border-transparent'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#6366F1]' : 'text-white/40'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Settings Content Area */}
        <div className="min-w-0">
          {subsettings === 'profile' && (
            <div className="flex flex-col gap-8 pb-24">
          <div id="identity" className="bg-[#161514] border border-white/5 rounded-[32px] p-6 md:p-10">
            <ProfileManager 
              onProfileUpdate={(data) => {
                setUser(prev => prev ? {
                  ...prev,
                  ...(data.name && { name: data.name }),
                  ...(data.profilePicId !== undefined && { profilePicId: data.profilePicId })
                } : null);
              }}
            />
          </div>

          <div id="identifiers" className="space-y-4">
            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
              Account Email
            </h2>
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] text-[#9B9691] font-bold font-mono uppercase tracking-wider block mb-1">
                  Primary Mail Relay
                </span>
                <span className="text-lg text-white font-extrabold tracking-tight">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(user.email);
                  toast.success('Email copied');
                }}
                className="py-2 px-4 rounded-xl border border-white/10 text-white font-bold text-xs hover:border-[#6366F1] hover:bg-[#6366F1]/5 transition-all cursor-pointer flex-shrink-0"
              >
                Copy Email
              </button>
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-[28px] p-6 md:p-8 space-y-4">
            <h3 className="text-lg font-black font-clash text-white">
              Billing & Subscriptions
            </h3>
            <p className="text-xs text-[#9B9691] leading-relaxed font-satoshi">
              Manage your premium subscription plans, active coupons, regional parameters, and gift subscriptions to other network nodes.
            </p>
            <button
              type="button"
              onClick={() => router.push('/accounts/billing')}
              className="px-6 py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-sm transition-all cursor-pointer border-none"
            >
              Go to Billing Settings
            </button>
          </div>
        </div>
      )}

      {subsettings === 'security' && (
        <div className="flex flex-col gap-8 pb-24">
          <div id="masterpass" className="space-y-4">
            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
              Encryption
            </h2>
            <div className="bg-[#161514] border border-white/5 rounded-[32px] p-6 md:p-10">
              <MasterPassManager userId={user.userId} />
            </div>
          </div>

          <div id="pin" className="space-y-4">
            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
              Quick Access
            </h2>
            <div className="bg-[#161514] border border-white/5 rounded-[32px] p-6 md:p-10">
              <PinManager />
            </div>
          </div>

          <div id="mfa" className="space-y-4">
            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
              2FA
            </h2>
            <div className="bg-white/[0.02] border border-white/5 rounded-[28px] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="text-base font-extrabold text-white mb-1">2FA Status</h4>
                  <p className="text-xs text-[#9B9691] leading-relaxed max-w-[540px]">
                    2FA is on only when both Email and TOTP are enabled.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTwoFactorSudoOpen(true)}
                  className="py-3 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-black text-xs transition-colors cursor-pointer flex-shrink-0"
                >
                  {accountMfaEnabled ? 'Manage 2FA' : 'Set up 2FA'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                  accountMfaEnabled 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  2FA: {accountMfaEnabled ? 'enabled' : 'off'}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                  mfaFactors?.email 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}>
                  Email: {mfaFactors?.email ? 'enabled' : 'off'}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                  mfaFactors?.totp 
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}>
                  TOTP: {mfaFactors?.totp ? 'enabled' : 'off'}
                </span>
              </div>

              <p className="text-xs text-[#9B9691] leading-relaxed font-satoshi">
                {accountMfaEnabled
                  ? 'Email and TOTP are both enabled.'
                  : 'Tap set up 2FA to register email first, then TOTP.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {subsettings === 'sessions' && (
        <div id="active-sessions" className="space-y-4 pb-24">
          <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
            Sessions
          </h2>
          <div className="bg-[#161514] border border-white/5 rounded-[32px] p-6 md:p-10">
            <SessionsManager />
          </div>
        </div>
      )}

      {subsettings === 'activity' && (
        <div id="activity-log" className="space-y-4 pb-24">
          <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
            Activity
          </h2>
          <div className="bg-[#161514] border border-white/5 rounded-[32px] p-6 md:p-10">
            <ActivityLogs />
          </div>
        </div>
      )}

      {subsettings === 'identities' && (
        <div id="oauth" className="pb-24">
          <div className="bg-[#161514] border border-white/5 rounded-[32px] p-6 md:p-10">
            <ConnectedIdentities />
          </div>
        </div>
      )}

      {subsettings === 'preferences' && (
        <div id="env-prefs" className="space-y-4 pb-24">
          <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
            Preferences
          </h2>
          <div className="bg-[#161514] border border-white/5 rounded-[32px] p-6 md:p-10">
            <PreferencesManager />
          </div>
        </div>
      )}

      {subsettings === 'account' && (
        <div id="root-mgmt" className="space-y-6 pb-24">
          <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
            Account Settings
          </h2>
          <div className="bg-white/[0.01] border border-white/5 rounded-[28px] p-6 md:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h4 className="text-base font-extrabold text-white mb-1">Export Account Data</h4>
                <p className="text-xs text-[#9B9691] leading-relaxed max-w-[600px] font-satoshi">
                  Download a copy of your account profile, preferences, and active session details.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmExportOpen(true)}
                className="py-3 px-5 rounded-xl border border-white/10 text-white font-extrabold text-xs hover:border-[#6366F1] hover:bg-[#6366F1]/5 transition-all min-w-[200px] cursor-pointer"
              >
                Download Data
              </button>
            </div>
            
            <div className="h-px bg-white/5 w-full" />

            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <h4 className="text-base font-extrabold text-red-500 mb-1">Delete Account</h4>
                <p className="text-xs text-[#9B9691] leading-relaxed max-w-[600px] font-satoshi">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="py-3 px-5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500 font-extrabold text-xs transition-all min-w-[200px] cursor-pointer"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

      {confirmExportOpen && (
        <DoubleConfirmationModal
          isOpen={confirmExportOpen}
          title1="Export Account Data"
          message1="This will prepare a downloadable backup containing your account information, preferences, and active sessions."
          title2="Security & Privacy Warning"
          message2="The generated file will contain sensitive configuration and session data. Please store this backup securely and only download it onto a personal, trusted device."
          confirmLabel1="Continue"
          confirmLabel2="Verify & Download"
          onSuccess={() => {
            setConfirmExportOpen(false);
            setSudoAction('export');
            setSudoModalOpen(true);
          }}
          onCancel={() => setConfirmExportOpen(false)}
        />
      )}

      {confirmDeleteOpen && (
        <DoubleConfirmationModal
          isOpen={confirmDeleteOpen}
          title1="Delete Your Account"
          message1="This will permanently delete your profile, active sessions, and configurations. This action is irreversible."
          title2="Irreversible Wiping Warning"
          message2="WARNING: All your data, including credentials and files, will be completely wiped from our records. You will lose access immediately. Do you want to proceed?"
          confirmLabel1="Continue"
          confirmLabel2="Verify & Delete Account"
          isDestructive={true}
          onSuccess={() => {
            setConfirmDeleteOpen(false);
            setSudoAction('delete');
            setSudoModalOpen(true);
          }}
          onCancel={() => setConfirmDeleteOpen(false)}
        />
      )}

      {twoFactorSudoOpen && (
        <SudoModal
          isOpen={twoFactorSudoOpen}
          onSuccess={handleTwoFactorSuccess}
          onCancel={() => setTwoFactorSudoOpen(false)}
        />
      )}

      {sudoModalOpen && (
        <SudoModal
          isOpen={sudoModalOpen}
          onSuccess={handleSudoSuccess}
          onCancel={() => {
            setSudoModalOpen(false);
            setSudoAction(null);
          }}
          intent="unlock"
          app="accounts"
        />
      )}

      {twoFactorDrawerOpen && user && (
        <TwoFactorDrawer
          open={twoFactorDrawerOpen}
          onClose={() => setTwoFactorDrawerOpen(false)}
          userId={user.userId}
          emailVerified={Boolean(user.emailVerified)}
          loginMethod={loginMethod}
          mode="setup"
          onEnabled={refreshTwoFactorStatus}
        />
      )}

      <AccountsBottomChrome />
    </div>
  );
}

interface DoubleConfirmationModalProps {
  isOpen: boolean;
  title1: string;
  message1: string;
  title2: string;
  message2: string;
  confirmLabel1?: string;
  confirmLabel2?: string;
  isDestructive?: boolean;
  onSuccess: () => void;
  onCancel: () => void;
}

function DoubleConfirmationModal({
  isOpen,
  title1,
  message1,
  title2,
  message2,
  confirmLabel1 = "Continue",
  confirmLabel2 = "Confirm",
  isDestructive = false,
  onSuccess,
  onCancel
}: DoubleConfirmationModalProps) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300"
        onClick={onCancel}
      />
      {/* Content Card */}
      <div className="relative w-full max-w-md bg-[#161412] border border-white/5 rounded-[28px] p-6 md:p-8 shadow-2xl transition-all duration-300 transform scale-100 flex flex-col gap-6 text-white font-satoshi">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#9B9691] font-bold font-mono uppercase tracking-wider">
              Step {step} of 2
            </span>
            {isDestructive && (
              <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-black font-mono uppercase tracking-wider">
                Critical
              </span>
            )}
          </div>
          <h3 className="text-xl font-black font-clash text-white tracking-tight leading-tight flex items-center gap-2">
            {isDestructive && <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />}
            {step === 1 ? title1 : title2}
          </h3>
        </div>

        <p className="text-sm text-[#9B9691] leading-relaxed">
          {step === 1 ? message1 : message2}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="py-3 px-5 rounded-xl border border-white/10 text-white/80 hover:text-white font-bold text-xs hover:border-white/20 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleNext}
            className={`py-3 px-5 rounded-xl font-black text-xs transition-all duration-200 cursor-pointer ${
              isDestructive
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_8px_30px_rgba(239,68,68,0.2)]'
                : 'bg-[#6366F1] hover:bg-[#5254E8] text-black shadow-[0_8px_30px_rgba(99,102,241,0.2)]'
            }`}
          >
            {step === 1 ? confirmLabel1 : confirmLabel2}
          </button>
        </div>
      </div>
    </div>
  );
}
