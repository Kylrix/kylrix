'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Box, 
    Typography, 
    Stack, 
    Button, 
    IconButton,
    Drawer,
    useMediaQuery,
    useTheme
} from '@mui/material';
import { Fingerprint, Bell, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { PasskeySetup } from './PasskeySetup';
import { useAuth } from '@/lib/auth';

export const PasskeyReminderDrawer: React.FC = () => {
    const { user } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    
    const [isOpen, setIsOpen] = useState(false);
    const [showSetup, setShowSetup] = useState(false);
    const [securityStatus, setSecurityStatus] = useState(ecosystemSecurity.status);

    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            setSecurityStatus(status);
        });
        return unsubscribe;
    }, []);

    const checkReminderStatus = useCallback(async () => {
        if (!user?.$id) return;

        // Fetch latest snapshot to be sure
        const status = await ecosystemSecurity.fetchSecuritySnapshot(user.$id);
        
        // Conditions for reminder:
        // 1. User has masterpass (already onboarded to security)
        // 2. User does NOT have a passkey
        // 3. passkeyReminderAt is null OR in the past
        const hasNoPasskey = status.hasPasskey === false;
        const hasMasterpass = status.hasMasterpass === true;
        const reminderDue = !status.passkeyReminderAt || new Date(status.passkeyReminderAt) < new Date();

        if (hasMasterpass && hasNoPasskey && reminderDue) {
            // Delay slightly to not overwhelm on load
            setTimeout(() => setIsOpen(true), 2500);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (user?.$id) {
            checkReminderStatus();
        }
    }, [user?.$id, checkReminderStatus]);

    const handleRemindLater = async () => {
        if (!user?.$id) return;
        setIsOpen(false);
        
        // Postpone for 7 days
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        await ecosystemSecurity.setPasskeyReminder(user.$id, nextWeek);
    };

    const handleSetupNow = () => {
        setIsOpen(false);
        setShowSetup(true);
    };

    const handleSetupSuccess = async () => {
        if (!user?.$id) return;
        setShowSetup(false);
        // Clear reminder as they now have a passkey
        await ecosystemSecurity.setPasskeyReminder(user.$id, null);
    };

    if (!user) return null;

    return (
        <>
            <Drawer
                anchor="bottom"
                open={isOpen}
                onClose={() => setIsOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#161412',
                        backgroundImage: 'none',
                        borderTop: '1px solid #23211F',
                        borderTopLeftRadius: '32px',
                        borderTopRightRadius: '32px',
                        maxHeight: '90dvh',
                        paddingBottom: 'env(safe-area-inset-bottom)',
                    }
                }}
            >
                <Box sx={{ p: 4, maxWidth: '600px', mx: 'auto', width: '100%' }}>
                    <Stack spacing={3}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box sx={{ 
                                p: 1.5, 
                                bgcolor: '#1C1A18', 
                                border: '1px solid #34322F', 
                                borderRadius: '14px',
                                display: 'grid',
                                placeItems: 'center'
                            }}>
                                <Fingerprint color="#6366F1" size={24} />
                            </Box>
                            <IconButton onClick={() => setIsOpen(false)} sx={{ color: '#9B9691' }}>
                                <X size={20} />
                            </IconButton>
                        </Stack>

                        <Box>
                            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', mb: 1 }}>
                                Upgrade to Biometric Access
                            </Typography>
                            <Typography sx={{ color: '#9B9691', fontSize: '0.95rem', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6 }}>
                                You are currently using only a password to unlock your vault. Add a passkey to enable Face ID, Touch ID, or Windows Hello for a faster, more secure experience.
                            </Typography>
                        </Box>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleSetupNow}
                                sx={{
                                    bgcolor: '#6366F1',
                                    color: '#fff',
                                    fontWeight: 900,
                                    borderRadius: '16px',
                                    py: 1.75,
                                    textTransform: 'none',
                                    fontFamily: 'var(--font-clash)',
                                    letterSpacing: '0.02em',
                                    '&:hover': { bgcolor: '#575CF0' }
                                }}
                                startIcon={<ShieldCheck size={18} />}
                            >
                                Setup Passkey
                            </Button>
                            <Button
                                fullWidth
                                variant="text"
                                onClick={handleRemindLater}
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

            {showSetup && user && (
                <PasskeySetup
                    open={showSetup}
                    userId={user.$id}
                    onClose={() => setShowSetup(false)}
                    onSuccess={handleSetupSuccess}
                />
            )}
        </>
    );
};
