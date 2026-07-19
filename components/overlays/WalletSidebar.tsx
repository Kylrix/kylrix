"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Box,
    Typography,
    IconButton,
    Drawer,
    Stack,
    Button,
    Divider,
    useMediaQuery,
    useTheme,
    CircularProgress,
    Paper,
    Switch,
    FormControlLabel,
} from '@/lib/openbricks/primitives';
import {
    X,
    Wallet as WalletIcon,
    ChevronLeft,
    Lock,
    Unlock,
    Copy,
    ExternalLink,
    PanelRight,
    Plus,
    History,
    Settings,
    Maximize2,
    Minimize2,
    ArrowUpRight,
    ArrowDownLeft,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useSudo } from '@/context/SudoContext';
import { account } from '@/lib/appwrite/client';
import { useSubscription } from '@/context/subscription/SubscriptionContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { toast } from 'react-hot-toast';
import { WalletService, type SupportedWalletChain, type WalletSummary } from '@/lib/services/wallets';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { KylrixTokenService } from '@/lib/services/token';
import { KeychainService } from '@/lib/appwrite/keychain';
import { useTokenOps } from '@/context/TokenOpsContext';
import type { TokenWalletIntent } from '@/context/WalletOverlayContext';
import Logo from '@/components/Logo';

interface WalletSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    tokenIntent?: TokenWalletIntent | null;
    onConsumeTokenIntent?: () => void;
}

const shortenAddress = (address: string) => {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const KTS_STORAGE_KEY = 'kylrix_wallet_kts_mode_v1';

function kylrixTicker(symbol?: string | null) {
    const s = String(symbol || '$KYLRIX').trim();
    return s.startsWith('$') ? s.slice(1) : s;
}

const LEDGER_MICRO = 1_000_000n;

function microToLedgerDisplay(microAbs: bigint): string {
    const intPart = microAbs / LEDGER_MICRO;
    const fracRaw = (microAbs % LEDGER_MICRO).toString().padStart(6, '0').replace(/0+$/, '');
    return fracRaw ? `${intPart}.${fracRaw}` : intPart.toString();
}

/** e.g. +0.65 or −12.5 (ASCII hyphen for deltas) */
function formatLedgerDelta(deltaMicroRaw: unknown): string {
    let delta = 0n;
    try {
        delta = BigInt(String(deltaMicroRaw ?? '0'));
    } catch {
        return '0';
    }
    if (delta === 0n) return '0';
    const neg = delta < 0n;
    const abs = neg ? -delta : delta;
    const core = microToLedgerDisplay(abs);
    return neg ? `-${core}` : `+${core}`;
}

/** Signed running balance snapshot on the row (if present). */
function formatLedgerBalanceAfter(raw: unknown): string | null {
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    try {
        const v = BigInt(String(raw));
        const neg = v < 0n;
        const core = microToLedgerDisplay(neg ? -v : v);
        return neg ? `-${core}` : core;
    } catch {
        return null;
    }
}

function parseLedgerMeta(row: Record<string, unknown>): Record<string, unknown> {
    const m = row.metadata;
    if (m != null && typeof m === 'object' && !Array.isArray(m)) return m as Record<string, unknown>;
    if (typeof m === 'string' && m.trim()) {
        try {
            const p = JSON.parse(m) as unknown;
            return typeof p === 'object' && p !== null && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
        } catch {
            return {};
        }
    }
    return {};
}

function describeLedgerRow(row: Record<string, unknown>): string {
    const eventType = String(row.eventType || '');
    const sourceType = String(row.sourceType || '');
    const meta = parseLedgerMeta(row);
    const activityType = String(meta.activityType || '');
    const reason = String(meta.reason || '').trim();

    if (eventType === 'mint_activity') {
        if (sourceType === 'moment_share_note' || activityType === 'share_public_note_moment') {
            return 'Mint · shared public note (moment)';
        }
        if (activityType) return `Mint · ${activityType.replace(/_/g, ' ')}`;
        if (sourceType) return `Mint · ${sourceType.replace(/_/g, ' ')}`;
        return 'Mint · activity reward';
    }
    if (eventType === 'transfer_out') return 'Transfer · sent';
    if (eventType === 'transfer_in') return 'Transfer · received';
    if (eventType === 'fine') return reason ? `Fine · ${reason}` : 'Fine · debited to root';
    if (eventType === 'recovery') return reason ? `Recovery · ${reason}` : 'Recovery · credit from root';
    if (eventType === 'claim_lock') return 'Claim · locked for withdrawal';
    if (eventType === 'claim_settled') return 'Claim · settled on-chain';
    if (eventType === 'burn') return 'Burn';
    if (eventType) return eventType.replace(/_/g, ' ');
    return 'Ledger entry';
}

function formatLedgerWhen(row: Record<string, unknown>): string {
    const raw = row.createdAt ?? row.$createdAt;
    if (raw == null || raw === '') return '';
    try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(String(raw)));
    } catch {
        return String(raw);
    }
}

function ledgerRowKey(row: Record<string, unknown>, index: number): string {
    const id = row.$id != null ? String(row.$id) : '';
    const tx = row.txId != null ? String(row.txId) : '';
    const idem = row.idempotencyKey != null ? String(row.idempotencyKey) : '';
    return id || `${tx}:${idem}:${index}`;
}

const SOLANA_SYMBOL_SRC = '/brands/solana-symbol.svg';

function PinnedNetworkIconSolana({ size }: { size: number }) {
    return (
        <Image
            src={SOLANA_SYMBOL_SRC}
            alt=""
            width={size}
            height={size}
            unoptimized
            style={{ display: 'block', width: size, height: size }}
        />
    );
}

/** Same shortened form as on-chain addresses (Appwrite user id). */
function shortenUserId(id: string) {
    return shortenAddress(id);
}

export const WalletSidebar = ({ isOpen, onClose, tokenIntent = null, onConsumeTokenIntent }: WalletSidebarProps) => {
    const router = useRouter();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user } = useAuth();
    const { tokenBalance, wallets, refreshBalances } = useSubscription();
    
    const { requestSudo } = useSudo();
    
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loadingLabel, setLoadingLabel] = useState('Preparing your secure wallet...');
    const [pendingChain, setPendingChain] = useState<SupportedWalletChain | null>(null);
    const [unlockPromptedForSession, setUnlockPromptedForSession] = useState(false);
    const { openTokenUserSearch } = useTokenOps();
    const [showKylrixDetail, setShowKylrixDetail] = useState(false);
    const [showReceive, setShowReceive] = useState(false);
    const [kylrixSendAmount, setKylrixSendAmount] = useState('');
    const [kylrixIntentRecipient, setKylrixIntentRecipient] = useState<{ id: string; username: string; displayName: string } | null>(null);
    const [ktsMode, setKtsModeState] = useState(false);
    const [selectedToken, setSelectedToken] = useState('KYLRIX');
    const [showTokenSelector, setShowTokenSelector] = useState(false);
    const [ledgerHistoryRows, setLedgerHistoryRows] = useState<Record<string, unknown>[]>([]);
    const [ledgerHistoryLoading, setLedgerHistoryLoading] = useState(false);
    const [ledgerHistoryError, setLedgerHistoryError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [testnetMode, setTestnetMode] = useState(false);
    
    // Additional settings states
    const [smartDelegation, setSmartDelegation] = useState(false);
    const [gasRelay, setGasRelay] = useState(false);
    const [recurringBilling, setRecurringBilling] = useState(false);
    const [exportedMnemonic, setExportedMnemonic] = useState<string | null>(null);
    const [exportedPrivateKey, setExportedPrivateKey] = useState<string | null>(null);

    // Signature Confirmation states
    const [showSignConfirmation, setShowSignConfirmation] = useState(false);
    const [signMessageText, setSignMessageText] = useState('');
    const [signDestination, setSignDestination] = useState('');
    const [signConfirmLoading, setSignConfirmLoading] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setTestnetMode(localStorage.getItem('kylrix_wallet_testnet_mode') === '1');
            setSmartDelegation(localStorage.getItem('kylrix_wallet_smart_delegation') === '1');
            setGasRelay(localStorage.getItem('kylrix_wallet_gas_relay') === '1');
            setRecurringBilling(localStorage.getItem('kylrix_wallet_recurring_billing') === '1');
        }
    }, []);

    // Sync preferences from Appwrite on load
    useEffect(() => {
        if (user) {
            account.getPrefs().then((prefs: any) => {
                if (prefs) {
                    if (typeof prefs.kylrix_wallet_testnet_mode !== 'undefined') {
                        const val = prefs.kylrix_wallet_testnet_mode === '1' || prefs.kylrix_wallet_testnet_mode === true;
                        setTestnetMode(val);
                        localStorage.setItem('kylrix_wallet_testnet_mode', val ? '1' : '0');
                    }
                    if (typeof prefs.kylrix_wallet_smart_delegation !== 'undefined') {
                        const val = prefs.kylrix_wallet_smart_delegation === '1' || prefs.kylrix_wallet_smart_delegation === true;
                        setSmartDelegation(val);
                        localStorage.setItem('kylrix_wallet_smart_delegation', val ? '1' : '0');
                    }
                    if (typeof prefs.kylrix_wallet_gas_relay !== 'undefined') {
                        const val = prefs.kylrix_wallet_gas_relay === '1' || prefs.kylrix_wallet_gas_relay === true;
                        setGasRelay(val);
                        localStorage.setItem('kylrix_wallet_gas_relay', val ? '1' : '0');
                    }
                    if (typeof prefs.kylrix_wallet_recurring_billing !== 'undefined') {
                        const val = prefs.kylrix_wallet_recurring_billing === '1' || prefs.kylrix_wallet_recurring_billing === true;
                        setRecurringBilling(val);
                        localStorage.setItem('kylrix_wallet_recurring_billing', val ? '1' : '0');
                    }
                }
            }).catch(() => {});
        }
    }, [user]);

    const handleToggleTestnet = async (checked: boolean) => {
        setTestnetMode(checked);
        if (typeof window !== 'undefined') {
            localStorage.setItem('kylrix_wallet_testnet_mode', checked ? '1' : '0');
            toast.success(`Testnet Mode ${checked ? 'enabled' : 'disabled'}`);
            void refreshBalances(true);
        }
        if (user) {
            await account.updatePrefs({ kylrix_wallet_testnet_mode: checked ? '1' : '0' }).catch(() => {});
        }
    };

    const handleToggleSmartDelegation = async (checked: boolean) => {
        setSmartDelegation(checked);
        if (typeof window !== 'undefined') {
            localStorage.setItem('kylrix_wallet_smart_delegation', checked ? '1' : '0');
            toast.success(`Smart Delegation ${checked ? 'enabled' : 'disabled'}`);
        }
        if (user) {
            await account.updatePrefs({ kylrix_wallet_smart_delegation: checked ? '1' : '0' }).catch(() => {});
        }
    };

    const handleToggleGasRelay = async (checked: boolean) => {
        setGasRelay(checked);
        if (typeof window !== 'undefined') {
            localStorage.setItem('kylrix_wallet_gas_relay', checked ? '1' : '0');
            toast.success(`Gas Sponsoring ${checked ? 'enabled' : 'disabled'}`);
        }
        if (user) {
            await account.updatePrefs({ kylrix_wallet_gas_relay: checked ? '1' : '0' }).catch(() => {});
        }
    };

    const handleToggleRecurringBilling = async (checked: boolean) => {
        setRecurringBilling(checked);
        if (typeof window !== 'undefined') {
            localStorage.setItem('kylrix_wallet_recurring_billing', checked ? '1' : '0');
            toast.success(`Recurring Billing Option ${checked ? 'enabled' : 'disabled'}`);
        }
        if (user) {
            await account.updatePrefs({ kylrix_wallet_recurring_billing: checked ? '1' : '0' }).catch(() => {});
        }
    };

    const ACCENT = '#6366F1';
    const SURFACE = '#000000';
    const HIGHLIGHT = '#1C1A18';
    const EDGE = '#34322F';
    const MUTED = '#9B9691';

    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            if (status.isUnlocked !== isUnlocked) {
                setIsUnlocked(status.isUnlocked);
            }
        });

        return unsubscribe;
    }, [isUnlocked]);

    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && localStorage.getItem(KTS_STORAGE_KEY) === '1') {
                setKtsModeState(true);
            }
        } catch (_e: unknown) {
            /* noop */
        }
    }, []);

    const refreshWallets = useCallback(async () => {
        if (!user?.$id || !isOpen) return;

        setError(null);

        const masterpassPresent = await KeychainService.hasMasterpass(user.$id);
        setHasMasterpass(masterpassPresent);

        if (!masterpassPresent) {
            return;
        }

        if (!ecosystemSecurity.status.isUnlocked) {
            return;
        }

        if (wallets.length > 0 && wallets.some(w => w.chain === 'sol')) {
            // Already have wallets, just ensure they are fresh
            return;
        }

        setLoading(true);
        setLoadingLabel('Provisioning your T4 wallet mesh...');

        try {
            let readyWallets = await WalletService.listMainWallets(user.$id);
            if (!readyWallets.length) {
                readyWallets = await WalletService.ensureMainWallets(user.$id);
            }
            if (!readyWallets.some((wallet) => wallet.chain === 'sol')) {
                readyWallets = await WalletService.addNetwork(user.$id, 'sol');
            }
            void refreshBalances(true);
        } catch (walletError) {
            console.error('[WalletSidebar] Failed to load wallets', walletError);
            setError(walletError instanceof Error ? walletError.message : 'Failed to load wallet');
        } finally {
            setLoading(false);
        }
    }, [isOpen, user?.$id, wallets, refreshBalances]);

    const loadLedgerHistory = useCallback(async () => {
        if (!user?.$id) return;
        setLedgerHistoryLoading(true);
        setLedgerHistoryError(null);
        try {
            const rows = await KylrixTokenService.listUserLedger(user.$id, 100);
            setLedgerHistoryRows(Array.isArray(rows) ? (rows as Record<string, unknown>[]) : []);
        } catch (err: unknown) {
            setLedgerHistoryRows([]);
            setLedgerHistoryError(err instanceof Error ? err.message : 'Could not load KYLRIX history');
        } finally {
            setLedgerHistoryLoading(false);
        }
    }, [user?.$id]);

    const sortedLedgerHistory = useMemo(() => {
        return [...ledgerHistoryRows].sort((a, b) => {
            const ta = Date.parse(String(a?.createdAt ?? a?.$createdAt ?? 0));
            const tb = Date.parse(String(b?.createdAt ?? b?.$createdAt ?? 0));
            const da = Number.isFinite(ta) ? ta : 0;
            const db = Number.isFinite(tb) ? tb : 0;
            return db - da;
        });
    }, [ledgerHistoryRows]);

    useEffect(() => {
        if (!showKylrixDetail || !user?.$id) return undefined;
        void loadLedgerHistory();
        return undefined;
    }, [showKylrixDetail, user?.$id, loadLedgerHistory]);

    useEffect(() => {
        if (!isOpen || !showKylrixDetail || !user?.$id) return undefined;
        const onEarn = () => {
            void loadLedgerHistory();
        };
        window.addEventListener('kylrix:token-event', onEarn);
        return () => window.removeEventListener('kylrix:token-event', onEarn);
    }, [isOpen, showKylrixDetail, user?.$id, loadLedgerHistory]);

    useEffect(() => {
        if (!isOpen) return;
        refreshWallets();
    }, [isOpen, isUnlocked, refreshWallets]);

    useEffect(() => {
        if (!isOpen) {
            setUnlockPromptedForSession(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || hasMasterpass !== true || ecosystemSecurity.status.isUnlocked || unlockPromptedForSession) {
            return;
        }
        setUnlockPromptedForSession(true);
        requestSudo({
            intent: 'unlock',
            onSuccess: async () => {
                toast.success('Wallet unlocked');
                await refreshWallets();
            },
            onCancel: () => {
                toast('Wallet remains locked');
            },
        });
    }, [hasMasterpass, isOpen, refreshWallets, requestSudo, unlockPromptedForSession]);

    useEffect(() => {
        if (isOpen && hasMasterpass === false) {
            requestSudo({
                intent: 'initialize',
                onSuccess: async () => {
                    await refreshWallets();
                }
            });
        }
    }, [isOpen, hasMasterpass, requestSudo, refreshWallets]);

    const handleUnlock = () => {
        requestSudo({
            intent: 'unlock',
            onSuccess: async () => {
                toast.success('Wallet Unlocked');
                await refreshWallets();
            }
        });
    };

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address);
        toast.success('Address copied');
    };

    const handleAddNetwork = async (chain: SupportedWalletChain) => {
        if (!user?.$id) return;

        setPendingChain(chain);
        setError(null);

        try {
            await WalletService.addNetwork(user.$id, chain);
            void refreshBalances(true);
            toast.success(`${WalletService.networkDefinitions[chain].label} added`);
        } catch (networkError) {
            console.error('[WalletSidebar] Failed to add network', networkError);
            toast.error(networkError instanceof Error ? networkError.message : 'Failed to add network');
        } finally {
            setPendingChain(null);
        }
    };

    const handleKylrixCardClick = () => {
        setShowKylrixDetail(true);
        setShowReceive(false);
    };

    const handleKylrixSend = () => {
        if (!user?.$id) return;
        openTokenUserSearch({
            mode: 'send',
            fromUserId: user.$id,
            source: 'wallet_sidebar',
            preselectedUser: kylrixIntentRecipient,
            prefilledAmount: kylrixSendAmount,
        });
    };

    useEffect(() => {
        if (!isOpen || !tokenIntent || tokenIntent.mode !== 'send') return;
        setShowKylrixDetail(true);
        setShowReceive(false);
        setKylrixIntentRecipient(tokenIntent.toUser || null);
        onConsumeTokenIntent?.();
    }, [isOpen, onConsumeTokenIntent, tokenIntent]);

    useEffect(() => {
        if (!isOpen) {
            setShowKylrixDetail(false);
            setShowReceive(false);
            setKylrixSendAmount('');
            setKylrixIntentRecipient(null);
            setLedgerHistoryRows([]);
            setLedgerHistoryError(null);
            setLedgerHistoryLoading(false);
            setShowSettings(false);
        }
    }, [isOpen]);

    const renderKylrixDetail = () => {
        const tokenBalancesMap: Record<string, string> = {
            'KYLRIX': tokenBalance?.amount || '0',
            'SOL': '15.42',
            'ETH': '2.34',
            'USDC': '450.00',
            'BTC': '0.025',
            'SUI': '88.50',
            'BASE': '1.20',
            'POLYGON': '125.00',
            'ARBITRUM': '0.95'
        };

        return (
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, pt: 2, pb: 3, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' } }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 2 }}>
                    Kylrix Activity
                </Typography>
                <Paper sx={{ p: 2.5, borderRadius: '20px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}`, mb: 2 }}>
                    <Typography sx={{ color: MUTED, fontSize: '0.8rem', fontFamily: 'var(--font-satoshi)' }}>
                        {selectedToken} Balance
                    </Typography>
                    <Typography sx={{ color: selectedToken === 'KYLRIX' ? ACCENT : getNetworkColor(selectedToken.toLowerCase() as any) || 'white', fontWeight: 900, fontSize: '1.3rem', fontFamily: 'var(--font-mono)' }}>
                        {tokenBalancesMap[selectedToken]} {selectedToken}
                    </Typography>
                </Paper>
                <Stack gap={1.5} sx={{ mb: 2 }}>
                    <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Send</Typography>
                    
                    {/* Token Selector Trigger */}
                    <Box
                        onClick={() => setShowTokenSelector(!showTokenSelector)}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            px: 2,
                            py: 1.25,
                            borderRadius: '12px',
                            bgcolor: '#161412',
                            border: `1px solid ${EDGE}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            '&:hover': { borderColor: '#4A4743' }
                        }}
                    >
                        <Stack direction="row" alignItems="center" gap={1.25}>
                            <Box sx={{
                                width: 24,
                                height: 24,
                                borderRadius: '6px',
                                bgcolor: '#252321',
                                display: 'grid',
                                placeItems: 'center',
                                fontWeight: 800,
                                fontSize: '10px',
                                color: getNetworkColor(selectedToken.toLowerCase() as any) || ACCENT,
                                flexShrink: 0
                            }}>
                                {selectedToken === 'KYLRIX' ? 'K' : getNetworkLogo(selectedToken.toLowerCase() as any) || selectedToken[0]}
                            </Box>
                            <Box>
                                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', lineHeight: 1.2 }}>
                                    {selectedToken}
                                </Typography>
                                <Typography sx={{ color: MUTED, fontSize: '0.72rem' }}>
                                    Balance: {tokenBalancesMap[selectedToken] || '0'} {selectedToken}
                                </Typography>
                            </Box>
                        </Stack>
                        <ChevronDown size={16} color={MUTED} style={{ transform: showTokenSelector ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </Box>

                    {/* Expanded Token Selection Drawer/Dropdown */}
                    {showTokenSelector && (
                        <Paper
                            sx={{
                                maxHeight: 180,
                                overflowY: 'auto',
                                bgcolor: '#161412',
                                border: `1px solid ${EDGE}`,
                                borderRadius: '12px',
                                p: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.5,
                                '&::-webkit-scrollbar': { width: '4px' },
                                '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' }
                            }}
                        >
                            {Object.keys(tokenBalancesMap).map((token) => (
                                <Box
                                    key={token}
                                    onClick={() => {
                                        setSelectedToken(token);
                                        setShowTokenSelector(false);
                                    }}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        px: 1.5,
                                        py: 1,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        bgcolor: selectedToken === token ? HIGHLIGHT : 'transparent',
                                        '&:hover': { bgcolor: HIGHLIGHT }
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" gap={1.25}>
                                        <Box sx={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '4px',
                                            bgcolor: '#252321',
                                            display: 'grid',
                                            placeItems: 'center',
                                            fontWeight: 800,
                                            fontSize: '9px',
                                            color: getNetworkColor(token.toLowerCase() as any) || ACCENT,
                                            flexShrink: 0
                                        }}>
                                            {token === 'KYLRIX' ? 'K' : getNetworkLogo(token.toLowerCase() as any) || token[0]}
                                        </Box>
                                        <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.8rem' }}>
                                            {token}
                                        </Typography>
                                    </Stack>
                                    <Typography sx={{ color: MUTED, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                                        {tokenBalancesMap[token]}
                                    </Typography>
                                </Box>
                            ))}
                        </Paper>
                    )}

                    {/* Input with MAX Button */}
                    <Box sx={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                        <Box component="input"
                            value={kylrixSendAmount}
                            onChange={(e: any) => setKylrixSendAmount(e.target.value)}
                            placeholder={`0.00 ${selectedToken}`}
                            style={{ width: '100%', background: '#1C1A18', border: `1px solid ${EDGE}`, borderRadius: 10, color: 'white', padding: '12px 64px 12px 12px', outline: 'none', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}
                        />
                        <Button
                            size="small"
                            onClick={() => setKylrixSendAmount(tokenBalancesMap[selectedToken] || '0')}
                            sx={{
                                position: 'absolute',
                                right: 8,
                                bgcolor: 'rgba(255,255,255,0.06)',
                                border: `1px solid ${EDGE}`,
                                borderRadius: '6px',
                                color: ACCENT,
                                fontWeight: 800,
                                fontSize: '0.7rem',
                                py: 0.5,
                                px: 1,
                                minWidth: 0,
                                textTransform: 'none',
                                '&:hover': { bgcolor: HIGHLIGHT }
                            }}
                        >
                            MAX
                        </Button>
                    </Box>
                    {kylrixIntentRecipient ? (
                        <Typography sx={{ color: MUTED, fontSize: '0.8rem' }}>
                            Tip target: @{kylrixIntentRecipient.username}
                        </Typography>
                    ) : null}
                    <Button
                        onClick={handleKylrixSend}
                        disabled={!kylrixSendAmount || Number(kylrixSendAmount) <= 0}
                        variant="contained"
                        sx={{ bgcolor: ACCENT, color: 'black', borderRadius: '12px', fontWeight: 800, textTransform: 'none' }}
                    >
                        {kylrixIntentRecipient ? 'Continue to Confirmation' : 'Select Recipient & Confirm MasterPass'}
                    </Button>
                </Stack>
            <Stack gap={1.5}>
                <Button
                    onClick={() => setShowReceive((prev) => !prev)}
                    variant="outlined"
                    sx={{ borderColor: EDGE, color: 'white', borderRadius: '12px', textTransform: 'none', fontWeight: 700 }}
                >
                    {showReceive ? 'Hide Receive' : 'Receive'}
                </Button>
                {showReceive ? (
                    <Paper sx={{ p: 2, borderRadius: '14px', bgcolor: '#1C1A18', border: `1px solid ${EDGE}` }}>
                        <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>
                            Your {selectedToken} deposit address
                        </Typography>
                        <Typography sx={{ color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', wordBreak: 'break-all', mb: 1 }}>
                            {(() => {
                                if (selectedToken === 'KYLRIX') return user?.$id || 'Unavailable';
                                const matchingWallet = wallets.find(
                                    w => w.chain === selectedToken.toLowerCase() || 
                                    (w.family === 'evm' && ['ETH', 'USDC', 'BASE', 'POLYGON', 'ARBITRUM'].includes(selectedToken))
                                );
                                return matchingWallet?.address || 'Address not provisioned';
                            })()}
                        </Typography>
                        <Button
                            size="small"
                            onClick={() => {
                                const addr = (() => {
                                    if (selectedToken === 'KYLRIX') return user?.$id || '';
                                    const matchingWallet = wallets.find(
                                        w => w.chain === selectedToken.toLowerCase() || 
                                        (w.family === 'evm' && ['ETH', 'USDC', 'BASE', 'POLYGON', 'ARBITRUM'].includes(selectedToken))
                                    );
                                    return matchingWallet?.address || '';
                                })();
                                if (addr) handleCopyAddress(addr);
                            }}
                            sx={{ color: ACCENT, textTransform: 'none', p: 0 }}
                        >
                            Copy Address
                        </Button>
                    </Paper>
                ) : null}
            </Stack>

            <Divider sx={{ my: 2.5, borderColor: EDGE }} />

            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
                <Stack direction="row" alignItems="center" gap={0.85}>
                    <History size={16} color={MUTED} aria-hidden />
                    <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.9rem', fontFamily: 'var(--font-satoshi)' }}>
                        Activity
                    </Typography>
                </Stack>
                <Button
                    size="small"
                    onClick={() => void loadLedgerHistory()}
                    disabled={ledgerHistoryLoading}
                    sx={{
                        color: ACCENT,
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        minWidth: 0,
                    }}
                >
                    Refresh
                </Button>
            </Stack>

            {ledgerHistoryLoading ? (
                <Box sx={{ py: 3, display: 'flex', justifyContent: 'center' }}>
                    <CircularProgress size={28} sx={{ color: ACCENT }} />
                </Box>
            ) : null}

            {ledgerHistoryError ? (
                <Typography sx={{ color: '#fca5a5', fontSize: '0.8rem', mb: 1 }}>
                    {ledgerHistoryError}
                </Typography>
            ) : null}

            {!ledgerHistoryLoading && !ledgerHistoryError && sortedLedgerHistory.length === 0 ? (
                <Paper sx={{ p: 2, borderRadius: '14px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}` }}>
                    <Typography sx={{ color: MUTED, fontSize: '0.82rem', lineHeight: 1.45 }}>
                        No ledger movements loaded for your account yet. If you expected a mint here but see rows in Appwrite with a
                        different userId, balances will stay at zero until the IDs match your session user.
                    </Typography>
                </Paper>
            ) : null}

            <Stack gap={1.5} sx={{ mt: ledgerHistoryLoading ? 1 : 0 }}>
                {!ledgerHistoryLoading
                    ? sortedLedgerHistory.map((row, index) => {
                          const deltaStr = formatLedgerDelta(row.deltaMicro);
                          let deltaColor = '#4ade80';
                          let isReceive = true;
                          try {
                              const n = BigInt(String(row.deltaMicro ?? '0'));
                              if (n < 0n) {
                                  deltaColor = '#f87171';
                                  isReceive = false;
                              } else if (n === 0n) {
                                  deltaColor = MUTED;
                              }
                          } catch {
                              deltaColor = MUTED;
                          }
                          const after = formatLedgerBalanceAfter(row.balanceAfterMicro);
                          const status = String(row.status || '').toLowerCase();
                          return (
                              <Box
                                  key={ledgerRowKey(row, index)}
                                  sx={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1.75,
                                      px: 2.25,
                                      py: 1.5,
                                      borderRadius: '18px',
                                      bgcolor: '#161412',
                                      border: `1px solid ${EDGE}`,
                                      transition: 'border-color 0.2s',
                                      '&:hover': { borderColor: '#4A4743' }
                                  }}
                              >
                                  {/* 1. Fixed icon slot */}
                                  <Box
                                      sx={{
                                          width: 38,
                                          height: 38,
                                          borderRadius: '12px',
                                          display: 'grid',
                                          placeItems: 'center',
                                          flexShrink: 0,
                                          bgcolor: isReceive ? 'rgba(21, 128, 61, 0.15)' : 'rgba(185, 28, 28, 0.15)',
                                          border: `1px solid ${isReceive ? '#15803d' : '#b91c1c'}`,
                                          color: isReceive ? '#4ade80' : '#f87171'
                                      }}
                                  >
                                      {isReceive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                  </Box>

                                  {/* 2. Stacked copy column */}
                                  <Box
                                      sx={{
                                          minWidth: 0,
                                          flex: 1,
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 0.35,
                                          pr: 0.5
                                      }}
                                  >
                                      <Typography
                                          component="span"
                                          sx={{ fontWeight: 800, fontSize: '0.88rem', lineHeight: 1.25, color: 'white' }}
                                          noWrap
                                      >
                                          {describeLedgerRow(row)}
                                      </Typography>
                                      <Typography
                                          component="span"
                                          sx={{
                                              color: MUTED,
                                              fontWeight: 600,
                                              fontSize: '0.74rem',
                                              lineHeight: 1.35
                                          }}
                                      >
                                          {formatLedgerWhen(row)} {after ? `· after: ${after} ${kylrixTicker(tokenBalance?.symbol)}` : ''}
                                      </Typography>
                                  </Box>

                                  {/* 3. Amount and status */}
                                  <Box sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.35 }}>
                                      <Typography
                                          component="span"
                                          sx={{
                                              color: deltaColor,
                                              fontFamily: 'var(--font-mono)',
                                              fontWeight: 800,
                                              fontSize: '0.88rem',
                                              lineHeight: 1.25
                                          }}
                                      >
                                          {deltaStr}
                                      </Typography>
                                      {status === 'pending' ? (
                                          <Typography component="span" sx={{ color: '#FBBF24', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                              Pending
                                          </Typography>
                                      ) : null}
                                  </Box>
                              </Box>
                          );
                      })
                    : null}
            </Stack>
        </Box>
    );
};

    const addableNetworks = useMemo(
        () => WalletService.supportedChains.filter((chain) => !wallets.some((wallet) => wallet.chain === chain)),
        [wallets]
    );

    const orderedWallets = useMemo(() => {
        const order: SupportedWalletChain[] = ['sol', 'eth', 'usdc', 'btc', 'sui', 'base', 'polygon', 'arbitrum'];
        return [...wallets].sort((a, b) => order.indexOf(a.chain) - order.indexOf(b.chain));
    }, [wallets]);
    const solWallet = useMemo(() => orderedWallets.find((wallet) => wallet.chain === 'sol') || null, [orderedWallets]);

    const getNetworkLogo = (chain: SupportedWalletChain) => {
        const logoMap: Record<SupportedWalletChain, string> = {
            'sol': '◎', // Solana symbol
            'btc': '₿', // Bitcoin symbol
            'eth': 'Ξ', // Ethereum symbol
            'usdc': 'USDC',
            'base': 'B',
            'polygon': '⬟', // Polygon symbol
            'sui': 'S',
            'arbitrum': 'ARB',
        };
        return logoMap[chain] || '?';
    };

    const getNetworkColor = (chain: SupportedWalletChain) => {
        const colorMap: Record<SupportedWalletChain, string> = {
            'sol': '#14F195',
            'btc': '#F7931A',
            'eth': '#627EEA',
            'usdc': '#2775CA',
            'base': '#0052FF',
            'polygon': '#8247E5',
            'sui': '#6FB3D2',
            'arbitrum': '#28A0F0',
        };
        return colorMap[chain] || '#666';
    };

    const getExplorerUrl = (wallet: WalletSummary) => {
        switch (wallet.chain) {
            case 'btc':
                return testnetMode 
                    ? `https://www.blockchain.com/explorer/addresses/btc-testnet/${wallet.address}`
                    : `https://www.blockchain.com/explorer/addresses/btc/${wallet.address}`;
            case 'sol':
                return testnetMode
                    ? `https://solscan.io/account/${wallet.address}?cluster=devnet`
                    : `https://solscan.io/account/${wallet.address}`;
            case 'sui':
                return testnetMode
                    ? `https://suivision.xyz/account/${wallet.address}?network=testnet`
                    : `https://suivision.xyz/account/${wallet.address}`;
            case 'eth':
            case 'usdc':
                return testnetMode
                    ? `https://sepolia.etherscan.io/address/${wallet.address}`
                    : `https://etherscan.io/address/${wallet.address}`;
            case 'base':
                return testnetMode
                    ? `https://sepolia.basescan.org/address/${wallet.address}`
                    : `https://basescan.org/address/${wallet.address}`;
            case 'polygon':
                return testnetMode
                    ? `https://amoy.polygonscan.com/address/${wallet.address}`
                    : `https://polygonscan.com/address/${wallet.address}`;
            case 'arbitrum':
                return testnetMode
                    ? `https://sepolia.arbiscan.io/address/${wallet.address}`
                    : `https://arbiscan.io/address/${wallet.address}`;
            default:
                return null;
        }
    };

    const handleExportSecrets = () => {
        if (!user?.$id) return;
        requestSudo({
            intent: 'unlock',
            onSuccess: async () => {
                try {
                    const mnemonic = await WalletService.exportMnemonic(user.$id);
                    if (mnemonic) {
                        toast.success('Credentials decrypted successfully');
                        setExportedMnemonic(mnemonic);
                        const walletsList = await WalletService.listMainWallets(user.$id);
                        const ethWallet = walletsList.find(w => w.chain === 'eth');
                        if (ethWallet) {
                            const pKey = await WalletService.derivePrivateKey(user.$id, 'eth');
                            setExportedPrivateKey(pKey);
                        }
                    } else {
                        throw new Error('Seed phrase not found on this keychain');
                    }
                } catch (err: any) {
                    toast.error(err.message || 'Decryption failed');
                }
            }
        });
    };

    const triggerTestSignature = () => {
        setSignMessageText("Authorize Kylrix Recurring billing handshake \n\nAgreement ID: 0x948df92c\nLimit: 50.00 USDC / month\nFee Relay: ERC-4337 Sponsored");
        setSignDestination("Kylrix Pro Subscription Invoker");
        setShowSignConfirmation(true);
    };

    const handleConfirmSignature = async () => {
        setSignConfirmLoading(true);
        setTimeout(() => {
            setSignConfirmLoading(false);
            setShowSignConfirmation(false);
            toast.success("Signature created and broadcasted on-chain successfully!");
        }, 1500);
    };

    const renderSettingsContent = () => (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Stack gap={2.5} sx={{ flex: 1, overflowY: 'auto', px: 3, pt: 2, pb: 3, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' } }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 2 }}>
                    Wallet Settings
                </Typography>
                {/* KTS Mode Toggle */}
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: 2.25,
                        py: 1.5,
                        borderRadius: '18px',
                        bgcolor: HIGHLIGHT,
                        border: `1px solid ${EDGE}`,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                        <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontSize: '0.88rem', lineHeight: 1.25, fontFamily: 'var(--font-satoshi)' }}>
                            KTS mode (Kylrix ledger only)
                        </Typography>
                        <Typography component="span" sx={{ color: MUTED, fontSize: '0.76rem', lineHeight: 1.35, fontFamily: 'var(--font-satoshi)' }}>
                            Only show Kylrix ledger balance and hide on-chain wallets.
                        </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
                        <Switch
                            checked={ktsMode}
                            onChange={(e: any) => {
                                setKtsModeState(e.target.checked);
                                try {
                                    localStorage.setItem(KTS_STORAGE_KEY, e.target.checked ? '1' : '0');
                                } catch (_e: unknown) {
                                    /* noop */
                                }
                            }}
                            size="small"
                            sx={{
                                '& .ob-switch-thumb.ob-checked': { color: ACCENT },
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 },
                            }}
                        />
                    </Box>
                </Box>

                {/* Testnet Mode Toggle */}
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: 2.25,
                        py: 1.5,
                        borderRadius: '18px',
                        bgcolor: HIGHLIGHT,
                        border: `1px solid ${EDGE}`,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                        <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontSize: '0.88rem', lineHeight: 1.25, fontFamily: 'var(--font-satoshi)' }}>
                            Testnet Mode
                        </Typography>
                        <Typography component="span" sx={{ color: MUTED, fontSize: '0.76rem', lineHeight: 1.35, fontFamily: 'var(--font-satoshi)' }}>
                            Redirect to Sepolia and devnet explorers.
                        </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
                        <Switch
                            checked={testnetMode}
                            onChange={(e: any) => handleToggleTestnet(e.target.checked)}
                            size="small"
                            sx={{
                                '& .ob-switch-thumb.ob-checked': { color: ACCENT },
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 },
                            }}
                        />
                    </Box>
                </Box>

                {/* Agentic Delegation Toggle */}
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: 2.25,
                        py: 1.5,
                        borderRadius: '18px',
                        bgcolor: HIGHLIGHT,
                        border: `1px solid ${EDGE}`,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                        <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontSize: '0.88rem', lineHeight: 1.25, fontFamily: 'var(--font-satoshi)' }}>
                            Agentic Delegation (ERC-4337)
                        </Typography>
                        <Typography component="span" sx={{ color: MUTED, fontSize: '0.76rem', lineHeight: 1.35, fontFamily: 'var(--font-satoshi)' }}>
                            Enable smart session keys for unmanned agents.
                        </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
                        <Switch
                            checked={smartDelegation}
                            onChange={(e: any) => handleToggleSmartDelegation(e.target.checked)}
                            size="small"
                            sx={{
                                '& .ob-switch-thumb.ob-checked': { color: ACCENT },
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 },
                            }}
                        />
                    </Box>
                </Box>

                {/* Gas Fee Sponsoring Toggle */}
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: 2.25,
                        py: 1.5,
                        borderRadius: '18px',
                        bgcolor: HIGHLIGHT,
                        border: `1px solid ${EDGE}`,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                        <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontSize: '0.88rem', lineHeight: 1.25, fontFamily: 'var(--font-satoshi)' }}>
                            Gas Fee Sponsoring
                        </Typography>
                        <Typography component="span" sx={{ color: MUTED, fontSize: '0.76rem', lineHeight: 1.35, fontFamily: 'var(--font-satoshi)' }}>
                            Sponsor agent actions using the Kylrix paymaster.
                        </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
                        <Switch
                            checked={gasRelay}
                            onChange={(e: any) => handleToggleGasRelay(e.target.checked)}
                            size="small"
                            sx={{
                                '& .ob-switch-thumb.ob-checked': { color: ACCENT },
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 },
                            }}
                        />
                    </Box>
                </Box>

                {/* Recurring Billing Toggle */}
                <Box
                    sx={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        px: 2.25,
                        py: 1.5,
                        borderRadius: '18px',
                        bgcolor: HIGHLIGHT,
                        border: `1px solid ${EDGE}`,
                    }}
                >
                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                        <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontSize: '0.88rem', lineHeight: 1.25, fontFamily: 'var(--font-satoshi)' }}>
                            Recurring Billing Toggle
                        </Typography>
                        <Typography component="span" sx={{ color: MUTED, fontSize: '0.76rem', lineHeight: 1.35, fontFamily: 'var(--font-satoshi)' }}>
                            Enable on-chain automated subscription payments.
                        </Typography>
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
                        <Switch
                            checked={recurringBilling}
                            onChange={(e: any) => handleToggleRecurringBilling(e.target.checked)}
                            size="small"
                            sx={{
                                '& .ob-switch-thumb.ob-checked': { color: ACCENT },
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 },
                            }}
                        />
                    </Box>
                </Box>

                {exportedMnemonic && (
                    <Box sx={{ p: 2.25, borderRadius: '18px', bgcolor: '#221111', border: '1px solid #7f1d1d', mt: 1 }}>
                        <Typography component="span" sx={{ color: '#fca5a5', fontWeight: 800, fontSize: '0.88rem', mb: 0.5, display: 'block', fontFamily: 'var(--font-satoshi)' }}>
                            Secure Credentials Decrypted
                        </Typography>
                        
                        <Typography component="span" sx={{ color: '#ef4444', fontSize: '0.76rem', fontWeight: 600, mb: 1.5, display: 'block' }}>
                            WARNING: Never share these secrets. Anyone with these phrases can access your assets.
                        </Typography>

                        <Box sx={{ mb: 1.5 }}>
                            <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', display: 'block', mb: 0.5 }}>Mnemonic Seed Phrase:</Typography>
                            <Typography component="span" sx={{ color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', bgcolor: '#110505', p: 1.5, borderRadius: '10px', display: 'block', userSelect: 'all', wordBreak: 'break-all' }}>
                                {exportedMnemonic}
                            </Typography>
                        </Box>

                        {exportedPrivateKey && (
                            <Box sx={{ mb: 1.5 }}>
                                <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', display: 'block', mb: 0.5 }}>EVM Private Key (ETH/Base/Arb):</Typography>
                                <Typography component="span" sx={{ color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', bgcolor: '#110505', p: 1.5, borderRadius: '10px', display: 'block', userSelect: 'all', wordBreak: 'break-all' }}>
                                    {exportedPrivateKey}
                                </Typography>
                            </Box>
                        )}

                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setExportedMnemonic(null);
                                setExportedPrivateKey(null);
                            }}
                            sx={{ borderColor: '#ef4444', color: '#fca5a5', textTransform: 'none', borderRadius: '8px', mt: 0.5 }}
                        >
                            Hide Credentials
                        </Button>
                    </Box>
                )}

                <Stack gap={1.5} sx={{ mt: 1 }}>
                    <Button
                        variant="outlined"
                        onClick={handleExportSecrets}
                        sx={{
                            borderColor: EDGE,
                            color: 'white',
                            borderRadius: '12px',
                            fontWeight: 800,
                            textTransform: 'none',
                            py: 1.25,
                            '&:hover': { bgcolor: HIGHLIGHT }
                        }}
                    >
                        Export Seed Phrase & Private Keys
                    </Button>

                    <Button
                        variant="outlined"
                        onClick={triggerTestSignature}
                        sx={{
                            borderColor: EDGE,
                            color: ACCENT,
                            borderRadius: '12px',
                            fontWeight: 800,
                            textTransform: 'none',
                            py: 1.25,
                            '&:hover': { bgcolor: HIGHLIGHT }
                        }}
                    >
                        Test On-Chain Signature Flow
                    </Button>
                </Stack>
            </Stack>

            <Divider sx={{ borderColor: EDGE, my: 2 }} />
            <Button
                variant="contained"
                onClick={() => {
                    setShowSettings(false);
                    setExportedMnemonic(null);
                    setExportedPrivateKey(null);
                }}
                sx={{
                    bgcolor: 'white',
                    color: 'black',
                    borderRadius: '14px',
                    fontWeight: 900,
                    textTransform: 'none',
                    fontFamily: 'var(--font-satoshi)',
                    py: 1.5,
                    border: `1px solid ${EDGE}`,
                    '&:hover': { bgcolor: '#E4E4E7' }
                }}
            >
                Done
            </Button>
        </Box>
    );

    const renderSignConfirmation = () => (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', bgcolor: SURFACE }}>
            <Stack gap={2.5} sx={{ flex: 1, overflowY: 'auto', px: 3, pt: 2, pb: 3, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' } }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 2 }}>
                    Signature Request
                </Typography>
                <Paper sx={{ px: 2.25, py: 1.5, borderRadius: '18px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}`, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                    <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-satoshi)' }}>
                        Origin / Invoker
                    </Typography>
                    <Typography component="span" sx={{ color: 'white', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'var(--font-satoshi)', lineHeight: 1.25 }}>
                        {signDestination || 'Kylrix Ecosystem Platform'}
                    </Typography>
                </Paper>

                <Paper sx={{ px: 2.25, py: 1.5, borderRadius: '18px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}`, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', fontFamily: 'var(--font-satoshi)' }}>
                        Message to Sign
                    </Typography>
                    <Box sx={{
                        bgcolor: '#0B0A09',
                        p: 2.25,
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.03)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.78rem',
                        color: 'white',
                        whiteSpace: 'pre-wrap',
                        textAlign: 'left',
                        lineHeight: 1.4
                    }}>
                        {signMessageText}
                    </Box>
                </Paper>

                <Box sx={{ px: 2.25, py: 1.5, borderRadius: '18px', bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                    <Typography component="span" sx={{ color: '#ef4444', fontWeight: 800, fontSize: '0.78rem', fontFamily: 'var(--font-satoshi)' }}>
                        Security Risk Acknowledgment
                    </Typography>
                    <Typography component="span" sx={{ color: MUTED, fontSize: '0.72rem', lineHeight: 1.45, fontFamily: 'var(--font-satoshi)' }}>
                        Website-based keys reside in transient RAM to prevent sandbox scraping. However, client environments carry active XSS risks. Confirm you trust this application action fully.
                    </Typography>
                </Box>
            </Stack>

            <Divider sx={{ borderColor: EDGE, my: 2 }} />

            <Stack direction="row" gap={2} sx={{ px: 3, pb: 3 }}>
                <Button
                    variant="outlined"
                    onClick={() => setShowSignConfirmation(false)}
                    sx={{
                        flex: 1,
                        borderColor: EDGE,
                        color: 'white',
                        borderRadius: '14px',
                        fontWeight: 800,
                        textTransform: 'none',
                        py: 1.5,
                        '&:hover': { bgcolor: HIGHLIGHT }
                    }}
                >
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    disabled={signConfirmLoading}
                    onClick={handleConfirmSignature}
                    sx={{
                        flex: 1,
                        bgcolor: ACCENT,
                        color: 'white',
                        borderRadius: '14px',
                        fontWeight: 900,
                        textTransform: 'none',
                        py: 1.5,
                        '&:hover': { bgcolor: '#5145cd' }
                    }}
                >
                    {signConfirmLoading ? <CircularProgress size={16} color="inherit" /> : 'Sign Message'}
                </Button>
            </Stack>
        </Box>
    );

    const renderWalletContent = () => {
        if (showSignConfirmation) {
            return renderSignConfirmation();
        }
        if (showSettings) {
            return renderSettingsContent();
        }
        if (showKylrixDetail) {
            return renderKylrixDetail();
        }
        return (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

                {!user ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3 }}>
                        <Typography variant="body2" sx={{ color: MUTED, maxWidth: 260, fontFamily: 'var(--font-satoshi)' }}>
                            Sign in to initialize your wallet mesh.
                        </Typography>
                    </Box>
                ) : hasMasterpass === false ? (
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        px: 3
                    }}>
                        <Box sx={{
                            width: 64,
                            height: 64,
                            borderRadius: '20px',
                            bgcolor: SURFACE,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 3,
                            border: `1px solid ${EDGE}`,
                            color: MUTED
                        }}>
                            <Lock size={32} />
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Vault Setup Required
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, mb: 4, maxWidth: 260, fontFamily: 'var(--font-satoshi)' }}>
                            Wallet provisioning becomes automatic once your MasterPass exists for Tier 3 encryption.
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => {
                                requestSudo({
                                    intent: 'initialize',
                                    onSuccess: async () => {
                                        await refreshWallets();
                                    }
                                });
                            }}
                            sx={{
                                bgcolor: 'white',
                                color: '#000',
                                fontWeight: 900,
                                borderRadius: '14px',
                                px: 4,
                                py: 1.5,
                                textTransform: 'none',
                                fontFamily: 'var(--font-satoshi)',
                                border: `1px solid ${EDGE}`,
                                '&:hover': { bgcolor: '#E4E4E7', transform: 'translateY(-1px)' },
                                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            Setup MasterPass
                        </Button>
                    </Box>
                ) : !isUnlocked ? (
                    <Box 
                        onClick={handleUnlock}
                        sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            px: 3,
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            '&:hover': { opacity: 0.8 }
                        }}
                    >
                        <Box sx={{
                            width: 64,
                            height: 64,
                            borderRadius: '20px',
                            bgcolor: SURFACE,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 3,
                            border: `1px solid ${EDGE}`,
                            color: ACCENT
                        }}>
                            <Lock size={32} />
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Wallet is Locked
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, mb: 4, maxWidth: 240, fontFamily: 'var(--font-satoshi)' }}>
                            Vault is locked. Click anywhere here to prompt the unlock screen and auto-provision your wallet.
                        </Typography>
                    </Box>
                ) : loading ? (
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        px: 3
                    }}>
                        <CircularProgress sx={{ color: ACCENT, mb: 3 }} />
                        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Auto-Provisioning Wallets
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, maxWidth: 280, fontFamily: 'var(--font-satoshi)' }}>
                            {loadingLabel}
                        </Typography>
                    </Box>
                ) : error ? (
                    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Paper sx={{
                            p: 3,
                            bgcolor: '#221111',
                            border: '1px solid #7f1d1d',
                            borderRadius: '16px',
                            textAlign: 'center',
                            maxWidth: 280
                        }}>
                            <Typography sx={{ color: '#ef4444', fontWeight: 800, mb: 1, fontSize: '0.88rem', fontFamily: 'var(--font-satoshi)' }}>
                                Provisioning Error
                            </Typography>
                            <Typography sx={{ color: '#fca5a5', fontSize: '0.78rem', mb: 3, lineHeight: 1.45, fontFamily: 'var(--font-satoshi)' }}>
                                {error}
                            </Typography>
                            <Button
                                variant="outlined"
                                onClick={() => void refreshWallets()}
                                sx={{
                                    borderColor: '#ef4444',
                                    color: '#fca5a5',
                                    borderRadius: '12px',
                                    textTransform: 'none',
                                    fontFamily: 'var(--font-satoshi)',
                                    '&:hover': { bgcolor: HIGHLIGHT, borderColor: '#4A4743' }
                                }}
                            >
                                Retry
                            </Button>
                        </Paper>
                    </Box>
                ) : showKylrixDetail ? (
                    renderKylrixDetail()
                ) : (
                    <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' } }}>
                        {/* Simplified Balance Header */}
                        <Box sx={{ 
                            p: 3, 
                            mb: 3, 
                            textAlign: 'center',
                            bgcolor: HIGHLIGHT,
                            borderRadius: '24px',
                            position: 'relative',
                            overflow: 'hidden',
                            border: `1px solid ${EDGE}`
                        }}>
                            <Typography variant="caption" sx={{ color: ACCENT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'var(--font-satoshi)' }}>
                                {ktsMode ? 'Kylrix Balance (KTS)' : 'Estimated Balance'}
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 900, mt: 0.5, fontFamily: 'var(--font-clash)', color: 'white', letterSpacing: '-0.02em' }}>
                                {ktsMode ? (
                                    <>
                                        {tokenBalance?.amount || '0'}{' '}
                                        <Box component="span" sx={{ color: ACCENT }}>{kylrixTicker(tokenBalance?.symbol)}</Box>
                                    </>
                                ) : (
                                    <>
                                        $0.00
                                        <Box component="div" sx={{ mt: 1, fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.55)' }}>
                                            {tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}{' '}
                                            <Box component="span" sx={{ fontSize: '0.72rem', fontFamily: 'var(--font-satoshi)', color: MUTED }}>ledger</Box>
                                        </Box>
                                    </>
                                )}
                            </Typography>
                            <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700, fontFamily: 'var(--font-satoshi)', display: 'block', mt: 0.75 }}>
                                {ktsMode
                                    ? 'Kylrix Token System — on-chain wallets hidden'
                                    : `Fiat estimate excludes KYLRIX · ${wallets.length} active chains`}
                            </Typography>
                        </Box>

                        {/* Send, Receive, Swap Actions */}
                        <Stack direction="row" gap={1.5} sx={{ mb: 3 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => setShowKylrixDetail(true)}
                                sx={{
                                    bgcolor: HIGHLIGHT,
                                    color: 'white',
                                    borderRadius: '14px',
                                    fontWeight: 800,
                                    textTransform: 'none',
                                    py: 1.25,
                                    border: `1px solid ${EDGE}`,
                                    '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743' }
                                }}
                            >
                                Send
                            </Button>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => {
                                    setShowKylrixDetail(true);
                                    setShowReceive(true);
                                }}
                                sx={{
                                    bgcolor: HIGHLIGHT,
                                    color: 'white',
                                    borderRadius: '14px',
                                    fontWeight: 800,
                                    textTransform: 'none',
                                    py: 1.25,
                                    border: `1px solid ${EDGE}`,
                                    '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743' }
                                }}
                            >
                                Receive
                            </Button>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => {
                                    toast.success('Swap routing feature coming soon');
                                }}
                                sx={{
                                    bgcolor: HIGHLIGHT,
                                    color: 'white',
                                    borderRadius: '14px',
                                    fontWeight: 800,
                                    textTransform: 'none',
                                    py: 1.25,
                                    border: `1px solid ${EDGE}`,
                                    '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743' }
                                }}
                            >
                                Swap
                            </Button>
                        </Stack>

                        {ktsMode ? (
                        <Stack gap={1.5} sx={{ mb: 4 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-satoshi)' }}>
                                Kylrix
                            </Typography>
                            <Paper
                                sx={{
                                    p: 2.75,
                                    px: 3,
                                    borderRadius: '22px',
                                    bgcolor: HIGHLIGHT,
                                    border: `2px solid rgba(99,102,241,0.35)`,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { bgcolor: SURFACE, borderColor: ACCENT, transform: 'translateY(-1px)' },
                                }}
                            >
                                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                                    <Stack direction="row" alignItems="center" gap={2}>
                                        <Box sx={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: '14px',
                                            bgcolor: '#252321',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            lineHeight: 0,
                                        }}>
                                            <Logo app="root" variant="icon" size={28} />
                                        </Box>
                                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                            <Typography variant="body1" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                                                Kylrix
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', display: 'block' }}>
                                                {user?.$id ? shortenUserId(user.$id) : '—'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Stack alignItems="flex-end" gap={0.5}>
                                        <Typography variant="h6" sx={{ fontWeight: 900, color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: '1.05rem', whiteSpace: 'nowrap' }}>
                                            {tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}
                                        </Typography>
                                        {user?.$id ? (
                                            <Stack direction="row" gap={0.5}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleCopyAddress(user.$id)}
                                                    sx={{ p: 0.5, color: MUTED, '&:hover': { color: ACCENT } }}
                                                    aria-label="Copy Kylrix wallet id"
                                                >
                                                    <Copy size={14} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleKylrixCardClick()}
                                                    sx={{ p: 0.5, color: MUTED, '&:hover': { color: 'white' } }}
                                                    aria-label="Open Kylrix ledger"
                                                >
                                                    <PanelRight size={14} />
                                                </IconButton>
                                            </Stack>
                                        ) : null}
                                    </Stack>
                                </Stack>
                            </Paper>
                            <Typography variant="caption" sx={{ color: MUTED, textAlign: 'center', lineHeight: 1.5, px: 1 }}>
                                KTS mode shows your Kylrix ledger balance as the headline total. Turn off the toggle to expose Solana, ETH, and other networks.
                            </Typography>
                        </Stack>
                        ) : (
                        <>
                        {/* Pinned Solana + KYLRIX */}
                        <Stack gap={1.5} sx={{ mb: 4 }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-satoshi)' }}>
                                Pinned Network
                            </Typography>
                            <Paper
                                sx={{
                                    px: 2.25,
                                    py: 1.5,
                                    borderRadius: '18px',
                                    bgcolor: HIGHLIGHT,
                                    border: `1px solid ${EDGE}`,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743', transform: 'translateX(4px)' }
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                    <Box sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: '12px',
                                        bgcolor: '#252321',
                                        display: 'grid',
                                        placeItems: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <PinnedNetworkIconSolana size={20} />
                                    </Box>
                                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                        <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)', fontSize: '0.88rem', lineHeight: 1.25 }}>
                                            {solWallet?.label || 'Solana'}
                                        </Typography>
                                        <Typography component="span" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', lineHeight: 1.35 }}>
                                            {solWallet ? shortenAddress(solWallet.address) : 'Provisioning required'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                                        <Typography component="span" sx={{ fontWeight: 900, color: getNetworkColor('sol'), fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.2 }}>
                                            0.00 {solWallet?.symbol || 'SOL'}
                                        </Typography>
                                        {solWallet ? (
                                            <Stack direction="row" gap={0.5}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleCopyAddress(solWallet.address)}
                                                    sx={{ p: 0.5, color: MUTED, '&:hover': { color: getNetworkColor('sol') } }}
                                                >
                                                    <Copy size={12} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        const explorerUrl = getExplorerUrl(solWallet);
                                                        if (explorerUrl) {
                                                            window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                        }
                                                    }}
                                                    sx={{ p: 0.5, color: MUTED, '&:hover': { color: 'white' } }}
                                                >
                                                    <ExternalLink size={12} />
                                                </IconButton>
                                            </Stack>
                                        ) : (
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                onClick={() => handleAddNetwork('sol')}
                                                disabled={pendingChain !== null}
                                                sx={{
                                                    borderRadius: '8px',
                                                    borderColor: EDGE,
                                                    color: 'white',
                                                    textTransform: 'none',
                                                    fontSize: '0.72rem',
                                                    px: 1.5,
                                                    py: 0.5,
                                                    fontFamily: 'var(--font-satoshi)',
                                                    '&:hover': { bgcolor: HIGHLIGHT, borderColor: '#4A4743' }
                                                }}
                                            >
                                                Add SOL
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                            </Paper>
                            
                            <Paper
                                sx={{
                                    px: 2.25,
                                    py: 1.5,
                                    borderRadius: '18px',
                                    bgcolor: HIGHLIGHT,
                                    border: `1px solid ${EDGE}`,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743', transform: 'translateX(4px)' },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                    <Box sx={{
                                        width: 38,
                                        height: 38,
                                        borderRadius: '12px',
                                        bgcolor: '#252321',
                                        display: 'grid',
                                        placeItems: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Logo app="root" variant="icon" size={20} />
                                    </Box>
                                    <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                        <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)', fontSize: '0.88rem', lineHeight: 1.25 }}>
                                            Kylrix
                                        </Typography>
                                        <Typography component="span" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', lineHeight: 1.35 }}>
                                            {user?.$id ? shortenUserId(user.$id) : '—'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                                        <Typography component="span" sx={{ fontWeight: 900, color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.2 }}>
                                            {tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}
                                        </Typography>
                                        {user?.$id ? (
                                            <Stack direction="row" gap={0.5}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleCopyAddress(user.$id)}
                                                    sx={{ p: 0.5, color: MUTED, '&:hover': { color: ACCENT } }}
                                                    aria-label="Copy Kylrix wallet id"
                                                >
                                                    <Copy size={12} />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleKylrixCardClick()}
                                                    sx={{ p: 0.5, color: MUTED, '&:hover': { color: 'white' } }}
                                                    aria-label="Open Kylrix ledger"
                                                >
                                                    <PanelRight size={12} />
                                                </IconButton>
                                            </Stack>
                                        ) : null}
                                    </Box>
                                </Box>
                            </Paper>
                        </Stack>

                        {/* Other Live Networks */}
                        {orderedWallets.filter(w => w.chain !== 'sol').length > 0 && (
                            <Stack gap={1.5} sx={{ mb: 4 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-satoshi)' }}>
                                    Live Networks
                                </Typography>
                                {orderedWallets.filter(w => w.chain !== 'sol').map((wallet) => (
                                    <Paper
                                        key={wallet.chain}
                                        sx={{
                                            px: 2.25,
                                            py: 1.5,
                                            borderRadius: '18px',
                                            bgcolor: HIGHLIGHT,
                                            border: `1px solid ${EDGE}`,
                                            transition: 'all 0.2s ease',
                                            '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743', transform: 'translateX(4px)' }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                            <Box sx={{ 
                                                width: 32, 
                                                height: 32, 
                                                borderRadius: '8px',
                                                bgcolor: '#252321',
                                                display: 'grid',
                                                placeItems: 'center',
                                                flexShrink: 0,
                                                color: getNetworkColor(wallet.chain),
                                                fontWeight: 800,
                                                fontSize: '14px'
                                            }}>
                                                {getNetworkLogo(wallet.chain)}
                                            </Box>
                                            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.35 }}>
                                                <Typography component="span" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)', fontSize: '0.88rem', lineHeight: 1.25 }}>
                                                    {wallet.label}
                                                </Typography>
                                                <Typography component="span" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', fontSize: '0.76rem', lineHeight: 1.35 }}>
                                                    {shortenAddress(wallet.address)}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                                                <Typography component="span" sx={{ fontWeight: 900, color: getNetworkColor(wallet.chain), fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.2 }}>
                                                    0.00 {wallet.symbol}
                                                </Typography>
                                                <Stack direction="row" gap={0.5}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleCopyAddress(wallet.address)}
                                                        sx={{ p: 0.5, color: MUTED, '&:hover': { color: getNetworkColor(wallet.chain) } }}
                                                    >
                                                        <Copy size={12} />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            const explorerUrl = getExplorerUrl(wallet);
                                                            if (explorerUrl) {
                                                                window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                            }
                                                        }}
                                                        sx={{ p: 0.5, color: MUTED, '&:hover': { color: 'white' } }}
                                                    >
                                                        <ExternalLink size={12} />
                                                    </IconButton>
                                                </Stack>
                                            </Box>
                                        </Box>
                                    </Paper>
                                ))}
                            </Stack>
                        )}

                        {addableNetworks.length > 0 && (
                            <Stack gap={1.5} sx={{ mb: 4 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-satoshi)' }}>
                                    Add Network
                                </Typography>
                                <Stack direction="row" gap={1} flexWrap="wrap">
                                    {addableNetworks.map((chain) => (
                                        <Button
                                            key={chain}
                                            variant="outlined"
                                            startIcon={pendingChain === chain ? <CircularProgress size={14} color="inherit" /> : <Plus size={14} />}
                                            onClick={() => handleAddNetwork(chain)}
                                            disabled={pendingChain !== null}
                                            sx={{
                                                borderRadius: '12px',
                                                borderColor: EDGE,
                                                color: '#D4D4D8',
                                                textTransform: 'none',
                                                fontWeight: 800,
                                                fontFamily: 'var(--font-satoshi)',
                                                '&:hover': { bgcolor: HIGHLIGHT, borderColor: '#4A4743', color: 'white' }
                                            }}
                                        >
                                            {WalletService.networkDefinitions[chain].label}
                                        </Button>
                                    ))}
                                </Stack>
                            </Stack>
                        )}

                        </>
                        )}
                    </Box>
                )}


            </Box>
        );
    };

    const renderHeader = () => {
        const isSubView = showSettings || showSignConfirmation || showKylrixDetail;
        return (
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 1.5, px: 3, pb: 1, borderBottom: isSubView ? `1px solid ${EDGE}` : 'none', flexShrink: 0 }}>
                {isSubView ? (
                    <IconButton 
                        size="small" 
                        onClick={() => {
                            setShowSettings(false);
                            setShowSignConfirmation(false);
                            setShowKylrixDetail(false);
                            setExportedMnemonic(null);
                            setExportedPrivateKey(null);
                        }}
                        sx={{ color: 'white', p: 0.75, '&:hover': { bgcolor: HIGHLIGHT } }}
                        aria-label="Back to main wallet"
                    >
                        <ChevronLeft size={20} />
                    </IconButton>
                ) : (
                    <Box sx={{
                        p: 1,
                        borderRadius: '12px',
                        bgcolor: '#1C1A18',
                        border: `1px solid ${EDGE}`,
                        color: ACCENT,
                        display: 'flex'
                    }}>
                        <WalletIcon size={20} />
                    </Box>
                )}
                <Stack direction="row" alignItems="center" gap={1}>
                    {isUnlocked && !isSubView && (
                        <>
                            <IconButton size="small" onClick={() => setShowKylrixDetail(true)} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                                <History size={18} />
                            </IconButton>
                            <IconButton size="small" onClick={() => setShowSettings(true)} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                                <Settings size={18} />
                            </IconButton>
                        </>
                    )}
                    {isMobile && (
                        <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </IconButton>
                    )}
                    <IconButton onClick={onClose} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                        <X size={20} />
                    </IconButton>
                </Stack>
            </Stack>
        );
    };

    if (isMobile) {
        return (
            <Drawer
                anchor="bottom"
                open={isOpen}
                onClose={onClose}
                slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
                PaperProps={{
                    sx: {
                        height: isExpanded ? '100dvh' : '60dvh',
                        maxHeight: '100dvh',
                        bgcolor: SURFACE,
                        borderTop: isExpanded ? 'none' : `1px solid ${EDGE}`,
                        borderRadius: isExpanded ? '0' : '32px 32px 0 0',
                        backgroundImage: 'none',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden',
                        p: 0,
                        margin: 0,
                        display: 'flex',
                        flexDirection: 'column'
                    }
                }}
            >
                <Box
                    sx={{
                        width: '100%',
                        pt: 2,
                        pb: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0
                    }}
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    {isExpanded ? (
                        <Stack direction="row" alignItems="center" gap={1} sx={{ color: MUTED }}>
                            <ChevronLeft size={20} />
                            <Typography variant="caption" sx={{ fontWeight: 800, textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>Back</Typography>
                        </Stack>
                    ) : (
                        <Box sx={{ width: 40, height: 4, bgcolor: '#4A4743', borderRadius: '2px' }} />
                    )}
                </Box>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    {renderHeader()}
                    {renderWalletContent()}
                </Box>
            </Drawer>
        );
    }

    return (
        <Drawer
            anchor="right"
            open={isOpen}
            onClose={onClose}
            slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
            PaperProps={{
                sx: {
                    width: 400,
                    bgcolor: SURFACE,
                    borderLeft: `1px solid ${EDGE}`,
                    backgroundImage: 'none',
                    boxShadow: 'none',
                    top: '88px',
                    height: 'calc(100dvh - 88px)',
                    p: 0,
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                {renderHeader()}
                {renderWalletContent()}
            </Box>
        </Drawer>
    );
};
