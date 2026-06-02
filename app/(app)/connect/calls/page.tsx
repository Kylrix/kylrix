'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { CallHistory } from '@/components/call/CallHistory';
import { CallActionModal } from '@/components/call/CallActionModal';
import { Box, Typography, Container, CircularProgress, Paper, TextField, Button, Divider, useTheme, useMediaQuery } from '@/lib/mui-tailwind/material';
import { Hash, ArrowRight, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { MultiSectionContainer, useSection } from '@/context/SectionContext';
import { listNotes } from '@/lib/appwrite';

function NotesFeed() {
    const [notes, setNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const res = await listNotes([], 5);
                if (mounted) setNotes(res.rows || []);
            } catch (e) {
                console.error(e);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, []);

    if (loading) {
        return (
            <Box sx={{ mt: 6 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff', mb: 3 }}>
                    Recent Notes
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[1, 2, 3].map((i) => (
                        <Box
                            key={i}
                            sx={{
                                display: 'flex',
                                gap: 2,
                                p: 2,
                                borderRadius: '16px',
                                bgcolor: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.03)',
                            }}
                        >
                            <></>
                            <Box sx={{ flex: 1 }}>
                                <></>
                                <></>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ mt: 6 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
                    Recent Notes
                </Typography>
                <Button 
                    size="small" 
                    onClick={() => router.push('/note/notes')} 
                    sx={{ color: '#F59E0B', textTransform: 'none', fontWeight: 700 }}
                >
                    View All
                </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {notes.length === 0 ? (
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 2 }}>
                        No recent notes.
                    </Typography>
                ) : (
                    notes.map((note) => (
                        <Box
                            key={note.$id}
                            onClick={() => router.push(`/note/notes/${note.$id}`)}
                            sx={{
                                display: 'flex',
                                gap: 2,
                                p: 2,
                                borderRadius: '16px',
                                bgcolor: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.03)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    borderColor: 'rgba(255,255,255,0.08)',
                                    transform: 'translateX(4px)',
                                }
                            }}
                        >
                            <Box sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: 'rgba(236, 72, 153, 0.1)',
                                color: '#EC4899',
                                flexShrink: 0,
                            }}>
                                <FileText size={20} />
                            </Box>
                            <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }} noWrap>
                                    {note.title || 'Untitled Note'}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }} noWrap>
                                    {note.content ? note.content.substring(0, 60) + '...' : 'Empty Note'}
                                </Typography>
                            </Box>
                        </Box>
                    ))
                )}
            </Box>
        </Box>
    );
}

function CallsContent() {
    const [modalOpen, setModalOpen] = useState(false);
    const searchParams = useSearchParams();
    const [joinInput, setJoinId] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const router = useRouter();
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
    const { setActiveDetail } = useSection();

    useEffect(() => {
        if (searchParams.get('start') === '1') {
            setModalOpen(true);
            // Clean up URL
            const params = new URLSearchParams(searchParams.toString());
            params.delete('start');
            const next = params.toString();
            router.replace(next ? `/connect/calls?${next}` : '/connect/calls');
        }
    }, [searchParams, router]);

    const handleJoin = () => {
        if (!joinInput.trim()) {
            toast.error("Please enter a meeting ID or URL");
            return;
        }
        
        let id = joinInput.trim();
        // If it's a URL, extract the ID
        if (id.includes('/connect/call/')) {
            id = id.split('/connect/call/').pop() || id;
        } else if (id.includes('/call/')) {
            id = id.split('/call/').pop() || id;
        }
        
        if (isDesktop) {
            setActiveDetail({ type: 'call', id });
        } else {
            router.push(`/connect/call/${id}`);
        }
    };

    return (
        <>
            <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h5" fontWeight="bold">Call History</Typography>
                
                <Paper sx={{ 
                    p: 1, 
                    pl: 2,
                    bgcolor: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    width: { xs: '100%', md: '400px' }
                }}>
                    <Hash size={18} style={{ opacity: 0.3 }} />
                    <TextField 
                        variant="standard"
                        placeholder="Join with ID or Link..."
                        value={joinInput}
                        onChange={(e) => setJoinId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                        InputProps={{ 
                            disableUnderline: true,
                            sx: { fontSize: '0.9rem', fontWeight: 700, color: 'white' }
                        }}
                        sx={{ flex: 1 }}
                    />
                    <Button 
                        variant="contained" 
                        size="small"
                        onClick={handleJoin}
                        sx={{ 
                            bgcolor: '#6366F1', 
                            borderRadius: '10px', 
                            minWidth: '40px', 
                            height: '36px',
                            p: 0
                        }}
                    >
                        <ArrowRight size={18} />
                    </Button>
                </Paper>
            </Box>
            
            <CallHistory key={refreshKey} onNewCall={() => setModalOpen(true)} />

            <CallActionModal 
                open={modalOpen} 
                onClose={() => {
                    setModalOpen(false);
                    setRefreshKey(prev => prev + 1);
                }} 
            />
        </>
    );
}

function CallHistorySkeleton() { return null; }

export default function CallsPage() {
    return (
        <Container maxWidth="xl" sx={{ py: 3, position: 'relative', minHeight: '100vh', pointerEvents: 'auto' }}>
            <MultiSectionContainer panels={['projects', 'threads']}>
                <Suspense fallback={<></>}>
                    <CallsContent />
                </Suspense>
            </MultiSectionContainer>
        </Container>
    );
}
