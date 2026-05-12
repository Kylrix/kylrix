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
} from '@mui/material';
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
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { useSudo } from '@/context/SudoContext';
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

/** Reads KYLRIX ledger via browser TablesDB session — not Server Actions (`runTokenOperationSecure` lacks cookies → Unauthorized). */
async function fetchKylrixLedgerBalance(userId: string) {
    const balance = await KylrixTokenService.getUserBalance(userId);
    return {
        amount: String(balance?.amount ?? '0'),
        symbol: String(balance?.symbol ?? '$KYLRIX'),
    };
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
    const [ktsMode, setKtsModeState] = useState(false);
    const [ledgerHistoryRows, setLedgerHistoryRows] = useState<Record<string, unknown>[]>([]);
    const [ledgerHistoryLoading, setLedgerHistoryLoading] = useState(false);
    const [ledgerHistoryError, setLedgerHistoryError] = useState<string | null>(null);

    const ACCENT = '#6366F1';
    const SURFACE = '#161412';
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

    useEffect(() => {
        if (!isOpen || !user?.$id) return undefined;
        const onEarn = () => {
            void (async () => {
                try {
                    setKylrixBalance(await fetchKylrixLedgerBalance(user.$id!));
                } catch (_e: unknown) {
                    /* noop */
                }
            })();
        };
        window.addEventListener('kylrix:token-event', onEarn);
        return () => window.removeEventListener('kylrix:token-event', onEarn);
    }, [isOpen, user?.$id]);

    useEffect(() => {
        if (!isOpen || !user?.$id || !isUnlocked || hasMasterpass !== true) return undefined;
        const id = window.setInterval(() => {
            void (async () => {
                try {
                    const next = await fetchKylrixLedgerBalance(user.$id!);
                    setKylrixBalance(next);
                } catch (_e: unknown) {
                    /* noop */
                }
            })();
        }, 28000);
        return () => clearInterval(id);
    }, [isOpen, user?.$id, isUnlocked, hasMasterpass]);

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
                setKylrixBalance(await fetchKylrixLedgerBalance(user.$id));
            } catch (ledgerErr: unknown) {
                console.warn('[WalletSidebar] KYL ledger snapshot failed', ledgerErr);
                setKylrixBalance({ amount: '0', symbol: '$KYLRIX' });
            }
        } catch (walletError) {
            console.error('[WalletSidebar] Failed to load wallets', walletError);
            setError(walletError instanceof Error ? walletError.message : 'Failed to load wallet');
        } finally {
            setLoading(false);
        }
    }, [isOpen, user?.$id]);

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
            const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
            const callbackUrl = encodeURIComponent(baseUrl + '?openWallet=true');
            router.push(`/vault/masterpass?callbackUrl=${callbackUrl}`);
        }
    }, [isOpen, hasMasterpass, router]);

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
            setLedgerHistoryRows([]);
            setLedgerHistoryError(null);
            setLedgerHistoryLoading(false);
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
                    {kylrixTicker(kylrixBalance?.symbol)}
                </Typography>
            </Stack>
            <Paper sx={{ p: 2.5, borderRadius: '20px', bgcolor: HIGHLIGHT, border: `1px solid ${EDGE}`, mb: 2 }}>
                <Typography sx={{ color: MUTED, fontSize: '0.8rem', fontFamily: 'var(--font-satoshi)' }}>Balance</Typography>
                <Typography sx={{ color: ACCENT, fontWeight: 900, fontSize: '1.3rem', fontFamily: 'var(--font-mono)' }}>
                    {kylrixBalance?.amount || '0'} {kylrixTicker(kylrixBalance?.symbol)}
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
                        <Typography sx={{ color: MUTED, fontSize: '0.78rem' }}>Your KYLRIX address (User ID)</Typography>
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

            <Stack gap={1.1} sx={{ mt: ledgerHistoryLoading ? 1 : 0 }}>
                {!ledgerHistoryLoading
                    ? sortedLedgerHistory.map((row, index) => {
                          const deltaStr = formatLedgerDelta(row.deltaMicro);
                          let deltaColor = ACCENT;
                          try {
                              const n = BigInt(String(row.deltaMicro ?? '0'));
                              if (n < 0n) deltaColor = '#f87171';
                              else if (n === 0n) deltaColor = MUTED;
                          } catch {
                              deltaColor = MUTED;
                          }
                          const after = formatLedgerBalanceAfter(row.balanceAfterMicro);
                          const status = String(row.status || '').toLowerCase();
                          return (
                              <Paper
                                  key={ledgerRowKey(row, index)}
                                  sx={{
                                      p: 1.35,
                                      borderRadius: '14px',
                                      bgcolor: HIGHLIGHT,
                                      border: `1px solid ${EDGE}`,
                                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                                  }}
                              >
                                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.25}>
                                      <Box sx={{ minWidth: 0 }}>
                                          <Typography
                                              sx={{
                                                  color: 'white',
                                                  fontWeight: 700,
                                                  fontSize: '0.82rem',
                                                  fontFamily: 'var(--font-satoshi)',
                                                  lineHeight: 1.35,
                                              }}
                                          >
                                              {describeLedgerRow(row)}
                                          </Typography>
                                          <Typography sx={{ color: MUTED, fontSize: '0.72rem', mt: 0.35 }}>
                                              {formatLedgerWhen(row)}
                                          </Typography>
                                          {status === 'pending' ? (
                                              <Typography sx={{ color: '#FBBF24', fontSize: '0.7rem', fontWeight: 600, mt: 0.35 }}>
                                                  Pending
                                              </Typography>
                                          ) : null}
                                      </Box>
                                      <Typography
                                          sx={{
                                              color: deltaColor,
                                              fontFamily: 'var(--font-mono)',
                                              fontWeight: 800,
                                              fontSize: '0.88rem',
                                              flexShrink: 0,
                                              textAlign: 'right',
                                              lineHeight: 1.35,
                                          }}
                                      >
                                          {deltaStr}{' '}
                                          <Box component="span" sx={{ color: MUTED, fontWeight: 600, fontSize: '0.72rem' }}>
                                              {kylrixTicker(kylrixBalance?.symbol)}
                                          </Box>
                                      </Typography>
                                  </Stack>
                                  {after ? (
                                      <Typography sx={{ color: MUTED, fontSize: '0.7rem', mt: 0.85 }}>
                                          After · {after} {kylrixTicker(kylrixBalance?.symbol)}
                                      </Typography>
                                  ) : null}
                              </Paper>
                          );
                      })
                    : null}
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
                            router.push(`/vault/masterpass?callbackUrl=${callbackUrl}`);
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
                            {ktsMode ? 'Kylrix Balance (KTS)' : 'Estimated Balance'}
                        </Typography>
                        <Typography variant="h3" sx={{ fontWeight: 900, mt: 0.5, fontFamily: 'var(--font-clash)', color: 'white', letterSpacing: '-0.02em' }}>
                            {ktsMode ? (
                                <>
                                    {kylrixBalance?.amount || '0'}{' '}
                                    <Box component="span" sx={{ color: ACCENT }}>{kylrixTicker(kylrixBalance?.symbol)}</Box>
                                </>
                            ) : (
                                <>
                                    $0.00
                                    <Box component="div" sx={{ mt: 1, fontSize: '1rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.55)' }}>
                                        {kylrixBalance?.amount || '0'} {kylrixTicker(kylrixBalance?.symbol)}{' '}
                                        <Box component="span" sx={{ fontSize: '0.72rem', fontFamily: 'var(--font-satoshi)', color: MUTED }}>ledger</Box>
                                    </Box>
                                </>
                            )}
                        </Typography>
                        <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700, fontFamily: 'var(--font-satoshi)', display: 'block', mt: 0.75 }}>
                            {ktsMode
                                ? 'Kylrix Token System — on-chain wallets hidden'
                                : `Fiat estimate excludes KYLRIX · ${orderedWallets.length} active chains`}
                        </Typography>
                        <FormControlLabel
                            sx={{ mt: 1.5, justifyContent: 'center', m: 0, display: 'flex', gap: 1 }}
                            control={(
                                <Switch
                                    checked={ktsMode}
                                    onChange={(_, checked) => {
                                        setKtsModeState(checked);
                                        try {
                                            localStorage.setItem(KTS_STORAGE_KEY, checked ? '1' : '0');
                                        } catch (_e: unknown) {
                                            /* noop */
                                        }
                                    }}
                                    size="small"
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': { color: ACCENT },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 },
                                    }}
                                />
                            )}
                            label={(
                                <Typography variant="caption" sx={{ color: MUTED, fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
                                    KTS mode (Kylrix ledger only)
                                </Typography>
                            )}
                        />
                    </Box>

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
                                        {kylrixBalance?.amount || '0'} {kylrixTicker(kylrixBalance?.symbol)}
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
                                    }}>
                                        <PinnedNetworkIconSolana size={22} />
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
                                            lineHeight: 0,
                                        }}>
                                            <Logo app="root" variant="icon" size={22} />
                                        </Box>
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>
                                                Kylrix
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: MUTED, fontFamily: 'var(--font-mono)', display: 'block' }}>
                                                {user?.$id ? shortenUserId(user.$id) : '—'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                    <Stack alignItems="flex-end">
                                        <Typography variant="body2" sx={{ fontWeight: 900, color: ACCENT, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                                            {kylrixBalance?.amount || '0'} {kylrixTicker(kylrixBalance?.symbol)}
                                        </Typography>
                                        {user?.$id ? (
                                            <Stack direction="row" gap={0.5} sx={{ mt: 0.5 }}>
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
                    </>
                    )}
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
                slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
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
            slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
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
