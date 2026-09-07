'use client';

import { Query } from 'appwrite';
import React, { useEffect, useState, useRef, useTransition, useMemo } from 'react';
import { ChatService } from '@/lib/services/chat';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/lib/auth';
import { UsersService } from '@/lib/services/users';
import { useRouter, useSearchParams } from 'next/navigation';
import { tablesDB, realtime } from '@/lib/appwrite/client';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { formatTime } from '@/lib/time-util';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import {

export function toggleRecording(bag: any) {
  const {
  handleClearChat,
  handleSecretSelect,
  handleSend,
  hydrateMembers,
  hydrateSenders,
  initRealtime,
  toggleRecording
  } = bag as any;

        if (isRecording) {
            // Stop recording
            if (recordingTimerRef.current) {
                clearTimeout(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
            setIsRecording(false);
        } else {
            // Start recording
            if (!hasPaidKylrixPlan(user)) {
                openProUpgrade('Voice recording');
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                
                // Heavily compress voice note on client side (16kbps bitrate & Opus format)
                let options = { audioBitsPerSecond: 16000 };
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    (options as any).mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                    (options as any).mimeType = 'audio/ogg;codecs=opus';
                }
                
                const mediaRecorder = new MediaRecorder(stream, options);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        audioChunksRef.current.push(e.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    if (recordingTimerRef.current) {
                        clearTimeout(recordingTimerRef.current);
                        recordingTimerRef.current = null;
                    }
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
                    
                    // Stop all tracks to release microphone
                    stream.getTracks().forEach(track => track.stop());

                    // Send the audio file — branch on substrate (thread thread vs secure conversation)
                    setSending(true);
                    try {
                        const uploaded = await StorageService.uploadFile(audioFile, StorageService.getBucketForType('audio'));
                        const isThreadHangoutVoice = !!(conversation as any)?.isThreadFallback || (conversation as any)?.type === 'thread' || !!(conversation as any)?.isthreadChat || !!(conversation as any)?.isSelfBookmarks;
                        if (isThreadHangoutVoice) {
                            const { getOrCreateThread, postThreadMessage } = await import('@/lib/actions/client-ops');
                            let threadId: any = conversationId;
                            try {
                                const parentKind: any = (conversation as any)?.isSelfBookmarks ? 'user' : 'chat';
                                const parentId: any = (conversation as any)?.isSelfBookmarks ? user?.$id : conversationId;
                                const channel: any = (conversation as any)?.isSelfBookmarks ? 'bookmarks' : 'general';
                                const ensured: any = await getOrCreateThread({ parentKind, parentId, channel, title: (conversation as any)?.name || 'Bookmarks', legacyNoteId: conversationId } as any);
                                threadId = ensured?.thread?.id || threadId;
                            } catch {}
                            await postThreadMessage({ threadId, content: `__voice_note__:${uploaded.$id}` } as any);
                        } else {
                            await ChatService.sendMessage(conversationId, user?.$id || '', 'Voice Message', 'audio', [uploaded.$id]);
                        }
                    } catch (error) {
                        console.error('Failed to send voice note:', error);
                    } finally {
                        setSending(false);
                    }
                };

                mediaRecorder.start();
                setIsRecording(true);

                // Audio length limit removed for Pro/Teams users.

            } catch (err) {
                console.error("Failed to start recording:", err);
                alert("Microphone access is required for voice notes.");
            }
        }
}
