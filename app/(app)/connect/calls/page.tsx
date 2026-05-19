'use client';

import React, { useState, Suspense } from 'react';
import { CallHistory } from '@/components/call/CallHistory';
import { CallActionModal } from '@/components/call/CallActionModal';
import { Box, Typography, Container, CircularProgress, Paper, TextField, Button } from '@mui/material';
import { Hash, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

function CallsContent() {
    const [modalOpen, setModalOpen] = useState(false);
    const searchParams = useSearchParams();
    const [joinInput, setJoinId] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const router = useRouter();

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
        
        router.push(`/connect/call/${id}`);
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

export default function CallsPage() {
    return (
        <Container maxWidth="md" sx={{ py: 3, position: 'relative', minHeight: '100vh', pointerEvents: 'auto' }}>
            <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}>
                <CallsContent />
            </Suspense>
        </Container>
    );
}
