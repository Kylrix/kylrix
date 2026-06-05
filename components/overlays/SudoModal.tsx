"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from 'next/navigation';
import {
    Lock,
    Fingerprint,
    Eye,
    EyeOff,
    AlertTriangle,
    CheckCircle,
    Shield
} from "lucide-react";
import Logo from "@/components/common/Logo";
import { ecosystemSecurity } from "@/lib/ecosystem/security";
import { AppwriteService } from "@/lib/appwrite";
import { useAuth } from "@/context/auth/AuthContext";
import { unlockWithPasskey } from "@/lib/passkey";
import { PasskeySetup } from "./PasskeySetup";
import toast from "react-hot-toast";
import { getAppTone, type KylrixApp } from "@/lib/sdk/design";
import { masterPassCrypto } from "@/lib/masterpass-crypto";
import { useDrawerState } from "@/components/ui/DrawerStateContext";
import { useAppwriteVault } from "@/context/appwrite-context";

interface SudoModalProps {
    isOpen?: boolean;
    open?: boolean;
    onSuccess: () => void;
    onCancel?: () => void;
    onClose?: () => void;
    intent?: "unlock" | "initialize" | "reset" | "upgrade";
    app?: KylrixApp;
}

// Simple custom media query hook to replace MUI useMediaQuery
function useIsDesktop() {
    const [isDesktop, setIsDesktop] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const media = window.matchMedia('(min-width: 768px)');
        setIsDesktop(media.matches);
        const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);
    return isDesktop;
}

export default function SudoModal({
    isOpen: _isOpen,
    open,
    onSuccess,
    onCancel,
    onClose,
    intent,
    app = "note",
}: SudoModalProps) {
    const router = useRouter();
    const { setIsDrawerOpen } = useDrawerState();
    const { usePasskeysByDefault } = useAppwriteVault();
    const isOpen = _isOpen ?? open ?? false;

    useEffect(() => {
        setIsDrawerOpen(isOpen);
        return () => setIsDrawerOpen(false);
    }, [isOpen, setIsDrawerOpen]);

    const cancelHandler = useMemo(() => onCancel ?? onClose ?? (() => {}), [onCancel, onClose]);
    const isDesktop = useIsDesktop();
    const { user } = useAuth();
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [passkeyLoading, setPasskeyLoading] = useState(false);
    const [hasPasskey, setHasPasskey] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [mode, setMode] = useState<"passkey" | "password" | "initialize" | "migrating" | null>(null);
    const [isDetecting, setIsDetecting] = useState(true);
    const [isPendingVault, setIsPendingVault] = useState(false);
    const [showPasskeyIncentive, setShowPasskeyIncentive] = useState(false);
    const passkeyTriggeredRef = useRef(false);
    const appTone = getAppTone(app);
    const accentColor = appTone.secondary;
    const isKylrixDomain =
        typeof window !== "undefined" &&
        (window.location.hostname === "kylrix.space" || window.location.hostname.endsWith(".kylrix.space"));

    // Migration state
    const [migrationStatus, setMigrationStatus] = useState<'idle' | 'upgrading' | 'success' | 'error'>('idle');
    const [migrationProgress, setMigrationProgress] = useState(0);
    const [isCriticalError, setIsCriticalError] = useState(false);
    const isMigratingRef = useRef(false);
    const onSuccessRef = useRef(onSuccess);

    // Keep onSuccessRef updated without triggering useEffect re-runs
    useEffect(() => {
        onSuccessRef.current = onSuccess;
    }, [onSuccess]);

    useEffect(() => {
        if (!isOpen) return;

        masterPassCrypto.setMigrationCallbacks(
            () => {
                isMigratingRef.current = true;
                setMode("migrating");
                setMigrationStatus('upgrading');
                setIsCriticalError(false);
            },
            (success) => {
                setMigrationStatus(success ? 'success' : 'error');
                if (!success) {
                    setIsCriticalError(true);
                    return;
                }
                setTimeout(() => {
                    if (isOpen) {
                        onSuccessRef.current();
                        isMigratingRef.current = false;
                    }
                }, 1500);
            }
        );
        
        return () => {
            if (!isMigratingRef.current) {
                masterPassCrypto.setMigrationCallbacks(() => {}, () => {});
            }
        };
    }, [isOpen]);

    useEffect(() => {
        if (migrationStatus !== 'upgrading') {
            if (migrationStatus === 'success') setMigrationProgress(100);
            return;
        }
        
        setMigrationProgress(0);
        const interval = setInterval(() => {
            setMigrationProgress(prev => {
                if (prev >= 95) {
                    clearInterval(interval);
                    return prev;
                }
                return prev + Math.random() * 15;
            });
        }, 350);
        
        return () => clearInterval(interval);
    }, [migrationStatus]);

    const handleSuccessWithSync = useCallback(async () => {
        if (user?.$id) {
            try {
                // Sudo Hook: Ensure E2E Identity is created and published upon successful MasterPass unlock
                console.log("[Kylrix] Synchronizing Identity...");
                await ecosystemSecurity.ensureE2EIdentity(user.$id);
            } catch (err) {
                console.warn("[Kylrix] Non-blocking Identity Sync failure:", err);
            }
        }
        onSuccessRef.current();
    }, [user?.$id]);

    const handleRedirectToVaultSetup = useCallback(() => {
        router.push("/vault/masterpass?setup=1");
        cancelHandler();
    }, [router, cancelHandler]);

    const handlePasskeyVerify = useCallback(async () => {
        if (!user || passkeyLoading) return;
        setPasskeyLoading(true);
        try {
            const success = await unlockWithPasskey(user.$id);
            if (success) {
                toast.success("Verified");
                handleSuccessWithSync();
            } else {
                toast.error("Passkey verification failed");
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Verification failed");
        } finally {
            setPasskeyLoading(false);
        }
    }, [user, passkeyLoading, handleSuccessWithSync]);

    // Detect capabilities
    useEffect(() => {
        if (!isOpen || !user) return;

        let active = true;
        
        async function detect() {
            try {
                setIsDetecting(true);
                
                // 1. Check if user has masterpass
                const hasPass = await AppwriteService.checkUserHasMasterpass(user.$id);
                if (!active) return;
                setHasMasterpass(hasPass);

                if (hasPass === false) {
                    setIsDetecting(false);
                    return;
                }

                // 2. Check if a vault migration was interrupted previously
                const pending = await masterPassCrypto.isMigrationInterrupted(user.$id);
                if (!active) return;
                setIsPendingVault(pending);

                // 3. Check if user has passkeys configured
                const keys = await AppwriteService.listPasskeys(user.$id);
                const hasKeys = keys.length > 0;
                if (!active) return;
                setHasPasskey(hasKeys);

                // Determine default mode
                if (intent === "initialize") {
                    setMode("initialize");
                } else if (pending) {
                    setMode("password");
                } else if (hasKeys && usePasskeysByDefault) {
                    setMode("passkey");
                } else {
                    setMode("password");
                }

                // Trigger passkey verification immediately if it's default
                if (hasKeys && usePasskeysByDefault && !passkeyTriggeredRef.current) {
                    passkeyTriggeredRef.current = true;
                    // Run async to avoid blocking
                    setTimeout(() => {
                        if (active) handlePasskeyVerify();
                    }, 100);
                }
            } catch (err) {
                console.error("SudoModal detection error:", err);
                if (active) setMode("password");
            } finally {
                if (active) setIsDetecting(false);
            }
        }

        detect();

        return () => {
            active = false;
        };
    }, [isOpen, user, intent, usePasskeysByDefault, handlePasskeyVerify]);

    // Reset ref when closed
    useEffect(() => {
        if (!isOpen) {
            passkeyTriggeredRef.current = false;
            setPassword("");
            setLoading(false);
            setPasskeyLoading(false);
            setMigrationStatus('idle');
            setMigrationProgress(0);
            setIsCriticalError(false);
            isMigratingRef.current = false;
        }
    }, [isOpen]);

    const handlePasswordVerify = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!user?.$id) return;

        if (hasMasterpass === false) {
            handleRedirectToVaultSetup();
            return;
        }

        if (!password) return;

        setLoading(true);
        try {
            const success = await masterPassCrypto.unlock(
              password,
              user.$id,
              false
            );

            if (success) {
                // IF MIGRATING: Don't call handleSuccessWithSync yet.
                if (isMigratingRef.current) {
                    return;
                }
                toast.success("Verified");
                handleSuccessWithSync();
            } else {
                toast.error("Incorrect master password");
            }
        } catch (error: any) {
            console.error(error);
            if (error.message === 'VAULT_ALREADY_EXISTS') {
                toast.error("Vault already initialized.");
                handleSuccessWithSync();
            } else {
                toast.error("Verification failed");
            }
        } finally {
            setLoading(false);
        }
    };

    if (showPasskeyIncentive && user) {
        return (
            <PasskeySetup
                open={true}
                onClose={() => {
                    setShowPasskeyIncentive(false);
                    onSuccess();
                }}
                userId={user.$id}
                onSuccess={() => {
                    setShowPasskeyIncentive(false);
                    onSuccess();
                }}
                trustUnlocked={true}
            />
        );
    }

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 z-[1298] bg-black/60 backdrop-blur-sm transition-all duration-300 animate-fadeIn"
                onClick={cancelHandler}
            />

            {/* Modal/Drawer Container */}
            <div 
                style={{
                    top: isDesktop ? '88px' : 'auto',
                    height: isDesktop ? 'calc(100vh - 88px)' : 'auto',
                    maxHeight: isDesktop ? 'calc(100vh - 88px)' : 'calc(100vh - 12px)',
                }}
                className={`fixed z-[1299] bg-[#161412] border-white/5 shadow-2xl transition-all duration-300 flex flex-col overflow-hidden bottom-0 right-0 w-full sm:w-[420px] rounded-t-[32px] sm:rounded-tr-none sm:rounded-l-[32px] border ${
                    isDesktop ? 'animate-slideInRight' : 'animate-slideInUp'
                }`}
            >
                <style>{`
                    @keyframes race {
                        from { stroke-dashoffset: 240; }
                        to { stroke-dashoffset: 0; }
                    }
                    @keyframes pulse-hex {
                        0% { transform: scale(1); opacity: 1; }
                        50% { transform: scale(1.05); opacity: 0.8; }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    .animate-race {
                        animation: race 2s linear infinite;
                    }
                    .animate-pulseHex {
                        animation: pulse-hex 2s infinite ease-in-out;
                    }
                `}</style>

                {/* Handle / Header Bar */}
                <div className="relative px-5 pt-3 pb-2 flex-shrink-0 bg-[#161412]">
                    <div className="flex justify-center mb-3">
                        <div className="width-11 h-1.5 rounded-full bg-white/10" style={{ width: 44, height: 5 }} />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <Logo 
                                variant="icon" 
                                size={48} 
                                app={app}
                                className="rounded-[18px] border-2 border-white/10 shadow-lg bg-[#0A0908]"
                            />
                            <div 
                                style={{
                                    backgroundColor: accentColor,
                                    boxShadow: `0 4px 12px ${accentColor}66`,
                                }}
                                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-lg text-white flex items-center justify-center border-3 border-[#0a0a0a] z-10"
                            >
                                <Lock className="w-3 h-3 stroke-[3]" />
                            </div>
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-clash font-black text-white text-lg tracking-tight leading-tight truncate">
                                {user?.name || "User"}
                            </h3>
                            <p className="text-xs text-white/40 font-semibold font-satoshi mt-1">
                                Enter MasterPass to continue
                            </p>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-white/8 w-full my-1" />

                {/* Content Area */}
                <div className="px-5 py-4 flex-1 overflow-y-auto bg-[#161412] pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    {isDetecting || (loading && !password && mode !== 'migrating') ? (
                        <div className="flex justify-center items-center py-6">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: accentColor }} />
                        </div>
                    ) : mode === "migrating" ? (
                        <div className="py-6 flex flex-col items-center justify-center text-center gap-6 animate-fadeIn">
                            <div className="relative flex items-center justify-center w-20 h-20">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke="rgba(255,255,255,0.05)"
                                        strokeWidth="2"
                                        fill="transparent"
                                    />
                                    <circle
                                        cx="40"
                                        cy="40"
                                        r="36"
                                        stroke={migrationStatus === 'error' ? '#EF4444' : accentColor}
                                        strokeWidth="3"
                                        fill="transparent"
                                        strokeDasharray="226"
                                        strokeDashoffset={226 - (226 * migrationProgress) / 100}
                                        className="transition-all duration-300"
                                    />
                                </svg>
                                <div className="absolute flex flex-col items-center justify-center">
                                    {migrationStatus === 'upgrading' && (
                                        <>
                                            <Shield className="w-6 h-6" style={{ color: accentColor }} />
                                            <span className="text-[10px] font-mono font-bold text-white mt-1">
                                                {Math.round(migrationProgress)}%
                                            </span>
                                        </>
                                    )}
                                    {migrationStatus === 'success' && <CheckCircle className="w-8 h-8 text-emerald-500" />}
                                    {migrationStatus === 'error' && <AlertTriangle className="w-8 h-8 text-red-500" />}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-clash font-black text-white text-base tracking-tight leading-tight">
                                    {migrationStatus === 'upgrading' && 'Hardening Security...'}
                                    {migrationStatus === 'success' && 'Upgrade Complete'}
                                    {migrationStatus === 'error' && 'Critical Update Interrupted'}
                                </h4>
                                <p className="text-xs text-[#9B9691] max-w-[320px] mx-auto leading-relaxed">
                                    {migrationStatus === 'upgrading' && 'Upgrading your vault to Argon2id protection.'}
                                    {migrationStatus === 'success' && 'Your identity is now protected with elite architectural standards.'}
                                    {migrationStatus === 'error' && (
                                        <span className="block text-[#F59E0B] font-bold">
                                            DO NOT REFRESH THIS TAB. <br/>
                                            <span className="font-medium text-xs opacity-80 mt-1 block">Your encryption key is currently resident in RAM. We are stabilizing your secure perimeter.</span>
                                        </span>
                                    )}
                                </p>

                                {isCriticalError && (
                                    <button
                                        type="button"
                                        onClick={handlePasswordVerify}
                                        className="mt-4 px-6 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-black font-black text-xs rounded-xl transition-all cursor-pointer"
                                    >
                                        Retry Stabilization
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : mode === "passkey" ? (
                        <div className="flex flex-col items-center gap-4 py-4 animate-fadeIn">
                            <div 
                                onClick={handlePasskeyVerify}
                                className="w-20 h-20 flex items-center justify-center cursor-pointer relative hover:scale-105 transition-all duration-300"
                            >
                                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 80 80">
                                    <path
                                        d="M40 5 L70 22.5 L70 57.5 L40 75 L10 57.5 L10 22.5 Z"
                                        fill="transparent"
                                        stroke="rgba(255, 255, 255, 0.1)"
                                        strokeWidth="2"
                                        strokeDasharray="4 4"
                                    />
                                    {passkeyLoading && (
                                        <path
                                            d="M40 5 L70 22.5 L70 57.5 L40 75 L10 57.5 L10 22.5 Z"
                                            fill="transparent"
                                            stroke="url(#racingGradient)"
                                            strokeWidth="3"
                                            strokeDasharray="60 180"
                                            className="animate-race"
                                        />
                                    )}
                                    <defs>
                                        <linearGradient id="racingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor={accentColor} />
                                            <stop offset="100%" stopColor={accentColor} />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className={`absolute flex items-center justify-center ${passkeyLoading ? 'animate-pulseHex' : ''}`}>
                                    <Fingerprint className="w-8 h-8" style={{ color: passkeyLoading ? accentColor : 'rgba(255, 255, 255, 0.4)' }} />
                                </div>
                            </div>

                            <span className="text-[10px] text-white/30 font-bold tracking-widest uppercase mt-2">
                                {passkeyLoading ? "CONFIRM ON DEVICE" : "TAP TO VERIFY"}
                            </span>
                        </div>
                    ) : (
                        <form onSubmit={handlePasswordVerify} className="space-y-4 animate-fadeIn">
                            {isPendingVault && (
                                <div className="p-4 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-2xl flex gap-3 items-start">
                                    <AlertTriangle className="w-5 h-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h4 className="font-extrabold text-white text-sm">Resuming High-Priority Upgrade</h4>
                                        <p className="text-xs text-[#9B9691] leading-relaxed mt-1">
                                            A previous cryptographic transition was interrupted. Please enter your master password to stabilize and finalize your T5 Core upgrade.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <span className="text-[10px] text-white/40 font-bold tracking-wider uppercase block">
                                    MASTER PASSWORD
                                </span>

                                <div className="relative">
                                    <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                                        <Lock className="w-4 h-4 text-white/30" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your master password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoFocus
                                        className="w-full bg-white/[0.03] pl-11 pr-12 py-3 rounded-xl border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#6366F1] hover:border-white/20 transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-4 flex items-center text-white/30 hover:text-white transition-all cursor-pointer"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                style={{
                                    background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}CC 100%)`,
                                    boxShadow: loading ? 'none' : `0 8px 25px ${accentColor}40`,
                                }}
                                className="w-full py-3.5 rounded-xl text-white font-extrabold text-sm hover:scale-[1.01] hover:shadow-lg active:scale-100 transition-all cursor-pointer flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                                ) : (
                                    "Verify Identity"
                                )}
                            </button>
                        </form>
                    )}
                </div>

                {/* Footer Switch mode */}
                {mode === "passkey" && (
                    <div className="flex-shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 border-t border-white/5 bg-[#161412]">
                        <button
                            type="button"
                            onClick={() => setMode("password")}
                            className="w-full min-h-[46px] flex items-center justify-center gap-2 border border-white/10 rounded-xl text-white font-extrabold text-sm bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all cursor-pointer"
                        >
                            <Fingerprint className="w-4 h-4" />
                            <span>Use Master Password</span>
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

// Migration compatibility: some pages import this overlay as a named export.
export { SudoModal };
