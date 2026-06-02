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
} from '@/lib/mui-tailwind/material';
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
    Bot,
    Lightbulb,
    Link
} from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { KeychainService } from '@/lib/appwrite/keychain';
import { PasskeySetup } from '@/components/overlays/PasskeySetup';
import { useSudo } from '@/context/SudoContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { DiscoverabilitySettings } from '@/components/settings/DiscoverabilitySettings';
import { toast } from 'react-hot-toast';
import { TelegramDrawer } from '@/components/overlays/TelegramDrawer';
import { checkTelegramConnection } from '@/lib/actions/telegram';
import TelegramIcon from '@/lib/mui-tailwind/icons/Telegram';

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
    const [tgDrawerOpen, setTgDrawerOpen] = useState(false);
    const [minting, setMinting] = useState(false);
  
    // Passkey state
    const [passkeyEntries, setPasskeyEntries] = useState<any[]>([]);
    const [_loadingPasskeys, setLoadingPasskeys] = useState(true);

    const FEATURE_FORM_ID = '6a19dc99002634bd33ae';



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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const shouldScroll = sessionStorage.getItem('scroll_to_google_workspace');
            if (shouldScroll === 'true') {
                sessionStorage.removeItem('scroll_to_google_workspace');
                setTimeout(() => {
                    const el = document.getElementById('google-workspace-settings');
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        // Premium glowing pulse highlight effect
                        const originalBorder = el.style.borderColor;
                        el.style.boxShadow = '0 0 32px rgba(99, 102, 241, 0.35)';
                        el.style.borderColor = '#6366F1';
                        setTimeout(() => {
                            el.style.boxShadow = 'none';
                            el.style.borderColor = originalBorder || 'rgba(255, 255, 255, 0.05)';
                        }, 2800);
                    }
                }, 350);
            }
        }
    }, []);

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
    }, [isUnlocked, isArgon, user, loadPasskeys]);

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
                    maxWidth: 1200,
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

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 4, alignItems: 'flex-start' }}>
                    {/* Left Column: Discoverability, Integrations & Feedback */}
                    <Stack spacing={4}>
                        <DiscoverabilitySettings />

                        {/* Integrations Category - GitHub */}
                        <Box id="github-workspace-settings" sx={{ transition: 'all 0.5s ease', borderRadius: '28px', border: '1px solid transparent' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1.25, color: 'white' }}>
                                <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: 8, fill: 'white' }}>
                                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
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
                                         <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', pr: 2 }}>
                                             <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', bgcolor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', flexShrink: 0, color: 'white' }}>
                                                 <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                                                     <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                                                 </svg>
                                             </Box>
                                             <Box>
                                                 <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>GitHub Integration</Typography>
                                                 <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', mt: 0.5 }}>Connect your GitHub profile to sync code, tasks, issues, and PR boards.</Typography>
                                             </Box>
                                         </Box>
                                         <Button 
                                             variant="contained"
                                             onClick={() => openDrawer('github-integration')}
                                             sx={{ 
                                                 borderRadius: '12px',
                                                 textTransform: 'none',
                                                 fontWeight: 700,
                                                 minWidth: 132,
                                                 bgcolor: '#24292F', '&:hover': { bgcolor: '#1F2328' }
                                             }}
                                         >
                                             Configure
                                         </Button>
                                     </Box>
                                 </Stack>
                            </Paper>
                        </Box>

                        {/* Daily Token Mint */}
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

                        {/* Feature Requests section */}
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1.25, color: 'white' }}>
                                <Lightbulb size={20} color="#6366F1" /> Feedback & Intelligence
                            </Typography>
                            
                            <Paper sx={{ 
                                p: { xs: 2.25, md: 3 }, 
                                borderRadius: '28px', 
                                bgcolor: '#161412', 
                                border: '1px solid rgba(255, 255, 255, 0.05)',
                                backgroundImage: 'none',
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 22px 44px rgba(0,0,0,0.42)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: '#1C1A18',
                                    borderColor: 'rgba(255, 255, 255, 0.1)'
                                }
                            }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white' }}>Feature Request & Bug Report</Typography>
                                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)' }}>Help us improve the Kylrix ecosystem by reporting issues or suggesting new features.</Typography>
                                    </Box>
                                    <Button 
                                        variant="contained"
                                        onClick={() => openDrawer('form', { formId: FEATURE_FORM_ID })}
                                        sx={{ 
                                            borderRadius: '12px',
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            minWidth: 132,
                                            bgcolor: '#6366F1',
                                            '&:hover': { bgcolor: '#5458E8' }
                                        }}
                                    >
                                        Open Portal
                                    </Button>
                                </Box>
                            </Paper>
                        </Box>
                    </Stack>

                    {/* Right Column: Account settings, Smart Assistants, Telegram & Security */}
                    <Stack spacing={4}>
                        {/* Go to account settings */}
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
                                        Receive push notifications for calls and active chat threads.
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                                    Manage
                                </Button>
                            </Box>
                        </Box>

                        {/* Security & Privacy card */}
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
                    </Stack>
                </Box>
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
                    onSuccess={() => {
                        setTgDrawerOpen(false);
                    }}
                />
            )}
        </>
    );
}
