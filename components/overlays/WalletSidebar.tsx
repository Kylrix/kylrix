"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
    Paper} from '@/lib/openbricks/primitives';
import {
    X,
    Wallet as WalletIcon,
    ChevronLeft,
    ChevronDown,
    Lock,
    Fingerprint,
    Copy,
    ExternalLink,
    PanelRight,
    Plus,
    History,
    Settings,
    Maximize2,
    Minimize2,
    ArrowUpRight,
    ArrowDownLeft} from 'lucide-react';
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
import {
    shortenAddress,
    KTS_STORAGE_KEY,
    kylrixTicker,
    formatLedgerDelta,
    formatLedgerBalanceAfter,
    describeLedgerRow,
    formatLedgerWhen,
    ledgerRowKey,
    shortenUserId,
} from './wallet-sidebar-utils';
import { PinnedNetworkIconSolana } from './PinnedNetworkIconSolana';
import { WALLET_SURFACE as SURFACE, WALLET_HIGHLIGHT as HIGHLIGHT, WALLET_EDGE as EDGE, WALLET_MUTED as MUTED, WALLET_ACCENT as ACCENT } from './wallet-theme';
import { WalletSignConfirmation } from './WalletSignConfirmation';
import { WalletSettingsPanel } from './WalletSettingsPanel';
import { getNetworkLogo, getNetworkColor } from './wallet-network';
import Logo from '@/components/Logo';
import { createPublicClient, http, formatEther } from 'viem';
import { mainnet, base, arbitrum, polygon } from 'viem/chains';


interface WalletSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    tokenIntent?: TokenWalletIntent | null;
    onConsumeTokenIntent?: () => void;
    /** Fill native right rail — no floating Drawer chrome */
    embedded?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}


export const WalletSidebar = ({
    isOpen,
    onClose,
    tokenIntent = null,
    onConsumeTokenIntent,
    embedded = false,
    isExpanded: propIsExpanded,
    onToggleExpand,
}: WalletSidebarProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user } = useAuth();
    const { tokenBalance, wallets, refreshBalances } = useSubscription();
    
    const { requestSudo } = useSudo();
    
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [internalExpanded, setInternalExpanded] = useState(false);
    const isExpanded = propIsExpanded !== undefined ? propIsExpanded : internalExpanded;
    const setIsExpanded = (val: boolean | ((prev: boolean) => boolean)) => {
        if (onToggleExpand) {
            onToggleExpand();
        } else {
            setInternalExpanded(val);
        }
    };
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
    const [onChainBalances, setOnChainBalances] = useState<Record<string, string>>({});
    const [_balancesLoading, setBalancesLoading] = useState(false);
    const [pinnedToken, setPinnedToken] = useState<string>('SOL');
    const [longPressedToken, setLongPressedToken] = useState<string | null>(null);
    const pressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    
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
            setPinnedToken(localStorage.getItem('kylrix_pinned_token') || 'SOL');
        }
    }, []);

    const fetchBalanceForChain = async (chain: string, address: string): Promise<string> => {
        try {
            if (['eth', 'base', 'arbitrum', 'polygon'].includes(chain)) {
                const chainConfigMap: Record<string, any> = {
                    eth: { config: mainnet, rpc: 'https://cloudflare-eth.com' },
                    base: { config: base, rpc: 'https://mainnet.base.org' },
                    arbitrum: { config: arbitrum, rpc: 'https://arb1.arbitrum.io/rpc' },
                    polygon: { config: polygon, rpc: 'https://polygon-rpc.com' }
                };
                const mapping = chainConfigMap[chain];
                if (!mapping) return '0.0000';
                
                const client = createPublicClient({
                    chain: mapping.config,
                    transport: http(mapping.rpc)
                });
                const balance = await client.getBalance({ address: address as `0x${string}` });
                return parseFloat(formatEther(balance)).toFixed(4);
            }
            if (chain === 'sol') {
                const res = await fetch('https://api.mainnet-beta.solana.com', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getBalance',
                        params: [address]
                    })
                });
                const json = await res.json();
                const lamports = json?.result?.value || 0;
                return (lamports / 1e9).toFixed(4);
            }
            if (chain === 'sui') {
                const res = await fetch('https://fullnode.mainnet.sui.io', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'suix_getBalance',
                        params: [address]
                    })
                });
                const json = await res.json();
                const balanceMs = json?.result?.totalBalance || 0;
                return (balanceMs / 1e9).toFixed(4);
            }
            return '0.0000';
        } catch (err) {
            console.warn(`[WalletSidebar] Failed to fetch balance for ${chain}:`, err);
            return '0.0000';
        }
    };

    useEffect(() => {
        if (!isOpen || !user?.$id || wallets.length === 0) return;
        
        const loadAllBalances = async () => {
            setBalancesLoading(true);
            const balances: Record<string, string> = {};
            await Promise.all(
                wallets.map(async (wallet) => {
                    const bal = await fetchBalanceForChain(wallet.chain, wallet.address);
                    balances[wallet.chain.toUpperCase()] = bal;
                })
            );
            setOnChainBalances(balances);
            setBalancesLoading(false);
        };
        
        void loadAllBalances();
    }, [isOpen, user?.$id, wallets]);

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
                    if (prefs.kylrix_pinned_token) {
                        setPinnedToken(prefs.kylrix_pinned_token);
                        localStorage.setItem('kylrix_pinned_token', prefs.kylrix_pinned_token);
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
            auto: true,
            intent: 'unlock',
            onSuccess: async () => {
                toast.success('Wallet unlocked');
                await refreshWallets();
            },
            onCancel: () => {
                toast('Wallet remains locked');
            }});
    }, [hasMasterpass, isOpen, refreshWallets, requestSudo, unlockPromptedForSession]);

    useEffect(() => {
        if (isOpen && hasMasterpass === false) {
            requestSudo({
                auto: true,
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

    const tokenToChain = (token: string): SupportedWalletChain => {
        const map: Record<string, SupportedWalletChain> = {
            'sol': 'sol',
            'solana': 'sol',
            'btc': 'btc',
            'bitcoin': 'btc',
            'eth': 'eth',
            'ethereum': 'eth',
            'usdc': 'usdc',
            'base': 'base',
            'polygon': 'polygon',
            'pol': 'polygon',
            'sui': 'sui',
            'arbitrum': 'arbitrum',
            'arb': 'arbitrum',
            'kylrix': 'sol'
        };
        return map[token.toLowerCase()] || (token.toLowerCase() as SupportedWalletChain);
    };

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address);
        toast.success('Address copied');
    };

    const handlePinToken = async (token: string) => {
        const isCurrentPin = pinnedToken === token;
        const targetToken = isCurrentPin ? 'SOL' : token;
        
        setPinnedToken(targetToken);
        if (typeof window !== 'undefined') {
            localStorage.setItem('kylrix_pinned_token', targetToken);
            toast.success(isCurrentPin ? `${token} unpinned from dashboard` : `${token} pinned to dashboard`);
        }
        if (user) {
            await account.updatePrefs({ kylrix_pinned_token: targetToken }).catch(() => {});
        }
        setLongPressedToken(null);
    };

    const handlePressStart = (token: string) => {
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => {
            setLongPressedToken(token);
        }, 600);
    };

    const handlePressEnd = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
        }
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
            prefilledAmount: kylrixSendAmount});
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
            'SOL': onChainBalances['SOL'] || '0.0000',
            'ETH': onChainBalances['ETH'] || '0.0000',
            'USDC': onChainBalances['USDC'] || '0.0000',
            'BTC': onChainBalances['BTC'] || '0.0000',
            'SUI': onChainBalances['SUI'] || '0.0000',
            'BASE': onChainBalances['BASE'] || '0.0000',
            'POLYGON': onChainBalances['POLYGON'] || '0.0000',
            'ARBITRUM': onChainBalances['ARBITRUM'] || '0.0000'
        };

        return (
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 space-y-4">
                <div className="text-base font-extrabold font-clash text-white tracking-tight">
                    Kylrix Activity & Transfer
                </div>
                <div className="p-4 rounded-2xl bg-[#161412] border border-white/[0.08] space-y-1">
                    <div className="text-xs text-white/50 font-satoshi">
                        {selectedToken} Balance
                    </div>
                    <div
                        className="text-2xl font-black font-mono tracking-tight"
                        style={{ color: selectedToken === 'KYLRIX' ? ACCENT : getNetworkColor(selectedToken.toLowerCase() as any) || 'white' }}
                    >
                        {tokenBalancesMap[selectedToken]} {selectedToken}
                    </div>
                </div>
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
                        minWidth: 0}}
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

            {/* Bottom Drawer Token Selector (Z-Index above the main Wallet Drawer) */}
            <Drawer
                anchor="bottom"
                open={showTokenSelector}
                onClose={() => setShowTokenSelector(false)}
                PaperProps={{
                    sx: {
                        bgcolor: SURFACE,
                        borderTop: `1px solid ${EDGE}`,
                        borderRadius: '32px 32px 0 0',
                        backgroundImage: 'none',
                        p: 3,
                        maxHeight: '60dvh',
                        zIndex: 1500,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2.5
                    }
                }}
                ModalProps={{
                    sx: {
                        zIndex: 1490
                    }
                }}
            >
                {/* Drawer handle indicator */}
                <Box sx={{ width: 40, height: 4, bgcolor: '#4A4743', borderRadius: '2px', alignSelf: 'center', mb: 1 }} />
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white' }}>
                        Select Token
                    </Typography>
                    <IconButton size="small" onClick={() => setShowTokenSelector(false)} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                        <X size={20} />
                    </IconButton>
                </Box>

                <Stack gap={1.25} sx={{ overflowY: 'auto', maxHeight: '40dvh', pr: 0.5, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' } }}>
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
                                px: 2.25,
                                py: 1.5,
                                borderRadius: '18px',
                                cursor: 'pointer',
                                bgcolor: selectedToken === token ? HIGHLIGHT : '#161412',
                                border: `1px solid ${EDGE}`,
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: '#4A4743', bgcolor: HIGHLIGHT }
                            }}
                        >
                            <Stack direction="row" alignItems="center" gap={1.5}>
                                <Box sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '8px',
                                    bgcolor: '#252321',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 800,
                                    fontSize: '12px',
                                    color: getNetworkColor(token.toLowerCase() as any) || ACCENT,
                                    flexShrink: 0
                                }}>
                                    {token === 'KYLRIX' ? 'K' : getNetworkLogo(token.toLowerCase() as any) || token[0]}
                                </Box>
                                <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.88rem', fontFamily: 'var(--font-satoshi)' }}>
                                    {token}
                                </Typography>
                            </Stack>
                            <Typography sx={{ color: MUTED, fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                                {tokenBalancesMap[token]}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            </Drawer>
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



    const renderWalletContent = () => {
        const pinnedWallet = pinnedToken === 'KYLRIX' || pinnedToken === 'SOL'
            ? null 
            : orderedWallets.find((wallet) => wallet.chain === tokenToChain(pinnedToken)) || null;

        if (showSignConfirmation) {
            return (
                <WalletSignConfirmation
                    signDestination={signDestination}
                    signMessageText={signMessageText}
                    signConfirmLoading={signConfirmLoading}
                    onCancel={() => setShowSignConfirmation(false)}
                    onConfirm={handleConfirmSignature}
                />
            );
        }
        if (showSettings) {
            return (
                <WalletSettingsPanel
                    ktsMode={ktsMode}
                    setKtsModeState={setKtsModeState}
                    testnetMode={testnetMode}
                    handleToggleTestnet={handleToggleTestnet}
                    smartDelegation={smartDelegation}
                    handleToggleSmartDelegation={handleToggleSmartDelegation}
                    gasRelay={gasRelay}
                    handleToggleGasRelay={handleToggleGasRelay}
                    recurringBilling={recurringBilling}
                    handleToggleRecurringBilling={handleToggleRecurringBilling}
                    handleExportSecrets={handleExportSecrets}
                    exportedMnemonic={exportedMnemonic}
                    exportedPrivateKey={exportedPrivateKey}
                    setExportedMnemonic={setExportedMnemonic}
                    setExportedPrivateKey={setExportedPrivateKey}
                    setShowSettings={setShowSettings}
                    triggerTestSignature={triggerTestSignature}
                />
            );
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
                            position: 'relative',
                            width: 68,
                            height: 68,
                            borderRadius: '22px',
                            bgcolor: SURFACE,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 3,
                            border: `1px solid ${EDGE}`,
                            color: ACCENT
                        }}>
                            <Fingerprint size={34} strokeWidth={1.75} />
                            <Box sx={{
                                position: 'absolute',
                                bottom: -2,
                                right: -2,
                                width: 22,
                                height: 22,
                                borderRadius: '8px',
                                bgcolor: '#1C1A18',
                                border: `1px solid ${EDGE}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.5)'
                            }}>
                                <Lock size={11} />
                            </Box>
                        </Box>
                        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Wallet is Locked
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, mb: 4, maxWidth: 240, fontFamily: 'var(--font-satoshi)' }}>
                            Click to unlock with your passkey or MasterPass to view balances and sign actions.
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
                    <div className="flex-1 overflow-y-auto px-4 py-4 md:px-5 md:py-5 space-y-5">
                        {/* OpenBricks Modern Balance Card */}
                        <div className="p-5 rounded-2xl bg-[#161412] border border-white/[0.08] flex flex-col gap-4 shadow-sm">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-white/50 font-satoshi">
                                        {ktsMode ? 'Kylrix Ledger Balance' : 'Estimated Portfolio'}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-md bg-[#0A0908] border border-white/[0.06] text-[10px] font-mono text-white/60">
                                        {ktsMode ? 'KTS Mode' : `${wallets.length} Networks`}
                                    </span>
                                </div>
                                <div className="text-3xl md:text-4xl font-extrabold font-clash text-white tracking-tight leading-normal py-1">
                                    {ktsMode ? (
                                        <div className="flex items-baseline gap-2">
                                            <span>{tokenBalance?.amount || '0'}</span>
                                            <span className="text-[#6366F1] font-mono text-2xl font-bold">{kylrixTicker(tokenBalance?.symbol)}</span>
                                        </div>
                                    ) : (
                                        <div>
                                            <div>$0.00</div>
                                            <div className="mt-2 flex items-center gap-2 text-sm font-mono font-medium text-white/60">
                                                <span>{tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}</span>
                                                <span className="text-[11px] text-white/40 font-satoshi px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.04]">Ledger</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tactile Action Grid */}
                            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/[0.06]">
                                <button
                                    type="button"
                                    onClick={() => setShowKylrixDetail(true)}
                                    className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-[#0A0908] border border-white/[0.06] hover:border-white/20 transition-all text-white active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#161412] border border-white/[0.04] flex items-center justify-center text-white/80">
                                        <ArrowUpRight size={16} />
                                    </div>
                                    <span className="text-xs font-bold font-satoshi">Send</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowKylrixDetail(true);
                                        setShowReceive(true);
                                    }}
                                    className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-[#0A0908] border border-white/[0.06] hover:border-white/20 transition-all text-white active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#161412] border border-white/[0.04] flex items-center justify-center text-white/80">
                                        <ArrowDownLeft size={16} />
                                    </div>
                                    <span className="text-xs font-bold font-satoshi">Receive</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        toast.success('Cross-chain swap router active soon');
                                    }}
                                    className="flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl bg-[#0A0908] border border-white/[0.06] hover:border-white/20 transition-all text-white/70 hover:text-white active:scale-[0.98] cursor-pointer"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#161412] border border-white/[0.04] flex items-center justify-center text-white/60">
                                        <Plus size={16} />
                                    </div>
                                    <span className="text-xs font-bold font-satoshi">Swap</span>
                                </button>
                            </div>
                        </div>

                        {ktsMode ? (
                        <div className="space-y-2.5 mb-4">
                            <span className="text-[11px] font-extrabold text-[#6366F1] uppercase tracking-wider font-satoshi block">
                                Kylrix
                            </span>
                            <div className="p-4 rounded-2xl bg-[#161412] border border-[#6366F1]/30 hover:border-[#6366F1] transition-all">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0">
                                            <Logo app="root" variant="icon" size={22} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-extrabold text-white font-satoshi truncate">
                                                Kylrix
                                            </div>
                                            <div className="text-xs font-mono text-white/40 truncate">
                                                {user?.$id ? shortenUserId(user.$id) : '—'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 pl-2">
                                        <div className="text-sm font-extrabold text-[#6366F1] font-mono whitespace-nowrap">
                                            {tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}
                                        </div>
                                        {user?.$id ? (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyAddress(user.$id)}
                                                    className="p-1 rounded text-white/40 hover:text-[#6366F1] transition-colors cursor-pointer"
                                                    aria-label="Copy Kylrix wallet id"
                                                >
                                                    <Copy size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleKylrixCardClick()}
                                                    className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    aria-label="Open Kylrix ledger"
                                                >
                                                    <PanelRight size={13} />
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            <p className="text-xs text-white/40 text-center leading-relaxed px-2 font-satoshi">
                                KTS mode shows your Kylrix ledger balance as the headline total. Turn off the toggle to expose Solana, ETH, and other networks.
                            </p>
                        </div>
                        ) : (
                        <>
                            {/* Pinned Solana + KYLRIX */}
                            <div className="space-y-3 mb-4">
                                <span className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider font-satoshi block">
                                    Pinned Networks
                                </span>
                                
                                {/* 1. Kylrix Card (Always Visible, Default Pinned) */}
                                <div
                                    onMouseDown={() => handlePressStart('KYLRIX')}
                                    onMouseUp={handlePressEnd}
                                    onMouseLeave={handlePressEnd}
                                    onTouchStart={() => handlePressStart('KYLRIX')}
                                    onTouchEnd={handlePressEnd}
                                    className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm"
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0">
                                            <Logo app="root" variant="icon" size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                            <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                Kylrix
                                            </span>
                                            <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                {user?.$id ? shortenUserId(user.$id) : '—'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                            <span className="font-extrabold text-[#6366F1] font-mono text-xs leading-tight whitespace-nowrap">
                                                {tokenBalance?.amount || '0'} {kylrixTicker(tokenBalance?.symbol)}
                                            </span>
                                            {user?.$id ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleCopyAddress(user.$id); }}
                                                        className="p-1 rounded text-white/40 hover:text-[#6366F1] transition-colors cursor-pointer"
                                                        aria-label="Copy Kylrix wallet id"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleKylrixCardClick(); }}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                        aria-label="Open Kylrix ledger"
                                                    >
                                                        <PanelRight size={13} />
                                                    </button>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {/* 2. Solana Card (Always Visible, Default Pinned) */}
                                <div
                                    onMouseDown={() => handlePressStart('SOL')}
                                    onMouseUp={handlePressEnd}
                                    onMouseLeave={handlePressEnd}
                                    onTouchStart={() => handlePressStart('SOL')}
                                    onTouchEnd={handlePressEnd}
                                    className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm"
                                >
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0">
                                            <PinnedNetworkIconSolana size={20} />
                                        </div>
                                        <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                            <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                {solWallet?.label || 'Solana'}
                                            </span>
                                            <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                {solWallet ? shortenAddress(solWallet.address) : 'Auto-provisioning'}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                            <span className="font-extrabold text-[#14F195] font-mono text-xs leading-tight whitespace-nowrap">
                                                {onChainBalances['SOL'] || '0.00'} SOL
                                            </span>
                                            {solWallet ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleCopyAddress(solWallet.address); }}
                                                        className="p-1 rounded text-white/40 hover:text-[#14F195] transition-colors cursor-pointer"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const explorerUrl = getExplorerUrl(solWallet);
                                                            if (explorerUrl) {
                                                                window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                            }
                                                        }}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); handleAddNetwork('sol'); }}
                                                    disabled={pendingChain !== null}
                                                    className="px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/25 bg-[#0A0908] text-white font-satoshi text-xs font-semibold transition-all cursor-pointer"
                                                >
                                                    Add SOL
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 3. Custom Pinned Card (Rendered if pinnedToken is not KYLRIX and not SOL) */}
                                {pinnedToken !== 'KYLRIX' && pinnedToken !== 'SOL' && (
                                    <div
                                        onMouseDown={() => handlePressStart(pinnedToken)}
                                        onMouseUp={handlePressEnd}
                                        onMouseLeave={handlePressEnd}
                                        onTouchStart={() => handlePressStart(pinnedToken)}
                                        onTouchEnd={handlePressEnd}
                                        className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm"
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <div
                                                className="w-10 h-10 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0 font-extrabold text-sm"
                                                style={{ color: getNetworkColor(tokenToChain(pinnedToken)) || ACCENT }}
                                            >
                                                {getNetworkLogo(tokenToChain(pinnedToken)) || pinnedToken[0]}
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                                <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                    {pinnedWallet?.label || pinnedToken}
                                                </span>
                                                <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                    {pinnedWallet ? shortenAddress(pinnedWallet.address) : 'Provisioning required'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                                <span
                                                    className="font-extrabold font-mono text-xs leading-tight whitespace-nowrap"
                                                    style={{ color: getNetworkColor(tokenToChain(pinnedToken)) || 'white' }}
                                                >
                                                    {onChainBalances[pinnedToken.toUpperCase()] || '0.00'} {pinnedToken}
                                                </span>
                                                {pinnedWallet ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleCopyAddress(pinnedWallet.address); }}
                                                            className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                        >
                                                            <Copy size={13} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const explorerUrl = getExplorerUrl(pinnedWallet);
                                                                if (explorerUrl) {
                                                                    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                                }
                                                            }}
                                                            className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                        >
                                                            <ExternalLink size={13} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleAddNetwork(tokenToChain(pinnedToken)); }}
                                                        disabled={pendingChain !== null}
                                                        className="px-2.5 py-1 rounded-lg border border-white/10 hover:border-white/25 bg-[#0A0908] text-white font-satoshi text-xs font-semibold transition-all cursor-pointer"
                                                    >
                                                        Add {pinnedToken}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        {/* Other Live Networks */}
                        {orderedWallets.filter(w => w.chain !== 'sol').length > 0 && (
                            <div className="space-y-3 mb-4">
                                <span className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider font-satoshi block">
                                    Live Networks
                                </span>
                                {orderedWallets.filter(w => w.chain !== 'sol').map((wallet) => (
                                    <div
                                        key={wallet.chain}
                                        onMouseDown={() => handlePressStart(wallet.symbol)}
                                        onMouseUp={handlePressEnd}
                                        onMouseLeave={handlePressEnd}
                                        onTouchStart={() => handlePressStart(wallet.symbol)}
                                        onTouchEnd={handlePressEnd}
                                        className="p-3.5 rounded-2xl bg-[#161412] border border-white/[0.08] hover:border-white/20 transition-all cursor-pointer shadow-sm"
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <div
                                                className="w-9 h-9 rounded-xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-center shrink-0 font-extrabold text-sm"
                                                style={{ color: getNetworkColor(wallet.chain) }}
                                            >
                                                {getNetworkLogo(wallet.chain)}
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col gap-0.5 pr-2">
                                                <span className="font-extrabold text-white font-satoshi text-sm leading-tight truncate">
                                                    {wallet.label}
                                                </span>
                                                <span className="text-xs text-white/40 font-mono leading-tight truncate">
                                                    {shortenAddress(wallet.address)}
                                                </span>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0 pl-1">
                                                <span
                                                    className="font-extrabold font-mono text-xs leading-tight whitespace-nowrap"
                                                    style={{ color: getNetworkColor(wallet.chain) }}
                                                >
                                                    {onChainBalances[wallet.chain.toUpperCase()] || '0.00'} {wallet.symbol}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyAddress(wallet.address)}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const explorerUrl = getExplorerUrl(wallet);
                                                            if (explorerUrl) {
                                                                window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                                                            }
                                                        }}
                                                        className="p-1 rounded text-white/40 hover:text-white transition-colors cursor-pointer"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {addableNetworks.length > 0 && (
                            <div className="space-y-3 mb-6">
                                <span className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider font-satoshi block">
                                    Add Network
                                </span>
                                <div className="flex flex-wrap gap-2">
                                    {addableNetworks.map((chain) => (
                                        <button
                                            key={chain}
                                            type="button"
                                            onClick={() => handleAddNetwork(chain)}
                                            disabled={pendingChain !== null}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/25 bg-[#161412] text-white/80 hover:text-white font-satoshi text-xs font-bold transition-all cursor-pointer"
                                        >
                                            {pendingChain === chain ? (
                                                <CircularProgress size={13} color="inherit" />
                                            ) : (
                                                <Plus size={13} />
                                            )}
                                            <span>{WalletService.networkDefinitions[chain].label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        </>
                        )}
                    </div>
                )}


            </Box>
        );
    };

    const renderHeader = () => {
        const isSubView = showSettings || showSignConfirmation || showKylrixDetail;
        return (
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 2, px: { xs: 2.5, md: 3 }, pb: 1.5, borderBottom: isSubView ? `1px solid ${EDGE}` : 'none', flexShrink: 0 }}>
                {isSubView ? (
                    <Stack direction="row" alignItems="center" gap={1.25}>
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
                        <Typography sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)', fontSize: '0.95rem' }}>
                            {showSettings ? 'Wallet Settings' : showSignConfirmation ? 'Authorize Request' : 'Kylrix Activity'}
                        </Typography>
                    </Stack>
                ) : (
                    <Stack direction="row" alignItems="center" gap={1.5}>
                        <Box sx={{
                            p: 1,
                            borderRadius: '12px',
                            bgcolor: '#1C1A18',
                            border: `1px solid ${EDGE}`,
                            color: ACCENT,
                            display: 'flex'
                        }}>
                            <WalletIcon size={18} />
                        </Box>
                        <Box>
                            <Typography sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)', fontSize: '1rem', lineHeight: 1.2 }}>
                                Wallet
                            </Typography>
                            <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
                                {user?.$id ? shortenUserId(user.$id) : 'Decentralized Vault'}
                            </Typography>
                        </Box>
                    </Stack>
                )}
                <Stack direction="row" alignItems="center" gap={0.75}>
                    {isUnlocked && !isSubView && (
                        <>
                            <IconButton size="small" onClick={() => setShowKylrixDetail(true)} title="Activity" sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                                <History size={18} />
                            </IconButton>
                            <IconButton size="small" onClick={() => setShowSettings(true)} title="Settings" sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                                <Settings size={18} />
                            </IconButton>
                        </>
                    )}
                    {isMobile && !isSubView && (
                        <IconButton 
                            size="small" 
                            onClick={() => setIsExpanded(!isExpanded)} 
                            title={isExpanded ? "Collapse to bottom" : "Expand to fullscreen"}
                            sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}
                        >
                            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </IconButton>
                    )}
                    <IconButton onClick={onClose} aria-label="Close wallet" sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                        <X size={18} />
                    </IconButton>
                </Stack>
            </Stack>
        );
    };

    const renderPinDrawer = () => (
        <Drawer
            anchor="bottom"
            open={longPressedToken !== null}
            onClose={() => setLongPressedToken(null)}
            PaperProps={{
                sx: {
                    bgcolor: SURFACE,
                    borderTop: `1px solid ${EDGE}`,
                    borderRadius: '32px 32px 0 0',
                    backgroundImage: 'none',
                    p: 3,
                    maxHeight: '40dvh',
                    zIndex: 1600,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2.5
                }
            }}
            ModalProps={{
                sx: {
                    zIndex: 1590
                }
            }}
        >
            <Box sx={{ width: 40, height: 4, bgcolor: '#3E3B37', borderRadius: '2px', alignSelf: 'center', mb: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography sx={{ color: MUTED, fontSize: '0.72rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)', mb: 0.5 }}>
                        Dashboard Settings
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', fontSize: '1.2rem', lineHeight: 1.1 }}>
                        Manage {longPressedToken}
                    </Typography>
                </Box>
                <IconButton size="small" onClick={() => setLongPressedToken(null)} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                    <X size={20} />
                </IconButton>
            </Box>
            <Stack gap={1.5}>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={() => longPressedToken && handlePinToken(longPressedToken)}
                    sx={{
                        bgcolor: pinnedToken === longPressedToken ? '#b91c1c' : ACCENT,
                        color: pinnedToken === longPressedToken ? 'white' : 'black',
                        borderRadius: '14px',
                        fontWeight: 800,
                        textTransform: 'none',
                        py: 1.5,
                        '&:hover': { bgcolor: pinnedToken === longPressedToken ? '#991b1b' : '#eab308' }
                    }}
                >
                    {pinnedToken === longPressedToken ? `Unpin ${longPressedToken} from Dashboard` : `Pin ${longPressedToken} to Dashboard`}
                </Button>
                <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => setLongPressedToken(null)}
                    sx={{
                        borderColor: EDGE,
                        color: 'white',
                        borderRadius: '14px',
                        fontWeight: 700,
                        textTransform: 'none',
                        py: 1.5,
                        '&:hover': { bgcolor: HIGHLIGHT }
                    }}
                >
                    Cancel
                </Button>
            </Stack>
        </Drawer>
    );

    if (embedded) {
        if (!isOpen) return null;
        return (
            <Box
                sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    minHeight: 0,
                    bgcolor: SURFACE,
                }}
            >
                {isMobile && (
                    <Box
                        sx={{
                            width: '100%',
                            pt: 1.5,
                            pb: 0.5,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <Stack direction="row" alignItems="center" gap={0.5} sx={{ color: MUTED, opacity: 0.75, '&:hover': { opacity: 1 } }}>
                            <Box sx={{ width: 36, height: 4, bgcolor: '#4A4743', borderRadius: '2px' }} />
                        </Stack>
                    </Box>
                )}
                {renderHeader()}
                {renderWalletContent()}
                {renderPinDrawer()}
            </Box>
        );
    }

    if (isMobile) {
        return (
            <>
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
                {renderPinDrawer()}
            </>
        );
    }

    return (
        <>
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
            {renderPinDrawer()}
        </>
    );
};

