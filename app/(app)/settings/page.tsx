'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Box, 
    Typography, 
    Paper, 
    Button, 
    Stack, 
    Switch, 
    FormControlLabel, 
    Divider,
    CircularProgress,
    alpha,
    useTheme,
    IconButton,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
    ButtonBase
} from '@mui/material';
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
    Bot
} from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { KeychainService } from '@/lib/appwrite/keychain';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { useSudo } from '@/context/SudoContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { DiscoverabilitySettings } from '@/components/settings/DiscoverabilitySettings';
import { toast } from 'react-hot-toast';
import { TelegramDrawer } from '@/app/(app)/(auth)/accounts/components/TelegramDrawer';
import { checkTelegramConnection } from '@/lib/actions/telegram';
import TelegramIcon from '@mui/icons-material/Telegram';

export default function SettingsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const _muiTheme = useTheme();
    const { requestSudo } = useSudo();
    const { open: openDrawer } = useUnifiedDrawer();
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    const [isArgon, setIsArgon] = useState(ecosystemSecurity.status.isArgon);
    const [passkeySetupOpen, setPasskeySetupOpen] = useState(false);
    const [hasMasterpass, setHasMasterpass] = useState<boolean | null>(null);

    // Telegram state
    const [tgUsername, setTgUsername] = useState<string | null>(null);
    const [tgLoading, setTgLoading] = useState(false);
    const [tgDrawerOpen, setTgDrawerOpen] = useState(false);

    // Google Suite state
    const [googleConnected, setGoogleConnected] = useState(false);
    const [googleSyncKeep, setGoogleSyncKeep] = useState(true);
    const [googleSyncCalendar, setGoogleSyncCalendar] = useState(true);
    const [googleSyncDrive, setGoogleSyncDrive] = useState(false);
    const [googleSyncTasks, setGoogleSyncTasks] = useState(true);
    const [minting, setMinting] = useState(false);
  
    // Passkey state
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [_loadingPasskeys, setLoadingPasskeys] = useState(true);



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

    const loadPasskeys = React.useCallback(async () => {
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

    const loadTelegramStatus = React.useCallback(async () => {
        if (!user?.$id) return;
        try {
            setTgLoading(true);
            const { account } = await import('@/lib/appwrite');
            const { jwt } = await account.createJWT();
            const res = await checkTelegramConnection(jwt);
            if (res.success && res.isVerified) {
                setTgUsername(res.tgUsername || 'Connected');
            } else {
                setTgUsername(null);
            }
        } catch (err) {
            console.error('Failed to load telegram status:', err);
        } finally {
            setTgLoading(false);
        }
    }, [user?.$id]);

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
            loadTelegramStatus();
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
    }, [isUnlocked, user, loadPasskeys, loadTelegramStatus]);

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
        <>
            <Box
                sx={{
                    maxWidth: 840,
                    mx: 'auto',
                    pt: { xs: 2, md: 2.5 },
                    pb: { xs: 3, md: 4 },
                    px: { xs: 2, md: 3 },
                    pointerEvents: 'auto',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                <Button
                    variant="outlined"
                    onClick={handleBack}
                    startIcon={<ArrowLeft size={16} />}
                    sx={{
                        mb: 2.5,
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.78)',
                        borderColor: 'rgba(255,255,255,0.15)',
                        '&:hover': {
                            borderColor: 'rgba(255,255,255,0.3)',
                            bgcolor: 'rgba(255,255,255,0.04)',
                        },
                    }}
                >
                    Back
                </Button>
                <Box sx={{ mb: 4 }}>
                    <Typography
                        variant="overline"
                        sx={{
                            letterSpacing: '0.16em',
                            color: 'rgba(255,255,255,0.45)',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)'
                        }}
                    >
                        KYLRIX CONTROL PANEL
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, fontFamily: 'var(--font-clash)', color: 'white' }}>
                        Settings
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 1, maxWidth: 560 }}>
                        Manage identity discoverability, encryption access, passkeys, and device preferences.
                    </Typography>
                </Box>

                <Stack spacing={4}>
                    <ButtonBase 
                        onClick={() => router.push('/accounts')}
                        sx={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            borderRadius: '28px',
                            display: 'block' 
                        }}
                    >
                        <Box sx={{ 
                            bgcolor: '#161412', 
                            borderRadius: '28px', 
                            p: 3, 
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                bgcolor: '#1C1A18',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            }
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                                    <User size={24} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
                                        Go to account settings
                                    </Typography>
                                    <Typography sx={{ color: '#9B9691', fontSize: '0.85rem' }}>
                                        Manage your unified identity, WebAuthn passkeys, and connected apps.
                                    </Typography>
                                </Box>
                            </Box>
                            <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                        </Box>
                    </ButtonBase>

                    {/* Smart Assistants Card */}
                    <ButtonBase 
                        onClick={() => router.push('/settings/agents')}
                        sx={{ 
                            width: '100%', 
                            textAlign: 'left', 
                            borderRadius: '28px',
                            display: 'block' 
                        }}
                    >
                        <Box sx={{ 
                            bgcolor: '#161412', 
                            borderRadius: '28px', 
                            p: 3, 
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                bgcolor: '#1C1A18',
                                borderColor: 'rgba(255, 255, 255, 0.1)',
                                transform: 'translateY(-2px)'
                            }
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                                    <Bot size={24} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
                                        Smart Assistants
                                    </Typography>
                                    <Typography sx={{ color: '#9B9691', fontSize: '0.85rem', mt: 0.5 }}>
                                        Configure private AI keys, automated assistant systems, and active workspaces.
                                    </Typography>
                                </Box>
                            </Box>
                            <ChevronRight size={20} color="rgba(255,255,255,0.3)" />
                        </Box>
                    </ButtonBase>

                    {/* Telegram Notifications */}
                    <Box sx={{ 
                        bgcolor: '#161412', 
                        borderRadius: '28px', 
                        p: 3, 
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            bgcolor: '#1C1A18',
                            borderColor: 'rgba(255, 255, 255, 0.1)'
                        }
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(0, 136, 204, 0.1)', color: '#0088cc', display: 'flex' }}>
                                <TelegramIcon sx={{ fontSize: 24 }} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', fontFamily: 'var(--font-clash)' }}>
                                    Telegram Notifications
                                </Typography>
                                <Typography sx={{ color: '#9B9691', fontSize: '0.85rem', mt: 0.5 }}>
                                    {tgUsername 
                                        ? `Linked as @${tgUsername}. Ready to receive secure notifications.` 
                                        : 'Receive instant notifications for calls, active chat threads, and mentions.'}
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {tgLoading ? (
                                <CircularProgress size={20} sx={{ color: 'rgba(255, 255, 255, 0.4)' }} />
                            ) : tgUsername ? (
                                <Button
                                    variant="text"
                                    onClick={() => {
                                        if (!user?.$id) return;
                                        openDrawer('delete-confirm', {
                                            title: `Disconnect @${tgUsername}?`,
                                            description: `Are you sure you want to unlink your Telegram account? You will stop receiving secure notifications for calls, active chat threads, and mentions on this device.`,
                                            confirmLabel: 'Disconnect Telegram',
                                            resourceName: 'this connection',
                                            onConfirm: async () => {
                                                try {
                                                    setTgLoading(true);
                                                    const { databases, APPWRITE_CONFIG } = await import('@/lib/appwrite');
                                                    await databases.deleteDocument(
                                                        APPWRITE_CONFIG.DATABASES.CONNECT,
                                                        APPWRITE_CONFIG.TABLES.CONNECT.TELEGRAM_CONNECTIONS,
                                                        user.$id
                                                    );
                                                    setTgUsername(null);
                                                    toast.success('Telegram disconnected.');
                                                } catch (err: any) {
                                                    console.error('Failed to disconnect telegram:', err);
                                                    toast.error(err?.message || 'Failed to disconnect.');
                                                } finally {
                                                    setTgLoading(false);
                                                }
                                            }
                                        });
                                    }}
                                    sx={{
                                        color: '#EF4444',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        '&:hover': {
                                            bgcolor: 'rgba(239, 68, 68, 0.08)',
                                        }
                                    }}
                                >
                                    Disconnect
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    onClick={() => setTgDrawerOpen(true)}
                                    sx={{
                                        bgcolor: '#6366F1',
                                        color: 'white',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        borderRadius: '12px',
                                        px: 3,
                                        py: 1,
                                        '&:hover': {
                                            bgcolor: '#4F46E5',
                                        }
                                    }}
                                >
                                    Connect
                                </Button>
                            )}
                        </Box>
                    </Box>

                    <DiscoverabilitySettings />
                    <Box sx={{ bgcolor: '#161412', borderRadius: '28px', p: 3, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', mb: 1, fontFamily: 'var(--font-clash)' }}>Daily Token Mint</Typography>
                        <Typography sx={{ color: '#9B9691', mb: 2, fontSize: '0.9rem' }}>Manually trigger your daily token minting reward.</Typography>
                        <Button 
                            variant="contained" 
                            startIcon={minting ? <CircularProgress size={18} /> : <RefreshCw size={18}/>} 
                            onClick={handleManualMint} 
                            disabled={minting}
                            sx={{ borderRadius: '12px', fontWeight: 700, px: 3, py: 1.2, bgcolor: '#6366F1' }}
                        >
                            {minting ? 'Minting...' : 'Mint Daily Tokens'}
                        </Button>
                    </Box>
                    
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1.25, color: 'white' }}>
                            <Shield size={20} color="#6366F1" /> Security & Privacy
                        </Typography>
                        
                        <Paper sx={{ 
                            p: { xs: 2.25, md: 3 }, 
                            borderRadius: '28px', 
                            bgcolor: '#161412', 
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundImage: 'none',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 44px rgba(0,0,0,0.42)'
                        }}>
                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>Vault Status</Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mb: 0.5 }}>Current encryption state of your session</Typography>
                                        
                                        {hasMasterpass && (
                                            <Typography variant="caption" sx={{ 
                                                fontFamily: 'var(--font-mono)', 
                                                fontWeight: 700, 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: 0.75,
                                                fontSize: '0.65rem',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                color: isArgon ? '#10B981' : '#F59E0B'
                                            }}>
                                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'currentColor' }} />
                                                {isArgon ? 'Vault upgraded to T5 core' : 'Unlock to upgrade to Argon2id'}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Button 
                                        variant={isUnlocked ? 'outlined' : 'contained'}
                                        onClick={() =>
                                          isUnlocked
                                            ? ecosystemSecurity.lock()
                                            : requestSudo({ onSuccess: () => {} })
                                        }
                                        color={isUnlocked ? 'inherit' : 'primary'}
                                        startIcon={isUnlocked ? <Lock size={16} /> : <Shield size={16} />}
                                        sx={{ 
                                            borderRadius: '12px',
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            minWidth: 132,
                                            ...(isUnlocked
                                                ? { borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }
                                                : { bgcolor: '#6366F1', '&:hover': { bgcolor: '#5458E8' } })
                                        }}
                                    >
                                        {isUnlocked ? "Lock Vault" : (hasMasterpass === false ? "Setup" : "Unlock Vault")}
                                    </Button>
                                </Box>

                                <Divider sx={{ opacity: 0.05 }} />

                                {/* Passkey Section */}
                                <Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>Passkeys</Typography>
                                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>
                                                Use biometrics to unlock your secure session.
                                            </Typography>
                                        </Box>
                                        <Button 
                                            variant="contained" 
                                            size="small" 
                                            startIcon={<Fingerprint size={16} />}
                                            onClick={() => setPasskeySetupOpen(true)}
                                            disabled={hasMasterpass === false}
                                            sx={{ 
                                                borderRadius: '10px',
                                                bgcolor: '#6366F1',
                                                textTransform: 'none',
                                                fontWeight: 700,
                                                '&:hover': { bgcolor: '#5458E8' }
                                            }}
                                        >
                                            Add Passkey
                                        </Button>
                                    </Box>

                                    <List sx={{ bgcolor: '#0A0908', borderRadius: '18px', p: 0, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        {passkeyEntries.length === 0 ? (
                                            <Box sx={{ p: 2, textAlign: 'center', opacity: 0.6 }}>
                                                <Typography variant="body2">No passkeys registered.</Typography>
                                            </Box>
                                        ) : (
                                            passkeyEntries.map((pk, idx) => (
                                                <React.Fragment key={pk.$id}>
                                                    <ListItem 
                                                        secondaryAction={
                                                            <IconButton edge="end" color="error" onClick={() => handleRemovePasskey(pk.$id)}>
                                                                <Trash2 size={18} />
                                                            </IconButton>
                                                        }
                                                        sx={{ py: 1.25 }}
                                                    >
                                                        <ListItemIcon>
                                                            <Fingerprint size={20} color="#6366F1" />
                                                        </ListItemIcon>
                                                        <ListItemText 
                                                            primary={pk.params?.name || `Passkey ${idx + 1}`}
                                                            secondary="Active"
                                                            primaryTypographyProps={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}
                                                            secondaryTypographyProps={{ fontSize: '0.75rem', color: alpha('#10B981', 0.9) }}
                                                        />
                                                    </ListItem>
                                                    {idx < passkeyEntries.length - 1 && <Divider sx={{ opacity: 0.05 }} />}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </List>
                                </Box>



                                {/* App Preferences */}
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'white' }}>
                                        <Smartphone size={18} color="#6366F1" /> App Preferences
                                    </Typography>
                                    <Stack spacing={2}>
                                        <FormControlLabel
                                            control={<Switch defaultChecked color="primary" />}
                                            label={
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Push Notifications</Typography>
                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Get notified of new messages</Typography>
                                                </Box>
                                            }
                                            sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                        />
                                        <Divider sx={{ opacity: 0.05 }} />
                                        <FormControlLabel
                                            control={<Switch defaultChecked color="primary" />}
                                            label={
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Active Status</Typography>
                                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Show when you are online</Typography>
                                                </Box>
                                            }
                                            sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                        />
                                    </Stack>
                                </Box>
                            </Stack>
                        </Paper>
                    </Box>

                    {/* Integrations Category - Google Suite */}
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1.25, color: 'white' }}>
                            <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 2 }}>
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.64l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                            Connected Integrations
                        </Typography>
                        
                        <Paper sx={{ 
                            p: { xs: 2.25, md: 3 }, 
                            borderRadius: '28px', 
                            bgcolor: '#161412', 
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundImage: 'none',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 44px rgba(0,0,0,0.42)'
                        }}>
                            <Stack spacing={3}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>Google Suite Integration</Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>Connect your Google workspace to sync Keep, Drive, Tasks, and Calendars.</Typography>
                                    </Box>
                                    <Button 
                                        variant={googleConnected ? 'outlined' : 'contained'}
                                        onClick={() => {
                                            setGoogleConnected(!googleConnected);
                                            toast.success(googleConnected ? 'Google Suite disconnected.' : 'Google Suite integrated successfully!');
                                        }}
                                        sx={{ 
                                            borderRadius: '12px',
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            minWidth: 132,
                                            ...(googleConnected
                                                ? { borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.85)' }
                                                : { bgcolor: '#4285F4', '&:hover': { bgcolor: '#357AE8' } })
                                        }}
                                    >
                                        {googleConnected ? "Disconnect" : "Integrate"}
                                    </Button>
                                </Box>

                                {googleConnected && (
                                    <>
                                        <Divider sx={{ opacity: 0.05 }} />
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2, color: 'rgba(255,255,255,0.7)' }}>Sync Preferences</Typography>
                                            <Stack spacing={2}>
                                                <FormControlLabel
                                                    control={<Switch checked={googleSyncKeep} onChange={(e) => setGoogleSyncKeep(e.target.checked)} color="primary" />}
                                                    label={
                                                        <Box>
                                                            <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Google Keep Sync</Typography>
                                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Real-time synchronization of notes and quick sheets</Typography>
                                                        </Box>
                                                    }
                                                    sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                                />
                                                <Divider sx={{ opacity: 0.05 }} />
                                                <FormControlLabel
                                                    control={<Switch checked={googleSyncCalendar} onChange={(e) => setGoogleSyncCalendar(e.target.checked)} color="primary" />}
                                                    label={
                                                        <Box>
                                                            <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Google Calendar Connections</Typography>
                                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Bi-directional event schedules and huddle meetings</Typography>
                                                        </Box>
                                                    }
                                                    sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                                />
                                                <Divider sx={{ opacity: 0.05 }} />
                                                <FormControlLabel
                                                    control={<Switch checked={googleSyncTasks} onChange={(e) => setGoogleSyncTasks(e.target.checked)} color="primary" />}
                                                    label={
                                                        <Box>
                                                            <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Google Tasks Sync</Typography>
                                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Synchronize your personal goals and assignees across platforms</Typography>
                                                        </Box>
                                                    }
                                                    sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                                />
                                                <Divider sx={{ opacity: 0.05 }} />
                                                <FormControlLabel
                                                    control={<Switch checked={googleSyncDrive} onChange={(e) => setGoogleSyncDrive(e.target.checked)} color="primary" />}
                                                    label={
                                                        <Box>
                                                            <Typography variant="body1" sx={{ fontWeight: 700, color: 'white' }}>Google Drive File Picker</Typography>
                                                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.45)' }}>Direct attachment of cloud storage assets to chat and notes</Typography>
                                                        </Box>
                                                    }
                                                    sx={{ justifyContent: 'space-between', width: '100%', ml: 0, flexDirection: 'row-reverse' }}
                                                />
                                            </Stack>
                                        </Box>
                                    </>
                                )}
                            </Stack>
                        </Paper>
                    </Box>
                </Stack>
            </Box>

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
                    onSuccess={(username) => {
                        setTgUsername(username);
                        setTgDrawerOpen(false);
                    }}
                />
            )}
        </>
    );
}
