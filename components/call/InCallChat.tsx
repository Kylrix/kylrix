'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
    Box, 
    Paper, 
    Typography, 
    TextField, 
    IconButton, 
    Stack, 
    alpha,
    InputAdornment,
    Tooltip
} from '@mui/material';
import { 
    Send, 
    X, 
    Paperclip, 
    MessageSquare,
    FileText,
    Calendar
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { FormattedText } from '../common/FormattedText';
import toast from 'react-hot-toast';

interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
    attachment?: any;
}

export const InCallChat = ({ 
    isOpen, 
    onClose, 
    onSendMessage, 
    messages,
    chatNoteId,
    isHost
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    onSendMessage: (content: string, attachment?: any) => void,
    messages: ChatMessage[],
    chatNoteId?: string | null,
    isHost?: boolean
}) => {
    const { user } = useAuth();
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    const handlePromoteToStory = async () => {
        if (!chatNoteId || !user?.$id) return;
        try {
            const { updateNote, getNote } = await import('@/lib/appwrite/note');
            const note = await getNote(chatNoteId);
            const currentMetadata = note.metadata ? JSON.parse(note.metadata) : {};
            const newMetadata = JSON.stringify({
                ...currentMetadata,
                isGhost: false,
                isStory: true,
                expiresAt: null
            });

            await updateNote(chatNoteId, {
                userId: user.$id,
                metadata: newMetadata
            } as any);

            toast.success("Chat promoted to Story! It will be kept permanently.");
        } catch (e) {
            console.error('[InCallChat] Failed to promote chat to story:', e);
            toast.error("Failed to promote chat");
        }
    };

    if (!isOpen) return null;

    return (
        <Paper 
            elevation={24}
            sx={{ 
                position: 'absolute', 
                right: 20, 
                top: 80, 
                bottom: 140, 
                width: 360, 
                bgcolor: '#161412', 
                borderRadius: '24px', 
                display: 'flex', 
                flexDirection: 'column',
                border: '1px solid rgba(255,255,255,0.1)',
                zIndex: 1400,
                overflow: 'hidden',
                boxShadow: '0 40px 80px -20px rgba(0,0,0,0.8)'
            }}
        >
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                    <MessageSquare size={18} color="#6366F1" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white' }}>In-call Messages</Typography>
                    {isHost && chatNoteId && (
                        <Tooltip title="Promote to Story (Keep Chat Permanently)">
                            <IconButton 
                                size="small" 
                                onClick={handlePromoteToStory}
                                sx={{ 
                                    ml: 'auto', 
                                    bgcolor: 'rgba(99, 102, 241, 0.1)', 
                                    color: '#6366F1',
                                    '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)' },
                                    borderRadius: '8px',
                                    p: '4px 8px',
                                    gap: 0.5
                                }}
                            >
                                <FileText size={14} />
                                <Typography variant="caption" fontWeight={900}>Save</Typography>
                            </IconButton>
                        </Tooltip>
                    )}
                </Stack>
                <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.3)', ml: 1 }}>
                    <X size={18} />
                </IconButton>
            </Box>

            {/* Messages Area */}
            <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ p: 2, bgcolor: 'rgba(245, 158, 11, 0.05)', borderRadius: 3, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, display: 'block', mb: 0.5 }}>
                        Public Call Thread
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500, display: 'block', lineHeight: 1.4 }}>
                        This chat is public to anyone with access to the call. Start a private chat thread in Connect for private messages.
                    </Typography>
                </Box>

                {messages.map((msg) => {
                    const isMe = msg.senderId === user?.$id;
                    return (
                        <Box key={msg.id} sx={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                            {!isMe && (
                                <Typography variant="caption" sx={{ ml: 1, mb: 0.5, display: 'block', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>
                                    {msg.senderName}
                                </Typography>
                            )}
                            <Paper sx={{ 
                                p: 1.5, 
                                bgcolor: isMe ? '#6366F1' : 'rgba(255,255,255,0.05)', 
                                color: isMe ? 'white' : 'white',
                                borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                border: isMe ? 'none' : '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <FormattedText text={msg.content} variant="body2" sx={{ fontWeight: 500 }} />
                                
                                {msg.attachment && (
                                    <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {msg.attachment.type === 'note' ? <FileText size={14} /> : <Calendar size={14} />}
                                        <Typography variant="caption" sx={{ fontWeight: 800 }}>{msg.attachment.title}</Typography>
                                    </Box>
                                )}
                                
                                <Typography variant="caption" sx={{ 
                                    display: 'block', 
                                    textAlign: 'right', 
                                    mt: 0.5, 
                                    fontSize: '0.65rem', 
                                    opacity: 0.5,
                                    fontWeight: 700 
                                }}>
                                    {format(msg.timestamp, 'h:mm a')}
                                </Typography>
                            </Paper>
                        </Box>
                    );
                })}
            </Box>

            {/* Input Area */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <TextField
                    fullWidth
                    multiline
                    maxRows={3}
                    placeholder="Send a message to everyone"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSend();
                        }
                    }}
                    InputProps={{
                        sx: { 
                            bgcolor: 'rgba(255,255,255,0.03)', 
                            borderRadius: 4, 
                            color: 'white',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' }
                        },
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton onClick={handleSend} disabled={!input.trim()} sx={{ color: '#6366F1' }}>
                                    <Send size={18} />
                                </IconButton>
                            </InputAdornment>
                        ),
                        startAdornment: user && (
                            <InputAdornment position="start">
                                <Tooltip title="Attach Object">
                                    <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                                        <Paperclip size={18} />
                                    </IconButton>
                                </Tooltip>
                            </InputAdornment>
                        )
                    }}
                />
            </Box>
        </Paper>
    );
};
