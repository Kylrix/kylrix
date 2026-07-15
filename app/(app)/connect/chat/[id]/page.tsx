'use client';

import React, { useEffect, useState } from 'react';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';
import { useParams, useRouter } from 'next/navigation';
import { Box } from '@/lib/openbricks/primitives';
import { getNote } from '@/lib/appwrite/note';
import { useAuth } from '@/context/auth/AuthContext';
import { UsersService } from '@/lib/services/users';
import { ChatService } from '@/lib/services/chat';
import { createGhostNoteChat } from '@/lib/actions/client-ops';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const conversationId = params.id as string;

    const [loading, setLoading] = useState(true);
    const [isHuddleChat, setIsHuddleChat] = useState(false);
    const [huddleTitle, setHuddleTitle] = useState('');

    useEffect(() => {
        if (!conversationId || !user?.$id) return;
        const checkChatType = async () => {
            try {
                // 1. Is the conversationId actually a userId?
                const targetProfile = await UsersService.getProfileById(conversationId).catch(() => null);
                if (targetProfile) {
                    // It IS a userId! Let's resolve the actual conversation ID.
                    const hasLocalKeys = ecosystemSecurity.status.hasIdentity && ecosystemSecurity.status.isUnlocked;
                    const targetHasPublicKey = !!targetProfile.publicKey;

                    if (hasLocalKeys && targetHasPublicKey) {
                        // Standard E2EE chat
                        try {
                            const participants = targetProfile.$id === user.$id ? [user.$id] : [user.$id, targetProfile.$id];
                            const conv = await ChatService.createConversation(participants);
                            if (conv) {
                                router.replace(`/connect/chat/${conv.$id || conv.id}`);
                                return;
                            }
                        } catch (convErr) {
                            console.error('Failed to create/resolve E2EE chat, falling back to discussion:', convErr);
                        }
                    }

                    // Fallback to standard discussion thread (ghost note chat)
                    const sorted = [user.$id, targetProfile.$id].sort();
                    const deterministicId = `gchat-${sorted[0].slice(0, 14)}-${sorted[1].slice(0, 14)}`;

                    try {
                        await getNote(deterministicId);
                        // Already exists!
                        router.replace(`/connect/chat/${deterministicId}`);
                        return;
                    } catch (e) {
                        // Does not exist, create it!
                        await createGhostNoteChat(
                            `@${targetProfile.username || 'user'}'s Discussion`,
                            [user.$id, targetProfile.$id],
                            deterministicId
                        );
                        router.replace(`/connect/chat/${deterministicId}`);
                        return;
                    }
                }

                // 2. Standard flow: If it is a ghost-note huddle/discussion thread
                const note = await getNote(conversationId) as any;
                if (note && (note.isChat || note.isThread || note.isGhost)) {
                    setIsHuddleChat(true);
                    setHuddleTitle(note.title || 'Huddle Chat');
                } else {
                    setIsHuddleChat(false);
                }
            } catch (e) {
                // Not a ghost-note, standard E2EE chat
                setIsHuddleChat(false);
            } finally {
                setLoading(false);
            }
        };
        checkChatType();
    }, [conversationId, user, router]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full bg-[#161412] min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]" />
            </div>
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
