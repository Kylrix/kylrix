'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
    ArrowLeft,
    Lock, 
    Shield, 
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
    Loader2 as SpinnerIcon
} from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { KeychainService } from '@/lib/appwrite/keychain';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { useSudo } from '@/context/SudoContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { DiscoverabilitySettings } from '@/components/settings/DiscoverabilitySettings';
import { toast } from 'react-hot-toast';
import { TelegramDrawer } from '@/components/overlays/TelegramDrawer';
import { checkTelegramConnection } from '@/lib/actions/telegram';
import { MultiSectionContainer } from '@/context/SectionContext';
import { CdrConfirmDrawer } from '@/src/features/story-cdr/CdrConfirmDrawer';

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
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const { requestSudo } = useSudo();
    const { open: openDrawer } = useUnifiedDrawer();
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [isArgon, setIsArgon] = useState(ecosystemSecurity.status.isArgon);
    const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);

    // Telegram state
    const [tgDrawerOpen, setTgDrawerOpen] = useState(false);
    const [minting, setMinting] = useState(false);
  
    // Passkey state
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [loadingPasskeys, setLoadingPasskeys] = useState(true);

    // Switches preferences state
    const [pushEnabled, setPushEnabled] = useState(true);
    const [statusEnabled, setStatusEnabled] = useState(true);
    const [cdrEnabled, setCdrEnabled] = useState(false);
    const [cdrDrawerOpen, setCdrDrawerOpen] = useState(false);

    useEffect(() => {
        if (user?.prefs) {
            setCdrEnabled(!!user.prefs.cdr_enabled);
        }
    }, [user]);

    const handleCdrToggle = async () => {
        if (cdrEnabled) {
            if (!window.confirm("Are you sure you want to deactivate Confidential Data Rails? This will switch credentials storage back to local E2EE.")) {
                return;
            }
            try {
                const { account, invalidateCurrentUserCache } = await import('@/lib/appwrite');
                const currentPrefs = await account.getPrefs();
                await account.updatePrefs({ ...currentPrefs, cdr_enabled: false });
                invalidateCurrentUserCache();
                await refreshUser(true);
                setCdrEnabled(false);
                toast.success("Confidential Data Rails deactivated");
            } catch (err: any) {
                toast.error(err.message || "Failed to deactivate");
            }
        } else {
            setCdrDrawerOpen(true);
        }
    };

    const handleCdrSuccess = async () => {
        await refreshUser(true);
        setCdrEnabled(true);
        setCdrDrawerOpen(false);
    };

    const FEATURE_FORM_ID = '6a19dc99002634bd33ae';

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
            // detect whether the user has a master password (Tier 2 / encryption) set
            (async () => {
                try {
                    const present = await KeychainService.hasMasterpass(user.$id);
                    setHasMasterpass(present);
                } catch (e) {
                    console.error('Failed to check masterpass presence', e);
                    setHasMasterpass(null);
                }
            })();
        }

        return unsubscribe;
    }, [isUnlocked, isArgon, user, loadPasskeys]);

    const handleRemovePasskey = async (id: string) => {
        if (!window.confirm("Are you sure you want to remove this passkey? This cannot be undone.")) return;
        
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

            {/* Header Title Section */}
            <header className="mb-8">
                <span className="text-[10px] font-black tracking-widest uppercase text-white/40 font-mono block mb-1">
                    KYLRIX CONTROL PANEL
                </span>
                <h1 className="text-white font-black text-2xl md:text-3xl tracking-tight leading-tight mb-1 font-mono tracking-tighter">
                    Settings
                </h1>
                <p className="text-white/40 text-xs font-semibold leading-normal font-sans max-w-[560px]">
                    Manage identity discoverability, encryption access, passkeys, and device preferences.
                </p>
            </header>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-8 items-start">
                
                {/* Left Column: Discoverability, Integrations & Feedback */}
                <div className="flex flex-col gap-8">
                    
                    {/* Discoverability Section */}
                    <DiscoverabilitySettings />

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
                                    onClick={() => openDrawer('form', { formId: FEATURE_FORM_ID })}
                                    className="h-10 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-extrabold text-xs flex items-center justify-center transition-all w-full md:w-auto"
                                >
                                    Open Portal
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Column: Account settings, Smart Assistants, Telegram & Security */}
                <div className="flex flex-col gap-8">
                    
                    {/* Go to account settings */}
                    <button
                        onClick={() => router.push('/accounts')}
                        className="w-full text-left p-6 bg-[#161412] border border-white/5 hover:border-white/10 hover:bg-[#1C1A18] rounded-[28px] shadow-2xl flex items-center justify-between gap-4 transition-all duration-300 group"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                                <User size={22} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-white font-black text-base leading-tight font-mono">
                                    Go to account settings
                                </h4>
                                <p className="text-white/40 text-xs font-semibold mt-0.5 leading-relaxed">
                                    Manage your unified identity, WebAuthn passkeys, and connected apps.
                                </p>
                            </div>
                        </div>
                        <ChevronRight size={20} className="text-white/30 group-hover:text-white transition-colors" />
                    </button>

                    {/* Smart Assistants */}
                    <button
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

                    {/* Telegram Notifications */}
                    <div className="p-6 bg-[#161412] border border-white/5 hover:border-white/10 hover:bg-[#1C1A18] rounded-[28px] shadow-2xl flex items-center justify-between gap-4 transition-all duration-300">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center flex-shrink-0">
                                <TelegramIcon className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-white font-black text-base leading-tight font-mono">
                                    Telegram Notifications
                                </h4>
                                <p className="text-white/40 text-xs font-semibold mt-0.5 leading-relaxed">
                                    Receive push notifications for calls and active chat threads.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setTgDrawerOpen(true)}
                            className="h-10 px-5 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-bold text-xs flex items-center justify-center transition-all select-none"
                        >
                            Manage
                        </button>
                    </div>

                    {/* Security & Privacy card */}
                    <div>
                        <h3 className="text-white font-black text-lg tracking-tight leading-tight flex items-center gap-2 mb-3 font-mono">
                            <Shield size={20} className="text-[#6366F1]" />
                            <span>Security & Privacy</span>
                        </h3>
                        
                        <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl flex flex-col gap-6">
                            
                            {/* Vault Status */}
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="min-w-0">
                                    <h4 className="text-white font-extrabold text-sm">Vault Status</h4>
                                    <p className="text-white/40 text-xs font-semibold font-sans mt-0.5 leading-relaxed">
                                        Current encryption state of your session
                                    </p>
                                    {hasMasterpass && (
                                        <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider font-mono mt-1.5 ${
                                            isArgon ? 'text-[#10B981]' : 'text-[#F59E0B]'
                                        }`}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-currentColor" />
                                            <span>{isArgon ? 'Vault upgraded to T5 core' : 'Unlock to upgrade to Argon2id'}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <button
                                    onClick={() =>
                                      isUnlocked
                                        ? ecosystemSecurity.lock()
                                        : requestSudo({ onSuccess: () => {} })
                                    }
                                    className={`h-10 px-5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto ${
                                        isUnlocked
                                            ? 'border border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-white/80'
                                            : 'bg-[#6366F1] hover:bg-[#5458E8] text-white'
                                    }`}
                                >
                                    {isUnlocked ? <Lock size={14} /> : <Shield size={14} />}
                                    <span>{isUnlocked ? "Lock Vault" : (hasMasterpass === false ? "Setup" : "Unlock Vault")}</span>
                                </button>
                            </div>

                            <div className="h-[1px] bg-white/5 w-full" />

                            {/* Passkeys */}
                            <div>
                                <div className="flex items-center justify-between gap-4 mb-4 select-none">
                                    <div className="min-w-0">
                                        <h4 className="text-white font-extrabold text-sm">Passkeys</h4>
                                        <p className="text-white/40 text-xs font-semibold font-sans mt-0.5 leading-relaxed">
                                            Use biometrics to unlock your secure session.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setPasskeySetupOpen(true)}
                                        disabled={hasMasterpass === false}
                                        className="h-9 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5458E8] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Fingerprint size={14} />
                                        <span>Add Passkey</span>
                                    </button>
                                </div>

                                <div className="bg-[#0A0908] border border-white/5 rounded-2xl p-2 flex flex-col gap-1.5">
                                    {passkeyEntries.length === 0 ? (
                                        <div className="p-4 text-center text-white/40 text-xs font-bold font-sans">
                                            No passkeys registered.
                                        </div>
                                    ) : (
                                        passkeyEntries.map((pk, idx) => (
                                            <div 
                                                key={pk.$id}
                                                className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 text-[#6366F1] flex items-center justify-center flex-shrink-0">
                                                        <Fingerprint size={16} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="block text-white font-extrabold text-xs truncate">
                                                            {pk.params?.name || `Passkey ${idx + 1}`}
                                                        </span>
                                                        <span className="block text-[#10B981] text-[9px] font-black uppercase tracking-wider font-mono">
                                                            Active
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemovePasskey(pk.$id)}
                                                    className="w-8 h-8 rounded-lg text-white/20 hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center transition-all"
                                                    title="Remove Passkey"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="h-[1px] bg-white/5 w-full" />

                            {/* App Preferences Switches */}
                            <div>
                                <h4 className="text-white font-extrabold text-sm flex items-center gap-1.5 mb-4 font-mono select-none">
                                    <Smartphone size={16} className="text-[#6366F1]" />
                                    <span>App Preferences</span>
                                </h4>

                                <div className="flex flex-col gap-4">
                                    {/* Push Notifications Switch */}
                                    <div className="flex items-center justify-between gap-4 select-none">
                                        <div>
                                            <span className="block text-white font-extrabold text-xs">Push Notifications</span>
                                            <span className="block text-white/40 text-[10px] font-semibold font-sans mt-0.5">Get notified of new messages</span>
                                        </div>
                                        <Switch 
                                            checked={pushEnabled}
                                            onChange={() => setPushEnabled(!pushEnabled)}
                                        />
                                    </div>

                                    <div className="h-[1px] bg-white/5 w-full" />

                                    {/* Active Status Switch */}
                                    <div className="flex items-center justify-between gap-4 select-none">
                                        <div>
                                            <span className="block text-white font-extrabold text-xs">Active Status</span>
                                            <span className="block text-white/40 text-[10px] font-semibold font-sans mt-0.5">Show when you are online</span>
                                        </div>
                                        <Switch 
                                            checked={statusEnabled}
                                            onChange={() => setStatusEnabled(!statusEnabled)}
                                        />
                                    </div>

                                    <div className="h-[1px] bg-white/5 w-full" />

                                    {/* Confidential Data Rails (Beta) Switch */}
                                    <div className="flex items-center justify-between gap-4 select-none">
                                        <div>
                                            <span className="block text-white font-extrabold text-xs">Confidential Data Rails (Beta)</span>
                                            <span className="block text-white/40 text-[10px] font-semibold font-sans mt-0.5">Route credentials securely through the Story network</span>
                                        </div>
                                        <Switch 
                                            checked={cdrEnabled}
                                            onChange={handleCdrToggle}
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                </div>

            </div>

            {/* Conditionally unmounted overlays/drawers mathematically preventing click blocking */}
            {passkeySetupOpen && (
                <PasskeySetup 
                    open={passkeySetupOpen}
                    onClose={() => setPasskeySetupOpen(false)}
                    userId={user?.$id || ""}
                    onSuccess={() => {
                        setPasskeySetupOpen(false);
                        loadPasskeys();
                    }}
                    trustUnlocked={true}
                />
            )}

            {tgDrawerOpen && (
                <TelegramDrawer
                    open={tgDrawerOpen}
                    onClose={() => setTgDrawerOpen(false)}
                    onSuccess={() => {
                        setTgDrawerOpen(false);
                    }}
                />
            )}

            {cdrDrawerOpen && (
                <CdrConfirmDrawer
                    open={cdrDrawerOpen}
                    onClose={() => setCdrDrawerOpen(false)}
                    onSuccess={handleCdrSuccess}
                />
            )}

            </div>
        </MultiSectionContainer>
    );
}
