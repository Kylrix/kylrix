'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeft,
    Lock, 
    Shield, 
    AlertCircle, 
    Fingerprint, 
    Smartphone,
    Trash2,
    RefreshCw,
    User,
    ChevronRight,
    Key,
    Bot,
    Lightbulb,
    Link,
    Loader2 as SpinnerIcon,
    Database,
    Info,
    Edit3,
    UserCircle as ProfileIcon,
    ShieldCheck as SecurityIcon,
    MonitorSmartphone as SessionsIcon,
    History as ActivityIcon,
    Sliders as PreferencesIcon,
    Settings2 as RootAccountIcon,
    ShieldAlert as AdminIcon,
    AlertTriangle,
    Mail,
    Ticket,
    Cpu,
    TrendingUp,
    Users,
    Zap,
    MoreVertical,
    CheckCircle2,
    UserPlus,
    Activity
} from 'lucide-react';
import { VaultPorterDrawer } from '@/components/import/VaultPorterDrawer';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { KeychainService } from '@/lib/appwrite/keychain';
import { useSudo } from '@/context/SudoContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { UsersService } from '@/lib/services/users';
import { toast } from 'react-hot-toast';
import { TelegramDrawer } from '@/components/overlays/TelegramDrawer';
import { checkTelegramConnection } from '@/lib/actions/telegram';
import { MultiSectionContainer } from '@/context/SectionContext';
import { useAppwriteVault } from '@/context/appwrite-context';
import { getUserProfilePicId, getEffectiveDisplayName, getEffectiveUsername } from '@/lib/utils';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { getComputeBalanceAction } from '@/lib/actions/ai';
import { getProfilePicturePreview } from '@/lib/appwrite';
import { getCachedProfilePreview } from '@/lib/profile-preview';
import { getUserProfilePicId as getSdkUserProfilePicId } from '@/lib/user-utils';
import { useSubscription } from '@/context/subscription/SubscriptionContext';

// Consolidated settings subpage imports
import ProfileManager from '@/components/ProfileManager';
import SessionsManager from '@/components/SessionsManager';
import ActivityLogs from '@/components/ActivityLogs';
import ConnectedIdentities from '@/components/ConnectedIdentities';
import PreferencesManager from '@/components/PreferencesManager';
import MasterPassManager from '@/components/MasterPassManager';
import PinManager from '@/components/PinManager';
import { TwoFactorDrawer } from '@/components/overlays/TwoFactorDrawer';
import { BillingDrawer } from '@/components/overlays/BillingDrawer';
import { AppwriteService } from '@/lib/appwrite';
import { account } from '@/lib/appwrite/client';
import AdminDashboardPage from '@/app/(app)/(auth)/accounts/admin/page';
import UsersManagement from '@/app/(app)/(auth)/accounts/admin/users/page';
import EmailOrchestrator from '@/app/(app)/(auth)/accounts/admin/emails/page';
import AdminCouponsPage from '@/app/(app)/(auth)/accounts/admin/coupons/page';

// Inline Custom Telegram Icon SVG for lucide alignment
function TelegramIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.35-.26-2.01-.48-.81-.27-1.46-.42-1.4-.88.03-.24.37-.49 1.02-.75 3.98-1.73 6.64-2.88 7.98-3.45 3.79-1.63 4.58-1.91 5.09-1.92.11 0 .36.03.52.16.14.12.18.28.2.43-.02.07-.02.16-.02.25z"/>
    </svg>
  );
}

// Reuseable custom Switch
function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-[#6366F1]' : 'bg-white/10'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
    const { user, refreshUser, getJWT } = useAuth();
    const { currentTier, expiresAt, refreshEntitlement } = useSubscription();
    const { usePasskeysByDefault, setUsePasskeysByDefault, masterpassForLoginEnabled, setMasterpassForLoginEnabled } = useAppwriteVault();
    const router = useRouter();
    const { requestSudo, promptSudo } = useSudo();
    const { open: openDrawer } = useUnifiedDrawer();

    // Tab state
    const [activeTab, setActiveTab] = useState<'general' | 'profile' | 'security' | 'sessions' | 'activity' | 'identities' | 'preferences' | 'account' | 'admin'>('general');
    const [billingDrawerOpen, setBillingDrawerOpen] = useState(false);
    const [twoFactorDrawerOpen, setTwoFactorDrawerOpen] = useState(false);
    const [mfaFactors, setMfaFactors] = useState<any>(null);
    const [accountMfaEnabled, setAccountMfaEnabled] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminSubTab, setAdminSubTab] = useState<'dashboard' | 'users' | 'email' | 'coupons'>('dashboard');

    // Delete/export state
    const [confirmExportOpen, setConfirmExportOpen] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [isArgon, setIsArgon] = useState(ecosystemSecurity.status.isArgon);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [isAuthPassConfigured, setIsAuthPassConfigured] = useState<boolean>(false);

    // Telegram state
    const [tgDrawerOpen, setTgDrawerOpen] = useState(false);
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [minting, setMinting] = useState(false);
  
    // Passkey state
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [loadingPasskeys, setLoadingPasskeys] = useState(true);

    // Switches preferences state
    const [pushEnabled, setPushEnabled] = useState(true);
    const [statusEnabled, setStatusEnabled] = useState(true);
    const [isLocalhost, setIsLocalhost] = useState(false);
    const [demoModeEnabled, setDemoModeEnabled] = useState(false);
    const [computeBalance, setComputeBalance] = useState<{ balance: number; maxBalance: number; tier: string; percent: number } | null>(null);
    const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
    const [showPorterDrawer, setShowPorterDrawer] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [profile, setProfile] = useState<any>(null);

    const fetchProfile = useCallback(async () => {
        const username = getEffectiveUsername(user);
        if (!username) return;
        try {
            const data = await UsersService.getProfile(username);
            if (data) setProfile(data);
        } catch (e) {
            console.error("Failed to load profile", e);
        }
    }, [user]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsLocalhost(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        }
    }, []);

    useEffect(() => {
        let active = true;
        async function checkTg() {
            try {
                const res = await checkTelegramConnection();
                if (active) setTelegramConnected(Boolean(res.success && res.isVerified));
            } catch (err) {
                console.warn('Failed to check Telegram connection:', err);
            }
        }
        checkTg();
        return () => { active = false; };
    }, []);

    const profilePicId = getUserProfilePicId(user) || getSdkUserProfilePicId(user);

    useEffect(() => {
        let mounted = true;
        const fetchAvatar = async () => {
            if (!profilePicId) {
                if (mounted) setProfileAvatarUrl(null);
                return;
            }
            try {
                const cached = getCachedProfilePreview(profilePicId);
                if (cached) {
                    if (mounted) setProfileAvatarUrl(cached ?? null);
                    return;
                }
                const { fetchProfilePreview } = await import('@/lib/profile-preview');
                const url = await fetchProfilePreview(profilePicId, 80, 80);
                if (mounted) setProfileAvatarUrl(url);
            } catch (e) {
                if (mounted) setProfileAvatarUrl(null);
            }
        };
        fetchAvatar();
        return () => { mounted = false; };
    }, [profilePicId]);

    const isPro = currentTier === 'PRO' || currentTier === 'LIFETIME' || currentTier === 'ORG';

    // Initialize with optimistic default based on client-side tier
    useEffect(() => {
        if (user && !computeBalance) {
            setComputeBalance({
                balance: isPro ? 100000 : 0,
                maxBalance: isPro ? 100000 : 10000,
                tier: isPro ? 'pro' : 'free',
                percent: isPro ? 100 : 0
            });
        }
    }, [user, isPro, computeBalance]);

    useEffect(() => {
        const fetchCompute = async () => {
            const balance = await getComputeBalanceAction();
            if (balance) setComputeBalance(balance);
        };
        fetchCompute();
    }, []);

    useEffect(() => {
        if (user?.prefs) {
            setDemoModeEnabled(!!user.prefs.demo_mode);
        }
    }, [user]);

    const handleDemoModeToggle = async () => {
        const nextVal = !demoModeEnabled;
        try {
            const { account, invalidateCurrentUserCache } = await import('@/lib/appwrite');
            const currentPrefs = await account.getPrefs();
            await account.updatePrefs({ ...currentPrefs, demo_mode: nextVal });
            invalidateCurrentUserCache();
            await refreshUser(true);
            await refreshEntitlement(true);
            setDemoModeEnabled(nextVal);
            toast.success(`Demo Mode ${nextVal ? "activated" : "deactivated"}`);
        } catch (err: any) {
            toast.error(err.message || "Failed to update Demo Mode");
        }
    };
    const handleMasterpassLoginToggle = () => {
        if (masterpassForLoginEnabled) {
            openDrawer('delete-confirm', {
                title: 'Disable MasterPass for Sign-In?',
                description: 'WARNING: Disabling this will prevent you from signing into your account using your MasterPass. If you lose access to your email OTP or passkeys, you could permanently lose access to your account. Are you sure you want to proceed?',
                confirmLabel: 'Disable',
                onConfirm: async () => {
                    await setMasterpassForLoginEnabled(false);
                    try {
                        const { account } = await import('@/lib/appwrite/client');
                        const currentPrefs = user?.prefs || {};
                        await account.updatePrefs({ ...currentPrefs, hasPass: false });
                    } catch (e) {
                        console.error('Failed to update hasPass pref:', e);
                    }
                    toast.success('MasterPass sign-in disabled');
                }
            });
        } else {
            if (!isUnlocked) {
                openDrawer('delete-confirm', {
                    title: 'Enable MasterPass Sign-In?',
                    description: 'To enable MasterPass for sign-in, we need to authenticate and synchronize your local encryption vault password with the server authentication password. Do you want to unlock and synchronize now?',
                    confirmLabel: 'Proceed',
                    onConfirm: () => {
                        requestSudo({
                            intent: 'unlock',
                            forcePrompt: true,
                            onSuccess: async () => {
                                await setMasterpassForLoginEnabled(true);
                                try {
                                    const { account } = await import('@/lib/appwrite/client');
                                    const currentPrefs = user?.prefs || {};
                                    await account.updatePrefs({ ...currentPrefs, hasPass: true });
                                } catch (e) {
                                    console.error('Failed to update hasPass pref:', e);
                                }
                                toast.success('MasterPass sign-in enabled & synchronized.');
                            }
                        });
                    }
                });
            } else {
                setMasterpassForLoginEnabled(true);
                try {
                    import('@/lib/appwrite/client').then(async ({ account }) => {
                        const currentPrefs = user?.prefs || {};
                        await account.updatePrefs({ ...currentPrefs, hasPass: true });
                    });
                } catch (e) {
                    console.error('Failed to update hasPass pref:', e);
                }
                toast.success('MasterPass sign-in enabled');
            }
        }
    };
    const FEATURE_FORM_ID = '6a2a653f002b0f296958';

    const handleManualMint = async () => {
        setMinting(true);
        try {
            const { mintDailyLoginSecure } = await import('@/lib/actions/secure-ops');
            const { account } = await import('@/lib/appwrite');
            const { jwt } = await account.createJWT();

            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const dateKey = today.toISOString();

            if (!user?.$id) throw new Error("User session not found");

            const response = await mintDailyLoginSecure({
                userId: user.$id,
                dateKey: dateKey,
                jwt: jwt
            });

          if (response?.accepted) {
            toast.success('Tokens minted successfully!');
          } else {
            toast.error(response?.reason === 'IDEMPOTENCY_CONFLICT' ? "Check back tomorrow! You've already collected today's reward." : (response?.reason || 'Minting failed'));
          }
        } catch (e: any) {
          toast.error(e.message || 'Minting failed');
        } finally {
          setMinting(false);
        }
    };

    useEffect(() => {
        let active = true;
        async function checkAdmin() {
            try {
                const { isUserAdmin } = await import('@/lib/actions/admin/check-admin');
                const jwt = await getJWT();
                const result = await isUserAdmin(jwt || undefined);
                if (active) setIsAdmin(result);
            } catch (err) {
                console.error('Failed to check admin status:', err);
            }
        }
        checkAdmin();
        return () => { active = false; };
    }, [getJWT]);

    useEffect(() => {
        let active = true;
        async function checkMfa() {
            if (!user?.$id) return;
            try {
                const factors = await AppwriteService.getMfaFactors();
                if (active) {
                    setMfaFactors(factors);
                    setAccountMfaEnabled(factors.email && factors.totp);
                }
            } catch (err) {
                console.warn('Failed to load MFA factors:', err);
            }
        }
        checkMfa();
        return () => { active = false; };
    }, [user?.$id]);

    const loadPasskeys = useCallback(async () => {
        if (!user?.$id) return;
        try {
            const entries = await KeychainService.listKeychainEntries(user.$id);
            const pkEntries = entries.filter((e: any) => e.type === 'passkey').map((e: any) => ({
                ...e,
                params: typeof e.params === 'string' ? JSON.parse(e.params) : e.params
            }));
            
            setPasskeyEntries(pkEntries);
        } catch (e) {
            console.error("Failed to load passkeys", e);
        } finally {
            setLoadingPasskeys(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const shouldScroll = sessionStorage.getItem('scroll_to_google_workspace');
            if (shouldScroll === 'true') {
                sessionStorage.removeItem('scroll_to_google_workspace');
                setTimeout(() => {
                    const el = document.getElementById('google-workspace-settings');
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Premium glowing pulse highlight effect
                        const originalBorder = el.style.borderColor;
                        el.style.boxShadow = '0 0 32px rgba(99, 102, 241, 0.35)';
                        el.style.borderColor = '#6366F1';
                        setTimeout(() => {
                            el.style.boxShadow = 'none';
                            el.style.borderColor = originalBorder || 'rgba(255, 255, 255, 0.05)';
                        }, 2800);
                    }
                }, 350);
            }
        }
    }, []);

    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            if (status.isUnlocked !== isUnlocked) {
                setIsUnlocked(status.isUnlocked);
            }
            if (status.isArgon !== isArgon) {
                setIsArgon(status.isArgon);
            }
        });

        if (user?.$id) {
            loadPasskeys();
            (async () => {
                try {
                    const entries = await KeychainService.listKeychainEntries(user.$id);
                    const passwordEntry = entries.find((e: any) => e.type === 'password');
                    setHasMasterpass(!!passwordEntry);
                    setIsAuthPassConfigured(!!passwordEntry?.authPass);
                } catch (e) {
                    console.error('Failed to check masterpass presence', e);
                    setHasMasterpass(null);
                }
            })();
        }

        return unsubscribe;
    }, [isUnlocked, isArgon, user, loadPasskeys]);

    const handleRemovePasskey = (id: string) => {
        openDrawer('delete-confirm', {
            title: 'Remove Passkey?',
            description: 'Are you sure you want to remove this passkey? This cannot be undone.',
            confirmLabel: 'Remove',
            onConfirm: async () => {
                requestSudo({
                    onSuccess: async () => {
                        try {
                            await KeychainService.deleteKeychainEntry(id);
                            toast.success("Passkey removed");
                            loadPasskeys();
                        } catch (_e) {
                            toast.error("Failed to remove passkey");
                        }
                    }
                });
            }
        });
    };

    const handleBack = () => {
        const hasHistory = typeof window !== 'undefined' && window.history.length > 1;
        const referrer = typeof document !== 'undefined' ? document.referrer : '';
        const sameOriginReferrer =
            typeof window !== 'undefined' && !!referrer && referrer.startsWith(window.location.origin);

        if (hasHistory && sameOriginReferrer) {
            router.back();
            return;
        }
        router.push('/connect');
    };

    const tabsList = [
        { id: 'general', label: 'General', icon: RootAccountIcon },
        { id: 'profile', label: 'Profile', icon: ProfileIcon },
        { id: 'security', label: 'Security & 2FA', icon: SecurityIcon },
        { id: 'sessions', label: 'Sessions', icon: SessionsIcon },
        { id: 'activity', label: 'Activity Logs', icon: ActivityIcon },
        { id: 'identities', label: 'Connected Apps', icon: Fingerprint },
        { id: 'preferences', label: 'Preferences', icon: PreferencesIcon },
        { id: 'account', label: 'Delete/Export', icon: Trash2 },
    ];
    if (isAdmin) {
        tabsList.push({ id: 'admin', label: 'Admin', icon: AdminIcon });
    }

    const handleExport = async () => {
        try {
            const [appPrefs, sessions] = await Promise.all([
                account.getPrefs().catch(() => ({})),
                account.listSessions().catch(() => ({ rows: [] }))
            ]);
            
            const exportData = {
                profile: {
                    userId: user?.$id,
                    email: user?.email,
                    name: user?.name,
                },
                preferences: appPrefs,
                sessions: (sessions as any).sessions || (sessions as any).rows || [],
                exportDate: new Date().toISOString(),
            };
            
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `kylrix_account_export_${user?.$id}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            toast.success('Account data exported successfully.');
        } catch (err: any) {
            toast.error(err.message || 'Export failed.');
        }
    };

    const handleDeleteAccount = async () => {
        try {
            toast.loading('Purging identity data...', { id: 'delete-purge' });
            const { executeMasterPurgeSecure } = await import('@/lib/actions/secure-ops');
            await executeMasterPurgeSecure();
            await account.deleteSession('current').catch(() => {});
            toast.success('Identity purged. Redirecting...', { id: 'delete-purge' });
            router.push('/');
        } catch (err: any) {
            toast.error(err.message || 'Purge failed.', { id: 'delete-purge' });
        }
    };

    const triggerExport = () => {
        openDrawer('delete-confirm', {
            title: 'Export Account Data',
            description: 'Are you sure you want to download a copy of your account profile, preferences, and session details?',
            confirmLabel: 'Export',
            onConfirm: handleExport
        });
    };

    const triggerDeleteAccount = () => {
        openDrawer('delete-confirm', {
            title: 'Delete Account?',
            description: 'WARNING: This will permanently delete your account and all associated vault/metadata. This action cannot be undone. Are you sure you want to proceed?',
            confirmLabel: 'Delete Permanently',
            onConfirm: handleDeleteAccount
        });
    };

    return (
        <MultiSectionContainer>
            <div className="relative w-full max-w-[1200px] mx-auto pt-4 md:pt-6 pb-12 px-4 md:px-6 z-10 select-none">
            
            {/* Back Button */}
            <button
                onClick={handleBack}
                className="mb-6 h-9 px-4 rounded-xl border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-all select-none"
            >
                <ArrowLeft size={16} />
                <span>Back</span>
            </button>

            {/* Header Title Section / Compact Account Summary */}
            <header 
                onClick={() => {
                    const username = getEffectiveUsername(user);
                    if (username) router.push(`/u/${username}`);
                }}
                className="mb-6 p-5 bg-[#161412] border border-white/5 rounded-[24px] shadow-xl overflow-hidden relative group cursor-pointer hover:border-white/10 hover:bg-[#1C1A18] transition-all"
            >
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#6366F1]/5 blur-[40px] rounded-full" />
                
                <div className="flex flex-col md:flex-row gap-6 items-center relative z-10">
                    {/* Profile */}
                    <div className="flex-shrink-0">
                        <IdentityAvatar 
                            userId={user?.$id}
                            pro={isPro}
                            size={56}
                            fallback={getEffectiveDisplayName(user).slice(0, 1).toUpperCase()}
                        />
                    </div>

                    {/* Account Info */}
                    <div className="flex-1 min-w-0 text-center md:text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-white font-black text-xl tracking-tight leading-tight font-mono truncate">
                                {getEffectiveDisplayName(user)}
                            </h1>
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                <span className="text-[10px] font-black text-[#EC4899] uppercase tracking-wider">
                                    {currentTier} PLAN
                                </span>
                                {isPro && expiresAt && (
                                    <span className="text-[10px] font-bold text-white/20 uppercase font-mono">
                                        • Ends {new Date(expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditModalOpen(true);
                            }}
                            className="py-2.5 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg select-none w-full md:w-auto"
                        >
                            <Edit3 size={14} />
                            <span>Edit Profile</span>
                        </button>
                    </div>

                    {/* AI Compute Section (Usage 0-100%) */}
                    <div className="w-full md:w-[220px] flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-black text-white/30 tracking-widest uppercase font-mono">
                                AI Compute Usage
                            </span>
                            <span className="text-sm font-black font-mono text-white">
                                {computeBalance ? Math.round(100 - computeBalance.percent) : '0'}%
                            </span>
                        </div>
                        
                        <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${100 - (computeBalance?.percent ?? 100)}%` }}
                                transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
                                className="h-full bg-gradient-to-r from-[#6366F1] to-[#EC4899] relative"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-shine" />
                            </motion.div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Horizontal Tabs Bar */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-8 border-b border-white/5 scrollbar-none select-none">
                {tabsList.map((t) => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.id;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setActiveTab(t.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 cursor-pointer ${
                                isActive 
                                    ? 'bg-[#6366F1] text-white border border-[#6366F1]' 
                                    : 'bg-[#161412] hover:bg-[#1C1A18] text-white/50 border border-white/5'
                            }`}
                        >
                            <Icon size={14} />
                            <span>{t.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Rendering Content */}
            <div className="w-full relative min-h-[400px]">
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 items-start">
                        {/* Left Column: Discoverability, Integrations & Feedback */}
                        <div className="flex flex-col gap-8">
                            {/* GitHub Integration panel */}
                            <div id="github-workspace-settings" className="transition-all duration-300">
                                <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 mb-3 font-mono">
                                    <svg viewBox="0 0 24 24" width="20" height="20" className="fill-white">
                                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                    <span>Connected Integrations</span>
                                </h3>
                                <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl">
                                    <div className="flex items-start md:items-center justify-between gap-4 flex-wrap">
                                        <div className="flex items-start gap-3 min-w-0 pr-2">
                                            <div className="w-9 h-9 rounded-xl bg-white/3 border border-white/8 flex items-center justify-center flex-shrink-0 text-white mt-0.5 md:mt-0">
                                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                                                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-white font-extrabold text-sm truncate">
                                                    GitHub Integration
                                                </h4>
                                                <p className="text-white/40 text-xs font-semibold font-sans mt-0.5 leading-relaxed">
                                                    Connect your GitHub profile to sync code, tasks, issues, and PR boards.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openDrawer('github-integration')}
                                            className="h-10 px-5 rounded-xl bg-[#24292F] hover:bg-[#1F2328] border border-white/5 text-white font-extrabold text-xs flex items-center justify-center transition-all w-full md:w-auto"
                                        >
                                            Configure
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Daily Token Mint */}
                            <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl flex flex-col gap-3">
                                <h4 className="text-white font-black text-base font-mono">Daily Token Mint</h4>
                                <p className="text-white/40 text-xs font-semibold leading-relaxed">
                                    Manually trigger your daily token minting reward.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleManualMint}
                                    disabled={minting}
                                    className="h-11 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all select-none disabled:opacity-40 w-fit"
                                >
                                    {minting ? <SpinnerIcon className="animate-spin text-white" size={16} /> : <RefreshCw size={16} />}
                                    <span>{minting ? 'Minting...' : 'Mint Daily Tokens'}</span>
                                </button>
                            </div>

                            {/* Feature Requests Section */}
                            <div>
                                <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 mb-3 font-mono">
                                    <Lightbulb size={20} className="text-[#6366F1]" />
                                    <span>Feedback & Intelligence</span>
                                </h3>
                                <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl hover:border-white/10 hover:bg-[#1C1A18] transition-all duration-300">
                                    <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div className="min-w-0">
                                            <h4 className="text-white font-extrabold text-sm truncate">
                                                Feature Request & Bug Report
                                            </h4>
                                            <p className="text-white/40 text-xs font-semibold font-sans mt-0.5 leading-relaxed">
                                                Help us improve the Kylrix ecosystem by reporting issues or suggesting new features.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openDrawer('form', { formId: FEATURE_FORM_ID })}
                                            className="h-10 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-extrabold text-xs flex items-center justify-center transition-all w-full md:w-auto"
                                        >
                                            Open Portal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="flex flex-col gap-8">
                            {/* Smart Assistants */}
                            <button
                                type="button"
                                onClick={() => router.push('/settings/agents')}
                                className="w-full text-left p-6 bg-[#161412] border border-white/5 hover:border-white/10 hover:bg-[#1C1A18] rounded-[28px] shadow-2xl flex items-center justify-between gap-4 transition-all duration-300 group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                        <Bot size={22} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-white font-black text-base leading-tight font-mono">
                                            Smart Assistants
                                        </h4>
                                        <p className="text-white/40 text-xs font-semibold mt-0.5 leading-relaxed">
                                            Configure private AI keys, automated assistant systems, and active workspaces.
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-white/30 group-hover:text-white transition-colors" />
                            </button>

                            {/* Trash Management Card */}
                            <button
                                type="button"
                                onClick={() => router.push('/trash')}
                                className="w-full text-left p-6 bg-[#161412] border border-white/5 hover:border-white/10 hover:bg-[#1C1A18] rounded-[28px] shadow-2xl flex items-center justify-between gap-4 transition-all duration-300 group"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-[#EF4444]/10 text-[#EF4444] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                        <Trash2 size={22} />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-white font-black text-base leading-tight font-mono">
                                            Trash bin
                                        </h4>
                                        <p className="text-white/40 text-xs font-semibold mt-0.5 leading-relaxed">
                                            Review and manage recently soft-deleted notes, credentials, tags, forms, events, and tasks.
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight size={20} className="text-white/30 group-hover:text-white transition-colors" />
                            </button>

                            {/* Telegram panel */}
                            <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl flex flex-col gap-5">
                                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center">
                                            <TelegramIcon />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-sm text-white">Telegram Notifications</h4>
                                            <p className="text-[10px] text-white/40 font-bold">Push notifications outlet</p>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                                        telegramConnected 
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                            : 'bg-white/5 border-white/10 text-white/40'
                                    }`}>
                                        {telegramConnected ? 'active' : 'off'}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setTgDrawerOpen(true)}
                                    className="py-3 px-5 rounded-xl border border-white/10 text-white hover:text-white font-extrabold text-xs hover:border-white/20 transition-all text-center w-full bg-transparent cursor-pointer"
                                >
                                    {telegramConnected ? 'Manage Link' : 'Link Telegram Bot'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div className="flex flex-col gap-8 pb-24 max-w-3xl">
                        <div id="identity" className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-10">
                            <ProfileManager 
                                onProfileUpdate={async () => {
                                    await refreshUser(true);
                                    await fetchProfile();
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
                                        {user?.email}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (user?.email) {
                                            navigator.clipboard.writeText(user.email);
                                            toast.success('Email copied');
                                        }
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
                                onClick={() => setBillingDrawerOpen(true)}
                                className="px-6 py-3.5 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-black text-sm transition-all cursor-pointer border-none"
                            >
                                Manage Billing & Subscription
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="flex flex-col gap-8 pb-24 max-w-3xl">
                        <div id="masterpass" className="space-y-4">
                            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                                Encryption
                            </h2>
                            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-10">
                                {user && <MasterPassManager userId={user.$id} />}
                            </div>
                        </div>

                        <div id="pin" className="space-y-4">
                            <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                                Quick Access
                            </h2>
                            <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-10">
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
                                        onClick={() => setTwoFactorDrawerOpen(true)}
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
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'sessions' && (
                    <div id="active-sessions" className="space-y-4 pb-24 max-w-3xl">
                        <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                            Sessions
                        </h2>
                        <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-10">
                            <SessionsManager />
                        </div>
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div id="activity-log" className="space-y-4 pb-24 max-w-3xl">
                        <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                            Activity
                        </h2>
                        <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-10">
                            <ActivityLogs />
                        </div>
                    </div>
                )}

                {activeTab === 'identities' && (
                    <div id="oauth" className="pb-24 max-w-3xl">
                        <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-10">
                            <ConnectedIdentities />
                        </div>
                    </div>
                )}

                {activeTab === 'preferences' && (
                    <div id="env-prefs" className="space-y-4 pb-24 max-w-3xl">
                        <h2 className="text-xl font-black font-clash text-white tracking-tight capitalize">
                            Preferences
                        </h2>
                        <div className="bg-[#161412] border border-white/5 rounded-[32px] p-6 md:p-10">
                            <PreferencesManager />
                        </div>
                    </div>
                )}

                {activeTab === 'account' && (
                    <div id="root-mgmt" className="space-y-6 pb-24 max-w-3xl">
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
                                    onClick={triggerExport}
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
                                    onClick={triggerDeleteAccount}
                                    className="py-3 px-5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs transition-all min-w-[200px] cursor-pointer"
                                >
                                    Delete Account
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'admin' && isAdmin && (
                    <div className="flex flex-col lg:flex-row gap-6 pb-24 w-full">
                        {/* Admin sub-menu */}
                        <div className="flex flex-col gap-2 w-full lg:w-[200px] flex-shrink-0">
                            <button type="button" onClick={() => setAdminSubTab('dashboard')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'dashboard' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>System Dashboard</button>
                            <button type="button" onClick={() => setAdminSubTab('users')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'users' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>User Directory</button>
                            <button type="button" onClick={() => setAdminSubTab('email')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'email' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>Email Orchestrator</button>
                            <button type="button" onClick={() => setAdminSubTab('coupons')} className={`p-3.5 rounded-xl text-xs font-bold text-left cursor-pointer transition-colors ${adminSubTab === 'coupons' ? 'bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20' : 'text-white/40 hover:bg-white/5'}`}>Coupons Registry</button>
                        </div>
                        {/* Render the selected admin subpage */}
                        <div className="flex-grow min-w-0">
                            {adminSubTab === 'dashboard' && <AdminDashboardPage />}
                            {adminSubTab === 'users' && <UsersManagement />}
                            {adminSubTab === 'email' && <EmailOrchestrator />}
                            {adminSubTab === 'coupons' && <AdminCouponsPage />}
                        </div>
                    </div>
                )}
            </div>

        {/* TOS & Privacy Policy Links */}
        <footer className="mt-12 pt-6 border-t border-white/5 flex items-center justify-center gap-4 text-xs font-semibold text-white/30 select-none">
            <button 
                onClick={() => router.push('/terms-of-service')}
                className="hover:text-white/60 transition-colors cursor-pointer"
            >
                Terms of Service
            </button>
            <span>•</span>
            <button 
                onClick={() => router.push('/privacy-policy')}
                className="hover:text-white/60 transition-colors cursor-pointer"
            >
                Privacy Policy
            </button>
        </footer>

        </div>

        {/* Conditionally unmounted overlays/drawers mathematically preventing click blocking */}
        {tgDrawerOpen && (
            <TelegramDrawer
                open={tgDrawerOpen}
                onClose={() => setTgDrawerOpen(false)}
                onSuccess={() => {
                    setTgDrawerOpen(false);
                }}
            />
        )}
        <VaultPorterDrawer
            isOpen={showPorterDrawer}
            onClose={() => setShowPorterDrawer(false)}
        />
        {profile && (
            <EditProfileModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                profile={profile}
                onUpdate={async () => {
                    await refreshUser(true);
                    await fetchProfile();
                }}
            />
        )}
        {billingDrawerOpen && (
            <BillingDrawer
                isOpen={billingDrawerOpen}
                onClose={() => setBillingDrawerOpen(false)}
            />
        )}
        {twoFactorDrawerOpen && user && (
            <TwoFactorDrawer
                open={twoFactorDrawerOpen}
                onClose={() => setTwoFactorDrawerOpen(false)}
                userId={user.$id}
                loginMethod="password"
                onEnabled={() => {
                    setTwoFactorDrawerOpen(false);
                    if (user?.$id) {
                        AppwriteService.getMfaFactors().then((factors: any) => {
                            setMfaFactors(factors);
                            setAccountMfaEnabled(factors.email && factors.totp);
                        });
                    }
                }}
            />
        )}
    </MultiSectionContainer>
  );
}
