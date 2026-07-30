'use client';

import React from 'react';
import Image from 'next/image';
import { Box, Typography } from '@/lib/openbricks/primitives';
import { Lock, File as FileIcon } from 'lucide-react';
import { VoiceMessage } from './VoiceMessage';
import { FormattedText } from '../common/FormattedText';
import { StorageService } from '@/lib/services/storage';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import type { AttachmentMetadata } from '@/types/p2p';
import { MessagesType, type ChatMessage } from './chat-types';
import { ChatAttachmentCard } from './ChatAttachmentCard';

const decryptedMessageCache = new Map<string, string>();

export function ChatMessageContent({
  msg,
  isUnlocked,
  conversationId,
  onDecrypted,
}: {
  msg: ChatMessage;
  isUnlocked: boolean;
  conversationId: string;
  onDecrypted: (messageId: string, decrypted: string) => void;
}) {
        if ((msg as any).metadata?.type === 'attachment') {
            return <ChatAttachmentCard metadata={(msg as any).metadata as unknown as AttachmentMetadata} />;
        }
        // Handle gibberish display when vault is locked
        const isLikelyEncrypted = (val: string) => {
            if (!val) return false;
            // Check if it's base64 with IV (standard WESP format) or just long gibberish
            return val.length > 40 && !val.includes(' ');
        };

        let displayedContent = msg.content as string;
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
            } else {
                // Dynamically decrypt using conversation key to prevent render loop execution bottlenecks
                const cacheKey = `decrypted_msg_${msg.$id || msg.id}`;
                const cachedDecrypted = decryptedMessageCache.get(cacheKey);
                if (cachedDecrypted) {
                    displayedContent = cachedDecrypted;
                } else {
                    const convKey = ecosystemSecurity.getConversationKey(conversationId);
                    if (convKey) {
                        ecosystemSecurity.decryptWithKey(displayedContent, convKey)
                            .then((decrypted) => {
                                decryptedMessageCache.set(cacheKey, decrypted);
                                onDecrypted(String(msg.$id || msg.id), decrypted);
                            })
                            .catch(() => {});
                    }
                }
            }
        }

        const fileId = msg.attachments && msg.attachments[0];
        if (!fileId) return <FormattedText text={displayedContent} />;

        const bucketId = StorageService.getBucketForType(msg.type);
        const viewUrl = StorageService.getFileView(fileId, bucketId);
        const previewUrl = StorageService.getFilePreview(fileId, bucketId, 300, 300);

        switch (msg.type) {
            case 'image':
                return (
                    <Box>
                        <Box
                            sx={{
                                width: 300,
                                height: 300,
                                position: 'relative',
                                borderRadius: 2,
                                overflow: 'hidden',
                                cursor: 'pointer'
                            }}
                            onClick={() => window.open(viewUrl, '_blank')}
                        >
                            <Image
                                src={previewUrl}
                                alt="attachment"
                                fill
                                style={{ objectFit: 'cover' }}
                            />
                        </Box>
                        {msg.content && <Typography variant="body2" sx={{ mt: 1 }}>{msg.content}</Typography>}
                    </Box>
                );
            case 'video':
                return (
                    <Box>
                        <video
                            src={viewUrl}
                            controls
                            style={{ maxWidth: '100%', borderRadius: 8 }}
                        />
                        {msg.content && <Typography variant="body2" sx={{ mt: 1 }}>{msg.content}</Typography>}
                    </Box>
                );
            case 'audio':
                return (
                    <VoiceMessage url={viewUrl} />
                );

            default:
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: '#161514', borderRadius: 1, border: '1px solid rgba(255,255,255,0.05)' }}>
                        <FileIcon size={18} strokeWidth={1.5} />
                        <Typography
                            variant="body2"
                            component="a"
                            href={StorageService.getFileDownload(fileId, bucketId)}
                            target="_blank"
                            sx={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            Download File
                        </Typography>
                    </Box>
                );
        }
}
