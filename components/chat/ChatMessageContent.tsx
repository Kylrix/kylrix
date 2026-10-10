'use client';

import React from 'react';
import { Box, Typography } from '@/lib/openbricks/primitives';
import { Lock, File as FileIcon } from 'lucide-react';
import { ChatMarkdownContent } from '@/components/chat/ChatMarkdownContent';
import { parseObjectBlocks } from '@/lib/note-object-secondary';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import type { AttachmentMetadata } from '@/types/p2p';
import { MessagesType, type ChatMessage } from './chat-types';
import { ChatAttachmentCard } from './ChatAttachmentCard';
import { unwrapThreadJsonContent } from '@/lib/chat/thread-json';

const decryptedMessageCache = new Map<string, string>();

export function ChatMessageContent({
  msg,
  isUnlocked,
  conversationId,
  onDecrypted,
  linkPreviewsEnabled = true,
}: {
  msg: ChatMessage;
  isUnlocked: boolean;
  conversationId: string;
  onDecrypted: (messageId: string, decrypted: string) => void;
  linkPreviewsEnabled?: boolean;
}) {
        if ((msg as any).metadata?.type === 'attachment') {
            return <ChatAttachmentCard metadata={(msg as any).metadata as unknown as AttachmentMetadata} />;
        }
        // Handle gibberish display when vault is locked
        const isLikelyEncrypted = (val: string) => {
            if (!val || typeof val !== 'string') return false;
            const trimmed = val.trim();
            if (
                trimmed.startsWith('http://') ||
                trimmed.startsWith('https://') ||
                trimmed.startsWith('ftp://') ||
                trimmed.startsWith('mailto:')
            ) {
                return false;
            }
            if (
                trimmed.startsWith('{"iv"') ||
                trimmed.startsWith('{"data"') ||
                trimmed.startsWith('{"ct"') ||
                trimmed.startsWith('{"ciphertext"') ||
                trimmed.startsWith('[DECRYPTION_')
            ) {
                return true;
            }
            if (trimmed.includes('://') || trimmed.includes('/') || trimmed.includes('?')) {
                return false;
            }
            return trimmed.length >= 32 && !trimmed.includes(' ') && /^[A-Za-z0-9+/=_-]+$/.test(trimmed);
        };

        let displayedContent = unwrapThreadJsonContent(msg.content);
        const isEncrypted = isLikelyEncrypted(displayedContent);

        if (msg.type === MessagesType.TEXT && isEncrypted) {
            if (!isUnlocked) {
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, opacity: 0.8 }}>
                        <Lock size={14} strokeWidth={2.5} />
                        <Typography variant="body2" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                            Encrypted message
                        </Typography>
                    </Box>
                );
            }
            // Decrypted plaintext lives only in transient RAM — never persist or render ciphertext
            const cacheKey = `decrypted_msg_${msg.$id || msg.id}`;
            const cachedDecrypted = decryptedMessageCache.get(cacheKey);
            if (cachedDecrypted) {
                displayedContent = unwrapThreadJsonContent(cachedDecrypted);
                // Fall through to render plaintext below
                if (!isLikelyEncrypted(displayedContent)) {
                    // plaintext ready
                }
            } else {
                const convKey = ecosystemSecurity.getConversationKey(conversationId);
                if (convKey) {
                    ecosystemSecurity.decryptWithKey(displayedContent, convKey)
                        .then((decrypted) => {
                            const unwrapped = unwrapThreadJsonContent(decrypted);
                            decryptedMessageCache.set(cacheKey, unwrapped);
                            onDecrypted(String(msg.$id || msg.id), unwrapped);
                        })
                        .catch(() => {});
                }
                // While async decrypt resolves or key is transient-missing, never render raw ciphertext (gibberish)
                // ChatService.decryptMessageRows already hydrates plaintext in RAM for hangouts; this is fallback for direct render
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, opacity: 0.6 }}>
                        <Lock size={14} strokeWidth={2.5} />
                        <Typography variant="body2" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                            Encrypted message
                        </Typography>
                    </Box>
                );
            }
            // Safety: if still looks like ciphertext after cache lookup, mask it
            if (isLikelyEncrypted(displayedContent)) {
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, opacity: 0.6 }}>
                        <Lock size={14} strokeWidth={2.5} />
                        <Typography variant="body2" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                            Encrypted message
                        </Typography>
                    </Box>
                );
            }
        }

        const fileId = msg.attachments && msg.attachments[0];
        const hasObjectBlocks = parseObjectBlocks(displayedContent).length > 0;

        if (!fileId || hasObjectBlocks) {
            return (
                <ChatMarkdownContent
                    content={displayedContent}
                    linkPreviewsEnabled={linkPreviewsEnabled}
                />
            );
        }

        const _bucketId = '';
        const _viewUrl = '';
        const _previewUrl = '';

        switch (msg.type) {
            case 'image':
            case 'video':
            case 'audio':
            default:
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#161514', borderRadius: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <FileIcon size={18} strokeWidth={1.5} />
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            File attachment not available
                        </Typography>
                    </Box>
                );
        }
}
