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
  Smile,
  Copy,
  Loader2,
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
      <span
        key={`${start}-${username}`}
        className="text-[#6366F1] font-extrabold bg-[#6366F1]/8 px-1 py-0.5 rounded font-mono text-[0.9em] select-text"
      >
        @{username}
      </span>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    pieces.push(text.slice(lastIndex));
  }

  return <span className="whitespace-pre-wrap break-words">{pieces}</span>;
}

export function ProjectDiscussionSidebar({
  project,
  fetchProjectData,
  user,
}: ProjectDiscussionSidebarProps) {
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
    <div className="flex flex-col h-full bg-[#0A0908] overflow-hidden relative">
      
      {/* 1. Header (Fixed/Anchored at top) */}
      <div className="flex flex-col p-5 border-b border-white/5 bg-[#0A0908] z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {activeThreadParent && (
              <button
                type="button"
                onClick={() => setActiveThreadParent(null)}
                className="text-white/50 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5 mr-1 shrink-0"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="font-black font-clash text-[#6366F1] uppercase tracking-wider text-sm truncate">
                {activeThreadParent ? 'Thread replies' : 'Project Discussion'}
              </h3>
              <span className="text-[10px] text-white/40 block truncate font-bold font-satoshi mt-0.5">
                {project.title}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={closeSidebar}
            className="text-white/50 hover:text-white transition p-1.5 rounded-lg hover:bg-white/5 shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. Middle Content (Free scroll chat viewport) */}
      <div className="flex-1 min-h-0 relative flex flex-col bg-[#080706]">
        <MuralPattern />

        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-[#0A0908]/70 z-30 animate-in fade-in">
            <Loader2 size={28} className="text-[#6366F1] animate-spin" />
          </div>
        )}

        {!chatNoteId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative z-10">
            <div className="w-14 h-14 rounded-2xl grid place-items-center bg-[#6366F1]/8 text-[#6366F1] border border-[#6366F1]/15 mb-6">
              <Globe size={26} />
            </div>
            <h4 className="font-extrabold text-sm text-white mb-2 font-satoshi">Initialize Public Huddle</h4>
            <p className="text-xs text-white/40 max-w-[320px] leading-relaxed mb-6 font-medium font-satoshi">
              A temporary public comment thread lets your team coordinate tasks, tag members, and comment on assets. Messages automatically clean up in 7 days.
            </p>
            <button
              type="button"
              onClick={handleInitHuddle}
              className="bg-[#6366F1] hover:bg-[#6366F1]/90 text-white font-extrabold text-xs py-3 px-6 rounded-xl transition duration-200"
            >
              Start Huddle
            </button>
          </div>
        ) : (
          /* Scrollable Messages view */
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 min-h-0 scrollbar-thin">
            {activeThreadParent ? (
              /* THREAD REPLIES VIEW */
              <>
                <div className="border-b border-white/5 pb-4 mb-2">
                  <span className="text-[10px] text-[#818CF8] font-black block uppercase tracking-wider mb-2 font-satoshi">
                    Thread initialized by {activeThreadParent.senderName}
                  </span>
                  <div className="flex flex-col gap-1">
                    <div
                      className="p-4 rounded-r-2xl rounded-bl-2xl rounded-tl-sm bg-[#161412] border border-[#23211F] border-l-[3px] border-l-[#818CF8] text-[#F5F2ED]"
                    >
                      {(() => {
                        const parsedParent = parseMessageContent(activeThreadParent.content);
                        if (parsedParent.type === 'voice' && parsedParent.voiceFileId) {
                          return <VoiceMessage url={StorageService.getFileView(parsedParent.voiceFileId, 'voice')} />;
                        }
                        return (
                          <p className="font-semibold text-xs leading-relaxed break-words font-satoshi">
                            {renderMessageText(parsedParent.text)}
                          </p>
                        );
                      })()}
                    </div>

                    {/* Parent Reactions */}
                    {activeThreadParent.reactions && activeThreadParent.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 align-self-start">
                        {Object.entries(
                          activeThreadParent.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                            if (!acc[r.emoji]) acc[r.emoji] = [];
                            acc[r.emoji].push(r.userId);
                            return acc;
                          }, {})
                        ).map(([emoji, userIds]) => {
                          const hasReacted = (userIds as any[]).includes(user?.$id);
                          return (
                            <button
                              type="button"
                              key={emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReact(activeThreadParent.id, emoji);
                              }}
                              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-colors ${
                                hasReacted 
                                  ? 'bg-[#818CF8]/15 text-[#818CF8] border-[#818CF8]/30' 
                                  : 'bg-white/3 text-white/55 border-white/5 hover:bg-white/5 hover:border-white/10'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span>{(userIds as any[]).length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {threadMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center py-8 opacity-40">
                    <span className="italic font-bold text-xs font-satoshi text-white/60">No replies yet. Send a reply below!</span>
                  </div>
                ) : (
                  threadMessages.map(reply => {
                    const isSelfReply = reply.senderId === user?.$id;
                    const parsedReply = parseMessageContent(reply.content);
                    return (
                      <div key={reply.id} className={`max-w-[85%] flex flex-col ${isSelfReply ? 'self-end' : 'self-start'}`}>
                        <span className={`text-[10px] text-white/30 font-black block mb-1 font-satoshi ${isSelfReply ? 'text-right' : 'text-left'}`}>
                          {reply.senderName}
                        </span>
                        <div
                          className={`p-3.5 shadow-xl shadow-black/30 border border-[#23211F] text-xs font-semibold leading-relaxed break-words font-satoshi ${
                            isSelfReply 
                              ? 'bg-[#1C1A18] text-white rounded-l-2xl rounded-br-2xl rounded-tr-sm border-r-[3px] border-r-[#6366F1]' 
                              : 'bg-[#161412] text-[#F5F2ED] rounded-r-2xl rounded-bl-2xl rounded-tl-sm border-l-[3px] border-l-[#34322F]'
                          }`}
                        >
                          {parsedReply.type === 'voice' && parsedReply.voiceFileId ? (
                            <VoiceMessage url={StorageService.getFileView(parsedReply.voiceFileId, 'voice')} />
                          ) : (
                            <p className="font-semibold text-xs leading-relaxed break-words font-satoshi">
                              {renderMessageText(parsedReply.text)}
                            </p>
                          )}
                        </div>

                        {/* Reply Reactions */}
                        {reply.reactions && reply.reactions.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1.5 ${isSelfReply ? 'justify-end' : 'justify-start'}`}>
                            {Object.entries(
                              reply.reactions.reduce((acc: Record<string, string[]>, r: any) => {
                                if (!acc[r.emoji]) acc[r.emoji] = [];
                                acc[r.emoji].push(r.userId);
                                return acc;
                              }, {})
                            ).map(([emoji, userIds]) => {
                              const hasReacted = (userIds as any[]).includes(user?.$id);
                              return (
                                <button
                                  type="button"
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(reply.id, emoji);
                                  }}
                                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-colors ${
                                    hasReacted 
                                      ? 'bg-[#818CF8]/15 text-[#818CF8] border-[#818CF8]/30' 
                                      : 'bg-white/3 text-white/55 border-white/5 hover:bg-white/5 hover:border-white/10'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span>{(userIds as any[]).length}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        <span className={`text-[9px] text-white/20 block mt-1.5 font-bold font-satoshi ${isSelfReply ? 'text-right' : 'text-left'}`}>
                          {new Date(reply.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={threadEndRef} />
              </>
            ) : (
              /* GENERAL HUDDLE CHAT LIST */
              <>
                {generalMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center opacity-40">
                    <span className="italic font-bold text-xs font-satoshi text-white/60">No messages yet. Start the discussion!</span>
                  </div>
                ) : (
                  generalMessages.map((msg) => {
                    const isSelf = msg.senderId === user?.$id;
                    const parsed = parseMessageContent(msg.content);
                    const replyCount = threadReplies[msg.id]?.length || 0;

                    return (
                      <div key={msg.id} className={`max-w-[85%] flex flex-col ${isSelf ? 'self-end' : 'self-start'}`}>
                        <span className={`text-[10px] text-white/30 font-black block mb-1 font-satoshi ${isSelf ? 'text-right' : 'text-left'}`}>
                          {msg.senderName}
                        </span>
                        <div
                          onClick={(e) => handleMessageClick(e, msg)}
                          onTouchStart={(e) => handleTouchStart(e, msg)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={handleTouchEnd}
                          className={`p-3.5 shadow-xl shadow-black/30 border border-[#23211F] text-xs font-semibold leading-relaxed break-words font-satoshi cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-black/40 ${
                            isSelf 
                              ? 'bg-[#1C1A18] text-white rounded-l-2xl rounded-br-2xl rounded-tr-sm border-r-[3px] border-r-[#6366F1]' 
                              : 'bg-[#161412] text-[#F5F2ED] rounded-r-2xl rounded-bl-2xl rounded-tl-sm border-l-[3px] border-l-[#34322F]'
                          }`}
                        >
                          {parsed.type === 'voice' && parsed.voiceFileId ? (
                            <VoiceMessage url={StorageService.getFileView(parsed.voiceFileId, 'voice')} />
                          ) : (
                            <p className="font-semibold text-xs leading-relaxed break-words font-satoshi">
                              {renderMessageText(parsed.text)}
                            </p>
                          )}
                        </div>

                        {/* Reactions and Quick Emoji Picker */}
                        <div className={`flex items-center gap-1.5 mt-1.5 ${isSelf ? 'justify-end' : 'justify-start'}`}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReact(msg.id, '👍');
                            }}
                            className="p-1 text-white/30 bg-white/2 border border-white/5 rounded-md hover:text-[#818CF8] hover:bg-[#6366F1]/8 hover:border-[#6366F1]/15 transition"
                          >
                            <Smile size={12} />
                          </button>

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
                                <button
                                  type="button"
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReact(msg.id, emoji);
                                  }}
                                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-colors ${
                                    hasReacted 
                                      ? 'bg-[#818CF8]/15 text-[#818CF8] border-[#818CF8]/30' 
                                      : 'bg-white/3 text-white/55 border-white/5 hover:bg-white/5 hover:border-white/10'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span>{(userIds as any[]).length}</span>
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Thread Replies Button */}
                        {replyCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveThreadParent(msg);
                            }}
                            className={`flex items-center justify-center gap-1.5 mt-1.5 px-3 py-1 bg-[#6366F1]/4 border border-[#6366F1]/10 rounded-lg text-[#818CF8] font-extrabold text-[10px] transition duration-200 hover:bg-[#6366F1]/8 hover:border-[#818CF8] ${
                              isSelf ? 'self-end' : 'self-start'
                            }`}
                          >
                            <MessageSquare size={12} />
                            <span>{replyCount} {replyCount === 1 ? 'reply' : 'replies'}</span>
                          </button>
                        )}

                        <span className={`text-[9px] text-white/20 block mt-1.5 font-bold font-satoshi ${isSelf ? 'text-right' : 'text-left'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Input Panel (Fixed/Anchored at bottom) */}
      {chatNoteId && (
        <form
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
          className="p-4 border-t border-white/5 bg-[#0A0908]/95 backdrop-blur-md relative z-20"
        >
          {/* Mentions dropdown popup overlay */}
          {showMentions && (
            <div className="absolute bottom-full left-4 right-4 bg-[#161412] border border-[#23211F] rounded-2xl p-3 mb-3 max-h-45 overflow-y-auto shadow-2xl shadow-black/85 z-30 scrollbar-thin">
              <span className="text-[10px] text-white/40 font-black block uppercase tracking-wider mb-2 font-satoshi">
                Mention users
              </span>
              <div className="flex flex-col gap-1">
                {mentionResults.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => replaceActiveMention(item)}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white/4 transition-colors w-full text-left"
                  >
                    <IdentityAvatar fileId={item.avatar} alt={item.title} fallback={item.title[0]?.toUpperCase()} size={28} />
                    <div className="min-w-0 flex flex-col">
                      <span className="font-extrabold text-xs text-white truncate font-satoshi">{item.title}</span>
                      {item.username && <span className="text-[10px] text-white/40 font-bold truncate mt-0.5 font-satoshi">@{item.username}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {!activeThreadParent && (
              <button
                type="button"
                onClick={toggleRecording}
                disabled={sending}
                className={`w-11 h-11 shrink-0 flex items-center justify-center bg-[#161412] border rounded-xl hover:bg-[#1C1A18] hover:text-white transition ${
                  isRecording ? 'text-[#ff4d4d] border-[#ff4d4d]' : 'text-white/40 border-white/5'
                }`}
              >
                {isRecording ? <Square size={16} fill="#ff4d4d" className="text-[#ff4d4d]" /> : <Mic size={18} />}
              </button>
            )}

            <div ref={activeThreadParent ? threadMentionContainerRef : mentionContainerRef} className="flex-1 relative flex items-center min-w-0">
              {isRecording && (
                <div className="absolute inset-0 bg-[#0A0908] rounded-xl border border-[#ff4d4d] flex items-center px-4 gap-3 z-[2]">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff4d4d] animate-pulse" />
                  <span className="text-white/60 text-xs font-extrabold flex-1 truncate font-satoshi">
                    Recording... click stop to send
                  </span>
                  <span className="text-[#ff4d4d] text-xs font-black font-mono">
                    {formatRecordingTime(recordingSeconds)}
                  </span>
                </div>
              )}

              <input
                type="text"
                className="w-full bg-[#161412] rounded-xl text-white px-4 py-3 font-semibold text-xs border border-white/5 transition hover:border-white/10 focus:border-[#6366F1] outline-none"
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
                      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                      
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
              />
            </div>

            <button
              type="submit"
              disabled={sending || isRecording || (activeThreadParent ? !threadInputText.trim() : !inputText.trim())}
              className="bg-[#6366F1] hover:bg-[#575CF0] disabled:bg-white/2 disabled:text-white/10 text-white rounded-xl w-11 h-11 shrink-0 flex items-center justify-center transition duration-200"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
