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
    Paper,
} from '@mui/material';
import {
    X,
    Wallet as WalletIcon,
    ChevronLeft,
    Lock,
    Unlock,
    Copy,
    ExternalLink,
    Plus,
    History,
    Settings,
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useSudo } from '@/context/SudoContext';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { toast } from 'react-hot-toast';
import { WalletService, type SupportedWalletChain, type WalletSummary } from '@/lib/services/wallets';
import { createKylrixTokenOperationsClient } from '@/lib/sdk/token';
import { KeychainService } from '@/lib/appwrite/keychain';
import { useTokenOps } from '@/context/TokenOpsContext';
import type { TokenWalletIntent } from '@/context/WalletOverlayContext';

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

export const WalletSidebar = ({ isOpen, onClose, tokenIntent = null, onConsumeTokenIntent }: WalletSidebarProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { user } = useAuth();
    
    const { requestSudo } = useSudo();
    
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);
    const [wallets, setWallets] = useState<WalletSummary[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loadingLabel, setLoadingLabel] = useState('Preparing your secure wallet...');
    const [pendingChain, setPendingChain] = useState<SupportedWalletChain | null>(null);
    const [unlockPromptedForSession, setUnlockPromptedForSession] = useState(false);
    const [kylrixBalance, setKylrixBalance] = useState<{ amount: string; symbol: string } | null>(null);
    const { openTokenUserSearch } = useTokenOps();
    const [showKylrixDetail, setShowKylrixDetail] = useState(false);
    const [showReceive, setShowReceive] = useState(false);
    const [kylrixSendAmount, setKylrixSendAmount] = useState('');
    const [kylrixIntentRecipient, setKylrixIntentRecipient] = useState<{ id: string; username: string; displayName: string } | null>(null);

    const ACCENT = '#6366F1';
    const SURFACE = '#161412';
    const HIGHLIGHT = '#1C1A18';
    const EDGE = '#34322F';
    const MUTED = '#9B9691';

    useEffect(() => {
        const interval = setInterval(() => {
            if (ecosystemSecurity.status.isUnlocked !== isUnlocked) {
                setIsUnlocked(ecosystemSecurity.status.isUnlocked);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isUnlocked]);

    const refreshWallets = useCallback(async () => {
        if (!user?.$id || !isOpen) return;

        setError(null);

        const masterpassPresent = await KeychainService.hasMasterpass(user.$id);
        setHasMasterpass(masterpassPresent);

        if (!masterpassPresent) {
            setWallets([]);
            return;
        }

        if (!ecosystemSecurity.status.isUnlocked) {
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
            setWallets(readyWallets);
            try {
                const tokenClient = createKylrixTokenOperationsClient();
                const balance = await tokenClient.getBalance({ userId: user.$id }) as { amount?: string; symbol?: string };
                setKylrixBalance({
                    amount: String(balance?.amount || '0'),
                    symbol: String(balance?.symbol || '$KYLRIX'),
                });
            } catch {
                setKylrixBalance(null);
            }
        } catch (walletError) {
            console.error('[WalletSidebar] Failed to load wallets', walletError);
            setError(walletError instanceof Error ? walletError.message : 'Failed to load wallet');
        } finally {
            setLoading(false);
        }
    }, [isOpen, user?.$id]);

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
            const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
            const callbackUrl = encodeURIComponent(baseUrl + '?openWallet=true');
            window.location.href = `/vault/masterpass?callbackUrl=${callbackUrl}`;
        }
    }, [isOpen, hasMasterpass]);

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
            const updatedWallets = await WalletService.addNetwork(user.$id, chain);
            setWallets(updatedWallets);
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
        }
    }, [isOpen]);

    const renderKylrixDetail = () => (
        <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Button
                    size="small"
                    onClick={() => setShowKylrixDetail(false)}
                    startIcon={<ChevronLeft size={14} />}
                    sx={{ color: MUTED, textTransform: 'none', borderRadius: '10px' }}
                >
                    Back
                </Button>
                <Typography variant="caption" sx={{ color: ACCENT, fontFamily: 'var(--font-satoshi)', fontWeight: 800 }}>
                    $KYLRIX
                </Typography>
            </Stack>
            <Paper sx={{ p: 2.5, borderRadius: '20px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}`, mb: 2 }}>
                <Typography sx={{ color: MUTED, fontSize: '0.8rem', fontFamily: 'var(--font-satoshi)' }}>Balance</Typography>
                <Typography sx={{ color: ACCENT, fontWeight: 900, fontSize: '1.3rem', fontFamily: 'var(--font-mono)' }}>
                    {kylrixBalance?.amount || '0'} {kylrixBalance?.symbol || '$KYLRIX'}
                </Typography>
            </Paper>
            <Stack gap={1.5} sx={{ mb: 2 }}>
                <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Send</Typography>
                <Box component="input"
                    value={kylrixSendAmount}
                    onChange={(e: any) => setKylrixSendAmount(e.target.value)}
                    placeholder="Enter amount"
                    style={{ width: '100%', background: '#1C1A18', border: `1px solid ${EDGE}`, borderRadius: 10, color: 'white', padding: '10px 12px', outline: 'none' }}
                />
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
                    Select Recipient & Confirm MasterPass
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
                        <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>Your $KYLRIX Address (User ID)</Typography>
                        <Typography sx={{ color: 'white', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', wordBreak: 'break-all', mb: 1 }}>
                            {user?.$id || 'Unavailable'}
                        </Typography>
                        <Button
                            size="small"
                            onClick={() => user?.$id && handleCopyAddress(user.$id)}
                            sx={{ color: ACCENT, textTransform: 'none', p: 0 }}
                        >
                            Copy Address
                        </Button>
                    </Paper>
                ) : null}
            </Stack>
        </Box>
    );

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
                return `https://www.blockchain.com/explorer/addresses/btc/${wallet.address}`;
            case 'sol':
                return `https://solscan.io/account/${wallet.address}`;
            case 'sui':
                return `https://suivision.xyz/account/${wallet.address}`;
            case 'eth':
            case 'usdc':
                return `https://etherscan.io/address/${wallet.address}`;
            case 'base':
                return `https://basescan.org/address/${wallet.address}`;
            case 'polygon':
                return `https://polygonscan.com/address/${wallet.address}`;
            case 'arbitrum':
                return `https://arbiscan.io/address/${wallet.address}`;
            default:
                return null;
        }
    };

    const renderWalletContent = () => (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                <Stack direction="row" alignItems="center" gap={1.5}>
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
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', color: 'white' }}>
                            Kylrix Wallet
                        </Typography>
                        <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
                            T4 Non-Custodial Layer
                        </Typography>
                    </Box>
                </Stack>
                <IconButton onClick={onClose} sx={{ color: MUTED, '&:hover': { color: 'white', bgcolor: HIGHLIGHT } }}>
                    <X size={20} />
                </IconButton>
            </Stack>

            {!user ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 2 }}>
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
                    px: 2
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
                            const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
                            const callbackUrl = encodeURIComponent(baseUrl + '?openWallet=true');
                            window.location.href = `/vault/masterpass?callbackUrl=${callbackUrl}`;
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
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    px: 2
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
                        color: ACCENT
                    }}>
                        <Lock size={32} />
                    </Box>
                    <Typography variant="body1" sx={{ fontWeight: 700, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                        Wallet is Locked
                    </Typography>
                    <Typography variant="body2" sx={{ color: MUTED, mb: 4, maxWidth: 240, fontFamily: 'var(--font-satoshi)' }}>
                        Unlock your secure vault and Connect will auto-provision your main wallet addresses with zero extra input.
                    </Typography>
                    <Button
                        variant="contained"
                        onClick={handleUnlock}
                        startIcon={<Unlock size={18} />}
                        sx={{
                            bgcolor: ACCENT,
                            color: '#000',
                            fontWeight: 900,
                            borderRadius: '14px',
                            px: 4,
                            py: 1.5,
                            textTransform: 'none',
                            fontFamily: 'var(--font-satoshi)',
                            border: `1px solid ${EDGE}`,
                            '&:hover': { bgcolor: '#575CF0', transform: 'translateY(-1px)' },
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        Unlock Wallet
                    </Button>
                </Box>
            ) : loading ? (
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    px: 2
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
                        borderRadius: '20px',
                        bgcolor: SURFACE,
                        border: `1px solid ${EDGE}`,
                        textAlign: 'center',
                        maxWidth: 280
                    }}>
                        <Typography variant="body1" sx={{ fontWeight: 800, mb: 1, fontFamily: 'var(--font-satoshi)', color: 'white' }}>
                            Wallet Sync Failed
                        </Typography>
                        <Typography variant="body2" sx={{ color: MUTED, mb: 2, fontFamily: 'var(--font-satoshi)' }}>
                            {error}
                        </Typography>
                        <Button
                            onClick={refreshWallets}
                            variant="outlined"
                            sx={{
                                borderRadius: '12px',
                                borderColor: EDGE,
                                color: 'white',
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
                <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, '&::-webkit-scrollbar': { width: '4px' }, '&::-webkit-scrollbar-thumb': { bgcolor: '#2A2825', borderRadius: '10px' } }}>
                    {/* Simplified Balance Header */}
                    <Box sx={{ 
                        p: 3, 
                        mb: 3, 
                        textAlign: 'center',
                        bgcolor: SURFACE,
                        borderRadius: '24px',
                        position: 'relative',
                        overflow: 'hidden',
                        border: `1px solid ${EDGE}`
                    }}>
                        <Typography variant="caption" sx={{ color: ACCENT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'var(--font-satoshi)' }}>
                            Estimated Balance
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 900, mt: 0.5, fontFamily: 'var(--font-clash)', color: 'white', letterSpacing: '-0.02em' }}>
                            $0.00
                        </Typography>
                        <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
                            {orderedWallets.length} active networks
                        </Typography>
                    </Box>

                    {/* Pinned Solana + KYLRIX */}
                    <Stack gap={1.5} sx={{ mb: 4 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-satoshi)' }}>
                            Pinned Network
                        </Typography>
                        <Paper
                            sx={{
                                p: 2,
                                px: 2.5,
                                borderRadius: '20px',
                                bgcolor: HIGHLIGHT,
                                border: `1px solid ${EDGE}`,
                                transition: 'all 0.2s ease',
                                '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743', transform: 'translateX(4px)' }
                            }}
                        >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                                <Stack direction="row" alignItems="center" gap={2}>
                                    <Box sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '12px',
                                        bgcolor: '#252321',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: getNetworkColor('sol'),
                                        fontWeight: 900,
                                        fontSize: '20px'
                                    }}>
                                        {getNetworkLogo('sol')}
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                                            {solWallet?.label || 'Solana'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', display: 'block' }}>
                                            {solWallet ? shortenAddress(solWallet.address) : 'Provisioning required'}
                                        </Typography>
                                    </Box>
                                </Stack>
                                <Stack alignItems="flex-end">
                                    <Typography variant="body2" sx={{ fontWeight: 900, color: getNetworkColor('sol'), fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                        0.00 {solWallet?.symbol || 'SOL'}
                                    </Typography>
                                    {solWallet ? (
                                        <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleCopyAddress(solWallet.address)}
                                                sx={{ p: 0.5, color: MUTED, '&:hover': { color: getNetworkColor('sol') } }}
                                            >
                                                <Copy size={14} />
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
                                                <ExternalLink size={14} />
                                            </IconButton>
                                        </Stack>
                                    ) : (
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => handleAddNetwork('sol')}
                                            disabled={pendingChain !== null}
                                            sx={{
                                                mt: 0.5,
                                                minWidth: 0,
                                                borderRadius: '10px',
                                                borderColor: EDGE,
                                                color: 'white',
                                                textTransform: 'none',
                                                fontFamily: 'var(--font-satoshi)',
                                                '&:hover': { bgcolor: HIGHLIGHT, borderColor: '#4A4743' }
                                            }}
                                        >
                                            Add SOL
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        </Paper>
                            <Paper
                                sx={{
                                    p: 2,
                                    px: 2.5,
                                    borderRadius: '20px',
                                    bgcolor: HIGHLIGHT,
                                    border: `1px solid ${EDGE}`,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { bgcolor: SURFACE, borderColor: '#4A4743', transform: 'translateX(4px)' },
                                    cursor: 'pointer'
                                }}
                                onClick={handleKylrixCardClick}
                            >
                                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                                    <Stack direction="row" alignItems="center" gap={2}>
                                        <Box sx={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: '12px',
                                            bgcolor: '#252321',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: ACCENT,
                                            fontWeight: 900,
                                            fontSize: '16px',
                                            fontFamily: 'var(--font-mono)'
                                        }}>
                                            K
                                        </Box>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                                                Kylrix Token
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', display: 'block' }}>
                                                {kylrixBalance?.symbol || '$KYLRIX'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Typography variant="body2" sx={{ fontWeight: 900, color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                        {kylrixBalance?.amount || '0'} {kylrixBalance?.symbol || '$KYLRIX'}
                                    </Typography>
                                </Stack>
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
                                        p: 1.5,
                                        px: 2,
                                        borderRadius: '18px',
                                        bgcolor: SURFACE,
                                        border: `1px solid ${EDGE}`,
                                        transition: 'all 0.2s ease',
                                        '&:hover': { bgcolor: HIGHLIGHT, transform: 'translateX(4px)' }
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                                        <Stack direction="row" alignItems="center" gap={1.5}>
                                            <Box sx={{ 
                                                width: 32, 
                                                height: 32, 
                                                borderRadius: '8px',
                                                bgcolor: '#252321',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: getNetworkColor(wallet.chain),
                                                fontWeight: 800,
                                                fontSize: '14px'
                                            }}>
                                                {getNetworkLogo(wallet.chain)}
                                            </Box>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                                                    {wallet.label}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', display: 'block' }}>
                                                    {shortenAddress(wallet.address)}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                        <Stack alignItems="flex-end">
                                            <Typography variant="body2" sx={{ fontWeight: 900, color: getNetworkColor(wallet.chain), fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                                0.00 {wallet.symbol}
                                            </Typography>
                                            <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleCopyAddress(wallet.address)}
                                                    sx={{ p: 0.5, color: MUTED, '&:hover': { color: getNetworkColor(wallet.chain) } }}
                                                >
                                                    <Copy size={14} />
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
                                                    <ExternalLink size={14} />
                                                </IconButton>
                                            </Stack>
                                        </Stack>
                                    </Stack>
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

                    <Stack gap={2}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-satoshi)' }}>
                            Recent Activity
                        </Typography>
                        <Box sx={{
                            p: 4,
                            textAlign: 'center',
                            borderRadius: '24px',
                            border: `1px solid ${EDGE}`,
                            bgcolor: HIGHLIGHT
                        }}>
                            <History size={24} color={MUTED} style={{ marginBottom: 12 }} />
                            <Typography variant="body2" sx={{ color: MUTED, fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
                                No transactions yet
                            </Typography>
                        </Box>
                    </Stack>
                </Box>
            )}

            <Divider sx={{ borderColor: EDGE, my: 2 }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
                    Auto-provisioned once unlocked
                </Typography>
                <IconButton size="small" sx={{ color: MUTED, '&:hover': { color: 'white' } }}>
                    <Settings size={16} />
                </IconButton>
            </Stack>
        </Box>
    );

    if (isMobile) {
        return (
            <Drawer
                anchor="bottom"
                open={isOpen}
                onClose={onClose}
                PaperProps={{
                    sx: {
                        height: isExpanded ? '100%' : '75%',
                        bgcolor: SURFACE,
                        borderTop: `1px solid ${EDGE}`,
                        borderRadius: isExpanded ? '0' : '32px 32px 0 0',
                        backgroundImage: 'none',
                        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden'
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
                        cursor: 'pointer'
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
                {renderWalletContent()}
            </Drawer>
        );
    }

    return (
        <Drawer
            anchor="right"
            open={isOpen}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: 400,
                    bgcolor: SURFACE,
                    borderLeft: `1px solid ${EDGE}`,
                    backgroundImage: 'none',
                    boxShadow: 'none',
                    top: '88px',
                    height: 'calc(100dvh - 88px)'
                }
            }}
        >
            {renderWalletContent()}
        </Drawer>
    );
};
