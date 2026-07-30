'use client';

import React, { useState, useRef } from 'react';
import { Box, Typography, TextField, IconButton } from '@/lib/openbricks/primitives';
import { Send, PlusCircle, Mic, Square, File as FileIcon, RefreshCw } from 'lucide-react';
import { PresenceService } from '@/lib/services/presence';
import { toast } from 'react-hot-toast';

export const ChatDraftInput = React.memo(function ChatDraftInput({
    attachment,
    sending,
    isRecording,
    attachmentDisabled = false,
    onAttach,
    onUpgradeRequested,
    onSend,
    onToggleRecording,
    typingUsers,
    conversationId,
    typingTimeoutRef}: {
    attachment: File | null;
    sending: boolean;
    isRecording: boolean;
    enableMentions?: boolean;
    mentionTargets?: Array<{ id: string; label: string; token: string }>;
    onAttach: (event: React.MouseEvent<HTMLElement>) => void;
    attachmentDisabled?: boolean;
    onUpgradeRequested: () => void;
    onSend: (text: string) => Promise<boolean>;
    onToggleRecording: () => void;
    typingUsers: string[];
    conversationId: string;
    typingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}) {
    const [draft, setDraft] = useState('');
    const [_mentionAnchorEl, _setMentionAnchorEl] = useState<null | HTMLElement>(null);
    const textRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    const submitDraft = React.useCallback(async () => {
        const didSend = await onSend(draft);
        if (didSend) setDraft('');
    }, [draft, onSend]);


    return (
        <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <IconButton
                    size="small"
                    onClick={attachmentDisabled ? onUpgradeRequested : onAttach}
                    aria-disabled={attachmentDisabled}
                    sx={{
                        color: attachmentDisabled ? 'rgba(255,255,255,0.32)' : '#9B9691',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: '#161412',
                        border: '1px solid #1C1A18',
                        '&:hover': {
                            bgcolor: '#1C1A18',
                            borderColor: attachmentDisabled ? '#1C1A18' : '#F59E0B',
                            color: attachmentDisabled ? '#9B9691' : '#fff',
                            cursor: attachmentDisabled ? 'not-allowed' : 'pointer'}}}
                >
                    <PlusCircle size={20} strokeWidth={2} />
                </IconButton>

                <IconButton
                    onClick={onToggleRecording}
                    sx={{
                        color: isRecording ? '#ff4d4d' : '#9B9691',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: '#161412',
                        border: '1px solid #1C1A18',
                        '&:hover': {
                            bgcolor: '#1C1A18',
                            borderColor: '#F59E0B',
                            color: '#fff'}}}
                >
                    {isRecording ? <Square size={18} fill="#ff4d4d" /> : <Mic size={20} strokeWidth={2} />}
                </IconButton>

                <Box sx={{ flex: 1, position: 'relative' }}>
                    {typingUsers.length > 0 && (
                        <Box sx={{ position: 'absolute', top: -20, left: 16 }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#9B9691', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {typingUsers.length === 1 ? 'someone' : `${typingUsers.length} people`} is typing...
                            </Typography>
                        </Box>
                    )}
                    <TextField

                        fullWidth
                        multiline
                        maxRows={4}
                        placeholder="Type a message..."
                        value={draft}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setDraft(e.target.value);
                            
                            // Broadcast typing status
                            if (conversationId) {
                                PresenceService.broadcastState(
                                    PresenceService.getChatChannel(conversationId),
                                    { state: 'online', activity: 'typing' }
                                );

                                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                typingTimeoutRef.current = setTimeout(() => {
                                    PresenceService.broadcastState(
                                        PresenceService.getChatChannel(conversationId),
                                        { state: 'online', activity: 'viewing' }
                                    );
                                }, 3000);
                            }
                        }}
                        onKeyDown={async (e: React.KeyboardEvent) => {
                            if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                const val = draft.trim();
                                if (!val) {
                                    toast.error('Type a message first to secure it.');
                                    return;
                                }
                                setDraft('Securing message payload...');
                                try {
                                    const { AppwriteService } = await import('@/lib/appwrite');
                                    const { encryptGhostData } = await import('@/lib/encryption/ghost-crypto');
                                    
                                    const ghostSecret = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-send`;
                                    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days standard
                                    
                                    const titleEnc = await encryptGhostData('Secure Note');
                                    const contentEnc = await encryptGhostData(val, titleEnc.key);
                                    
                                    const note = await AppwriteService.createSendGhostObject({
                                        title: titleEnc.encrypted,
                                        content: contentEnc.encrypted,
                                        format: 'markdown',
                                        ghostSecret,
                                        expiresAt,
                                        isEncrypted: true,
                                        sendObject: { kind: 'note' }
                                    });
                                    
                                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                    const url = `${origin}/idea/${note.$id}/${titleEnc.key}`;
                                    
                                    // Cache in localStorage stash
                                    try {
                                        const existing = JSON.parse(localStorage.getItem('kylrix_send_sparks') || '[]');
                                        const newSpark = {
                                            id: note.$id,
                                            kind: 'note',
                                            title: 'Secure Note',
                                            url,
                                            expiresAt};
                                        localStorage.setItem('kylrix_send_sparks', JSON.stringify([newSpark, ...existing]));
                                    } catch (err) {
                                        console.warn('Failed to cache spark:', err);
                                    }
                                    
                                    setDraft(url);
                                    toast.success('Message secured as Zero-Knowledge Ghost Note!');
                                } catch (err) {
                                    console.error('Failed to secure message:', err);
                                    setDraft(val);
                                    toast.error('Failed to secure message.');
                                }
                                return;
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                submitDraft();
                            }
                        }}
                        inputRef={textRef}
                        variant="standard"
                        InputProps={{
                            disableUnderline: true,
                            sx: {
                                px: 2,
                                py: 1.5,
                                bgcolor: '#161412',
                                borderRadius: '18px',
                                border: '1px solid #1C1A18',
                                color: '#fff',
                                fontWeight: 600,
                                fontFamily: 'var(--font-satoshi)',
                                fontSize: '0.95rem',
                                '&:focus-within': {
                                    borderColor: '#6366F1',
                                    bgcolor: '#1C1A18'}
                            }
                        }}
                    />
                    {attachment && (
                        <Box sx={{ position: 'absolute', top: -36, left: 0, right: 0, px: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Box sx={{ px: 1.2, py: 0.5, borderRadius: '8px', bgcolor: '#6366F1', color: '#fff', display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem', fontWeight: 800 }}>
                                <FileIcon size={12} strokeWidth={2.5} />
                                {attachment.name.slice(0, 16)}...
                            </Box>
                        </Box>
                    )}
                </Box>

                <IconButton
                    disabled={!draft.trim() && !attachment && !isRecording}
                    onClick={submitDraft}
                    sx={{
                        color: (draft.trim() || attachment) ? '#6366F1' : 'rgba(255,255,255,0.1)',
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        bgcolor: (draft.trim() || attachment) ? '#161412' : 'transparent',
                        border: '1px solid',
                        borderColor: (draft.trim() || attachment) ? '#1C1A18' : 'transparent',
                        '&:hover': {
                            bgcolor: '#1C1A18',
                            borderColor: '#6366F1'},
                        '&.ob-disabled': {
                            color: 'rgba(255,255,255,0.05)'}
                    }}
                >
                    {sending ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} strokeWidth={2.5} />}
                </IconButton>
            </Box>
        </>
    );
});

