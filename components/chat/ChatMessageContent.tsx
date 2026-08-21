'use client';

import React from 'react';
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
                trimmed.startsWith('mailto:') ||
                trimmed.startsWith('nostr:') ||
                trimmed.startsWith('npub1') ||
                trimmed.startsWith('nsec1') ||
                trimmed.startsWith('note1')
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

        let displayedContent = msg.content as string;
        // Thread leak fix: older thread messages stored as JSON {"text":"...","type":"text","sendToGeneral":true}
        // Render only the text, drop sendToGeneral/type wrapper.
        if (typeof displayedContent === 'string' && displayedContent.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(displayedContent);
            if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
              displayedContent = parsed.text;
            } else if (parsed && typeof parsed.content === 'string') {
              displayedContent = parsed.content;
            }
          } catch {}
        }
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
                displayedContent = cachedDecrypted;
                // Fall through to render plaintext below
                if (!isLikelyEncrypted(displayedContent)) {
                    // plaintext ready
                }
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
        if (!fileId) return <FormattedText text={displayedContent} linkPreviewsEnabled={linkPreviewsEnabled} />;

        const bucketId = StorageService.getBucketForType(msg.type);
        const viewUrl = StorageService.getFileView(fileId, bucketId);
        const previewUrl = StorageService.getFilePreview(fileId, bucketId, 300, 300);

        switch (msg.type) {
            case 'image':
                return (
                    <Box>
                        <Box
                            sx={{
                                maxWidth: '100%',
                                maxHeight: '65vh',
                                position: 'relative',
                                borderRadius: 2,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                bgcolor: '#0A0908',
                            }}
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('kylrix:open-unified-media', {
                                    detail: {
                                        src: viewUrl,
                                        type: 'image',
                                        title: 'Chat image',
                                        fileId,
                                        bucketId,
                                    }
                                }));
                            }}
                        >
                            <img
                                src={viewUrl || previewUrl}
                                alt="attachment"
                                className="w-full max-h-[65vh] object-contain rounded-2xl cursor-pointer hover:opacity-95 transition-opacity"
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
                            playsInline
                            style={{ maxWidth: '100%', maxHeight: '65vh', borderRadius: 16 }}
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
