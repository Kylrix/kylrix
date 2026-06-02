'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  IconButton,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  alpha,
  Popover,
  Checkbox,
  FormControlLabel,
  TextField,
} from '@/lib/mui-tailwind/material';
import {
  ArrowLeft,
  Trash2,
  MessageSquare,
  Globe,
  Mic,
  Square,
  X,
  Copy,
  ChevronLeft,
  Send,
  Users,
  Edit,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { IdentityAvatar } from '@/components/IdentityBadge';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Query, AppwriteService } from '@/lib/appwrite';
import { databases, client } from '@/lib/appwrite/client';
import { createComment, listComments, createReaction, deleteReaction, listReactions, updateComment } from '@/lib/appwrite/note';
import { TargetType } from '@/types/appwrite';
import MuralPattern from '@/components/chat/MuralPattern';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { StorageService } from '@/lib/services/storage';

interface HuddleChatWindowProps {
  chatNoteId: string;
  user: any;
  title: string;
  participants?: any[];
  onBack?: () => void;
  standalone?: boolean;
  expiresAt?: string;
  shareLink?: string;
}

export function HuddleChatWindow({ chatNoteId, user, title, participants = [], onBack, standalone = false, expiresAt, shareLink }: HuddleChatWindowProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [myCommentIds, setMyCommentIds] = useState<string[]>([]);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const [editInputText, setEditInputText] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('kylrix_my_comments');
      if (stored) {
        setMyCommentIds(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleStartEdit = (msg: any) => {
    setEditingMessage(msg);
    const parsed = parseMessageContent(msg.content);
    setEditInputText(parsed.text);
    setMessageAnchorEl(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInputText.trim() || sending || !editingMessage) return;
    setSending(true);
    try {
      const parsed = parseMessageContent(editingMessage.content);
      const updatedContent = JSON.stringify({
        ...parsed,
        text: editInputText.trim()
      });
      await updateComment(editingMessage.id, { content: updatedContent });
      showSuccess('Message updated');
      setEditingMessage(null);
      loadHuddleMessages();
    } catch (err) {
      console.error('Failed to update message:', err);
      showError('Failed to update message');
    } finally {
      setSending(false);
    }
  };

  // Thread and Reactions states
  const [activeThreadParent, setActiveThreadParent] = useState<any | null>(null);
  const [messageAnchorEl, setMessageAnchorEl] = useState<{ el: HTMLElement; msg: any } | null>(null);

  // Voice recording states and refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPending, startTransition] = useTransition();

  const messageEndRef = useRef<HTMLDivElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThreadParent]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadParent]);

  // Clean up timers on component unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Touch long press state/refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = React.useCallback((e: React.TouchEvent, msg: any) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    const currentTarget = e.currentTarget as HTMLElement;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setMessageAnchorEl({ el: currentTarget, msg });
      if (navigator.vibrate) navigator.vibrate(10);
    }, 600);
  }, []);

  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPosRef.current.x;
    const dy = touch.clientY - touchStartPosRef.current.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      touchStartPosRef.current = null;
    }
  }, []);

  const handleTouchEnd = React.useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleMessageClick = React.useCallback((e: React.MouseEvent, msg: any) => {
    e.stopPropagation();
    if (msg.parentCommentId) {
      const parent = messages.find(m => m.id === msg.parentCommentId);
      if (parent) {
        setActiveThreadParent(parent);
      }
    } else {
      setActiveThreadParent(msg);
    }
  }, [messages]);

  // Keep activeThreadParent fresh in real-time when messages change
  useEffect(() => {
    if (activeThreadParent) {
      const freshParent = messages.find(m => m.id === activeThreadParent.id);
      if (freshParent) {
        setActiveThreadParent(freshParent);
      }
    }
  }, [messages, activeThreadParent]);

  // Format voice recording seconds into MM:SS string
  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Safe JSON parser helper
  const parseMessageContent = React.useCallback((rawContent: string) => {
    if (rawContent?.startsWith('{') && rawContent?.endsWith('}')) {
      try {
        const json = JSON.parse(rawContent);
        return {
          text: json.text || '',
          type: json.type || 'text',
          voiceFileId: json.voiceFileId || null,
          sendToGeneral: json.sendToGeneral !== false
        };
      } catch {}
    }
    if (rawContent?.startsWith('__voice_note__:')) {
      return {
        text: 'Voice Note',
        type: 'voice',
        voiceFileId: rawContent.substring('__voice_note__:'.length),
        sendToGeneral: true
      };
    }
    return {
      text: rawContent || '',
      type: 'text',
      voiceFileId: null,
      sendToGeneral: true
    };
  }, []);

  // Load and Subscribe to Huddle Thread (Ghost Note)
  const loadHuddleMessages = useCallback(async () => {
    if (!chatNoteId) return;
    try {
      const res = await listComments(chatNoteId);
      
      // Load reactions for comments parallelly
      let commentReactions: Record<string, any[]> = {};
      try {
        const commentIds = res.rows.map((r: any) => r.$id);
        if (commentIds.length > 0) {
          const reactionsRes = await listReactions([
            Query.equal('targetType', 'comment'),
            Query.equal('targetId', commentIds),
            Query.limit(500)
          ]);
          reactionsRes.rows.forEach((react: any) => {
            if (!commentReactions[react.targetId]) commentReactions[react.targetId] = [];
            commentReactions[react.targetId].push(react);
          });
        }
      } catch (e) {
        console.warn('Failed to load reactions:', e);
      }

      const msgs = await Promise.all(
        res.rows.map(async (doc: any) => {
          let senderName = 'Collaborator';
          if (doc.userId === user?.$id) {
            senderName = user.name || 'You';
          } else {
            try {
              const profile = await AppwriteService.getProfile(doc.userId);
              if (profile) senderName = profile.name || 'Collaborator';
            } catch {}
          }
          return {
            id: doc.$id,
            senderId: doc.userId,
            senderName,
            content: doc.content,
            timestamp: new Date(doc.createdAt).getTime(),
            parentCommentId: doc.parentCommentId || null,
            reactions: commentReactions[doc.$id] || []
          };
        })
      );
      msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
      setMessages(msgs);
    } catch (err) {
      console.error('Failed to load huddle comments:', err);
    } finally {
      setLoading(false);
    }
  }, [chatNoteId, user]);

  useEffect(() => {
    if (!chatNoteId) return;

    let active = true;
    setLoading(true);

    loadHuddleMessages();

    // Subscribe to comments and reactions
    const unsubscribe = client.subscribe(
      [
        `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.comments.documents`,
        `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.reactions.documents`
      ],
      async () => {
        if (!active) return;
        loadHuddleMessages();
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [chatNoteId, loadHuddleMessages]);

  const handleSendMainMessage = async (text: string) => {
    if (!text.trim() || sending) return false;
    setSending(true);

    try {
      const res = await createComment(chatNoteId, JSON.stringify({
        text: text.trim(),
        type: 'text',
        sendToGeneral: true
      }));
      if (res && res.$id) {
        try {
          const stored = localStorage.getItem('kylrix_my_comments');
          const list = stored ? JSON.parse(stored) : [];
          list.push(res.$id);
          localStorage.setItem('kylrix_my_comments', JSON.stringify(list));
          setMyCommentIds(list);
        } catch (e) {
          console.warn('Failed to save comment ID to local storage:', e);
        }
      }
      return true;
    } catch (err) {
      console.error('Failed to send message:', err);
      return false;
    } finally {
      setSending(false);
    }
  };

  const handleSendThreadMessage = async (text: string, sendToGeneral: boolean) => {
    if (!text.trim() || sending || !activeThreadParent) return false;
    setSending(true);
    try {
      const res = await createComment(chatNoteId, JSON.stringify({
        text: text.trim(),
        type: 'text',
        sendToGeneral
      }), activeThreadParent.id);
      if (res && res.$id) {
        try {
          const stored = localStorage.getItem('kylrix_my_comments');
          const list = stored ? JSON.parse(stored) : [];
          list.push(res.$id);
          localStorage.setItem('kylrix_my_comments', JSON.stringify(list));
          setMyCommentIds(list);
        } catch (e) {
          console.warn('Failed to save comment ID to local storage:', e);
        }
      }
      loadHuddleMessages();
      return true;
    } catch (err) {
      console.error('Failed to send thread reply:', err);
      return false;
    } finally {
      setSending(false);
    }
  };

  // Toggle reaction in database
  const handleReact = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    try {
      const existingReaction = msg.reactions?.find(
        (r: any) => r.userId === user.$id && r.emoji === emoji
      );
      if (existingReaction) {
        await deleteReaction(existingReaction.$id);
      } else {
        await createReaction({
          userId: user.$id,
          targetId: msgId,
          targetType: TargetType.COMMENT,
          emoji: emoji
        });
      }
      loadHuddleMessages();
    } catch (e) {
      console.error('Failed to toggle reaction:', e);
    }
  };

  // Voice note toggle logic (start/stop)
  const toggleRecording = async () => {
    if (isRecording) {
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
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
          if (recordingIntervalRef.current) {
            clearInterval(recordingIntervalRef.current);
            recordingIntervalRef.current = null;
          }
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
          
          stream.getTracks().forEach(track => track.stop());

          setSending(true);
          try {
            const uploaded = await StorageService.uploadFile(audioFile, 'voice');
            const res = await createComment(chatNoteId, JSON.stringify({
              text: 'Voice Note',
              type: 'voice',
              voiceFileId: uploaded.$id,
              sendToGeneral: true
            }));
            if (res && res.$id) {
              try {
                const stored = localStorage.getItem('kylrix_my_comments');
                const list = stored ? JSON.parse(stored) : [];
                list.push(res.$id);
                localStorage.setItem('kylrix_my_comments', JSON.stringify(list));
                setMyCommentIds(list);
              } catch (e) {
                console.warn('Failed to save comment ID to local storage:', e);
              }
            }
          } catch (error) {
            console.error('Failed to send voice note comment:', error);
          } finally {
            setSending(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingSeconds(0);
        
        recordingIntervalRef.current = setInterval(() => {
          setRecordingSeconds(s => s + 1);
        }, 1000);

        recordingTimerRef.current = setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setIsRecording(false);
        }, 120000);

      } catch (err) {
        console.error("Failed to start recording:", err);
        alert("Microphone access is required for voice notes.");
      }
    }
  };

  // Split messages into general huddle list vs thread huddle replies
  const generalMessages = useMemo(() => {
    return messages.filter(m => {
      if (!m.parentCommentId) return true;
      const parsed = parseMessageContent(m.content);
      return parsed.sendToGeneral !== false;
    });
  }, [messages, parseMessageContent]);

  const threadReplies = useMemo(() => {
    const groups: Record<string, any[]> = {};
    messages.forEach(m => {
      if (m.parentCommentId) {
        if (!groups[m.parentCommentId]) groups[m.parentCommentId] = [];
        groups[m.parentCommentId].push(m);
      }
    });
    return groups;
  }, [messages]);

  const threadMessages = useMemo(() => {
    if (!activeThreadParent) return [];
    return messages.filter(m => m.parentCommentId === activeThreadParent.id);
  }, [messages, activeThreadParent]);

  return (
    <Box sx={{ 
      bgcolor: '#0A0908', 
      position: 'fixed',
      top: '88px', // Start below the main topbar
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1200,
      overflow: 'hidden',
      display: 'flex', 
      flexDirection: 'column', 
    }}>

      {/* Dynamic Pinned Header */}

      <Stack 
        direction="row" 
        justifyContent="space-between" 
        alignItems="center" 
        sx={{ 
          p: { xs: 1.5, sm: 2 }, 
          borderBottom: '1px solid rgba(255,255,255,0.06)', 
          bgcolor: '#0E0C0A',
          zIndex: 10,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '72px'
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center">
          <IconButton 
            onClick={onBack}
            sx={{ 
              color: '#fff', 
              bgcolor: '#161412',
              border: '1px solid #1C1A18',
              '&:hover': { bgcolor: '#1C1A18' }
            }}
          >
            <ArrowLeft size={18} />
          </IconButton>
          
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: '#fff' }}>
              {title}
            </Typography>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
              <Globe size={10} color="#F59E0B" />
              <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Standard Huddle Chat
              </Typography>
              {expiresAt && (
                <>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.65rem' }}>•</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: '0.65rem' }}>
                    Vanishes: {new Date(expiresAt).toLocaleDateString()}
                  </Typography>
                </>
              )}
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {shareLink && (
            <IconButton
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                showSuccess('Share link copied');
              }}
              sx={{
                color: 'rgba(255,255,255,0.6)',
                bgcolor: '#161412',
                border: '1px solid #1C1A18',
                '&:hover': { color: '#fff', bgcolor: '#1C1A18' }
              }}
            >
              <Copy size={16} />
            </IconButton>
          )}

          {participants.length > 0 && (
            <Stack direction="row" spacing={-1} sx={{ display: { xs: 'none', sm: 'flex' } }}>
              {participants.map((p, idx) => (
                <IdentityAvatar 
                  key={p.$id || p.userId}
                  size={32}
                  src={p.profilePicId || p.avatar}
                  fallback={p.name?.[0].toUpperCase() || 'U'}
                  sx={{ border: '2px solid #0A0908', zIndex: 10 - idx }}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </Stack>

      {/* Main Viewport Container */}
      <Box sx={{ 
        flex: 1, 
        minHeight: 0, 
        display: 'flex', 
        flexDirection: 'column', 
        position: 'relative', 
        overflow: 'hidden',
        m: { xs: 1, sm: 2 },
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.05)',
        bgcolor: '#080706',
        pt: '72px'
      }}>
        <MuralPattern />

        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(10,9,8,0.7)', zIndex: 3 }}>
            <CircularProgress size={28} sx={{ color: '#F59E0B' }} />
          </Box>
        )}

        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'row', 
          minHeight: 0, 
          position: 'relative', 
          zIndex: 1,
          overflow: 'hidden'
        }}>
          {/* Left Side: Messages Viewport */}
          <Box sx={{ 
            flex: activeThreadParent ? { xs: 0, md: 0.6 } : 1, 
            display: activeThreadParent ? { xs: 'none', md: 'flex' } : 'flex',
            flexDirection: 'column', 
            minHeight: 0,
            borderRight: activeThreadParent ? '1px solid rgba(255,255,255,0.06)' : 'none',
            position: 'relative' // relative context for input bar
          }}>
            <Box sx={{ 
              flex: 1, 
              overflowY: 'auto', 
              p: 2, 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 1.75,
              pb: 'calc(80px + env(safe-area-inset-bottom))', // Prevent overlapping content
              '&::-webkit-scrollbar': { width: '6px' },

              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.06)', borderRadius: '10px' },
              '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.12)' }
            }}>
              {generalMessages.length === 0 ? (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                  <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 700 }}>No messages yet. Say hello!</Typography>
                </Box>
              ) : (
                generalMessages.map((msg) => {
                  const isDeviceOwner = myCommentIds.includes(msg.id);
                  const isSelf = msg.senderId === user?.$id || isDeviceOwner;
                  const parsed = parseMessageContent(msg.content);
                  const replyCount = threadReplies[msg.id]?.length || 0;

                  return (
                    <Box key={msg.id} sx={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '80%', display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.75, textAlign: isSelf ? 'right' : 'left' }}>
                        {isDeviceOwner ? 'You' : msg.senderName} {msg.parentCommentId && '• Thread Reply'}
                      </Typography>
                      
                      <Paper 
                        elevation={0}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setMessageAnchorEl({ el: e.currentTarget, msg });
                        }}
                        onClick={(e) => handleMessageClick(e, msg)}
                        onTouchStart={(e) => handleTouchStart(e, msg)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        sx={{
                          p: parsed.type === 'voice' ? 1.25 : 1.75,
                          borderRadius: isSelf ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                          bgcolor: isSelf ? '#1C1A18' : '#161412', 
                          backgroundImage: 'none',
                          border: '1px solid #23211F',
                          borderRight: isSelf ? '3px solid #F59E0B' : '1px solid #23211F',
                          borderLeft: !isSelf ? '3px solid #34322F' : '1px solid #23211F',
                          color: isSelf ? '#FFFFFF' : '#F5F2ED',
                          boxShadow: '0 4px 12px -4px rgba(0,0,0,0.8)',
                          position: 'relative',
                          zIndex: 2,
                          cursor: 'context-menu',
                          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                          '&:hover': {
                              transform: 'translateY(-1px)',
                              boxShadow: '0 6px 16px -4px rgba(0,0,0,0.9)',
                          }
                        }}
                      >
                        {parsed.type === 'voice' && parsed.voiceFileId ? (
                          <VoiceMessage url={StorageService.getFileView(parsed.voiceFileId, 'voice')} />
                        ) : (
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {parsed.text}
                          </Typography>
                        )}
                      </Paper>

                      {/* Reactions Badge Group */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
                          {Object.entries(
                            msg.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                              if (!acc[r.emoji]) acc[r.emoji] = [];
                              acc[r.emoji].push(r.userId);
                              return acc;
                            }, {} as Record<string, string[]>)
                          ).map(([emoji, userIds]) => {
                            const hasReacted = (userIds as any[]).includes(user?.$id);
                            return (
                              <Chip
                                key={emoji}
                                label={`${emoji} ${(userIds as any[]).length}`}
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReact(msg.id, emoji);
                                }}
                                sx={{
                                  bgcolor: hasReacted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                                  color: hasReacted ? '#F59E0B' : 'rgba(255,255,255,0.5)',
                                  border: `1px solid ${hasReacted ? alpha('#F59E0B', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                  height: 20,
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: hasReacted ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.08)'
                                  }
                                }}
                              />
                            );
                          })}
                        </Box>
                      )}

                      {/* Thread Replies Button */}
                      {replyCount > 0 && (
                        <Button
                          size="small"
                          startIcon={<MessageSquare size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveThreadParent(msg);
                          }}
                          sx={{
                            alignSelf: isSelf ? 'flex-end' : 'flex-start',
                            mt: 0.75,
                            color: '#F59E0B',
                            fontWeight: 800,
                            textTransform: 'none',
                            fontSize: '0.75rem',
                            bgcolor: 'rgba(245, 158, 11, 0.04)',
                            px: 1.5,
                            borderRadius: '8px',
                            border: '1px solid rgba(245, 158, 11, 0.1)',
                            '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.08)', borderColor: '#F59E0B' }
                          }}
                        >
                          {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                        </Button>
                      )}

                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', display: 'block', mt: 0.5, textAlign: isSelf ? 'right' : 'left', fontWeight: 700 }}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                    </Box>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </Box>

            {/* Input Bar */}
            {editingMessage ? (
              <Box 
                component="form" 
                onSubmit={handleSaveEdit} 
                sx={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  px: { xs: 1.5, md: 2 },
                  pb: 'max(1rem, env(safe-area-inset-bottom))', 
                  pt: 1.5,
                  bgcolor: '#161412', 
                  borderTop: '1px solid #1C1A18',
                  borderRadius: '24px 24px 0 0',
                  boxShadow: '0 -4px 24px rgba(0,0,0,0.6)',
                  zIndex: 20 
                }}
              >
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900 }}>
                      Editing Message
                    </Typography>
                    <IconButton size="small" onClick={() => setEditingMessage(null)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                      <X size={14} />
                    </IconButton>
                  </Stack>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <TextField
                      fullWidth
                      size="small"
                      value={editInputText}
                      onChange={(e) => setEditInputText(e.target.value)}
                      variant="standard"
                      InputProps={{
                        disableUnderline: true,
                        sx: {
                          bgcolor: '#161412',
                          borderRadius: '12px',
                          color: 'white',
                          px: 2,
                          py: 1.25,
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          border: '1px solid rgba(255,255,255,0.05)',
                          transition: 'all 0.2s ease',
                          '&:hover': { borderColor: 'rgba(255,255,255,0.1)' },
                          '&.Mui-focused': { borderColor: '#F59E0B' }
                        }
                      }}
                    />
                    <Button
                      type="submit"
                      disabled={!editInputText.trim() || sending}
                      variant="contained"
                      sx={{
                        bgcolor: '#F59E0B',
                        color: '#000',
                        borderRadius: '12px',
                        textTransform: 'none',
                        fontWeight: 800,
                        px: 3,
                        py: 1.25,
                        '&:hover': { bgcolor: '#eab308' }
                      }}
                    >
                      Save
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ) : (
              <HuddleMainInput
                onSendMessage={handleSendMainMessage}
                sending={sending}
                isRecording={isRecording}
                toggleRecording={toggleRecording}
                formatRecordingTime={formatRecordingTime}
                recordingSeconds={recordingSeconds}
              />
            )}
          </Box>

          {/* Right Side: Active Thread Panel */}
          {activeThreadParent && (
            <Box sx={{ 
              flex: { xs: 1, md: 0.4 }, 
              display: 'flex', 
              flexDirection: 'column', 
              minHeight: 0,
              bgcolor: '#0E0C0A', 
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              position: 'relative',
              zIndex: 2
            }}>
              <Stack 
                direction="row" 
                justifyContent="space-between" 
                alignItems="center" 
                sx={{ 
                  p: 1.5, 
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  bgcolor: 'rgba(10, 9, 8, 0.5)' 
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton 
                    size="small" 
                    onClick={() => setActiveThreadParent(null)} 
                    sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
                  >
                    <ChevronLeft size={16} />
                  </IconButton>
                  <Typography variant="body2" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                    Thread replies
                  </Typography>
                </Stack>
                <IconButton 
                  size="small" 
                  onClick={() => setActiveThreadParent(null)} 
                  sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}
                >
                  <X size={16} />
                </IconButton>
              </Stack>

              <Box sx={{ 
                flex: 1, 
                overflowY: 'auto', 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2,
                pb: 'calc(100px + env(safe-area-inset-bottom))',
                '&::-webkit-scrollbar': { width: '4px' },
                '&::-webkit-scrollbar-track': { background: 'transparent' },
                '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }
              }}>
                <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 2, mb: 1 }}>                  <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Thread initialized by {myCommentIds.includes(activeThreadParent.id) ? 'You' : activeThreadParent.senderName}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Paper
                      elevation={0}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMessageAnchorEl({ el: e.currentTarget, msg: activeThreadParent });
                      }}
                      onTouchStart={(e) => handleTouchStart(e, activeThreadParent)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      sx={{
                        p: 1.5,
                        borderRadius: '4px 20px 20px 20px',
                        bgcolor: '#161412',
                        border: '1px solid #23211F',
                        borderLeft: '3px solid #F59E0B',
                        color: '#F5F2ED',
                        cursor: 'context-menu',
                        transition: 'all 0.2s ease',
                        '&:hover': { bgcolor: '#1C1A18' }
                      }}
                    >
                      {(() => {
                        const parsedParent = parseMessageContent(activeThreadParent.content);
                        if (parsedParent.type === 'voice' && parsedParent.voiceFileId) {
                          return <VoiceMessage url={StorageService.getFileView(parsedParent.voiceFileId, 'voice')} />;
                        }
                        return (
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {parsedParent.text}
                          </Typography>
                        );
                      })()}
                    </Paper>

                    {/* Thread Parent Reactions */}
                    {activeThreadParent.reactions && activeThreadParent.reactions.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignSelf: 'flex-start' }}>
                        {Object.entries(
                          activeThreadParent.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                            if (!acc[r.emoji]) acc[r.emoji] = [];
                            acc[r.emoji].push(r.userId);
                            return acc;
                          }, {} as Record<string, string[]>)
                        ).map(([emoji, userIds]) => {
                          const hasReacted = (userIds as any[]).includes(user?.$id);
                          return (
                            <Chip
                              key={emoji}
                              label={`${emoji} ${(userIds as any[]).length}`}
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReact(activeThreadParent.id, emoji);
                              }}
                              sx={{
                                bgcolor: hasReacted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                                color: hasReacted ? '#F59E0B' : 'rgba(255,255,255,0.5)',
                                border: `1px solid ${hasReacted ? alpha('#F59E0B', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: hasReacted ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.08)'
                                }
                              }}
                            />
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Box>
                {threadMessages.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35, py: 4 }}>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 700 }}>No replies yet. Send a reply below!</Typography>
                  </Box>
                ) : (
                  threadMessages.map(reply => {
                    const isDeviceReply = myCommentIds.includes(reply.id);
                    const isSelfReply = reply.senderId === user?.$id || isDeviceReply;
                    const parsedReply = parseMessageContent(reply.content);
                    return (
                      <Box key={reply.id} sx={{ alignSelf: isSelfReply ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.5, textAlign: isSelfReply ? 'right' : 'left' }}>
                          {isDeviceReply ? 'You' : reply.senderName}
                        </Typography>
                        <Paper
                          elevation={0}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setMessageAnchorEl({ el: e.currentTarget, msg: reply });
                          }}
                          onTouchStart={(e) => handleTouchStart(e, reply)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          sx={{
                            p: parsedReply.type === 'voice' ? 1.25 : 1.75,
                            borderRadius: isSelfReply ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                            bgcolor: isSelfReply ? '#1C1A18' : '#161412',
                            border: '1px solid #23211F',
                            borderRight: isSelfReply ? '3px solid #F59E0B' : '1px solid #23211F',
                            borderLeft: !isSelfReply ? '3px solid #34322F' : '1px solid #23211F',
                            color: isSelfReply ? '#FFFFFF' : '#F5F2ED',
                            cursor: 'context-menu',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                            zIndex: 2,
                            '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            }
                          }}
                        >
                          {parsedReply.type === 'voice' && parsedReply.voiceFileId ? (
                            <VoiceMessage url={StorageService.getFileView(parsedReply.voiceFileId, 'voice')} />
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {parsedReply.text}
                            </Typography>
                          )}
                        </Paper>

                        {/* Reply Reactions */}
                        {reply.reactions && reply.reactions.length > 0 && (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignSelf: isSelfReply ? 'flex-end' : 'flex-start' }}>
                            {Object.entries(
                              reply.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                                if (!acc[r.emoji]) acc[r.emoji] = [];
                                acc[r.emoji].push(r.userId);
                                return acc;
                              }, {} as Record<string, string[]>)
                            ).map(([emoji, userIds]) => {
                              const hasReacted = (userIds as any[]).includes(user?.$id);
                              return (
                                <Chip
                                  key={emoji}
                                  label={`${emoji} ${(userIds as any[]).length}`}
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(reply.id, emoji);
                                  }}
                                  sx={{
                                    bgcolor: hasReacted ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)',
                                    color: hasReacted ? '#F59E0B' : 'rgba(255,255,255,0.5)',
                                    border: `1px solid ${hasReacted ? alpha('#F59E0B', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    '&:hover': {
                                      bgcolor: hasReacted ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255,255,255,0.08)'
                                    }
                                  }}
                                />
                              );
                            })}
                          </Box>
                        )}

                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.65rem', display: 'block', mt: 0.5, textAlign: isSelfReply ? 'right' : 'left', fontWeight: 700 }}>
                          {new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Box>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </Box>
              <HuddleThreadInput
                onSendThreadMessage={handleSendThreadMessage}
                sending={sending}
              />
            </Box>
          )}
        </Box>
      </Box>

      {/* Message Options / Reactions Popover Menu */}
      <Popover
        open={Boolean(messageAnchorEl)}
        anchorEl={messageAnchorEl?.el}
        onClose={() => setMessageAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          sx: {
            bgcolor: '#13110F',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            p: 1.5,
            color: '#fff',
            backgroundImage: 'none',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)'
          }
        }}
      >
        <Stack spacing={1.5}>
          {/* Reaction Quick Picker */}
          <Stack direction="row" spacing={1} sx={{ borderBottom: '1px solid rgba(255,255,255,0.06)', pb: 1 }}>
            {['👍', '❤️', '🔥', '😂', '🙌', '😮'].map(emoji => (
              <IconButton
                key={emoji}
                size="small"
                onClick={() => {
                  if (messageAnchorEl?.msg) {
                    handleReact(messageAnchorEl.msg.id, emoji);
                    setMessageAnchorEl(null);
                  }
                }}
                sx={{ 
                  fontSize: '1.25rem',
                  p: 0.5,
                  borderRadius: '8px',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', transform: 'scale(1.15)' },
                  transition: 'all 0.15s ease'
                }}
              >
                {emoji}
              </IconButton>
            ))}
          </Stack>

          {/* Action Items */}
          <Stack spacing={0.5}>
            <Button
              size="small"
              startIcon={<MessageSquare size={14} />}
              onClick={() => {
                if (messageAnchorEl?.msg) {
                  const msg = messageAnchorEl.msg;
                  if (msg.parentCommentId) {
                    const parent = messages.find(m => m.id === msg.parentCommentId);
                    if (parent) {
                      setActiveThreadParent(parent);
                    }
                  } else {
                    setActiveThreadParent(msg);
                  }
                  setMessageAnchorEl(null);
                }
              }}
              sx={{ 
                justifyContent: 'flex-start', 
                color: 'rgba(255,255,255,0.7)', 
                textTransform: 'none', 
                fontWeight: 700,
                px: 1.5,
                py: 0.75,
                borderRadius: '8px',
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
              }}
            >
              Reply
            </Button>
            <Button
              size="small"
              startIcon={<Copy size={14} />}
              onClick={() => {
                if (messageAnchorEl?.msg) {
                  const content = parseMessageContent(messageAnchorEl.msg.content);
                  navigator.clipboard.writeText(content.text);
                  showSuccess('Message copied to clipboard');
                  setMessageAnchorEl(null);
                }
              }}
              sx={{ 
                justifyContent: 'flex-start', 
                color: 'rgba(255,255,255,0.7)', 
                textTransform: 'none', 
                fontWeight: 700,
                px: 1.5,
                py: 0.75,
                borderRadius: '8px',
                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
              }}
            >
              Copy Text
            </Button>
            {(messageAnchorEl?.msg?.senderId === user?.$id || (messageAnchorEl?.msg && myCommentIds.includes(messageAnchorEl.msg.id))) && (
              <>
                <Button
                  size="small"
                  startIcon={<Edit size={14} />}
                  onClick={() => {
                    if (messageAnchorEl?.msg) {
                      handleStartEdit(messageAnchorEl.msg);
                    }
                  }}
                  sx={{ 
                    justifyContent: 'flex-start', 
                    color: 'rgba(255,255,255,0.7)', 
                    textTransform: 'none', 
                    fontWeight: 700,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: '8px',
                    '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.04)' }
                  }}
                >
                  Edit Message
                </Button>
                <Button
                  size="small"
                  startIcon={<Trash2 size={14} />}
                  onClick={async () => {
                    if (messageAnchorEl?.msg) {
                      try {
                        await databases.deleteRow(APPWRITE_CONFIG.DATABASES.NOTE, 'comments', messageAnchorEl.msg.id);
                        showSuccess('Message deleted');
                        loadHuddleMessages();
                      } catch (e) {
                        console.error('Delete message failed:', e);
                      }
                      setMessageAnchorEl(null);
                    }
                  }}
                  sx={{ 
                    justifyContent: 'flex-start', 
                    color: '#FF453A', 
                    textTransform: 'none', 
                    fontWeight: 700,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: '8px',
                    '&:hover': { bgcolor: alpha('#FF453A', 0.08) }
                  }}
                >
                  Delete Message
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Popover>
    </Box>
  );
}

interface HuddleMainInputProps {
  onSendMessage: (text: string) => Promise<boolean>;
  sending: boolean;
  isRecording: boolean;
  toggleRecording: () => void;
  formatRecordingTime: (secs: number) => string;
  recordingSeconds: number;
}

function HuddleMainInput({
  onSendMessage,
  sending,
  isRecording,
  toggleRecording,
  formatRecordingTime,
  recordingSeconds
}: HuddleMainInputProps) {
  const [inputText, setInputText] = useState('');
  const { showSuccess, showError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    const success = await onSendMessage(inputText);
    if (success) {
      setInputText('');
    }
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit} 
      sx={{ 
        position: 'absolute', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        px: { xs: 1.5, md: 2 },
        pb: 'max(1rem, env(safe-area-inset-bottom))', 
        pt: 1.5,
        bgcolor: '#161412', 
        borderTop: '1px solid #1C1A18',
        borderRadius: '24px 24px 0 0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.6)',
        zIndex: 20 
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <IconButton
          onClick={toggleRecording}
          disabled={sending}
          sx={{
            color: isRecording ? '#ff4d4d' : 'rgba(255,255,255,0.4)',
            width: 44,
            height: 44,
            flexShrink: 0,
            bgcolor: '#161412',
            border: `1px solid ${isRecording ? '#ff4d4d' : 'rgba(255,255,255,0.05)'}`,
            borderRadius: '12px',
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: '#1C1A18',
              borderColor: isRecording ? '#ff4d4d' : '#F59E0B',
              color: '#fff',
            },
          }}
        >
          {isRecording ? <Square size={18} fill="#ff4d4d" /> : <Mic size={20} />}
        </IconButton>

        <Box sx={{ flexGrow: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          {isRecording && (
            <Box sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: '#0A0908',
              borderRadius: '12px',
              border: '1px solid #ff4d4d',
              display: 'flex',
              alignItems: 'center',
              px: 2,
              gap: 2,
              zIndex: 2,
              animation: 'pulse 2s infinite ease-in-out',
            }}>
              <Box sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: '#ff4d4d',
                animation: 'blink 1s infinite',
              }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 800, flexGrow: 1 }}>
                Recording audio note... click square to send
              </Typography>
              <Typography sx={{ color: '#ff4d4d', fontSize: '0.85rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                {formatRecordingTime(recordingSeconds)}
              </Typography>
            </Box>
          )}

          <TextField
            fullWidth
            size="small"
            value={inputText}
            disabled={isRecording}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isRecording ? "Recording..." : "Type unencrypted huddle message..."}
            onKeyDown={async (e) => {
              if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const val = inputText.trim();
                if (!val) {
                  showError('Type a message first to secure it.');
                  return;
                }
                setInputText('Securing message payload...');
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
                  const url = `${origin}/send/${note.$id}/${titleEnc.key}`;
                  
                  // Cache in localStorage stash
                  try {
                    const existing = JSON.parse(localStorage.getItem('kylrix_send_sparks') || '[]');
                    const newSpark = {
                      id: note.$id,
                      kind: 'note',
                      title: 'Secure Note',
                      url,
                      expiresAt,
                    };
                    localStorage.setItem('kylrix_send_sparks', JSON.stringify([newSpark, ...existing]));
                  } catch (err) {
                    console.warn('Failed to cache spark:', err);
                  }
                  
                  setInputText(url);
                  showSuccess('Message secured as Zero-Knowledge Ghost Note!');
                } catch (err) {
                  console.error('Failed to secure message:', err);
                  setInputText(val);
                  showError('Failed to secure message.');
                }
                return;
              }
            }}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                bgcolor: '#161412',
                borderRadius: '12px',
                color: 'white',
                px: 2,
                py: 1.25,
                fontWeight: 600,
                fontSize: '0.85rem',
                border: '1px solid rgba(255,255,255,0.05)',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: 'rgba(255,255,255,0.1)' },
                '&.Mui-focused': { borderColor: '#F59E0B' }
              }
            }}
          />
        </Box>
        
        <IconButton 
          type="submit"
          disabled={!inputText.trim() || sending || isRecording}
          sx={{
            bgcolor: '#F59E0B',
            color: '#000',
            borderRadius: '12px',
            width: 44,
            height: 44,
            flexShrink: 0,
            transition: 'all 0.2s ease',
            '&:hover': { bgcolor: '#eab308' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.1)' }
          }}
        >
          <Send size={18} />
        </IconButton>
      </Stack>
    </Box>
  );
}

interface HuddleThreadInputProps {
  onSendThreadMessage: (text: string, sendToGeneral: boolean) => Promise<boolean>;
  sending: boolean;
}

function HuddleThreadInput({
  onSendThreadMessage,
  sending
}: HuddleThreadInputProps) {
  const [threadInputText, setThreadInputText] = useState('');
  const { showSuccess, showError } = useToast();
  const [sendToGeneralChecked, setSendToGeneralChecked] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!threadInputText.trim() || sending) return;
    const success = await onSendThreadMessage(threadInputText, sendToGeneralChecked);
    if (success) {
      setThreadInputText('');
    }
  };

  return (
    <Box 
      component="form" 
      onSubmit={handleSubmit}
      sx={{ 
        p: 1.5, 
        borderTop: '1px solid rgba(255,255,255,0.05)', 
        bgcolor: 'rgba(10, 9, 8, 0.95)',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20
      }}
    >
      <Stack spacing={1}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            fullWidth
            size="small"
            value={threadInputText}
            onChange={(e) => setThreadInputText(e.target.value)}
            placeholder="Reply in thread..."
            onKeyDown={async (e) => {
              if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const val = threadInputText.trim();
                if (!val) {
                  showError('Type a message first to secure it.');
                  return;
                }
                setThreadInputText('Securing message payload...');
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
                  const url = `${origin}/send/${note.$id}/${titleEnc.key}`;
                  
                  // Cache in localStorage stash
                  try {
                    const existing = JSON.parse(localStorage.getItem('kylrix_send_sparks') || '[]');
                    const newSpark = {
                      id: note.$id,
                      kind: 'note',
                      title: 'Secure Note',
                      url,
                      expiresAt,
                    };
                    localStorage.setItem('kylrix_send_sparks', JSON.stringify([newSpark, ...existing]));
                  } catch (err) {
                    console.warn('Failed to cache spark:', err);
                  }
                  
                  setThreadInputText(url);
                  showSuccess('Message secured as Zero-Knowledge Ghost Note!');
                } catch (err) {
                  console.error('Failed to secure message:', err);
                  setThreadInputText(val);
                  showError('Failed to secure message.');
                }
                return;
              }
            }}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              sx: {
                bgcolor: '#161412',
                borderRadius: '8px',
                color: 'white',
                px: 1.5,
                py: 1,
                fontWeight: 600,
                fontSize: '0.8rem',
                border: '1px solid rgba(255,255,255,0.05)'
              }
            }}
          />
          <IconButton 
            type="submit"
            disabled={!threadInputText.trim() || sending}
            sx={{
              bgcolor: '#F59E0B',
              color: '#000',
              borderRadius: '8px',
              width: 36,
              height: 36,
              '&:hover': { bgcolor: '#eab308' }
            }}
          >
            <Send size={14} />
          </IconButton>
        </Stack>

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={sendToGeneralChecked}
              onChange={(e) => setSendToGeneralChecked(e.target.checked)}
              sx={{
                color: 'rgba(255,255,255,0.3)',
                p: 0.5,
                '&.Mui-focused': { color: '#F59E0B' },
                '&.Mui-checked': { color: '#F59E0B' }
              }}
            />
          }
          label="Also send to huddle"
          componentsProps={{
            typography: {
              sx: {
                fontSize: '0.7rem',
                fontWeight: 800,
                color: 'rgba(255,255,255,0.5)',
                userSelect: 'none'
              }
            }
          }}
        />
      </Stack>
    </Box>
  );
}
