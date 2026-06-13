'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  X,
  Send,
  Mic,
  Square,
  MessageSquare,
  Globe,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  AppBar,
  Toolbar,
  Stack,
  Button,
  CircularProgress,
} from '@/lib/mui-tailwind/material';
import { useToast } from '@/components/ui/Toast';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { Projects } from '@/types/appwrite';
import { Query, AppwriteService } from '@/lib/appwrite';
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
import { formatTime } from '@/lib/time-util';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { useProUpgrade } from '@/context/ProUpgradeContext';

interface ProjectDiscussionSidebarProps {
  project: Projects;
  fetchProjectData: () => void;
  user: any;
}

type DiscussionMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  content: string;
  timestamp: number;
  parentCommentId: string | null;
  reactions: any[];
};

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

  return { query: match[1] || '', start, end: cursor };
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

    if (start > lastIndex) pieces.push(text.slice(lastIndex, start));
    if (prefix) pieces.push(prefix);

    pieces.push(
      <Box
        key={`${start}-${username}`}
        component="span"
        sx={{
          color: '#818CF8',
          fontWeight: 800,
          bgcolor: 'rgba(129, 140, 248, 0.1)',
          px: 0.5,
          py: 0.25,
          borderRadius: '4px',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.92em',
        }}
      >
        @{username}
      </Box>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) pieces.push(text.slice(lastIndex));

  return (
    <Typography component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--font-satoshi)', fontSize: '0.92rem', lineHeight: 1.55, color: '#F5F2ED' }}>
      {pieces}
    </Typography>
  );
}

function secretChatBubbleSx(isOutgoing: boolean) {
  return {
    py: 1.75,
    px: 2.5,
    width: 'fit-content',
    maxWidth: '100%',
    alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
    borderRadius: isOutgoing ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
    bgcolor: isOutgoing ? '#1E1A3C' : '#1C1A18',
    backgroundImage: 'none',
    border: '1px solid',
    borderColor: isOutgoing ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)',
    color: '#FFFFFF',
    boxShadow: isOutgoing 
      ? '0 4px 16px rgba(99, 102, 241, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.08)' 
      : '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    position: 'relative' as const,
    zIndex: 2,
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    '&:hover': {
      transform: 'translateY(-1px)',
      boxShadow: isOutgoing 
        ? '0 6px 20px rgba(99, 102, 241, 0.1)' 
        : '0 6px 20px rgba(0, 0, 0, 0.5)',
      borderColor: isOutgoing ? 'rgba(99, 102, 241, 0.4)' : 'rgba(255, 255, 255, 0.15)',
    },
  };
}

function groupCommentReactions(reactions: any[] = [], userId?: string) {
  const groups = new Map<string, { emoji: string; count: number; reactedBySelf: boolean }>();
  reactions.forEach((r) => {
    if (!r?.emoji) return;
    const existing = groups.get(r.emoji);
    if (existing) {
      existing.count += 1;
      existing.reactedBySelf = existing.reactedBySelf || r.userId === userId;
    } else {
      groups.set(r.emoji, { emoji: r.emoji, count: 1, reactedBySelf: r.userId === userId });
    }
  });
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

export function ProjectDiscussionSidebar({
  project,
  fetchProjectData,
  user,
}: ProjectDiscussionSidebarProps) {
  const { closeSidebar } = useDynamicSidebar();
  const { openProUpgrade } = useProUpgrade();
  const { showSuccess, showError } = useToast();

  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const [activeThreadParent, setActiveThreadParent] = useState<DiscussionMessage | null>(null);
  const [threadInputText, setThreadInputText] = useState('');
  const [sendToGeneralChecked] = useState(true);

  const [mentionAnchorEl, setMentionAnchorEl] = useState<HTMLElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [mentionActiveRange, setMentionActiveRange] = useState<{ start: number; end: number } | null>(null);
  const [mentionInputSource, setMentionInputSource] = useState<'general' | 'thread'>('general');
  const inputContainerRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

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

  const chatNoteId = metadata.discussionNoteId as string | undefined;
  const messageEndRef = useRef<HTMLDivElement>(null);

  const draftText = activeThreadParent ? threadInputText : inputText;
  const setDraftText = activeThreadParent ? setThreadInputText : setInputText;

  const closeMentionSuggestions = useCallback(() => {
    setMentionAnchorEl(null);
    setMentionResults([]);
    setMentionQuery('');
    setMentionActiveRange(null);
  }, []);

  const handleInputChange = useCallback((text: string, selectionStart: number, type: 'general' | 'thread') => {
    if (type === 'general') setInputText(text);
    else setThreadInputText(text);

    const active = getActiveMentionToken(text, selectionStart);
    if (active) {
      setMentionQuery(active.query);
      setMentionActiveRange({ start: active.start, end: active.end });
      setMentionInputSource(type);
      setMentionAnchorEl(inputContainerRef.current);
    } else {
      closeMentionSuggestions();
    }
  }, [closeMentionSuggestions]);

  const replaceActiveMention = useCallback((item: any) => {
    if (!mentionActiveRange) return;
    const mention = `@${item.username || item.title.replace(/\s+/g, '').toLowerCase()}`;
    const currentValue = mentionInputSource === 'general' ? inputText : threadInputText;
    const nextValue = `${currentValue.slice(0, mentionActiveRange.start)}${mention} ${currentValue.slice(mentionActiveRange.end)}`;
    if (mentionInputSource === 'general') setInputText(nextValue);
    else setThreadInputText(nextValue);
    closeMentionSuggestions();
  }, [mentionActiveRange, mentionInputSource, inputText, threadInputText, closeMentionSuggestions]);

  useEffect(() => {
    if (!mentionQuery.trim()) {
      setMentionResults([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const docs = await searchGlobalUsers(mentionQuery.trim(), 6);
        if (!alive) return;
        setMentionResults(
          docs.map((doc: any) => ({
            id: doc?.$id || doc?.id || doc?.userId,
            title: doc?.displayName || doc?.name || doc?.username || 'Profile',
            username: String(doc?.username || doc?.prefs?.username || '').replace(/^@+/, '').trim().toLowerCase() || null,
            avatar: doc?.avatar || doc?.profilePicId || doc?.prefs?.profilePicId || null,
          }))
        );
      } catch {
        if (alive) setMentionResults([]);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [mentionQuery]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeThreadParent]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!activeThreadParent) return;
    const fresh = messages.find((m) => m.id === activeThreadParent.id);
    if (fresh) setActiveThreadParent(fresh);
  }, [messages, activeThreadParent]);

  const parseMessageContent = useCallback((rawContent: string) => {
    if (rawContent?.startsWith('{') && rawContent?.endsWith('}')) {
      try {
        const json = JSON.parse(rawContent);
        return {
          text: json.text || '',
          type: json.type || 'text',
          voiceFileId: json.voiceFileId || null,
          sendToGeneral: json.sendToGeneral !== false,
        };
      } catch {
        /* fall through */
      }
    }
    if (rawContent?.startsWith('__voice_note__:')) {
      return {
        text: 'Voice Note',
        type: 'voice',
        voiceFileId: rawContent.substring('__voice_note__:'.length),
        sendToGeneral: true,
      };
    }
    return { text: rawContent || '', type: 'text', voiceFileId: null, sendToGeneral: true };
  }, []);

  const loadHuddleMessages = useCallback(async () => {
    if (!chatNoteId) return;
    try {
      const res = await listComments(chatNoteId);
      const commentReactions: Record<string, any[]> = {};
      try {
        const commentIds = res.rows.map((r: any) => r.$id);
        if (commentIds.length > 0) {
          const reactionsRes = await listReactions([
            Query.equal('targetType', 'comment'),
            Query.equal('targetId', commentIds),
            Query.limit(500),
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
          let senderAvatar: string | null = null;
          if (doc.userId === user?.$id) {
            senderName = user?.username ? `@${user.username}` : (user?.displayName || user?.name || 'You');
            senderAvatar = user?.avatar || user?.profilePicId || null;
          } else {
            try {
              const profile = await AppwriteService.getProfile(doc.userId);
              if (profile) {
                senderName = profile.username ? `@${profile.username}` : (profile.displayName || profile.name || 'Collaborator');
                senderAvatar = profile.avatar || profile.profilePicId || null;
              }
            } catch {
              /* ignore */
            }
          }
          return {
            id: doc.$id,
            senderId: doc.userId,
            senderName,
            senderAvatar,
            content: doc.content,
            timestamp: new Date(doc.createdAt).getTime(),
            parentCommentId: doc.parentCommentId || null,
            reactions: commentReactions[doc.$id] || [],
          } satisfies DiscussionMessage;
        })
      );
      msgs.sort((a, b) => a.timestamp - b.timestamp);
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
    const unsubscribe = client.subscribe(
      [
        `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.comments.documents`,
        `databases.${APPWRITE_CONFIG.DATABASES.NOTE}.collections.reactions.documents`,
      ],
      () => {
        if (active) loadHuddleMessages();
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [chatNoteId, loadHuddleMessages]);

  const handleReact = async (msgId: string, emoji: string) => {
    if (!user) return;
    const msg = messages.find((m) => m.id === msgId);
    if (!msg) return;
    try {
      const existingReaction = msg.reactions?.find((r: any) => r.userId === user.$id && r.emoji === emoji);
      if (existingReaction) await deleteReaction(existingReaction.$id);
      else {
        await createReaction({
          userId: user.$id,
          targetId: msgId,
          targetType: TargetType.COMMENT,
          emoji,
        });
      }
      loadHuddleMessages();
    } catch (e) {
      console.error('Failed to toggle reaction:', e);
    }
  };

  const submitMessage = async () => {
    const text = draftText.trim();
    if (!text || sending || !chatNoteId) return false;
    setSending(true);
    try {
      if (activeThreadParent) {
        await createComment(
          chatNoteId,
          JSON.stringify({ text, type: 'text', sendToGeneral: sendToGeneralChecked }),
          activeThreadParent.id
        );
        setThreadInputText('');
      } else {
        await createComment(chatNoteId, JSON.stringify({ text, type: 'text', sendToGeneral: true }));
        setInputText('');
      }
      await loadHuddleMessages();
      return true;
    } catch (err) {
      console.error('Failed to send message:', err);
      return false;
    } finally {
      setSending(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    if (!hasPaidKylrixPlan(user)) {
      openProUpgrade('Voice recording');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options: MediaRecorderOptions = { audioBitsPerSecond: 16000 };
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      }
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        setSending(true);
        try {
          const uploaded = await StorageService.uploadFile(audioFile, 'voice');
          if (chatNoteId) {
            await createComment(
              chatNoteId,
              JSON.stringify({ text: 'Voice Note', type: 'voice', voiceFileId: uploaded.$id, sendToGeneral: true })
            );
            await loadHuddleMessages();
          }
        } catch (error) {
          console.error('Failed to send voice note:', error);
        } finally {
          setSending(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
        setIsRecording(false);
      }, 120000);
    } catch {
      showError('Microphone access is required for voice notes.');
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

  const generalMessages = useMemo(
    () =>
      messages.filter((m) => {
        if (!m.parentCommentId) return true;
        return parseMessageContent(m.content).sendToGeneral !== false;
      }),
    [messages, parseMessageContent]
  );

  const threadReplies = useMemo(() => {
    const groups: Record<string, DiscussionMessage[]> = {};
    messages.forEach((m) => {
      if (m.parentCommentId) {
        if (!groups[m.parentCommentId]) groups[m.parentCommentId] = [];
        groups[m.parentCommentId].push(m);
      }
    });
    return groups;
  }, [messages]);

  const threadMessages = useMemo(() => {
    if (!activeThreadParent) return [];
    return messages.filter((m) => m.parentCommentId === activeThreadParent.id);
  }, [messages, activeThreadParent]);

  const visibleMessages = activeThreadParent ? threadMessages : generalMessages;

  const renderBubbleBody = (msg: DiscussionMessage) => {
    const parsed = parseMessageContent(msg.content);
    if (parsed.type === 'voice' && parsed.voiceFileId) {
      return <VoiceMessage url={StorageService.getFileView(parsed.voiceFileId, 'voice')} />;
    }
    return renderMessageText(parsed.text);
  };

  const renderMessageRow = (msg: DiscussionMessage, opts?: { isThreadParent?: boolean }) => {
    const isOutgoing = msg.senderId === user?.$id;
    const replyCount = threadReplies[msg.id]?.length || 0;
    const reactionGroups = groupCommentReactions(msg.reactions, user?.$id);

    return (
      <Box
        key={msg.id}
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: isOutgoing ? 'flex-end' : 'flex-start',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Stack
          direction={isOutgoing ? 'row-reverse' : 'row'}
          spacing={1.25}
          alignItems="flex-end"
          sx={{ width: '100%', maxWidth: '85%' }}
        >
          <IdentityAvatar
            fileId={msg.senderAvatar}
            alt={msg.senderName}
            fallback={msg.senderName.replace(/^@/, '').slice(0, 1).toUpperCase()}
            size={32}
            borderRadius="50%"
          />
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              minWidth: 0,
              flex: '0 1 auto',
              alignItems: isOutgoing ? 'flex-end' : 'flex-start',
            }}
          >
            {!isOutgoing && (
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 900,
                  color: '#9B9691',
                  pl: 0.5,
                  mb: 0.25,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.05em',
                }}
              >
                {msg.senderName}
              </Typography>
            )}
            <Paper
              elevation={0}
              onClick={() => {
                if (!opts?.isThreadParent && !activeThreadParent) setActiveThreadParent(msg);
              }}
              sx={{
                ...secretChatBubbleSx(isOutgoing),
                cursor: opts?.isThreadParent ? 'default' : 'pointer',
              }}
            >
              {renderBubbleBody(msg)}
            </Paper>

            {reactionGroups.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignSelf: isOutgoing ? 'flex-end' : 'flex-start', mt: 0.5, px: 0.5 }}>
                {reactionGroups.slice(0, 5).map((group) => (
                  <Box
                    key={group.emoji}
                    component="button"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReact(msg.id, group.emoji);
                    }}
                    sx={{
                      p: 0,
                      m: 0,
                      border: 0,
                      background: 'transparent',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      lineHeight: 1,
                      opacity: group.reactedBySelf ? 1 : 0.95,
                    }}
                  >
                    {group.emoji}
                  </Box>
                ))}
              </Box>
            )}

            {!activeThreadParent && replyCount > 0 && (
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveThreadParent(msg);
                }}
                startIcon={<MessageSquare size={12} />}
                sx={{
                  alignSelf: isOutgoing ? 'flex-end' : 'flex-start',
                  mt: 0.5,
                  px: 1.5,
                  py: 0.5,
                  minHeight: 0,
                  borderRadius: '10px',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'none',
                  color: '#818CF8',
                  bgcolor: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.12)' },
                }}
              >
                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              </Button>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, alignSelf: isOutgoing ? 'flex-end' : 'flex-start', px: 0.5, position: 'relative', zIndex: 2 }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                {formatTime(new Date(msg.timestamp), { hour: 'numeric', minute: '2-digit', hour12: true })}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>
    );
  };

  return (
    <Box sx={{ bgcolor: '#161412', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {/* Top Spotlight Gradient */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160, pointerEvents: 'none', background: 'radial-gradient(ellipse at top, rgba(99, 102, 241, 0.06), transparent 70%)', zIndex: 1 }} />

      {/* Fixed top command rail — opaque, no mural bleed */}
      <AppBar
        position="static"
        color="transparent"
        elevation={0}
        sx={{
          bgcolor: '#161412',
          backgroundImage: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: '68px !important', px: 2 }}>
          {activeThreadParent ? (
            <IconButton
              onClick={() => setActiveThreadParent(null)}
              sx={{ color: 'rgba(255,255,255,0.55)', bgcolor: '#0B0A09', border: '1px solid rgba(255,255,255,0.05)', '&:hover': { color: '#fff', bgcolor: '#1C1A18' } }}
            >
              <ChevronLeft size={20} strokeWidth={2} />
            </IconButton>
          ) : (
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '12px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.22)',
                color: '#818CF8',
                flexShrink: 0,
              }}
            >
              <MessageSquare size={18} strokeWidth={2} />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0, px: 0.5 }}>
            <Typography
              variant="subtitle1"
              noWrap
              sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', lineHeight: 1.15, color: '#F5F2ED', fontSize: '0.95rem' }}
            >
              {activeThreadParent ? 'Thread replies' : project.title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#9B9691', fontWeight: 700, fontSize: '0.72rem', lineHeight: 1.35, display: 'block' }}>
              {activeThreadParent ? project.title : 'Project discussion · team huddle'}
            </Typography>
          </Box>
          <IconButton
            onClick={closeSidebar}
            sx={{ color: 'rgba(255,255,255,0.55)', bgcolor: '#0B0A09', border: '1px solid rgba(255, 255, 255, 0.05)', '&:hover': { color: '#fff', bgcolor: '#1C1A18' } }}
          >
            <X size={18} strokeWidth={2} />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Middle lane — mural + scroll only (header/footer stay solid) */}
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {loading && !messages.length && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: 'rgba(22,20,18,0.7)', zIndex: 30 }}>
            <CircularProgress sx={{ color: '#6366F1' }} size={28} />
          </Box>
        )}

        {!chatNoteId ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, position: 'relative', zIndex: 2 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3.5,
                maxWidth: 340,
                width: '100%',
                textAlign: 'center',
                bgcolor: '#0B0A09',
                backgroundImage: 'none',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '28px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
              }}
            >
              <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: '#818CF8', mx: 'auto', mb: 2.5 }}>
                <Globe size={26} />
              </Box>
              <Typography component="span" sx={{ display: 'block', fontWeight: 900, color: '#F5F2ED', mb: 1, fontFamily: 'var(--font-clash)', fontSize: '1rem', lineHeight: 1.25 }}>
                Start project discussion
              </Typography>
              <Typography component="span" sx={{ display: 'block', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', lineHeight: 1.6, mb: 2.5 }}>
                Spin up a team huddle for this project. Messages auto-clean after 7 days.
              </Typography>
              <Button
                variant="contained"
                onClick={handleInitHuddle}
                sx={{ bgcolor: '#6366F1', color: '#fff', fontWeight: 900, borderRadius: '14px', px: 3, py: 1.25, textTransform: 'none', boxShadow: '0 8px 24px rgba(99,102,241,0.25)' }}
              >
                Start Huddle
              </Button>
            </Paper>
          </Box>
        ) : (
          <>
            <MuralPattern />
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                px: 2,
                py: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.75,
                pb: 'calc(108px + env(safe-area-inset-bottom))',
                position: 'relative',
                zIndex: 2,
              }}
              className="scrollbar-thin"
            >
              {activeThreadParent && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mb: 0.5,
                    bgcolor: '#0B0A09',
                    backgroundImage: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '20px',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 900, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)', mb: 1.25, display: 'block', lineHeight: 1.25 }}>
                    Thread started by {activeThreadParent.senderName}
                  </Typography>
                  {renderMessageRow(activeThreadParent, { isThreadParent: true })}
                </Paper>
              )}

              {visibleMessages.length === 0 ? (
                <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', py: 8 }}>
                  <Typography component="span" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', lineHeight: 1.45, fontStyle: 'italic' }}>
                    {activeThreadParent ? 'No replies yet.' : 'No messages yet. Say hello!'}
                  </Typography>
                </Box>
              ) : (
                visibleMessages.map((msg) => renderMessageRow(msg))
              )}
              <div ref={messageEndRef} />
            </Box>

            {/* Fixed bottom composer — openbricks inset drawer lip */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                px: { xs: 1.5, md: 2 },
                pb: 'max(1rem, env(safe-area-inset-bottom))',
                pt: 1.5,
                bgcolor: '#161412',
                backgroundImage: 'none',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 -12px 36px rgba(0, 0, 0, 0.5), 0 16px 48px rgba(0, 0, 0, 0.7)',
                zIndex: 20,
              }}
            >
              {mentionAnchorEl && mentionResults.length > 0 && (
                <Box sx={{ mb: 1.5, p: 1.5, borderRadius: '16px', bgcolor: '#0B0A09', border: '1px solid rgba(255,255,255,0.05)', maxHeight: 180, overflowY: 'auto' }}>
                  <Typography variant="caption" sx={{ fontWeight: 900, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1, display: 'block' }}>
                    Mention
                  </Typography>
                  <Stack spacing={0.5}>
                    {mentionResults.map((item) => (
                      <Button
                        key={item.id}
                        onClick={() => replaceActiveMention(item)}
                        sx={{ justifyContent: 'flex-start', gap: 1.5, py: 1, px: 1.5, borderRadius: '12px', color: '#fff', textTransform: 'none', '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' } }}
                      >
                        <IdentityAvatar fileId={item.avatar} alt={item.title} fallback={item.title[0]?.toUpperCase()} size={28} />
                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                          <Typography sx={{ fontWeight: 800, fontSize: '0.85rem' }} noWrap>{item.title}</Typography>
                          {item.username && (
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>@{item.username}</Typography>
                          )}
                        </Box>
                      </Button>
                    ))}
                  </Stack>
                </Box>
              )}

              <Box ref={inputContainerRef} sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.75, position: 'relative', zIndex: 2 }}>
                {!activeThreadParent && (
                  <IconButton
                    onClick={toggleRecording}
                    sx={{
                      color: isRecording ? '#ff4d4d' : '#9B9691',
                      width: 44,
                      height: 44,
                      flexShrink: 0,
                      bgcolor: '#0B0A09',
                      border: '1px solid rgba(255,255,255,0.05)',
                      '&:hover': { bgcolor: '#1C1A18', borderColor: 'rgba(99, 102, 241, 0.4)', color: '#fff' },
                    }}
                  >
                    {isRecording ? <Square size={18} fill="#ff4d4d" /> : <Mic size={20} strokeWidth={2} />}
                  </IconButton>
                )}

                <Box sx={{ flex: 1, position: 'relative' }}>
                  {isRecording && (
                    <Box sx={{ position: 'absolute', inset: 0, bgcolor: '#0B0A09', borderRadius: '18px', border: '1px solid #ff4d4d', display: 'flex', alignItems: 'center', px: 2, gap: 1, zIndex: 3 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff4d4d', animation: 'pulse 1.5s infinite' }} />
                      <Typography sx={{ flex: 1, fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)' }}>
                        Recording… tap stop to send
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: '#ff4d4d', fontFamily: 'var(--font-mono)' }}>
                        {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
                      </Typography>
                    </Box>
                  )}
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    disabled={isRecording}
                    placeholder={activeThreadParent ? 'Reply in thread…' : 'Message the team…'}
                    value={draftText}
                    onChange={(e) =>
                      handleInputChange(
                        e.target.value,
                        e.target.selectionStart ?? e.target.value.length,
                        activeThreadParent ? 'thread' : 'general'
                      )
                    }
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        await submitMessage();
                      }
                    }}
                    inputRef={textInputRef}
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      sx: {
                        px: 2,
                        py: 1.5,
                        bgcolor: '#0B0A09',
                        borderRadius: '18px',
                        border: '1px solid rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontWeight: 600,
                        fontFamily: 'var(--font-satoshi)',
                        fontSize: '0.95rem',
                        '&:focus-within': { borderColor: '#6366F1', bgcolor: '#0B0A09' },
                      },
                    }}
                  />
                </Box>

                <IconButton
                  disabled={!draftText.trim() || sending || isRecording}
                  onClick={() => void submitMessage()}
                  sx={{
                    color: draftText.trim() ? '#818CF8' : 'rgba(255,255,255,0.1)',
                    width: 44,
                    height: 44,
                    flexShrink: 0,
                    bgcolor: draftText.trim() ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                    border: '1px solid',
                    borderColor: draftText.trim() ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366F1' },
                  }}
                >
                  {sending ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} strokeWidth={2.5} />}
                </IconButton>
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
