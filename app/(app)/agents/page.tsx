'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
    Box, 
    Typography, 
    Button, 
    Stack, 
    CircularProgress,
    ButtonBase,
    Grid
} from '@mui/material';
import { 
    ArrowLeft,
    Settings,
    Bot,
    Plus,
    Play,
    Activity,
    Compass
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useAgenticDrawer } from '@/context/AgenticDrawerContext';
import { AgenticService } from '@/lib/services/agentic';

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

interface AgentRow {
    $id: string;
    ownerId: string;
    parentId?: string | null;
    publicKey?: string | null;
    config?: string;
    status?: string;
    $updatedAt?: string;
}

export default function AssistantsWorkspacePage() {
    const { user } = useAuth();
    const router = useRouter();
    const { openAgenticDrawer } = useAgenticDrawer();
    const [agents, setAgents] = useState<AgentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAgents = useCallback(async () => {
        if (!user?.$id) return;
        setLoading(true);
        setError(null);
        try {
            const rows = await AgenticService.listMyAgents(user.$id, true);
            setAgents(rows as unknown as AgentRow[]);
        } catch (err: any) {
            console.error('Failed to load assistants:', err);
            setError('Failed to retrieve assistants. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (user?.$id) {
            fetchAgents();
        }
    }, [fetchAgents, user?.$id]);

    const handleBack = () => {
        router.push('/flow');
    };

    const handleSettings = () => {
        router.push('/settings/agents');
    };

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
            {/* Navigation Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Button
                    variant="outlined"
                    onClick={handleBack}
                    startIcon={<ArrowLeft size={16} />}
                    sx={{
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
                    Back to Workspace
                </Button>

                <Button
                    variant="outlined"
                    onClick={handleSettings}
                    startIcon={<Settings size={16} />}
                    sx={{
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 700,
                        color: TEXT_MUTED,
                        borderColor: 'rgba(255,255,255,0.1)',
                        fontFamily: fontUi,
                        '&:hover': {
                            borderColor: 'rgba(255,255,255,0.2)',
                            color: 'white',
                            bgcolor: 'rgba(255,255,255,0.02)',
                        },
                    }}
                >
                    Settings
                </Button>
            </Box>

            {/* Dashboard Intro */}
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
                    KYLRIX EXECUTION SURFACE
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5, fontFamily: fontDisplay, color: 'white' }}>
                    Automated Assistants
                </Typography>
                <Typography variant="body2" sx={{ color: TEXT_MUTED, mt: 1, maxWidth: 560, fontFamily: fontUi }}>
                    Assign background work to smart assistants that coexist inside your workspace notes, calendar, and workflows.
                </Typography>
            </Box>

            <Stack spacing={4}>
                {/* Create/Launch Card */}
                <ButtonBase
                    onClick={() => openAgenticDrawer()}
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
                            borderColor: SYSTEM_PRIMARY,
                            transform: 'translateY(-2px)'
                        }
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: 'rgba(99, 102, 241, 0.1)', color: SYSTEM_PRIMARY }}>
                                <Plus size={24} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#fff', fontFamily: fontDisplay }}>
                                    Launch Control Panel
                                </Typography>
                                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.85rem', mt: 0.5, fontFamily: fontUi }}>
                                    Activate the assistant drawer to initialize new background workers or audit logs.
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </ButtonBase>

                {/* Assistants List Grid */}
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 900, mb: 2, display: 'flex', alignItems: 'center', gap: 1, fontFamily: fontDisplay }}>
                        Active Assistants
                    </Typography>

                    {loading ? (
                        <Box sx={{ py: 6, display: 'flex', justifyContent: 'center', bgcolor: SURFACE_ASH, borderRadius: '24px', border: BORDER }}>
                            <CircularProgress size={32} sx={{ color: SYSTEM_PRIMARY }} />
                        </Box>
                    ) : error ? (
                        <Box sx={{ p: 4, textAlign: 'center', bgcolor: SURFACE_ASH, borderRadius: '24px', border: BORDER }}>
                            <Typography sx={{ color: '#EF4444', fontFamily: fontUi }}>{error}</Typography>
                            <Button size="small" onClick={fetchAgents} sx={{ mt: 2, color: SYSTEM_PRIMARY, textTransform: 'none', fontWeight: 800 }}>Retry</Button>
                        </Box>
                    ) : agents.length === 0 ? (
                        <Box sx={{ p: 6, textAlign: 'center', bgcolor: SURFACE_ASH, borderRadius: '24px', border: BORDER }}>
                            <Bot size={40} color={TEXT_MUTED} style={{ margin: '0 auto 12px' }} />
                            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '1rem', fontFamily: fontUi }}>No active assistants found</Typography>
                            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.8rem', mt: 0.5, fontFamily: fontUi, maxWidth: 360, mx: 'auto' }}>
                                Tap the launch card above to configure and deploy your first native workspace assistant.
                            </Typography>
                        </Box>
                    ) : (
                        <Grid container spacing={2}>
                            {agents.map((agent) => {
                                let name = 'Assistant';
                                let goal = 'Background task orchestration';
                                let framework = 'Kylrix';

                                try {
                                    if (agent.config) {
                                        const parsed = JSON.parse(agent.config);
                                        name = parsed.name || name;
                                        goal = parsed.goal || goal;
                                        framework = parsed.framework || framework;
                                    }
                                } catch (e) {}

                                const isWorking = agent.status === 'working';

                                return (
                                    <Grid xs={12} sm={6} key={agent.$id}>
                                        <Box sx={{
                                            bgcolor: SURFACE_ASH,
                                            p: 2.5,
                                            borderRadius: '20px',
                                            border: BORDER,
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            transition: BRAND_TRANSITION,
                                            '&:hover': {
                                                borderColor: isWorking ? SYSTEM_SUCCESS : SYSTEM_PRIMARY,
                                                bgcolor: INSET_ASH
                                            }
                                        }}>
                                            <Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                                        <Bot size={18} color={SYSTEM_PRIMARY} />
                                                        <Typography sx={{ fontWeight: 800, fontFamily: fontUi, fontSize: '1rem' }}>{name}</Typography>
                                                    </Box>
                                                    <Box sx={{ 
                                                        px: 1.25, 
                                                        py: 0.5, 
                                                        borderRadius: '8px', 
                                                        bgcolor: isWorking ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                                                        color: isWorking ? SYSTEM_SUCCESS : TEXT_MUTED,
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        fontFamily: fontMono
                                                    }}>
                                                        {isWorking ? 'WORKING' : 'IDLE'}
                                                    </Box>
                                                </Box>

                                                <Typography sx={{ color: TEXT_MUTED, fontSize: '0.82rem', mb: 2, fontFamily: fontUi, minHeight: 40, lineHeight: 1.4 }}>
                                                    {goal}
                                                </Typography>
                                            </Box>

                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid rgba(255,255,255,0.04)`, pt: 1.5 }}>
                                                <Typography sx={{ fontSize: '0.75rem', color: TEXT_MUTED, fontFamily: fontMono }}>
                                                    Engine: {framework.toUpperCase()}
                                                </Typography>
                                                <Button
                                                    size="small"
                                                    onClick={() => openAgenticDrawer()}
                                                    startIcon={isWorking ? <Activity size={12} /> : <Play size={12} />}
                                                    sx={{
                                                        textTransform: 'none',
                                                        fontWeight: 800,
                                                        fontFamily: fontUi,
                                                        fontSize: '0.8rem',
                                                        color: isWorking ? SYSTEM_SUCCESS : 'white'
                                                    }}
                                                >
                                                    {isWorking ? 'Monitor' : 'Launch'}
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    )}
                </Box>
            </Stack>
        </Box>
    );
}
