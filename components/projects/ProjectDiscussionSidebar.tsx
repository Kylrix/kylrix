'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  IconButton,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
  CircularProgress,
  TextField,
  alpha,
  useTheme,
  Tooltip,
} from '@/lib/mui-tailwind/material';
import {
  ChevronLeft,
  X,
  Send,
  Mic,
  Square,
  MessageSquare,
  Globe,
  Smile,
  Copy,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Projects, Notes } from '@/types/appwrite';
import { Query, AppwriteService } from '@/lib/appwrite';
import { databases } from '@/lib/appwrite/client';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import {
  createComment,
  listComments,
  createReaction,
  deleteReaction,
  listReactions,
} from '@/lib/appwrite/note';
import { TargetType } from '@/types/appwrite';
import { client } from '@/lib/appwrite/client';
import { createGhostNoteForProject } from '@/lib/actions/client-ops';
import { VoiceMessage } from '@/components/chat/VoiceMessage';
import { StorageService } from '@/lib/services/storage';
import MuralPattern from '@/components/chat/MuralPattern';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';

interface ProjectDiscussionSidebarProps {
  project: Projects;
  fetchProjectData: () => void;
  user: any;
}

function getActiveMentionToken(value: string, caret: number | null | undefined) {
  const cursor = typeof caret === 'number' ? caret : value.length;
  const before = value.slice(0, cursor);
  const match = before.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  if (!match) return null;

  const start = before.lastIndexOf('@');
  if (start < 0) return null;

  const prefix = before.slice(0, start);
  if (prefix.length > 0) {
    const prev = prefix[prefix.length - 1];
    if (!/[\s(]/.test(prev)) return null;
  }

  return {
    query: match[1] || '',
    start,
    end: cursor,
  };
}

function renderMessageText(text: string): React.ReactNode {
  const MENTION_REGEX = /(^|[\s(])@([a-zA-Z0-9_]+)/g;
  const pieces: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const [full, prefix, username] = match;
    const start = match.index;
    const end = start + full.length;

    if (start > lastIndex) {
      pieces.push(text.slice(lastIndex, start));
    }

    if (prefix) {
      pieces.push(prefix);
    }

    pieces.push(
      <Box
        component="span"
        key={`${start}-${username}`}
        sx={{
          color: '#6366F1',
          fontWeight: 800,
          bgcolor: 'rgba(99, 102, 241, 0.08)',
          px: 0.4,
          py: 0.1,
          borderRadius: '4px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9em',
          userSelect: 'text',
        }}
      >
        @{username}
      </Box>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    pieces.push(text.slice(lastIndex));
  }

  return <Box component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pieces}</Box>;
}

export function ProjectDiscussionSidebar({
  project,
  fetchProjectData,
  user,
}: ProjectDiscussionSidebarProps) {
  const theme = useTheme();
  const { closeSidebar } = useDynamicSidebar();
  const { showSuccess, showError } = useToast();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Thread and Reactions states
  const [activeThreadParent, setActiveThreadParent] = useState<any | null>(null);
  const [threadInputText, setThreadInputText] = useState('');
  const [sendToGeneralChecked, setSendToGeneralChecked] = useState(true);

  // Mention Autocomplete States & Refs
  const [mentionAnchorEl, setMentionAnchorEl] = useState<HTMLDivElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionActiveRange, setMentionActiveRange] = useState<{ start: number; end: number } | null>(null);
  const [mentionInputSource, setMentionInputSource] = useState<'general' | 'thread'>('general');
  const mentionContainerRef = useRef<HTMLDivElement | null>(null);
  const threadMentionContainerRef = useRef<HTMLDivElement | null>(null);

  const closeMentionSuggestions = useCallback(() => {
    setMentionAnchorEl(null);
    setMentionResults([]);
    setMentionQuery('');
    setMentionActiveRange(null);
    setMentionLoading(false);
  }, []);

  const handleInputChange = useCallback((text: string, selectionStart: number, type: 'general' | 'thread') => {
    if (type === 'general') {
      setInputText(text);
    } else {
      setThreadInputText(text);
    }

    const caret = selectionStart;
    const active = getActiveMentionToken(text, caret);
    if (active) {
      setMentionQuery(active.query);
      setMentionActiveRange({ start: active.start, end: active.end });
      setMentionInputSource(type);
      setMentionAnchorEl(type === 'general' ? mentionContainerRef.current : threadMentionContainerRef.current);
    } else {
      closeMentionSuggestions();
    }
  }, [closeMentionSuggestions]);

  const replaceActiveMention = useCallback((item: any) => {
    if (!mentionActiveRange) return;
    const mention = `@${item.username || item.title.replace(/\s+/g, '').toLowerCase()}`;
    const currentValue = mentionInputSource === 'general' ? inputText : threadInputText;
    const nextValue = `${currentValue.slice(0, mentionActiveRange.start)}${mention} ${currentValue.slice(mentionActiveRange.end)}`;

    if (mentionInputSource === 'general') {
      setInputText(nextValue);
    } else {
      setThreadInputText(nextValue);
    }
    closeMentionSuggestions();
  }, [mentionActiveRange, mentionInputSource, inputText, threadInputText, closeMentionSuggestions]);

  useEffect(() => {
    if (!mentionQuery.trim()) {
      setMentionResults([]);
      setMentionLoading(false);
      return;
    }

    let alive = true;
    const timer = setTimeout(async () => {
      setMentionLoading(true);
      try {
        const docs = await searchGlobalUsers(mentionQuery.trim(), 6);
        if (!alive) return;
        const mapped = docs.map((doc: any) => {
          const id = doc?.$id || doc?.id || doc?.userId;
          const username = String(doc?.username || doc?.prefs?.username || doc?.displayName || doc?.name || '').replace(/^@+/, '').trim().toLowerCase();
          return {
            id,
            title: doc?.displayName || doc?.name || username || 'Profile',
            username: username || null,
            avatar: doc?.avatar || doc?.profilePicId || doc?.prefs?.profilePicId || null,
          };
        });
        setMentionResults(mapped);
      } catch (err) {
        if (alive) setMentionResults([]);
      } finally {
        if (alive) setMentionLoading(false);
      }
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [mentionQuery]);

  // Voice recording states and refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const metadata = useMemo(() => {
    try {
      return JSON.parse(project.metadata || '{}');
    } catch {
      return {};
    }
  }, [project.metadata]);

  const chatNoteId = metadata.discussionNoteId;
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

  const handleTouchStart = useCallback((e: React.TouchEvent, msg: any) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    const currentTarget = e.currentTarget as HTMLElement;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(10);
    }, 600);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
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

  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  }, []);

  const handleMessageClick = useCallback((e: React.MouseEvent, msg: any) => {
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

  // Format voice recording seconds into beautiful MM:SS string
  const formatRecordingTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Safe JSON parser helper
  const parseMessageContent = useCallback((rawContent: string) => {
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || sending) return;
    setSending(true);

    try {
      if (chatNoteId) {
        await createComment(chatNoteId, JSON.stringify({
          text: inputText.trim(),
          type: 'text',
          sendToGeneral: true
        }));
      }
      setInputText('');
    } catch (err) {
      console.error('Failed to send message:', err);
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
      // Stop recording
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
      // Start recording
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
            if (chatNoteId) {
              await createComment(chatNoteId, JSON.stringify({
                text: 'Voice Note',
                type: 'voice',
                voiceFileId: uploaded.$id,
                sendToGeneral: true
              }));
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

        // Limit recording to 120 seconds
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

  const handleInitHuddle = async () => {
    setLoading(true);
    try {
      await createGhostNoteForProject(project.$id, `${project.title} Discussion`);
      fetchProjectData();
    } catch (err) {
      console.error('Failed to initialize huddle thread:', err);
    } finally {
      setLoading(false);
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

  // Mentions list dropdown
  const showMentions = mentionAnchorEl && mentionResults.length > 0;

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      bgcolor: '#0A0908',
      overflow: 'hidden',
      position: 'relative'
    }}>
      
      {/* 1. Header (Fixed/Anchored at top) */}
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        p: 2.5,
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        bgcolor: '#0A0908',
        zIndex: 10
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            {activeThreadParent && (
              <IconButton
                onClick={() => setActiveThreadParent(null)}
                sx={{ color: theme.palette.text.secondary, mr: 0.5 }}
              >
                <ChevronLeft size={18} />
              </IconButton>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontWeight: 900,
                  fontFamily: '"Space Grotesk", sans-serif',
                  color: '#6366F1',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '1.05rem'
                }}
              >
                {activeThreadParent ? 'Thread replies' : 'Project Discussion'}
              </Typography>
              <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', fontWeight: 600 }}>
                {project.title}
              </Typography>
            </Box>
          </Stack>

          <IconButton
            onClick={closeSidebar}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': { color: 'white', bgcolor: alpha(theme.palette.text.primary, 0.08) }
            }}
          >
            <X size={18} />
          </IconButton>
        </Box>
      </Box>

      {/* 2. Middle Content (Free scroll chat viewport) */}
      <Box sx={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#080706'
      }}>
        <MuralPattern />

        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(10,9,8,0.7)', zIndex: 3 }}>
            <CircularProgress size={28} sx={{ color: '#6366F1' }} />
          </Box>
        )}

        {!chatNoteId ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#6366F1', border: '1px solid rgba(99, 102, 241, 0.15)', mb: 2.5 }}>
              <Globe size={26} />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>Initialize Public Huddle</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', maxWidth: 300, lineHeight: 1.5, mb: 3 }}>
              A temporary public comment thread lets your team coordinate tasks, tag members, and comment on assets. Messages automatically clean up in 7 days.
            </Typography>
            <Button
              onClick={handleInitHuddle}
              sx={{ bgcolor: '#6366F1', color: '#fff', fontWeight: 800, fontSize: '0.8rem', py: 1.25, px: 3, borderRadius: '10px', textTransform: 'none', '&:hover': { bgcolor: '#575CF0' } }}
            >
              Start Huddle
            </Button>
          </Box>
        ) : (
          /* Scrollable Messages view */
          <Box sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minHeight: 0,
            '&::-webkit-scrollbar': { width: '5px' },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }
          }}>
            {activeThreadParent ? (
              /* THREAD REPLIES VIEW */
              <>
                <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)', pb: 2, mb: 1 }}>
                  <Typography variant="caption" sx={{ color: '#818CF8', fontWeight: 900, mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Thread initialized by {activeThreadParent.senderName}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        borderRadius: '4px 20px 20px 20px',
                        bgcolor: '#161412',
                        border: '1px solid #23211F',
                        borderLeft: '3px solid #818CF8',
                        color: '#F5F2ED',
                      }}
                    >
                      {(() => {
                        const parsedParent = parseMessageContent(activeThreadParent.content);
                        if (parsedParent.type === 'voice' && parsedParent.voiceFileId) {
                          return <VoiceMessage url={StorageService.getFileView(parsedParent.voiceFileId, 'voice')} />;
                        }
                        return (
                          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                            {renderMessageText(parsedParent.text)}
                          </Typography>
                        );
                      })()}
                    </Paper>

                    {/* Parent Reactions */}
                    {activeThreadParent.reactions && activeThreadParent.reactions.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75, alignSelf: 'flex-start' }}>
                        {Object.entries(
                          activeThreadParent.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                            if (!acc[r.emoji]) acc[r.emoji] = [];
                            acc[r.emoji].push(r.userId);
                            return acc;
                          }, {})
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
                                bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                color: hasReacted ? '#818CF8' : 'rgba(255,255,255,0.5)',
                                border: `1px solid ${hasReacted ? alpha('#818CF8', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 800,
                                cursor: 'pointer',
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
                    const isSelfReply = reply.senderId === user?.$id;
                    const parsedReply = parseMessageContent(reply.content);
                    return (
                      <Box key={reply.id} sx={{ alignSelf: isSelfReply ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.5, textAlign: isSelfReply ? 'right' : 'left' }}>
                          {reply.senderName}
                        </Typography>
                        <Paper
                          elevation={0}
                          sx={{
                            p: parsedReply.type === 'voice' ? 1.25 : 1.75,
                            borderRadius: isSelfReply ? '20px 4px 20px 20px' : '4px 20px 20px 20px',
                            bgcolor: isSelfReply ? '#1C1A18' : '#161412',
                            border: '1px solid #23211F',
                            borderRight: isSelfReply ? '3px solid #6366F1' : '1px solid #23211F',
                            borderLeft: !isSelfReply ? '3px solid #34322F' : '1px solid #23211F',
                            color: isSelfReply ? '#FFFFFF' : '#F5F2ED',
                            boxShadow: '0 4px 12px -4px rgba(0,0,0,0.8)',
                          }}
                        >
                          {parsedReply.type === 'voice' && parsedReply.voiceFileId ? (
                            <VoiceMessage url={StorageService.getFileView(parsedReply.voiceFileId, 'voice')} />
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.5, wordBreak: 'break-word' }}>
                              {renderMessageText(parsedReply.text)}
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
                              }, {})
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
                                    bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                    color: hasReacted ? '#818CF8' : 'rgba(255,255,255,0.5)',
                                    border: `1px solid ${hasReacted ? alpha('#818CF8', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
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
              </>
            ) : (
              /* GENERAL HUDDLE CHAT LIST */
              <>
                {generalMessages.length === 0 ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
                    <Typography variant="caption" sx={{ fontStyle: 'italic', fontWeight: 700 }}>No messages yet. Start the discussion!</Typography>
                  </Box>
                ) : (
                  generalMessages.map((msg) => {
                    const isSelf = msg.senderId === user?.$id;
                    const parsed = parseMessageContent(msg.content);
                    const replyCount = threadReplies[msg.id]?.length || 0;

                    return (
                      <Box key={msg.id} sx={{ alignSelf: isSelf ? 'flex-end' : 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, display: 'block', mb: 0.75, textAlign: isSelf ? 'right' : 'left' }}>
                          {msg.senderName}
                        </Typography>
                        <Paper
                          elevation={0}
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
                            borderRight: isSelf ? '3px solid #6366F1' : '1px solid #23211F',
                            borderLeft: !isSelf ? '3px solid #34322F' : '1px solid #23211F',
                            color: isSelf ? '#FFFFFF' : '#F5F2ED',
                            boxShadow: '0 4px 12px -4px rgba(0,0,0,0.8)',
                            cursor: 'pointer',
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
                              {renderMessageText(parsed.text)}
                            </Typography>
                          )}
                        </Paper>

                        {/* Reactions and Quick Emoji Picker */}
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75, alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
                          {/* Emoji Trigger */}
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReact(msg.id, '👍');
                            }}
                            sx={{
                              p: 0.5,
                              color: 'rgba(255,255,255,0.3)',
                              bgcolor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.04)',
                              borderRadius: '6px',
                              '&:hover': { color: '#818CF8', bgcolor: 'rgba(99,102,241,0.08)' }
                            }}
                          >
                            <Smile size={12} />
                          </IconButton>

                          {msg.reactions && msg.reactions.length > 0 && (
                            Object.entries(
                              msg.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                                if (!acc[r.emoji]) acc[r.emoji] = [];
                                acc[r.emoji].push(r.userId);
                                return acc;
                              }, {})
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
                                    bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255,255,255,0.03)',
                                    color: hasReacted ? '#818CF8' : 'rgba(255,255,255,0.5)',
                                    border: `1px solid ${hasReacted ? alpha('#818CF8', 0.3) : 'rgba(255,255,255,0.05)'}`,
                                    height: 20,
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    '&:hover': {
                                      bgcolor: hasReacted ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.08)'
                                    }
                                  }}
                                />
                              );
                            })
                          )}
                        </Stack>

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
                              color: '#818CF8',
                              fontWeight: 800,
                              textTransform: 'none',
                              fontSize: '0.75rem',
                              bgcolor: 'rgba(99,102,241,0.04)',
                              px: 1.5,
                              borderRadius: '8px',
                              border: '1px solid rgba(99,102,241,0.1)',
                              '&:hover': { bgcolor: 'rgba(99,102,241,0.08)', borderColor: '#818CF8' }
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
              </>
            )}
          </Box>
        )}
      </Box>

      {/* 3. Input Panel (Fixed/Anchored at bottom) */}
      {chatNoteId && (
        <Box
          component="form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (activeThreadParent) {
              if (!threadInputText.trim() || sending) return;
              setSending(true);
              try {
                await createComment(chatNoteId, JSON.stringify({
                  text: threadInputText.trim(),
                  type: 'text',
                  sendToGeneral: sendToGeneralChecked
                }), activeThreadParent.id);
                setThreadInputText('');
                loadHuddleMessages();
              } catch (err) {
                console.error('Failed to send thread reply:', err);
              } finally {
                setSending(false);
              }
            } else {
              handleSendMessage(e);
            }
          }}
          sx={{
            p: 2,
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            bgcolor: 'rgba(10, 9, 8, 0.95)',
            backdropFilter: 'blur(12px)',
            position: 'relative',
            zIndex: 20
          }}
        >
          {/* Mentions dropdown popup overlay */}
          {showMentions && (
            <Paper sx={{
              position: 'absolute',
              bottom: '100%',
              left: 16,
              right: 16,
              bgcolor: '#161412',
              border: '1px solid #23211F',
              borderRadius: '16px',
              p: 1.5,
              mb: 1.5,
              maxHeight: 180,
              overflowY: 'auto',
              boxShadow: '0 -8px 24px rgba(0,0,0,0.5)',
              zIndex: 30,
              '&::-webkit-scrollbar': { width: '4px' },
              '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.06)', borderRadius: '10px' }
            }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 900, textTransform: 'uppercase', mb: 1, display: 'block' }}>
                Mention users
              </Typography>
              <Stack spacing={0.5}>
                {mentionResults.map((item) => (
                  <Box
                    key={item.id}
                    onClick={() => replaceActiveMention(item)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' }
                    }}
                  >
                    <IdentityAvatar fileId={item.avatar} alt={item.title} fallback={item.title[0]?.toUpperCase()} size={28} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>{item.title}</Typography>
                      {item.username && <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block' }}>@{item.username}</Typography>}
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          <Stack direction="row" spacing={1.5} alignItems="center">
            {!activeThreadParent && (
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
                  '&:hover': { bgcolor: '#1C1A18', color: '#fff' }
                }}
              >
                {isRecording ? <Square size={16} fill="#ff4d4d" /> : <Mic size={18} />}
              </IconButton>
            )}

            <Box ref={activeThreadParent ? threadMentionContainerRef : mentionContainerRef} sx={{ flexGrow: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
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
                  gap: 1.5,
                  zIndex: 2,
                }}>
                  <Box sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#ff4d4d',
                    animation: 'blink 1s infinite',
                    '@keyframes blink': { '0%, 100%': { opacity: 0.3 }, '50%': { opacity: 1 } }
                  }} />
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', fontWeight: 800, flexGrow: 1 }} noWrap>
                    Recording... click stop to send
                  </Typography>
                  <Typography sx={{ color: '#ff4d4d', fontSize: '0.85rem', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>
                    {formatRecordingTime(recordingSeconds)}
                  </Typography>
                </Box>
              )}

              <TextField
                fullWidth
                size="small"
                value={activeThreadParent ? threadInputText : inputText}
                disabled={isRecording}
                onChange={(e) => handleInputChange(
                  e.target.value,
                  e.target.selectionStart ?? e.target.value.length,
                  activeThreadParent ? 'thread' : 'general'
                )}
                onBlur={() => {
                  setTimeout(() => closeMentionSuggestions(), 120);
                }}
                onFocus={(e) => {
                  const caret = e.currentTarget.selectionStart ?? (activeThreadParent ? threadInputText.length : inputText.length);
                  const active = getActiveMentionToken(activeThreadParent ? threadInputText : inputText, caret);
                  if (active) {
                    setMentionQuery(active.query);
                    setMentionActiveRange({ start: active.start, end: active.end });
                    setMentionInputSource(activeThreadParent ? 'thread' : 'general');
                    setMentionAnchorEl(activeThreadParent ? threadMentionContainerRef.current : mentionContainerRef.current);
                  }
                }}
                placeholder={activeThreadParent ? "Reply in thread..." : "Type huddle message..."}
                onKeyDown={async (e) => {
                  if (e.key === 'g' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    const currentText = activeThreadParent ? threadInputText : inputText;
                    const val = currentText.trim();
                    if (!val) {
                      showError('Type a message first to secure it.');
                      return;
                    }
                    const setVal = activeThreadParent ? setThreadInputText : setInputText;
                    setVal('Securing message payload...');
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
                      
                      setVal(url);
                      showSuccess('Message secured as Zero-Knowledge Ghost Note!');
                    } catch (err) {
                      console.error('Failed to secure message:', err);
                      setVal(val);
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
                    '&.Mui-focused': { borderColor: '#6366F1' }
                  }
                }}
              />
            </Box>

            <IconButton
              type="submit"
              disabled={sending || isRecording || (activeThreadParent ? !threadInputText.trim() : !inputText.trim())}
              sx={{
                bgcolor: '#6366F1',
                color: '#fff',
                borderRadius: '12px',
                width: 44,
                height: 44,
                flexShrink: 0,
                '&:hover': { bgcolor: '#575CF0' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.1)' }
              }}
            >
              <Send size={18} />
            </IconButton>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
