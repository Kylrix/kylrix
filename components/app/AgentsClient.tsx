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
    Grid,
    Paper,
    Chip
} from '@/lib/mui-tailwind/material';
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

// Opaque OpenBricks Colors
const VOID = '#0A0908';
const SURFACE_ASH = '#161412';
const TEXT_MUTED = '#9B9691';
const SYSTEM_PRIMARY = '#6366F1';
const SYSTEM_SUCCESS = '#10B981';

const BORDER = `1px solid #34322F`;
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

export function AgentsClient({ initialAgents }: { initialAgents?: AgentRow[] }) {
    const { user } = useAuth();
    const router = useRouter();
    const { openAgenticDrawer } = useAgenticDrawer();
    const [agents, setAgents] = useState<AgentRow[]>(initialAgents || []);
    const [loading, setLoading] = useState(!initialAgents);
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
        if (initialAgents) return;
        if (user?.$id) {
            fetchAgents();
        }
    }, [fetchAgents, user?.$id, initialAgents]);

    const handleBack = () => {
        router.push('/flow');
    };

    const handleSettings = () => {
        router.push('/settings/agents');
    };

    const parseConfig = (configStr?: string) => {
        try {
            return JSON.parse(configStr || '{}');
        } catch {
            return {};
        }
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
            }}
        >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    <ButtonBase
                        onClick={handleBack}
                        sx={{
                            p: 1,
                            borderRadius: 2,
                            color: TEXT_MUTED,
                            '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
                            transition: BRAND_TRANSITION
                        }}
                    >
                        <ArrowLeft size={20} />
                    </ButtonBase>
                    <Typography sx={{ fontFamily: fontDisplay, fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
                        Assistants
                    </Typography>
                </Stack>

                <ButtonBase
                    onClick={handleSettings}
                    sx={{
                        p: 1,
                        borderRadius: 2,
                        color: TEXT_MUTED,
                        '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
                        transition: BRAND_TRANSITION
                    }}
                >
                    <Settings size={20} />
                </ButtonBase>
            </Stack>

            {loading ? (
                <Stack alignItems="center" sx={{ py: 10 }}>
                    <CircularProgress size={24} sx={{ color: SYSTEM_PRIMARY }} />
                </Stack>
            ) : error ? (
                <Box sx={{ py: 6, textAlign: 'center', bgcolor: SURFACE_ASH, borderRadius: 4, border: BORDER }}>
                    <Typography sx={{ color: TEXT_MUTED, mb: 3 }}>{error}</Typography>
                    <Button 
                        variant="outlined" 
                        onClick={fetchAgents}
                        sx={{ borderRadius: 3, borderColor: SYSTEM_PRIMARY, color: SYSTEM_PRIMARY }}
                    >
                        Retry
                    </Button>
                </Box>
            ) : (
                <Grid container spacing={2}>
                    {agents.map((agent) => {
                        const config = parseConfig(agent.config);
                        return (
                            <Grid key={agent.$id} size={{ xs: 12, sm: 6 }}>
                                <Paper
                                    onClick={() => openAgenticDrawer()}
                                    sx={{
                                        p: 2.5,
                                        bgcolor: SURFACE_ASH,
                                        borderRadius: 4,
                                        border: BORDER,
                                        cursor: 'pointer',
                                        transition: BRAND_TRANSITION,
                                        '&:hover': {
                                            borderColor: SYSTEM_PRIMARY,
                                            transform: 'translateY(-2px)',
                                            bgcolor: '#1C1A18'
                                        }
                                    }}
                                >
                                    <Stack spacing={2}>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between">
                                            <Box sx={{ p: 1, bgcolor: VOID, borderRadius: 2, color: SYSTEM_PRIMARY }}>
                                                <Bot size={24} />
                                            </Box>
                                            <Chip 
                                                label={agent.status || 'idle'} 
                                                size="small"
                                                sx={{ 
                                                    bgcolor: agent.status === 'working' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                                                    color: agent.status === 'working' ? SYSTEM_SUCCESS : TEXT_MUTED,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase'
                                                }}
                                            />
                                        </Stack>
                                        <Box>
                                            <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', mb: 0.5 }}>
                                                {config.name || 'Unnamed Agent'}
                                            </Typography>
                                            <Typography sx={{ color: TEXT_MUTED, fontSize: '0.85rem', lineHeight: 1.5 }}>
                                                {config.goal || 'No objective defined yet.'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Grid>
                        );
                    })}

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper
                            onClick={() => openAgenticDrawer()}
                            sx={{
                                p: 2.5,
                                bgcolor: VOID,
                                borderRadius: 4,
                                border: `1px dashed #34322F`,
                                cursor: 'pointer',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: BRAND_TRANSITION,
                                '&:hover': {
                                    borderColor: SYSTEM_PRIMARY,
                                    bgcolor: 'rgba(99, 102, 241, 0.05)'
                                }
                            }}
                        >
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ color: TEXT_MUTED }}>
                                <Plus size={20} />
                                <Typography sx={{ fontWeight: 900 }}>Deploy Assistant</Typography>
                            </Stack>
                        </Paper>
                    </Grid>
                </Grid>
            )}

            <Box sx={{ mt: 6, p: 3, bgcolor: 'rgba(99, 102, 241, 0.03)', borderRadius: 4, border: `1px solid rgba(99, 102, 241, 0.1)` }}>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Compass size={24} style={{ color: SYSTEM_PRIMARY }} />
                    <Box>
                        <Typography sx={{ fontWeight: 900, mb: 0.5 }}>OpenClaw Architecture</Typography>
                        <Typography variant="body2" sx={{ color: TEXT_MUTED }}>
                            Your assistants run in a secure, isolated sandbox on the Kylrix backend.
                        </Typography>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
}
