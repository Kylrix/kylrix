'use client';

import React, { useState } from 'react';
import {
    Box,
    Typography,
    Stack,
    Button,
    IconButton,
    Drawer,
    Paper} from '@/lib/openbricks/primitives';
import { X, Shield, Fingerprint, Bell, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth/AuthContext';
import { useSetup } from '@/context/SetupContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { TOPBAR_DRAWER_BACKDROP_SLOT } from '@/lib/ui/topbar-drawer-slot';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { useSudo } from '@/context/SudoContext';

const SURFACE = '#161412';
const SURFACE_HOVER = '#1C1A18';
const EDGE = '#34322F';
const AMBER = '#F59E0B';

export function AccountHealthDrawers() {
    const router = useRouter();
    const { user } = useAuth();
    const { activeContent } = useUnifiedDrawer();
    const { currentStep, dismissStep, triggerCheck } = useSetup();
    const { requestSudo: _requestSudo } = useSudo();

    const [showPasskeySetup, setShowPasskeySetup] = useState(false);

    const openVaultSetup = () => {
        // Direct users to Security settings where the full vault setup flow lives
        router.push('/settings?tab=security');
    };

    const handleSetupPasskeySuccess = async () => {
        setShowPasskeySetup(false);
        await triggerCheck();
    };

    const drawerPaperSx = {
        borderTopLeftRadius: '26px',
        borderTopRightRadius: '26px',
        bgcolor: SURFACE,
        borderTop: `1px solid ${EDGE}`,
        backgroundImage: 'none',
        maxHeight: 'min(520px, 92dvh)',
        boxShadow: '0 -12px 42px rgba(0, 0, 0, 0.52)',
        pb: 'calc(1rem + env(safe-area-inset-bottom))'};

    if (activeContent === 'login') {
        return null;
    }

    return (
        <>
            {/* MasterPass Setup Drawer */}
            {currentStep === 'masterpass' && (
                <Drawer
                    anchor="bottom"
                    open={true}
                    onClose={() => dismissStep('masterpass', 3)}
                    slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
                    ModalProps={{ keepMounted: false, disableScrollLock: false }}
                    PaperProps={{ sx: { ...drawerPaperSx, maxHeight: 'min(380px, 88dvh)' } }}
                >
                    <Box sx={{ maxWidth: 720, width: '100%', mx: 'auto', p: { xs: 2, sm: 2.75 }, pt: 2.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                            <Paper
                                elevation={0}
                                sx={{
                                    px: 1.6,
                                    py: 1.25,
                                    borderRadius: '16px',
                                    bgcolor: SURFACE_HOVER,
                                    border: `1px solid ${EDGE}`,
                                    flex: 1}}
                            >
                                <Box sx={{ display: 'flex', gap: 1.35, alignItems: 'flex-start' }}>
                                    <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: SURFACE, border: `1px solid ${EDGE}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                        <Shield color={AMBER} size={21} strokeWidth={2.4} />
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.06rem' }}>
                                            Initialize MasterPass
                                        </Typography>
                                        <Typography sx={{ opacity: 0.66, mt: 0.45, fontSize: '0.88rem', lineHeight: 1.46 }}>
                                            No Vault master-password marker found. Setup MasterPass to secure your account.
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                            <IconButton onClick={() => dismissStep('masterpass', 3)} aria-label="Close" sx={{ color: 'text.secondary' }}>
                                <X size={20} />
                            </IconButton>
                        </Box>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.5 }} justifyContent="flex-end">
                            <Button variant="text" sx={{ color: 'text.secondary' }} onClick={() => dismissStep('masterpass', 3)}>
                                Remind me in 3 days
                            </Button>
                            <Button
                                variant="contained"
                                onClick={openVaultSetup}
                                sx={{
                                    borderRadius: '14px',
                                    py: 1.15,
                                    fontWeight: 900,
                                    textTransform: 'none',
                                    bgcolor: AMBER,
                                    color: '#000',
                                    '&:hover': { bgcolor: '#fbbf24' }}}
                            >
                                Open Vault setup
                            </Button>
                        </Stack>
                    </Box>
                </Drawer>
            )}

            {/* Passkey Setup Reminder Drawer */}
            {currentStep === 'passkey' && (
                <Drawer
                    anchor="bottom"
                    open={true}
                    onClose={() => dismissStep('passkey', 7)}
                    slotProps={TOPBAR_DRAWER_BACKDROP_SLOT}
                    ModalProps={{ keepMounted: false, disableScrollLock: false }}
                    PaperProps={{ sx: { ...drawerPaperSx, maxHeight: 'min(400px, 90dvh)' } }}
                >
                    <Box sx={{ p: 4, maxWidth: '600px', mx: 'auto', width: '100%' }}>
                        <Stack spacing={3}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box sx={{ p: 1.5, bgcolor: '#1C1A18', border: '1px solid #34322F', borderRadius: '14px', display: 'grid', placeItems: 'center' }}>
                                    <Fingerprint color="#6366F1" size={24} />
                                </Box>
                                <IconButton onClick={() => dismissStep('passkey', 7)} sx={{ color: '#9B9691' }}>
                                    <X size={20} />
                                </IconButton>
                            </Stack>

                            <Box>
                                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', mb: 1 }}>
                                    Upgrade to Biometric Access
                                </Typography>
                                <Typography sx={{ color: '#9B9691', fontSize: '0.95rem', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6 }}>
                                    Enable Face ID, Touch ID, or Windows Hello for a faster, more secure way to authenticate.
                                </Typography>
                            </Box>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    onClick={() => setShowPasskeySetup(true)}
                                    sx={{
                                        bgcolor: '#6366F1',
                                        color: '#fff',
                                        fontWeight: 900,
                                        borderRadius: '16px',
                                        py: 1.75,
                                        textTransform: 'none',
                                        '&:hover': { bgcolor: '#575CF0' }
                                    }}
                                    startIcon={<ShieldCheck size={18} />}
                                >
                                    Setup Passkey
                                </Button>
                                <Button
                                    fullWidth
                                    variant="text"
                                    onClick={() => dismissStep('passkey', 7)}
                                    sx={{
                                        color: '#9B9691',
                                        fontWeight: 700,
                                        borderRadius: '16px',
                                        py: 1.75,
                                        textTransform: 'none',
                                        '&:hover': { bgcolor: '#1C1A18', color: '#fff' }
                                    }}
                                    startIcon={<Bell size={18} />}
                                >
                                    Remind me in a week
                                </Button>
                            </Stack>
                        </Stack>
                    </Box>
                </Drawer>
            )}

            {showPasskeySetup && user && (
                <PasskeySetup
                    open={showPasskeySetup}
                    userId={user.$id}
                    onClose={() => setShowPasskeySetup(false)}
                    onSuccess={handleSetupPasskeySuccess}
                />
            )}
        </>
    );
}
