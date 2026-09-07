'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { motion } from 'framer-motion';
import { 
import { handleManualMint as handleManualMint_ext } from './SettingsPageInnerSections/handleManualMint';
import { SettingsPageInnerView } from './SettingsPageInnerSections/SettingsPageInnerView';



export function SettingsPageInner(bag: any) {
  const {
  SettingsPageInner
  } = bag as any;

    const { user, refreshUser, getJWT } = useAuth();
    const { currentTier, expiresAt} = useSubscription();
    const {} = useAppwriteVault();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { requestSudo} = useSudo();
    const { open: openDrawer } = useUnifiedDrawer();
    const { openOverlay, closeOverlay } = useOverlay();
    const { openSidebar, closeSidebar } = useDynamicSidebar();
    const { isRightRailPushing } = useSidebar();
    const _nativeSidebar = useNativeSidebarOptional();

    // Tab state
    const [activeTab, setActiveTab] = useState<'general' | 'billing' | 'agents' | 'workspace' | 'security' | 'privacy' | 'developers' | 'sessions' | 'activity' | 'identities' | 'preferences' | 'account' | 'admin'>('general');
    const [billingDrawerOpen, setBillingDrawerOpen] = useState(false);
    const [mfaFactors, setMfaFactors] = useState<any>(null);
    const [accountMfaEnabled, setAccountMfaEnabled] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminSubTab, setAdminSubTab] = useState<'dashboard' | 'users' | 'email' | 'coupons'>('dashboard');

    useEffect(() => {
        const section = (searchParams.get('section') || '').toLowerCase();
        const tab = (searchParams.get('tab') || '').toLowerCase();
        const allowed = new Set(['general', 'billing', 'agents', 'workspace', 'security', 'privacy', 'developers', 'sessions', 'activity', 'identities', 'preferences', 'account', 'admin']);
        if (section.startsWith('admin') || tab === 'admin') {
            setActiveTab('admin');
            if (section.includes('user')) setAdminSubTab('users');
            else if (section.includes('email')) setAdminSubTab('email');
            else if (section.includes('coupon')) setAdminSubTab('coupons');
            else setAdminSubTab('dashboard');
            return;
        }
        if (section === 'profile' || tab === 'profile') {
            setIsEditModalOpen(true);
            setActiveTab('general');
            return;
        }
        if (tab === 'assistants' || tab === 'agent') {
            setActiveTab('agents');
            return;
        }
        if (tab && allowed.has(tab)) {
            setActiveTab(tab as typeof activeTab);
        }
        if (typeof window !== 'undefined' && window.location.hash === '#mfa') {
            setActiveTab('security');
        }
    }, [searchParams]);

    const refreshMfaFactors = useCallback(async () => {
        if (!user?.$id) return;
        try {
            const { listCurrentMfaFactors } = await import('@/lib/mfa');
            const factors = await listCurrentMfaFactors();
            setMfaFactors(factors);
            setAccountMfaEnabled(Boolean(factors?.mfaEnabled));
        } catch (err) {
            console.warn('Failed to load MFA factors:', err);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (user?.$id) {
            void refreshMfaFactors();
        }
    }, [user?.$id, refreshMfaFactors]);

    const { promptSudo } = useSudo?.() || {};

    const openTwoFactorSurface = useCallback(async () => {
        if (!user?.$id) return;
        const { ecosystemSecurity } = await import('@/lib/ecosystem/security');
        if (!ecosystemSecurity.status.isUnlocked && promptSudo) {
            const unlocked = await promptSudo('unlock');
            if (!unlocked) return;
        }

        const close = () => {
            if (typeof window !== 'undefined' && window.innerWidth >= 768) closeSidebar();
            else closeOverlay();
        };
        const panel = (
            <TwoFactorPanel
                userId={user.$id}
                loginMethod="password"
                hasPasskeys={passkeyEntries.length > 0}
                onAddPasskey={() => setPasskeySetupOpen(true)}
                onClose={close}
                onChanged={() => {
                    void refreshMfaFactors();
                }}
            />
        );
        if (typeof window !== 'undefined' && window.innerWidth >= 768) {
            openSidebar(panel, '2fa-setup', { hideHeader: true });
        } else {
            openOverlay(panel);
        }
    }, [user?.$id, promptSudo, openSidebar, closeSidebar, openOverlay, closeOverlay, refreshMfaFactors]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (window.location.hash !== '#mfa') return;
        if (!user?.$id) return;
        openTwoFactorSurface();
        // Open once when user is ready for deep-link; avoid re-opening on callback identity churn.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.$id]);

    // Delete/export state
    const [_confirmExportOpen, _setConfirmExportOpen] = useState(false);
    const [_confirmDeleteOpen, _setConfirmDeleteOpen] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [isArgon, setIsArgon] = useState(ecosystemSecurity.status.isArgon);
    const [_hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [_isAuthPassConfigured, setIsAuthPassConfigured] = useState<boolean>(false);
    const [_masterpassChangedAt, setMasterpassChangedAt] = useState<string | null>(null);

    // Telegram state
    const [tgDrawerOpen, setTgDrawerOpen] = useState(false);
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [minting, setMinting] = useState(false);
  
    // Passkey state
    const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [loadingPasskeys, setLoadingPasskeys] = useState(true);

    // Switches preferences state
    const [_pushEnabled, _setPushEnabled] = useState(true);
    const [_statusEnabled, _setStatusEnabled] = useState(true);
    const [_isLocalhost, setIsLocalhost] = useState(false);
    const [_demoModeEnabled, setDemoModeEnabled] = useState(false);
    const [computeBalance, setComputeBalance] = useState<{ balance: number; maxBalance: number; tier: string; percent: number } | null>(null);
    const [_profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const openPorter = useOpenEcosystemPorter({ surface: 'settings' });

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
        if (typeof window === 'undefined') return;
        const hash = window.location.hash;
        if (!hash) return;
        const scrollToHash = () => {
            const el = document.querySelector(hash);
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        const timer = setTimeout(scrollToHash, 300);
        return () => clearTimeout(timer);
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
            } catch (_e) {
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

    const FEATURE_FORM_ID = '6a2a653f002b0f296958';

    const handleManualMint = (..._args: any[]) => handleManualMint_ext({ handleManualMint });

    const [referralStats, setReferralStats] = useState<{
        totalReferred: number;
        totalTokensEarned: string;
        referralLink: string;
    } | null>(null);
    const [copiedReferral, setCopiedReferral] = useState(false);

    useEffect(() => {
        if (user?.$id) {
            const username = getEffectiveUsername(user);
            import('@/lib/actions/referrals')
                .then(m => m.getReferralStatsAction(username))
                .then(stats => setReferralStats(stats))
                .catch(() => null);
        }
    }, [user]);

    const handleCopyReferral = async () => {
        if (!user?.$id) return;
        const effUsername = getEffectiveUsername(user);
        const refParam = effUsername ? `u_${effUsername}` : `id_${user.$id}`;
        const baseUri = typeof window !== 'undefined' ? window.location.origin : 'https://www.kylrix.space';
        const link = `${baseUri}/?ref=${refParam}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopiedReferral(true);
            toast.success('Referral link copied!');
            setTimeout(() => setCopiedReferral(false), 2000);
        } catch {
            toast.error('Failed to copy link');
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
        void refreshMfaFactors();
    }, [refreshMfaFactors]);

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
                    setMasterpassChangedAt(passwordEntry?.$updatedAt || passwordEntry?.$createdAt || null);
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
        { id: 'billing', label: 'Billing', icon: BillingIcon },
        { id: 'agents', label: 'Smart Agents', icon: Bot },
        { id: 'workspace', label: 'Workspace', icon: WorkspaceIcon },
        { id: 'security', label: 'Security & 2FA', icon: SecurityIcon },
        { id: 'privacy', label: 'Privacy', icon: ShieldCheck },
        { id: 'developers', label: 'Developers', icon: DevelopersIcon },
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
                    name: user?.name},
                preferences: appPrefs,
                sessions: (sessions as any).sessions || (sessions as any).rows || [],
                exportDate: new Date().toISOString()};
            
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

    const triggerExport = () => {
        openDrawer('delete-confirm', {
            title: 'Export Account Data',
            description: 'Are you sure you want to download a copy of your account profile, preferences, and session details?',
            confirmLabel: 'Export',
            onConfirm: handleExport
        });
    };

    const triggerDeleteAccount = () => {
        const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
        const node = <DeleteAccountFlow onClose={isDesktop ? closeSidebar : closeOverlay} />;
        if (isDesktop) openSidebar(node, 'delete-account', { hideHeader: true });
        else openOverlay(node);
    };

    return <SettingsPageInnerView {...({ FEATURE_FORM_ID, _confirmDeleteOpen, _confirmExportOpen, _demoModeEnabled, _hasMasterpass, _isAuthPassConfigured, _isLocalhost, _masterpassChangedAt, _nativeSidebar, _profileAvatarUrl, _pushEnabled, _setConfirmDeleteOpen, _setConfirmExportOpen, _setPushEnabled, _setStatusEnabled, _statusEnabled, accountMfaEnabled, active, activeTab, adminSubTab, allowed, appPrefs, bag, balance, baseUri, billingDrawerOpen, cached, checkAdmin, checkTg, close, computeBalance, copiedReferral, data, dataStr, downloadAnchor, effUsername, el, entries, exportData, factors, fetchAvatar, fetchCompute, fetchProfile, handleBack, handleCopyReferral, handleExport, handleManualMint, handleRemovePasskey, hasHistory, hash, isAdmin, isArgon, isDesktop, isEditModalOpen, isPro, isUnlocked, jwt, link, loadPasskeys, loadingPasskeys, mfaFactors, minting, mounted, node, openPorter, openTwoFactorSurface, originalBorder, panel, passkeyEntries, passkeySetupOpen, passwordEntry, pkEntries, profile, profilePicId, refParam, referralStats, referrer, refreshMfaFactors, res, result, router, sameOriginReferrer, scrollToHash, searchParams, section, sessions, setAccountMfaEnabled, setActiveTab, setAdminSubTab, setBillingDrawerOpen, setComputeBalance, setCopiedReferral, setDemoModeEnabled, setHasMasterpass, setIsAdmin, setIsArgon, setIsAuthPassConfigured, setIsEditModalOpen, setIsLocalhost, setIsUnlocked, setLoadingPasskeys, setMasterpassChangedAt, setMfaFactors, setMinting, setPasskeyEntries, setPasskeySetupOpen, setProfile, setProfileAvatarUrl, setReferralStats, setTelegramConnected, setTgDrawerOpen, shouldScroll, tab, tabsList, telegramConnected, tgDrawerOpen, timer, triggerDeleteAccount, triggerExport, unlocked, unsubscribe, url, username })} />;
}
