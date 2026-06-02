'use client';

import React, { useEffect, useState } from 'react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';
import { useParams, useRouter } from 'next/navigation';
import { Box, CircularProgress, Skeleton } from '@/lib/mui-tailwind/material';
import { getNote } from '@/lib/appwrite/note';
import { useAuth } from '@/context/auth/AuthContext';

function ChatWindowSkeleton() {
    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#0A0908', p: 3, gap: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.05)', pb: 2 }}>
                <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: 'rgba(255,255,255,0.03)' }} />
                <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="150px" height={24} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: '4px' }} />
                    <Skeleton variant="text" width="80px" height={16} sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '3px' }} />
                </Box>
            </Box>
            {/* Message Area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, justifyContent: 'flex-end', overflow: 'hidden' }}>
                <Box sx={{ alignSelf: 'flex-start', maxWidth: '60%', display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                    <Skeleton variant="circular" width={28} height={28} sx={{ bgcolor: 'rgba(255,255,255,0.03)' }} />
                    <Skeleton variant="rounded" width={200} height={48} sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px 12px 12px 2px' }} />
                </Box>
                <Box sx={{ alignSelf: 'flex-end', maxWidth: '60%' }}>
                    <Skeleton variant="rounded" width={160} height={40} sx={{ bgcolor: 'rgba(245, 158, 11, 0.05)', borderRadius: '12px 12px 2px 12px' }} />
                </Box>
                <Box sx={{ alignSelf: 'flex-start', maxWidth: '60%', display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                    <Skeleton variant="circular" width={28} height={28} sx={{ bgcolor: 'rgba(255,255,255,0.03)' }} />
                    <Skeleton variant="rounded" width={280} height={60} sx={{ bgcolor: 'rgba(255,255,255,0.02)', borderRadius: '12px 12px 12px 2px' }} />
                </Box>
            </Box>
            {/* Input Bar */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <Skeleton variant="rounded" width="100%" height={48} sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '14px' }} />
            </Box>
        </Box>
    );
}

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const conversationId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [isHuddleChat, setIsHuddleChat] = useState(false);
    const [huddleTitle, setHuddleTitle] = useState('');

    useEffect(() => {
        if (!conversationId) return;
        const checkChatType = async () => {
            try {
                // If it is a ghost-note huddle, getNote will succeed
                const note = await getNote(conversationId) as any;
                if (note && (note.isChat || note.isThread || note.isGhost)) {
                    setIsHuddleChat(true);
                    setHuddleTitle(note.title || 'Huddle Chat');
                }
            } catch (e) {
                // Not a ghost-note, standard E2EE chat
                setIsHuddleChat(false);
            } finally {
                setLoading(false);
            }
        };
        checkChatType();
    }, [conversationId]);

    if (loading) {
        return <ChatWindowSkeleton />;
    }

    return (
        <Box sx={{ pointerEvents: 'auto', height: '100%' }}>
            {isHuddleChat ? (
                <HuddleChatWindow 
                    chatNoteId={conversationId} 
                    user={user} 
                    title={huddleTitle} 
                    onBack={() => router.push('/connect/chats')}
                />
            ) : (
                <ChatWindow conversationId={conversationId} />
            )}
        </Box>
    );
}
