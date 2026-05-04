'use client';

import React, { useState, Suspense  } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CallHistory } from '@/components/call/CallHistory';
import { CallActionModal } from '@/components/call/CallActionModal';
import { Box, Typography, Container, CircularProgress, Paper, TextField, Button } from '@mui/material';
import { Hash, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function CallsPage() {
    const [modalOpen, setModalOpen] = useState(false);
    const [joinInput, setJoinId] = useState('');
    const router = useRouter();

    const handleJoin = () => {
        if (!joinInput.trim()) {
            toast.error("Please enter a meeting ID or URL");
            return;
        }
        
        let id = joinInput.trim();
        // If it's a URL, extract the ID
        if (id.includes('/call/')) {
            id = id.split('/call/').pop() || id;
        }
        
        router.push(`/call/${id}`);
    };

    return (
        <AppShell>
            <Container maxWidth="md" sx={{ py: 3, position: 'relative', minHeight: '100vh' }}>
                <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h5" fontWeight="bold">Call History</Typography>
                    
                    <Paper sx={{ 
                        p: 1, 
                        pl: 2,
                        bgcolor: 'rgba(255,255,255,0.02)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
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
                
                <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>}>
                    <CallHistory onNewCall={() => setModalOpen(true)} />
                </Suspense>

                <CallActionModal open={modalOpen} onClose={() => setModalOpen(false)} />
            </Container>
        </AppShell>
    );
}
