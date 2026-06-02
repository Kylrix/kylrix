'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Box, 
    Typography, 
    Button, 
    Stack, 
    Divider,
    CircularProgress,
    TextField,
    ButtonBase,
    Radio,
    RadioGroup,
    FormControlLabel
} from '@/lib/mui-tailwind/material';
import { 
    ArrowLeft,
    Lock, 
    Shield, 
    ChevronRight,
    Key,
    Bot,
    Cpu,
    ArrowUpRight
} from 'lucide-react';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useAuth } from '@/lib/auth';
import { useSudo } from '@/context/SudoContext';
import { toast } from 'react-hot-toast';
import { BYOKManager } from '@/lib/ai/byok';

const fontUi = 'var(--font-satoshi)';
const fontDisplay = 'var(--font-clash)';
const fontMono = 'var(--font-mono)';

// Opaque OpenBricks Colors
const VOID = '#0A0908';
const SURFACE_ASH = '#161412';
const INSET_ASH = '#1C1A18';
const BORDER_HAIRLINE = '#34322F';
const TEXT_MUTED = '#9B9691';
const SYSTEM_PRIMARY = '#6366F1';
const SYSTEM_SUCCESS = '#10B981';

const BORDER = `1px solid ${BORDER_HAIRLINE}`;
const BRAND_TRANSITION = 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)';

export default function AssistantSettingsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { promptSudo } = useSudo();
    
    // Unified vault state
    const [isUnlocked, setIsUnlocked] = useState(ecosystemSecurity.status.isUnlocked);
    
    // Private AI Key state
    const [byokKeyInput, setByokKeyInput] = useState('');
    const [hasByok, setHasByok] = useState(false);
    const [byokLoading, setByokLoading] = useState(true);
    const [byokSaving, setByokSaving] = useState(false);
    const [showByokInput, setShowByokInput] = useState(false);

    // Framework state
    const [selectedFramework, setSelectedFramework] = useState('kylrix');

    const handleBack = () => {
        router.push('/settings');
    };

    const handleUnlockVault = async () => {
        const success = await promptSudo('unlock');
        if (success) {
            toast.success("Security vault unlocked successfully!");
        }
    };

    const handleSaveByok = async () => {
        if (!user?.$id) return;
        if (!byokKeyInput.trim()) {
            toast.error("Please enter a valid API Key.");
            return;
        }

        setByokSaving(true);
        try {
            await BYOKManager.saveKey(user.$id, 'gemini', byokKeyInput.trim());
            toast.success("Private AI key saved and encrypted successfully!");
            setHasByok(true);
            setByokKeyInput('');
            setShowByokInput(false);
        } catch (err: any) {
            toast.error(err?.message || "Failed to encrypt and save private key.");
        } finally {
            setByokSaving(false);
        }
    };

    const handleDeleteByok = async () => {
        if (!user?.$id) return;
        if (!window.confirm("Are you sure you want to remove your private AI key? Automated assistants will fall back to default keys.")) return;

        setByokSaving(true);
        try {
            await BYOKManager.deleteKey(user.$id, 'gemini');
            toast.success("Private AI key removed.");
            setHasByok(false);
            setByokKeyInput('');
            setShowByokInput(false);
        } catch (err: any) {
            toast.error(err?.message || "Failed to remove private key.");
        } finally {
            setByokSaving(false);
        }
    };

    useEffect(() => {
        const unsubscribe = ecosystemSecurity.onStatusChange((status) => {
            if (status.isUnlocked !== isUnlocked) {
                setIsUnlocked(status.isUnlocked);
            }
        });

        if (user?.$id && isUnlocked) {
            setByokLoading(true);
            BYOKManager.hasKey(user.$id, 'gemini')
                .then((present) => {
                    setHasByok(present);
                    setByokLoading(false);
                })
                .catch(() => setByokLoading(false));
        } else {
            setByokLoading(false);
        }

        return () => {
            unsubscribe();
        };
    }, [isUnlocked, user?.$id]);

    return (
        <Box
            sx={{
                maxWidth: 840,
                mx: 'auto',
                pt: { xs: 2, md: 2.5 },
                pb: { xs: 3, md: 4 },
                px: { xs: 2, md: 3 },
                pointerEvents: 'auto',
                position: 'relative',
                zIndex: 1,
                bgcolor: VOID,
                minHeight: '100vh',
                color: 'white'
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
                    fontFamily: fontUi,
                    '&:hover': {
                        borderColor: 'rgba(255,255,255,0.3)',
                        bgcolor: 'rgba(255,255,255,0.04)',
                    },
                }}
            >
                Back to Control Panel
            </Button>

            <Box sx={{ mb: 4 }}>
                <Typography
                    variant="overline"
                    sx={{
                        letterSpacing: '0.16em',
                        color: TEXT_MUTED,
                        fontWeight: 800,
                        fontFamily: fontMono
                    }}
                >
                    SYSTEM CONFIGURATION
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, fontFamily: fontDisplay, color: 'white' }}>
                    Assistant Settings
                </Typography>
                <Typography variant="body2" sx={{ color: TEXT_MUTED, mt: 1, maxWidth: 560, fontFamily: fontUi }}>
                    Configure private keys, automated assistant systems, and resource allocations.
                </Typography>
            </Box>

            <Stack spacing={4}>
                {/* Assistants Workspace Gateway */}
                <ButtonBase
                    onClick={() => router.push('/agents')}
                    sx={{
                        width: '100%',
                        textAlign: 'left',
                        borderRadius: '24px',
                        display: 'block'
                    }}
                >
                    <Box sx={{
                        bgcolor: SURFACE_ASH,
                        borderRadius: '24px',
                        p: 3,
                        border: BORDER,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: BRAND_TRANSITION,
                        '&:hover': {
                            bgcolor: INSET_ASH,
                            borderColor: '#4F46E5',
                            transform: 'translateY(-2px)'
                        }
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: SYSTEM_PRIMARY }}>
                                <Bot size={24} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', fontFamily: fontDisplay }}>
                                    Go to Assistants Workspace
                                </Typography>
                                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.85rem', mt: 0.5, fontFamily: fontUi }}>
                                    Launch, audit, and coordinate your active smart assistants.
                                </Typography>
                            </Box>
                        </Box>
                        <ArrowUpRight size={20} color={TEXT_MUTED} />
                    </Box>
                </ButtonBase>

                {/* Vault & Keys Section */}
                <Box sx={{ bgcolor: SURFACE_ASH, borderRadius: '24px', p: 3, border: BORDER }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, display: 'flex', alignItems: 'center', gap: 1.25, color: 'white', fontFamily: fontDisplay }}>
                        <Shield size={20} color={SYSTEM_PRIMARY} /> Security Vault & Credentials
                    </Typography>
                    <Typography variant="body2" sx={{ color: TEXT_MUTED, mb: 3, fontFamily: fontUi, fontSize: '0.85rem' }}>
                        To protect your sensitive credentials, private keys are encrypted locally before saving.
                    </Typography>

                    <Stack spacing={3}>
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            p: 2,
                            borderRadius: '16px',
                            bgcolor: INSET_ASH,
                            border: BORDER
                        }}>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', fontFamily: fontUi }}>Vault Access</Typography>
                                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem', fontFamily: fontUi }}>
                                    {isUnlocked ? "Unlocked - private keys accessible" : "Locked - unlock to view or edit keys"}
                                </Typography>
                            </Box>
                            <Button
                                variant={isUnlocked ? 'outlined' : 'contained'}
                                size="small"
                                onClick={isUnlocked ? undefined : handleUnlockVault}
                                disabled={isUnlocked}
                                startIcon={isUnlocked ? <Lock size={16} /> : <Shield size={16} />}
                                sx={{
                                    borderRadius: '10px',
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontFamily: fontUi,
                                    borderColor: isUnlocked ? 'rgba(255,255,255,0.15)' : SYSTEM_PRIMARY,
                                    color: isUnlocked ? 'rgba(255,255,255,0.7)' : 'white',
                                    bgcolor: isUnlocked ? 'transparent' : SYSTEM_PRIMARY,
                                    '&:hover': {
                                        bgcolor: isUnlocked ? 'rgba(255,255,255,0.05)' : '#4F46E5'
                                    }
                                }}
                            >
                                {isUnlocked ? "Unlocked" : "Unlock Vault"}
                            </Button>
                        </Box>

                        <Divider sx={{ borderColor: BORDER_HAIRLINE }} />

                        {/* Private AI Key Configuration */}
                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Box>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 1, fontFamily: fontDisplay }}>
                                        <Key size={18} color={SYSTEM_PRIMARY} /> Private AI Key (Gemini)
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: TEXT_MUTED, mt: 0.5, fontFamily: fontUi, fontSize: '0.85rem' }}>
                                        Power your assistants using a personal key, bypassing ecosystem resource controls.
                                    </Typography>
                                </Box>
                                {hasByok && !showByokInput && (
                                    <Button 
                                        variant="outlined" 
                                        color="error"
                                        size="small" 
                                        onClick={handleDeleteByok}
                                        disabled={byokSaving}
                                        sx={{ 
                                            borderRadius: '10px',
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontFamily: fontUi,
                                            borderColor: 'rgba(239, 68, 68, 0.3)',
                                            color: '#EF4444',
                                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.05)', borderColor: '#EF4444' }
                                        }}
                                    >
                                        Remove Key
                                    </Button>
                                )}
                            </Box>

                            {byokLoading ? (
                                <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                                    <CircularProgress size={20} sx={{ color: SYSTEM_PRIMARY }} />
                                </Box>
                            ) : !isUnlocked ? (
                                <Box sx={{ p: 2, borderRadius: '16px', bgcolor: INSET_ASH, border: BORDER, textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: TEXT_MUTED, fontFamily: fontUi, fontSize: '0.85rem' }}>
                                        Unlock your security vault with MasterPass to configure or rotate private keys.
                                    </Typography>
                                </Box>
                            ) : (
                                <Stack spacing={2}>
                                    {hasByok && !showByokInput ? (
                                        <Box sx={{ 
                                            p: 2, 
                                            borderRadius: '16px', 
                                            bgcolor: INSET_ASH, 
                                            border: BORDER, 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center' 
                                        }}>
                                            <Typography variant="body2" sx={{ fontFamily: fontMono, color: SYSTEM_SUCCESS, fontWeight: 700, fontSize: '0.85rem' }}>
                                                •••••••••••••••••••••••••••••••• (Encrypted in local vault)
                                            </Typography>
                                            <Button 
                                                variant="text" 
                                                size="small" 
                                                onClick={() => setShowByokInput(true)}
                                                sx={{ color: SYSTEM_PRIMARY, fontWeight: 700, textTransform: 'none', fontFamily: fontUi }}
                                            >
                                                Rotate Key
                                            </Button>
                                        </Box>
                                    ) : (
                                        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
                                            <TextField
                                                fullWidth
                                                type="password"
                                                placeholder="Enter Gemini API Key (AIzaSy...)"
                                                value={byokKeyInput}
                                                onChange={(e) => setByokKeyInput(e.target.value)}
                                                variant="filled"
                                                InputProps={{ 
                                                    disableUnderline: true, 
                                                    sx: { 
                                                        borderRadius: '12px',
                                                        bgcolor: INSET_ASH,
                                                        color: 'white',
                                                        fontFamily: fontMono,
                                                        border: BORDER,
                                                        '&:hover': { bgcolor: INSET_ASH, borderColor: '#34322F' }
                                                    } 
                                                }}
                                            />
                                            <Button
                                                variant="contained"
                                                onClick={handleSaveByok}
                                                disabled={byokSaving || !byokKeyInput.trim()}
                                                sx={{
                                                    bgcolor: SYSTEM_PRIMARY,
                                                    color: 'white',
                                                    borderRadius: '12px',
                                                    px: 3,
                                                    fontWeight: 700,
                                                    textTransform: 'none',
                                                    fontFamily: fontUi,
                                                    minWidth: 96,
                                                    '&:hover': { bgcolor: '#4F46E5' },
                                                    '&.Mui-disabled': { bgcolor: INSET_ASH, color: '#34322F' }
                                                }}
                                            >
                                                {byokSaving ? <CircularProgress size={18} color="inherit" /> : "Save"}
                                            </Button>
                                            {hasByok && (
                                                <Button
                                                    variant="text"
                                                    onClick={() => setShowByokInput(false)}
                                                    sx={{ color: TEXT_MUTED, textTransform: 'none', fontWeight: 700, fontFamily: fontUi }}
                                                >
                                                    Cancel
                                                </Button>
                                            )}
                                        </Box>
                                    )}
                                </Stack>
                            )}
                        </Box>
                    </Stack>
                </Box>

                {/* Assistant Systems Selection */}
                <Box sx={{ bgcolor: SURFACE_ASH, borderRadius: '24px', p: 3, border: BORDER }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 1, display: 'flex', alignItems: 'center', gap: 1.25, color: 'white', fontFamily: fontDisplay }}>
                        <Cpu size={20} color={SYSTEM_PRIMARY} /> Assistant Systems Architecture
                    </Typography>
                    <Typography variant="body2" sx={{ color: TEXT_MUTED, mb: 3, fontFamily: fontUi, fontSize: '0.85rem' }}>
                        Select the technology stack that manages and routes your background automated processes.
                    </Typography>

                    <RadioGroup
                        value={selectedFramework}
                        onChange={(e) => setSelectedFramework(e.target.value)}
                    >
                        <Stack spacing={2}>
                            {[
                                { id: 'kylrix', title: 'Kylrix Internal', desc: 'Core native framework optimized for task tracking and calendar automation.', status: 'Active' },
                                { id: 'openclaw', title: 'OpenClaw Platform', desc: 'Compatibility layers for external tools and third-party task agents.', status: 'Coming Soon' },
                                { id: 'hermes', title: 'Hermes Orchestrator', desc: 'Lightweight, rapid response chat and dialogue flow coordinator.', status: 'Coming Soon' }
                            ].map((fw) => (
                                <Box 
                                    key={fw.id}
                                    sx={{
                                        p: 2,
                                        borderRadius: '16px',
                                        bgcolor: INSET_ASH,
                                        border: BORDER,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: BRAND_TRANSITION,
                                        opacity: fw.status === 'Active' ? 1 : 0.6,
                                        '&:hover': {
                                            borderColor: fw.status === 'Active' ? '#4F46E5' : BORDER_HAIRLINE
                                        }
                                    }}
                                >
                                    <FormControlLabel
                                        value={fw.id}
                                        control={<Radio disabled={fw.status !== 'Active'} sx={{ color: 'rgba(255,255,255,0.3)', '&.Mui-checked': { color: SYSTEM_PRIMARY } }} />}
                                        label={
                                            <Box sx={{ ml: 1 }}>
                                                <Typography sx={{ fontWeight: 800, fontFamily: fontUi, fontSize: '0.95rem' }}>{fw.title}</Typography>
                                                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem', fontFamily: fontUi, mt: 0.25 }}>{fw.desc}</Typography>
                                            </Box>
                                        }
                                        sx={{ margin: 0 }}
                                    />
                                    <Box sx={{ 
                                        px: 1.5, 
                                        py: 0.5, 
                                        borderRadius: '8px', 
                                        bgcolor: fw.status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                                        color: fw.status === 'Active' ? SYSTEM_SUCCESS : TEXT_MUTED,
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        fontFamily: fontMono
                                    }}>
                                        {fw.status}
                                    </Box>
                                </Box>
                            ))}
                        </Stack>
                    </RadioGroup>
                </Box>
            </Stack>
        </Box>
    );
}
