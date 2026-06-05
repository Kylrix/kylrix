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
  ShieldAlert as AdminIcon
} from 'lucide-react';
import { isUserAdmin } from '@/lib/actions/admin/check-admin';

interface UserData {
  email: string;
  name: string;
  userId: string;
  lastUsernameEdit?: string;
  profilePicId?: string | null;
  emailVerified?: boolean;
  mfaEnabledAt?: string | null;
  mfaLastVerifiedAt?: string | null;
  mfaPrimaryFactor?: 'email' | 'totp' | null;
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

  useEffect(() => {
    let active = true;
    async function checkAdmin() {
      try {
        const result = await isUserAdmin();
        if (active) setIsAdmin(result);
      } catch (err) {
        console.error('Failed to check admin status:', err);
      }
    }
    checkAdmin();
    return () => {
      active = false;
    };
  }, []);

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
            mfaEnabledAt: userData.prefs?.mfaEnabledAt || null,
            mfaLastVerifiedAt: userData.prefs?.mfaLastVerifiedAt || null,
            mfaPrimaryFactor: userData.prefs?.mfaPrimaryFactor || null,
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
        mfaEnabledAt: freshUser.prefs?.mfaEnabledAt || null,
        mfaLastVerifiedAt: freshUser.prefs?.mfaLastVerifiedAt || null,
        mfaPrimaryFactor: freshUser.prefs?.mfaPrimaryFactor || null,
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
          account.listSessions().catch(() => ({ documents: [] }))
        ]);
        
        const exportData = {
          profile: {
            userId: user.userId,
            email: user.email,
            name: user.name,
          },
          preferences: appPrefs,
          sessions: (sessions as any).documents || [],
          exportDate: new Date().toISOString(),
        };
        
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `kylrix_account_export_${user.userId}.json`);
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
              Identifiers
            </h2>
            <div className="space-y-3.5">
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
                  Copy ID
                </button>
              </div>

              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] text-[#9B9691] font-bold font-mono uppercase tracking-wider block mb-1">
                    Unique Node Signature
                  </span>
                  <span className="text-sm text-white/80 font-mono break-all leading-normal">
                    {user.userId}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(user.userId);
                    toast.success('Signature copied');
                  }}
                  className="py-2 px-4 rounded-xl border border-white/10 text-white font-bold text-xs hover:border-[#6366F1] hover:bg-[#6366F1]/5 transition-all cursor-pointer flex-shrink-0"
                >
                  Copy Signature
                </button>
              </div>
            </div>
          </div>

          <div id="pulse" className="space-y-4">
            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
              Pulse
            </h2>
            <div className="bg-[#6366F1]/[0.02] border border-[#6366F1]/10 rounded-[28px] p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-3.5 h-3.5 rounded-full animate-pulse flex-shrink-0" 
                  style={{ 
                    backgroundColor: profileStatus?.color || '#6366F1',
                    boxShadow: `0 0 12px ${profileStatus?.color || '#6366F1'}`
                  }} 
                />
                <span className="text-base font-extrabold text-white">
                  Global Directory Synchrony
                </span>
              </div>
              
              {profileStatus && (
                <p className="text-sm text-[#9B9691] leading-relaxed font-satoshi">
                  {profileStatus.label}
                </p>
              )}

              {!profileStatus?.label.includes('Correctly linked') && (
                <div className="space-y-4">
                  <p className="text-xs text-[#9B9691]/70 leading-relaxed font-satoshi">
                    Ensure your identity is broadcasted across all nodes to enable seamless interaction in Note, Flow, and Connect.
                  </p>
                  <button
                    type="button"
                    onClick={handleFixDiscoverability}
                    disabled={syncing}
                    className="px-6 py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-black font-black text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {syncing && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />}
                    <span>{syncSuccess ? 'IDENTITY SYNCED' : 'INITIALIZE SYNC'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/[0.02] border border-white/5 rounded-[28px] p-6 md:p-8 space-y-4">
            <h3 className="text-lg font-black font-clash text-white">
              Gift Pro
            </h3>
            <p className="text-xs text-[#9B9691] leading-relaxed font-satoshi">
              Send a subscription gift to another Kylrix account. The recipient will claim it automatically on login.
            </p>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Recipient username"
                value={giftUsername}
                onChange={(e) => setGiftUsername(e.target.value)}
                className="w-full bg-[#161412] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1]"
              />
              <input
                type="number"
                placeholder="Months"
                min={1}
                value={giftMonths}
                onChange={(e) => setGiftMonths(e.target.value)}
                className="w-full bg-[#161412] px-4 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1]"
              />
              {giftError && (
                <p className="text-xs text-red-500 font-satoshi">{giftError}</p>
              )}
              <button
                type="button"
                onClick={() => void handleGiftCheckout()}
                disabled={giftLoading}
                className="px-5 py-3 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-extrabold text-xs transition-colors cursor-pointer"
              >
                {giftLoading ? 'Preparing Gift...' : 'Gift Subscription'}
              </button>
            </div>
          </div>

          <div id="referrals" className="space-y-4">
            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
              Referrals
            </h2>
            <ReferralManager />
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
                onClick={() => {
                  const confirm1 = window.confirm("Are you sure you want to export your account data?");
                  if (!confirm1) return;
                  const confirm2 = window.confirm("This will download a backup file containing your settings and profile details. Proceed?");
                  if (!confirm2) return;
                  setSudoAction('export');
                  setSudoModalOpen(true);
                }}
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
                onClick={() => {
                  const confirm1 = window.confirm("Are you sure you want to permanently delete your account?");
                  if (!confirm1) return;
                  const confirm2 = window.confirm("WARNING: This will permanently delete your profile, active sessions, and preferences. You will immediately lose access to all Kylrix features. This action CANNOT be undone. Proceed?");
                  if (!confirm2) return;
                  setSudoAction('delete');
                  setSudoModalOpen(true);
                }}
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

      <SudoModal
        isOpen={twoFactorSudoOpen}
        onSuccess={handleTwoFactorSuccess}
        onCancel={() => setTwoFactorSudoOpen(false)}
      />

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

      {user && (
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
