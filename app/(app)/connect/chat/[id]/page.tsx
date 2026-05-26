'use client';

import React, { useEffect, useState } from 'react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';
import { useParams, useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { getNote } from '@/lib/appwrite/note';
import { useAuth } from '@/context/auth/AuthContext';

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
                if (note && note.isChat) {
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
        return (
            <Box sx={{ display: 'grid', placeItems: 'center', height: '100vh', bgcolor: '#0A0908' }}>
                <CircularProgress sx={{ color: '#F59E0B' }} />
            </Box>
        );
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
