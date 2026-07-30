'use client';
import React from 'react';
import { Box, Typography, Stack, Button, Divider, Switch } from '@/lib/openbricks/primitives';
import { WALLET_HIGHLIGHT as HIGHLIGHT, WALLET_EDGE as EDGE, WALLET_MUTED as MUTED, WALLET_ACCENT as ACCENT } from './wallet-theme';
import { KTS_STORAGE_KEY } from './wallet-sidebar-utils';

export function WalletSettingsPanel(props: {
  ktsMode: boolean;
  setKtsModeState: (v: boolean) => void;
  testnetMode: boolean;
  handleToggleTestnet: (checked: boolean) => void;
  smartDelegation: boolean;
  handleToggleSmartDelegation: (checked: boolean) => void;
  gasRelay: boolean;
  handleToggleGasRelay: (checked: boolean) => void;
  recurringBilling: boolean;
  handleToggleRecurringBilling: (checked: boolean) => void;
  handleExportSecrets: () => void;
  exportedMnemonic: string | null;
  exportedPrivateKey: string | null;
  setExportedMnemonic: (v: string | null) => void;
  setExportedPrivateKey: (v: string | null) => void;
  setShowSettings: (v: boolean) => void;
  triggerTestSignature: () => void;
}) {
  const {
    ktsMode, setKtsModeState, testnetMode, handleToggleTestnet,
    smartDelegation, handleToggleSmartDelegation, gasRelay, handleToggleGasRelay,
    recurringBilling, handleToggleRecurringBilling, handleExportSecrets,
    exportedMnemonic, exportedPrivateKey, setExportedMnemonic, setExportedPrivateKey,
    setShowSettings, triggerTestSignature,
  } = props;
  return (
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
                        border: `1px solid ${EDGE}`}}
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
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 }}}
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
                        border: `1px solid ${EDGE}`}}
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
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 }}}
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
                        border: `1px solid ${EDGE}`}}
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
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 }}}
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
                        border: `1px solid ${EDGE}`}}
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
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 }}}
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
                        border: `1px solid ${EDGE}`}}
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
                                '& .ob-switch-thumb.ob-checked + .ob-switch-track': { bgcolor: `${ACCENT} !important`, opacity: 0.38 }}}
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
}
