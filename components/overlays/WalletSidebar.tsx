"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Drawer,
    Stack,
    Button,
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
    ArrowDownLeft,
    QrCode,
    Download} from 'lucide-react';
import { QRCodeCanvas } from './QRCodeCanvas';
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
} from './wallet-sidebar-utils';
import { shortenUserId } from '@/sdk/identity';
import { PinnedNetworkIconSolana } from './PinnedNetworkIconSolana';
import { WALLET_SURFACE as SURFACE, WALLET_HIGHLIGHT as HIGHLIGHT, WALLET_EDGE as EDGE, WALLET_MUTED as MUTED, WALLET_ACCENT as ACCENT } from './wallet-theme';
import { WalletSignConfirmation } from './WalletSignConfirmation';
import { WalletSettingsPanel } from './WalletSettingsPanel';
import { getNetworkLogo, getNetworkColor } from './wallet-network';
import Logo from '@/components/Logo';
import { createPublicClient, http, formatEther } from 'viem';
import { mainnet, base, arbitrum, polygon } from 'viem/chains';
import { renderWalletContent as renderWalletContent_ext } from './WalletSidebarSections/renderWalletContent';
import { renderSendView as renderSendView_ext } from './WalletSidebarSections/renderSendView';
import { renderReceiveView as renderReceiveView_ext } from './WalletSidebarSections/renderReceiveView';
import { renderHistoryView as renderHistoryView_ext } from './WalletSidebarSections/renderHistoryView';
import { renderReceiveDrawer as renderReceiveDrawer_ext } from './WalletSidebarSections/renderReceiveDrawer';



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
    const [activeSubView, setActiveSubView] = useState<'dashboard' | 'send' | 'receive' | 'history' | 'settings' | 'sign'>('dashboard');
    const [receiveModalData, setReceiveModalData] = useState<{
        token: string;
        chainName: string;
        address: string;
        color?: string;
    } | null>(null);
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
        if (activeSubView !== 'history' || !user?.$id) return undefined;
        void loadLedgerHistory();
        return undefined;
    }, [activeSubView, user?.$id, loadLedgerHistory]);

    useEffect(() => {
        if (!isOpen || activeSubView !== 'history' || !user?.$id) return undefined;
        const onEarn = () => {
            void loadLedgerHistory();
        };
        window.addEventListener('kylrix:token-event', onEarn);
        return () => window.removeEventListener('kylrix:token-event', onEarn);
    }, [isOpen, activeSubView, user?.$id, loadLedgerHistory]);

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
        setActiveSubView('send');
        setKylrixIntentRecipient(tokenIntent.toUser || null);
        onConsumeTokenIntent?.();
    }, [isOpen, onConsumeTokenIntent, tokenIntent]);

    useEffect(() => {
        if (!isOpen) {
            setActiveSubView('dashboard');
            setReceiveModalData(null);
            setKylrixSendAmount('');
            setKylrixIntentRecipient(null);
            setLedgerHistoryRows([]);
            setLedgerHistoryError(null);
            setLedgerHistoryLoading(false);
        }
    }, [isOpen]);

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

    const renderSendView = (..._args: any[]) => renderSendView_ext({ renderHistoryView, renderReceiveDrawer, renderReceiveView, renderSendView, renderWalletContent });

    const renderReceiveView = (..._args: any[]) => renderReceiveView_ext({ renderHistoryView, renderReceiveDrawer, renderReceiveView, renderSendView, renderWalletContent });

    const renderHistoryView = (..._args: any[]) => renderHistoryView_ext({ renderHistoryView, renderReceiveDrawer, renderReceiveView, renderSendView, renderWalletContent });

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



    const renderWalletContent = (..._args: any[]) => renderWalletContent_ext({ renderHistoryView, renderReceiveDrawer, renderReceiveView, renderSendView, renderWalletContent });

    const renderHeader = () => {
        const isSubView = activeSubView !== 'dashboard';
        const subViewTitles: Record<string, string> = {
            'send': 'Send Asset',
            'receive': 'Deposit / Receive',
            'history': 'Ledger History',
            'settings': 'Wallet Settings',
            'sign': 'Authorize Request'
        };

        return (
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ pt: 2, px: { xs: 2.5, md: 3 }, pb: 1.5, borderBottom: isSubView ? `1px solid ${EDGE}` : 'none', flexShrink: 0 }}>
                {isSubView ? (
                    <Stack direction="row" alignItems="center" gap={1.25}>
                        <IconButton 
                            size="small" 
                            onClick={() => {
                                setActiveSubView('dashboard');
                                setExportedMnemonic(null);
                                setExportedPrivateKey(null);
                            }}
                            sx={{ color: 'white', p: 0.75, '&:hover': { bgcolor: HIGHLIGHT } }}
                            aria-label="Back to main wallet"
                        >
                            <ChevronLeft size={20} />
                        </IconButton>
                        <Typography sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)', fontSize: '0.95rem' }}>
                            {subViewTitles[activeSubView] || 'Wallet'}
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
                            <IconButton size="small" onClick={() => setActiveSubView('history')} title="Activity History" sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                                <History size={18} />
                            </IconButton>
                            <IconButton size="small" onClick={() => setActiveSubView('settings')} title="Settings" sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
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

    const renderReceiveDrawer = (..._args: any[]) => renderReceiveDrawer_ext({ renderHistoryView, renderReceiveDrawer, renderReceiveView, renderSendView, renderWalletContent });

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
                {renderReceiveDrawer()}
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
                {renderReceiveDrawer()}
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
            {renderReceiveDrawer()}
        </>
    );
};

