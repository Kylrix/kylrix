'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  Copy,
  FileText,
  KeyRound,
  ListTodo,
  Shield,
  Sparkles,
  Upload,
  MessageSquare,
  Lock,
  Unlock,
  Users as UsersIcon,
  Share2,
  Paperclip,
  Mic,
  Send as SendIcon,
  ChevronDown,
  Clock,
  ArrowRight
} from 'lucide-react';

import MuralPattern from '@/components/chat/MuralPattern';
import { buildAutoTitleFromContent } from '@/constants/noteTitle';
import PasswordGenerator from '@/components/ui/PasswordGenerator';

import { useAuth } from '@/context/auth/AuthContext';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { EphemeralClaimDrawer, type EphemeralClaimTarget } from '@/components/ephemeral/EphemeralClaimDrawer';
import { SendSparkShelf } from '@/components/send/SendSparkShelf';
import { AuthDiscoveryDrawer } from '@/components/send/AuthDiscoveryDrawer';
import UserSearch from '@/components/UserSearch';
import { AppwriteService } from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { encryptGhostBinaryToBytes, encryptGhostData } from '@/lib/encryption/ghost-crypto';
import { sha256HexUtf8 } from '@/lib/crypto/sha256-hex';
import { clearEphemeralClaimResume, peekEphemeralClaimResume } from '@/lib/ephemeral/claim-session';
import {
  SEND_EXPIRY_PRESETS,
  SEND_MAX_TTL_MS,
  SEND_SPARK_STORAGE_KEY,
  SEND_SPARKS_MAX,
  clampExpiryMs,
} from '@/lib/send/constants';
import type {
  SendFilePayload,
  SendKind,
  SendSparkRef,
  SendPasswordPayload,
  SendTaskPayload,
  SendTotpPayload,
} from '@/lib/send/types';
import { hasPaidKylrixPlan } from '@/lib/utils';
import toast from 'react-hot-toast';

const KINDS: { id: SendKind; label: string; blurb: string; Icon: typeof FileText }[] = [
  { id: 'note', label: 'Note', blurb: 'Text and context', Icon: FileText },
  { id: 'password', label: 'Password', blurb: 'Credential snapshot', Icon: KeyRound },
  { id: 'task', label: 'Task', blurb: 'Action item', Icon: ListTodo },
  { id: 'totp', label: 'TOTP', blurb: 'Authenticator seed', Icon: Shield },
  { id: 'file', label: 'File', blurb: 'Up to 7 days in bucket', Icon: Upload },
  { id: 'discussion', label: 'Discussion', blurb: 'Ephemeral thread', Icon: MessageSquare }
];

const KIND_COLORS: Record<SendKind, string> = {
  note: '#EC4899',       // Pink (Note App)
  password: '#10B981',   // Green (Vault App)
  totp: '#10B981',       // Green (Vault App)
  task: '#A855F7',       // Purple (Flow App)
  file: '#6366F1',       // Indigo (Accounts/Send)
  discussion: '#F59E0B'  // Amber/Orange (Connect App)
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hr`;
  const d = Math.floor(h / 24);
  return `${d} days`;
}

interface NoteCardProps {
  noteTitle: string;
  setNoteTitle: (val: string) => void;
  noteBody: string;
  setNoteBody: (val: string) => void;
  isTitleManuallyEdited: boolean;
  setIsTitleManuallyEdited: (val: boolean) => void;
  handleCreateLink: () => Promise<void>;
  renderHeaderActions: (tooltipText: string) => React.ReactNode;
  draftValid: boolean;
  isCreating: boolean;
  effectiveSecureMode: boolean;
  themeColor: string;
}

function NoteComposerCard({
  noteTitle,
  setNoteTitle,
  noteBody,
  setNoteBody,
  isTitleManuallyEdited,
  setIsTitleManuallyEdited,
  renderHeaderActions,
  effectiveSecureMode,
}: NoteCardProps) {
  return (
    <div className="rounded-[24px] bg-[#161412] border border-[#34322F] shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),_0_2px_3px_-3px_rgba(37,35,33,0.9)] transition duration-200 focus-within:border-pink-500/50 focus-within:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),_0_0_15px_rgba(236,72,153,0.15)] overflow-hidden">
      {/* Editor Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#34322F] bg-white/[0.01]">
        <div className="flex items-center gap-3">
          {effectiveSecureMode && (
            <div className="flex items-center gap-1.5 text-[#EC4899]" title="This content is encrypted before upload.">
              <Lock size={12} />
              <span className="text-[10px] font-black uppercase tracking-wider font-satoshi">SECURE</span>
            </div>
          )}
        </div>

        {renderHeaderActions("Type a note to share")}
      </div>

      {/* Main Inputs */}
      <div className="p-6 sm:p-10 pt-5 sm:pt-6">
        {(noteBody.trim().length > 0 || noteTitle.trim().length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <input
              key="note-title-input"
              type="text"
              placeholder="Note Title"
              value={noteTitle}
              autoComplete="off"
              onChange={(e) => setNoteTitle(e.target.value)}
              onKeyDown={() => setIsTitleManuallyEdited(true)}
              onMouseDown={() => setIsTitleManuallyEdited(true)}
              onPaste={() => setIsTitleManuallyEdited(true)}
              className="w-full bg-transparent text-4xl font-black font-clash text-white mb-4 placeholder-white/20 focus:outline-none"
            />
          </motion.div>
        )}
        <textarea
          key="note-body-textarea"
          placeholder="Start typing your brilliant thoughts…"
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={10}
          autoFocus
          className="w-full bg-transparent text-white text-lg font-satoshi leading-relaxed placeholder-white/20 focus:outline-none resize-none scrollbar-thin"
        />
      </div>
    </div>
  );
}

interface DiscussionCardProps {
  noteTitle: string;
  setNoteTitle: (val: string) => void;
  noteBody: string;
  setNoteBody: (val: string) => void;
  isTitleManuallyEdited: boolean;
  setIsTitleManuallyEdited: (val: boolean) => void;
  handleCreateLink: () => Promise<void>;
  renderHeaderActions: (tooltipText: string) => React.ReactNode;
  draftValid: boolean;
  isCreating: boolean;
  user: any;
  themeColor: string;
}

function DiscussionComposerCard({
  noteTitle,
  setNoteTitle,
  noteBody,
  setNoteBody,
  isTitleManuallyEdited,
  setIsTitleManuallyEdited,
  handleCreateLink,
  renderHeaderActions,
  draftValid,
  isCreating,
  user,
}: DiscussionCardProps) {
  return (
    <div className="rounded-[24px] bg-[#161412] border border-[#34322F] shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),_0_2px_3px_-3px_rgba(37,35,33,0.9)] transition duration-200 focus-within:border-amber-500/50 focus-within:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),_0_0_15px_rgba(245,158,11,0.15)] overflow-hidden relative">
      {/* Mural Pattern Background */}
      <MuralPattern />
      
      {/* Secure Chat Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#34322F] bg-[#0A0908]/85 backdrop-blur-md z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
          <span className="text-[10px] text-white font-black font-clash tracking-widest uppercase">
            EPHEMERAL HUDDLE ROOM
          </span>
          <div className="flex items-center gap-1 text-[#F59E0B]">
            <Lock size={12} />
            <span className="text-[10px] font-black uppercase tracking-wider">LOCKED</span>
          </div>
        </div>

        {renderHeaderActions("Type a message to share")}
      </div>

      {/* Simulated Chat Feed */}
      <div className="p-6 flex flex-col gap-4 min-h-[220px] justify-end relative z-10">
        {/* System Note */}
        <div className="self-center bg-black/60 border border-[#34322F] rounded-xl px-4 py-2 max-w-[85%] text-center">
          <span className="text-xs text-white/50 font-satoshi flex items-center gap-2 justify-center">
            <Lock size={12} color="#F59E0B" />
            Messages are encrypted. Huddle automatically purges in 7 days.
          </span>
        </div>

        {/* Outgoing Bubble Preview */}
        {noteBody.trim().length > 0 && (
          <div className="self-end max-w-[80%] flex gap-3 items-end">
            <div className="flex flex-col items-end gap-1">
              <div className="bg-[#F59E0B] text-[#0A0908] px-5 py-3.5 rounded-[20px_20px_4px_20px] shadow-[0_4px_12px_rgba(245,158,11,0.2)]">
                <p className="text-sm font-satoshi font-bold whitespace-pre-wrap leading-normal">
                  Composing message…
                </p>
              </div>
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <Lock size={10} color="#F59E0B" /> Encrypted
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#34322F] flex items-center justify-center text-sm font-black border border-[#34322F] text-white">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          </div>
        )}
      </div>

      {/* Chat Composer Well */}
      <div className="p-6 border-t border-[#34322F] bg-[#0A0908]/95 backdrop-blur-md relative z-10">
        {/* Conditional Topic Field */}
        {(noteBody.trim().length > 0 || noteTitle.trim().length > 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
          >
            <input
              key="discussion-title-input"
              type="text"
              placeholder="Discussion Topic / Room Name"
              value={noteTitle}
              autoComplete="off"
              onChange={(e) => setNoteTitle(e.target.value)}
              onKeyDown={() => setIsTitleManuallyEdited(true)}
              onMouseDown={() => setIsTitleManuallyEdited(true)}
              onPaste={() => setIsTitleManuallyEdited(true)}
              className="w-full bg-transparent text-xl font-bold font-clash text-white mb-4 px-2 placeholder-white/30 focus:outline-none"
            />
          </motion.div>
        )}
 
        <div className="bg-black rounded-2xl border border-[#34322F] focus-within:border-[#F59E0B] p-3 flex flex-col gap-3">
          <textarea
            key="discussion-body-textarea"
            placeholder="Open the huddle with a clear message…"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={3}
            autoFocus
            className="w-full bg-transparent text-white text-base font-satoshi leading-normal placeholder-white/20 focus:outline-none resize-none scrollbar-thin"
          />
          <div className="flex items-center justify-between pt-2 border-t border-white/[0.03]">
            <div className="flex items-center gap-2">
              <button type="button" className="p-1.5 text-white/30 hover:text-white transition rounded">
                <Paperclip size={16} />
              </button>
              <button type="button" className="p-1.5 text-white/30 hover:text-white transition rounded">
                <Mic size={16} />
              </button>
            </div>
            <button
              disabled={!draftValid || isCreating}
              onClick={() => void handleCreateLink()}
              className={`flex items-center gap-1.5 text-xs font-black rounded-lg px-4 py-2 transition duration-200 ${
                draftValid 
                  ? 'bg-[#F59E0B] text-[#0A0908] hover:bg-[#D97706]' 
                  : 'text-white/20 bg-transparent cursor-not-allowed'
              }`}
            >
              <span>Share Huddle</span>
              {isCreating ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-t-2 border-b-2 border-current" />
              ) : (
                <SendIcon size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SendComposer() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && searchParams.get('login') === '1') {
      openUnified('login');
      router.replace('/send');
    }
  }, [isLoading, isAuthenticated, searchParams, openUnified, router]);

  const activeMaxBytes = 10 * 1024 * 1024; // Strict 10MB limit for Send
  const activeMaxLabel = '10 MB';

  const [kind, setKind] = useState<SendKind>('note');
  const themeColor = KIND_COLORS[kind];
  const [expiryMs, setExpiryMs] = useState(SEND_EXPIRY_PRESETS[2].ms);
  
  const isSecureMode = true;
  const isMandatorySecure = true;
  const effectiveSecureMode = true;

  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [taskDuePreset, setTaskDuePreset] = useState<'none' | 'today' | 'tomorrow' | 'week'>('none');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [isTaskTitleManuallyEdited, setIsTaskTitleManuallyEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [kindDrawerOpen, setKindDrawerOpen] = useState(false);
  const [securityDrawerOpen, setSecurityDrawerOpen] = useState(false);
  const [expiryDrawerOpen, setExpiryDrawerOpen] = useState(false);
  const [discreteDrawerOpen, setDiscreteDrawerOpen] = useState(false);

  const handleSelectSecureMode = (val: boolean) => {};

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');

  // LIFTED MECHANISM: Exactly like CreateNoteForm.tsx
  useEffect(() => {
    if (isTitleManuallyEdited) return;
    if (kind !== 'note' && kind !== 'discussion') return;

    const generatedTitle = buildAutoTitleFromContent(noteBody);
    if (noteBody.trim()) {
      if (generatedTitle !== noteTitle) {
        setNoteTitle(generatedTitle);
      }
    } else {
      if (noteTitle) setNoteTitle('');
    }
  }, [noteBody, isTitleManuallyEdited, noteTitle, kind]);

  // LIFTED TASK AUTO-TITLE MECHANISM: Automatically generates task title from details
  useEffect(() => {
    if (isTaskTitleManuallyEdited) return;
    if (kind !== 'task') return;

    const generatedTitle = buildAutoTitleFromContent(taskDetail);
    if (taskDetail.trim()) {
      if (generatedTitle !== taskTitle) {
        setTaskTitle(generatedTitle);
      }
    } else {
      if (taskTitle) setTaskTitle('');
    }
  }, [taskDetail, isTaskTitleManuallyEdited, taskTitle, kind]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpIssuer, setTotpIssuer] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [passwordTotpBundle, setPasswordTotpBundle] = useState('');
  const [sendFile, setSendFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sendSparks, setSendSparks] = useState<SendSparkRef[]>([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<EphemeralClaimTarget | null>(null);
  const [, setSendSparksHydrated] = useState(false);

  const saveSendSparks = useCallback((next: SendSparkRef[]) => {
    try {
      localStorage.setItem(SEND_SPARK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignored
    }
    setSendSparks(next);
    window.dispatchEvent(new Event('storage'));
  }, []);

  useEffect(() => {
    const loadSparks = () => {
      try {
        const raw = localStorage.getItem(SEND_SPARK_STORAGE_KEY);
        if (!raw) {
          setSendSparks([]);
        } else {
          setSendSparks(JSON.parse(raw));
        }
      } catch {
        // Ignored
      }
      setSendSparksHydrated(true);
    };
    loadSparks();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SEND_SPARK_STORAGE_KEY) loadSparks();
    };
    window.addEventListener('storage', handleStorage);

    if (searchParams.get('claimOpen') === '1') {
      const pendingId = peekEphemeralClaimResume('send');
      if (pendingId) {
        const sparksRaw = localStorage.getItem(SEND_SPARK_STORAGE_KEY);
        if (sparksRaw) {
          const list = JSON.parse(sparksRaw) as SendSparkRef[];
          const match = list.find(s => s.id === pendingId);
          if (match) {
            setClaimTarget({
              noteId: match.id,
              claimSecret: match.deletionSecret,
              sendKind: match.kind,
              stashKind: 'send',
              sendUrl: match.url
            });
            setClaimOpen(true);
            clearEphemeralClaimResume();
          }
        }
      }
    }

    return () => window.removeEventListener('storage', handleStorage);
  }, [searchParams]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      const file = e.dataTransfer.files[0];
      setSendFile(file);
      setFileName(file.name);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSendFile(file);
      setFileName(file.name);
    }
  };

  useEffect(() => {
    setIsTitleManuallyEdited(false);
    setIsTaskTitleManuallyEdited(false);
  }, [kind]);

  const draftValid = useMemo(() => {
    if (kind === 'note') return noteBody.trim().length > 0;
    if (kind === 'password') return password.trim().length > 0;
    if (kind === 'task') return taskTitle.trim().length > 0;
    if (kind === 'totp') return totpSecret.trim().length > 0;
    if (kind === 'file') return !!sendFile;
    if (kind === 'discussion') return noteBody.trim().length > 0;
    return false;
  }, [kind, noteBody, password, taskTitle, totpSecret, sendFile]);

  const handleCreateLink = useCallback(async () => {
    setIsCreating(true);
    try {
      const expiresAt = new Date(Date.now() + clampExpiryMs(expiryMs)).toISOString();
      const ghostSecret = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-send`;
      const deletionSecret = crypto.randomUUID();
      const creatorDeletionProofHash = await sha256HexUtf8(deletionSecret);
      let sparkTitle = 'Send';
      let sendObjectPayload: { kind: SendKind; bucketId?: string; fileId?: string } = { kind };

      let outTitle: string;
      let outContent: string;
      let noteKey: string | null = null;
      let format: string;

      const processData = async (title: string, content: string) => {
        if (effectiveSecureMode) {
          const t = await encryptGhostData(title);
          const c = await encryptGhostData(content, t.key);
          noteKey = t.key;
          return { t: t.encrypted, c: c.encrypted };
        }
        return { t: title, c: content };
      };

      if (kind === 'note') {
        sparkTitle = noteTitle.trim() || buildAutoTitleFromContent(noteBody) || 'Note';
        const bodyText = noteBody.trim();
        const { t, c } = await processData(sparkTitle, bodyText);
        outTitle = t;
        outContent = c;
        format = 'markdown';
      } else if (kind === 'password') {
        const bundle: SendPasswordPayload = {
          username: username.trim() || undefined,
          password: password.trim(),
          totpSecret: passwordTotpBundle.trim() || undefined,
        };
        const label = username.trim() ? `Credential · ${username.trim()}` : 'Credential';
        sparkTitle = label;
        const { t, c } = await processData(label, JSON.stringify(bundle));
        outTitle = t;
        outContent = c;
        format = 'json';
      } else if (kind === 'task') {
        let calculatedDueAt: string | undefined = undefined;
        if (taskDuePreset === 'today') {
          calculatedDueAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        } else if (taskDuePreset === 'tomorrow') {
          calculatedDueAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
        } else if (taskDuePreset === 'week') {
          calculatedDueAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
        }

        const priorityHeader = `[Priority: ${taskPriority.toUpperCase()}]\n\n`;
        const finalTaskTitle = taskTitle.trim() || buildAutoTitleFromContent(taskDetail) || 'Task';
        const bundle: SendTaskPayload & { priority?: string } = {
          title: finalTaskTitle,
          detail: priorityHeader + (taskDetail.trim() || ''),
          dueAt: calculatedDueAt,
          priority: taskPriority
        };
        sparkTitle = finalTaskTitle;
        const { t, c } = await processData(finalTaskTitle, JSON.stringify(bundle));
        outTitle = t;
        outContent = c;
        format = 'json';
      } else if (kind === 'totp') {
        const bundle: SendTotpPayload = {
          issuer: totpIssuer.trim() || undefined,
          secret: totpSecret.trim(),
        };
        sparkTitle = bundle.issuer || 'Authenticator';
        const { t, c } = await processData(sparkTitle, JSON.stringify(bundle));
        outTitle = t;
        outContent = c;
        format = 'json';
      } else if (kind === 'discussion') {
        sparkTitle = noteTitle.trim() || buildAutoTitleFromContent(noteBody) || 'Discussion';
        const bodyText = noteBody.trim() || 'Welcome to the thread.';
        const { t, c } = await processData(sparkTitle, bodyText);
        outTitle = t;
        outContent = c;
        format = 'markdown';
      } else if (kind === 'file') {
        const f = sendFile;
        if (!f) {
          toast.error('Choose a file first.');
          return;
        }
        if (f.size > activeMaxBytes) {
          toast.error(`Max file size is ${activeMaxLabel}.`);
          return;
        }
        sparkTitle = f.name || 'File';
        const buf = await f.arrayBuffer();
        
        const t = await encryptGhostData(sparkTitle);
        noteKey = t.key;
        outTitle = t.encrypted;
        
        const cipherBytes = encryptGhostBinaryToBytes(buf, noteKey);
        const uploadBlob = new Blob([cipherBytes.slice()], { type: 'application/octet-stream' });
        const uploadFile = new File([uploadBlob], 'send.enc', { type: 'application/octet-stream' });
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('bucketId', APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL);
        const uploaded = await secureUploadFile(formData);
        
        sendObjectPayload = {
          kind: 'file',
          bucketId: APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL,
          fileId: uploaded.$id,
        };
        const manifest: SendFilePayload = {
          bucketId: APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL,
          fileId: uploaded.$id,
          originalName: f.name,
          mimeType: f.type || 'application/octet-stream',
          size: f.size,
        };
        
        const c = await encryptGhostData(JSON.stringify(manifest), noteKey);
        outContent = c.encrypted;
        format = 'json';
      } else {
        toast.error('Unsupported send type.');
        return;
      }

      const note = await AppwriteService.createSendGhostObject({
        title: outTitle,
        content: outContent,
        format,
        ghostSecret,
        expiresAt,
        isEncrypted: effectiveSecureMode,
        creatorDeletionProofHash,
        sendObject: sendObjectPayload,
      });

      if (selectedUsers.length > 0) {
        const { createCollaborator } = await import('@/lib/appwrite/note');
        await Promise.all(selectedUsers.map(u => 
          createCollaborator({
            resourceId: note.$id,
            resourceType: 'note',
            userId: u.id,
            permission: 'read'
          })
        ));
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = effectiveSecureMode ? `${origin}/send/${note.$id}/${noteKey}` : `${origin}/send/${note.$id}`;
      setCreatedUrl(url);
      setCopied(false);

      setSendSparks((prev) => {
        const spark: SendSparkRef = {
          id: note.$id,
          kind,
          title: sparkTitle,
          url,
          createdAt: new Date().toISOString(),
          expiresAt,
          deletionSecret,
        };
        const next = [spark, ...prev.filter((s) => s.id !== spark.id)].slice(0, SEND_SPARKS_MAX);
        try {
          localStorage.setItem(SEND_SPARK_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignored
        }
        window.dispatchEvent(new Event('storage'));
        return next;
      });

      toast.success(effectiveSecureMode ? 'Secure link created' : 'Send link created');
    } catch (e: unknown) {
      console.error('[Send]', e);
      toast.error(e instanceof Error ? e.message : 'Could not create send link');
    } finally {
      setIsCreating(false);
    }
  }, [
    kind,
    effectiveSecureMode,
    expiryMs,
    noteTitle,
    noteBody,
    username,
    password,
    passwordTotpBundle,
    taskTitle,
    taskDetail,
    totpIssuer,
    totpSecret,
    sendFile,
    taskPriority,
    taskDuePreset,
    selectedUsers,
    activeMaxBytes,
    activeMaxLabel
  ]);

  const handleCopy = useCallback(async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Ignored
    }
  }, [createdUrl]);

  const handleReset = useCallback(() => {
    setCreatedUrl(null);
    setNoteTitle('');
    setNoteBody('');
    setUsername('');
    setPassword('');
    setTaskTitle('');
    setTaskDetail('');
    setTotpIssuer('');
    setTotpSecret('');
    setSendFile(null);
    setFileName(null);
    setSelectedUsers([]);
    setTaskPriority('medium');
    setTaskDuePreset('none');
    setIsTitleManuallyEdited(false);
    setIsTaskTitleManuallyEdited(false);
    setShowPassword(false);
    setExpiryMs(SEND_EXPIRY_PRESETS[2].ms);
  }, []);

  const handleClaimSendSpark = useCallback((spark: SendSparkRef) => {
    setClaimTarget({
      noteId: spark.id,
      claimSecret: spark.deletionSecret,
      sendKind: spark.kind,
      stashKind: 'send',
      sendUrl: spark.url
    });
    setClaimOpen(true);
  }, []);

  const handleSparkConsumed = useCallback((id: string) => {
    setSendSparks(prev => {
        const next = prev.filter(s => s.id !== id);
        localStorage.setItem(SEND_SPARK_STORAGE_KEY, JSON.stringify(next));
        return next;
    });
  }, []);

  const renderHeaderActions = (tooltipText: string) => {
    const isExpiryCustomized = expiryMs !== SEND_EXPIRY_PRESETS[2].ms;
    const isSharingCustomized = selectedUsers.length > 0;
    
    return (
      <div className="flex items-center gap-3">
        {/* Link Expiry Button */}
        <button 
          type="button"
          onClick={() => setExpiryDrawerOpen(true)}
          className={`p-2.5 rounded-xl border transition duration-200 flex items-center justify-center ${
            isExpiryCustomized 
              ? 'text-white border-[#34322F] bg-white/5' 
              : 'text-white/40 border-transparent hover:text-white hover:bg-white/5'
          }`}
          style={{ 
            color: isExpiryCustomized ? themeColor : undefined,
            backgroundColor: isExpiryCustomized ? `${themeColor}14` : undefined,
            borderColor: isExpiryCustomized ? `${themeColor}33` : undefined,
          }}
          title={`Expiry Configuration (${formatRemaining(expiryMs)})`}
        >
          <Clock size={18} />
        </button>

        {/* Discrete Sharing Button */}
        <button 
          type="button"
          onClick={() => setDiscreteDrawerOpen(true)}
          className={`p-2.5 rounded-xl border transition duration-200 flex items-center justify-center ${
            isSharingCustomized 
              ? 'text-white border-[#34322F] bg-white/5' 
              : 'text-white/40 border-transparent hover:text-white hover:bg-white/5'
          }`}
          style={{ 
            color: isSharingCustomized ? themeColor : undefined,
            backgroundColor: isSharingCustomized ? `${themeColor}14` : undefined,
            borderColor: isSharingCustomized ? `${themeColor}33` : undefined,
          }}
          title={isSharingCustomized ? `${selectedUsers.length} collaborator(s) added` : "Discrete Sharing (Optional)"}
        >
          <UsersIcon size={18} />
        </button>

        {/* Main Share/Link Generation Button */}
        <button 
          type="button"
          disabled={!draftValid || isCreating}
          onClick={() => void handleCreateLink()}
          className={`p-3 rounded-xl border transition duration-300 flex items-center justify-center ${
            draftValid 
              ? 'scale-110 active:scale-95' 
              : 'cursor-not-allowed opacity-40'
          }`}
          style={{ 
            color: draftValid ? themeColor : 'rgba(255,255,255,0.15)',
            backgroundColor: draftValid ? `${themeColor}14` : 'transparent',
            borderColor: draftValid ? `${themeColor}59` : 'transparent',
          }}
          title={!draftValid ? tooltipText : "Create & copy send link"}
        >
          {isCreating ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" />
          ) : (
            <Share2 size={20} />
          )}
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative bg-[#0A0908] text-white font-satoshi overflow-x-hidden">
      {/* Dynamic Aura background */}
      <div
        className="pointer-events-none fixed inset-0 z-0 transition duration-500"
        style={{
          background: effectiveSecureMode ?
            'radial-gradient(ellipse 78% 48% at 50% -18%, rgba(99, 102, 241, 0.22), transparent 56%), radial-gradient(ellipse 55% 38% at 100% 0%, rgba(236, 72, 153, 0.07), transparent 52%), radial-gradient(ellipse 48% 32% at 0% 100%, rgba(16, 185, 129, 0.06), transparent 46%)' :
            'radial-gradient(ellipse 78% 48% at 50% -18%, rgba(16, 185, 129, 0.15), transparent 56%), radial-gradient(ellipse 55% 38% at 100% 0%, rgba(99, 102, 241, 0.05), transparent 52%)'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-16 pb-20">
        {/* Workspace Banner */}
        <div className={`mb-8 rounded-3xl overflow-hidden border p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${
          user 
            ? 'border-[#6366F1]/20 bg-gradient-to-r from-[#6366F1]/8 to-[#A855F7]/3'
            : 'border-[#F59E0B]/20 bg-gradient-to-r from-[#F59E0B]/8 to-[#EF4444]/3'
        }`}>
          <div className="flex-1 min-w-0">
            <h6 className="font-black text-white font-clash text-lg flex items-center gap-2 mb-1">
              {user ? (
                <>
                  <Sparkles size={18} className="text-[#818CF8]" />
                  <span>Active Session Detected</span>
                </>
              ) : (
                <>
                  <Lock size={18} className="text-[#F59E0B]" />
                  <span>Ecosystem Integration Available</span>
                </>
              )}
            </h6>
            <p className="text-xs text-white/60 leading-relaxed">
              {user ? (
                `You are currently signed in as ${user.name || user.email || 'Teammate'}. Head back to your workspace to manage your active execution containers, notes, and secure vaults.`
              ) : (
                "You are sharing as a guest. Create a free account to permanently save these ghost objects, unlock unlimited encrypted vaults, and collaborate in real-time with teammates."
              )}
            </p>
          </div>
          <button
            onClick={() => {
              if (user) {
                router.push('/projects');
              } else {
                openUnified('login');
              }
            }}
            className="flex-shrink-0 rounded-2xl font-black text-xs px-6 py-3.5 transition duration-200 hover:-translate-y-0.5 active:translate-y-0 text-black"
            style={{
              backgroundColor: user ? '#6366F1' : '#F59E0B',
            }}
          >
            {user ? 'Go to Workspace' : 'Unlock Full Suite'}
          </button>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex flex-col gap-2 mb-8 text-center items-center">
            <span 
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border text-white/90"
              style={{
                backgroundColor: `${themeColor}1f`,
                borderColor: `${themeColor}59`,
              }}
            >
              <Sparkles size={12} style={{ color: themeColor }} />
              <span>Send by Kylrix</span>
            </span>
            <h3 className="font-clash font-black text-3xl md:text-4xl tracking-tight text-white mt-1">
              {effectiveSecureMode ? "Private Sharing" : "Public Preview"}
            </h3>
            <p className="text-white/60 max-w-[520px] mx-auto text-sm leading-relaxed mt-2">
              {effectiveSecureMode ? 
                "End-to-end encrypted objects with one link. We never see your data. Keys stay on your device." :
                "Fast, unencrypted previews for notes, tasks, and files. Perfect for discovery and public sharing."
              }
            </p>
          </div>
        </motion.div>

        {!createdUrl ? (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-8 items-start">
            {/* Desktop Sidebar / Mobile Trigger buttons */}
            <div className="flex flex-col gap-4">
              {/* Mobile trigger button (hidden on desktop) */}
              <div className="flex gap-3 lg:hidden flex-wrap">
                <button
                  type="button"
                  onClick={() => setKindDrawerOpen(true)}
                  className="bg-white/[0.02] border rounded-xl px-5 py-3.5 text-white text-sm font-black font-clash flex items-center gap-2 hover:bg-[#1C1A18] transition duration-200"
                  style={{ borderColor: `${KIND_COLORS[kind]}40` }}
                >
                  {React.createElement(KINDS.find(k => k.id === kind)?.Icon || FileText, { size: 18, color: KIND_COLORS[kind] })}
                  <span>{KINDS.find(k => k.id === kind)?.label || 'Note'}</span>
                  <ChevronDown size={14} className="opacity-60 ml-1" />
                </button>
              </div>

              {/* Desktop Sidebar panel (hidden on mobile) */}
              <div className="hidden lg:flex flex-col gap-2 p-5 bg-[#161412] border border-[#34322F] rounded-3xl">
                <span className="text-[10px] font-black text-white/30 tracking-widest uppercase mb-3 block">
                  Select Format
                </span>
                <div className="flex flex-col gap-1.5">
                  {KINDS.map(({ id, label, blurb, Icon }) => {
                    const selected = kind === id;
                    const itemColor = KIND_COLORS[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setKind(id);
                          if (id !== 'file') {
                            setSendFile(null);
                            setFileName(null);
                          }
                        }}
                        className="p-3 rounded-xl border text-left flex items-center gap-3 transition duration-200 w-full cursor-pointer hover:bg-white/[0.02]"
                        style={{
                          borderColor: selected ? itemColor : 'transparent',
                          backgroundColor: selected ? `${itemColor}14` : 'transparent',
                        }}
                      >
                        <div style={{ color: itemColor }}>
                          <Icon size={18} />
                        </div>
                        <div>
                          <p className={`text-xs font-black font-clash ${selected ? 'text-white' : 'text-white/60'}`}>{label}</p>
                          <p className="text-[10px] text-white/30 font-satoshi truncate mt-0.5 max-w-[190px]">{blurb}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              {kind === 'note' && (
                <NoteComposerCard
                  noteTitle={noteTitle}
                  setNoteTitle={setNoteTitle}
                  noteBody={noteBody}
                  setNoteBody={setNoteBody}
                  isTitleManuallyEdited={isTitleManuallyEdited}
                  setIsTitleManuallyEdited={setIsTitleManuallyEdited}
                  handleCreateLink={handleCreateLink}
                  renderHeaderActions={renderHeaderActions}
                  draftValid={draftValid}
                  isCreating={isCreating}
                  effectiveSecureMode={effectiveSecureMode}
                  themeColor={themeColor}
                />
              )}

              {kind === 'discussion' && (
                <DiscussionComposerCard
                  noteTitle={noteTitle}
                  setNoteTitle={setNoteTitle}
                  noteBody={noteBody}
                  setNoteBody={setNoteBody}
                  isTitleManuallyEdited={isTitleManuallyEdited}
                  setIsTitleManuallyEdited={setIsTitleManuallyEdited}
                  handleCreateLink={handleCreateLink}
                  renderHeaderActions={renderHeaderActions}
                  draftValid={draftValid}
                  isCreating={isCreating}
                  user={user}
                  themeColor={themeColor}
                />
              )}

            {kind === 'password' && (
              <div className="rounded-[24px] bg-[#161412] border border-[#34322F] p-6 shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),_0_2px_3px_-3px_rgba(37,35,33,0.9)] focus-within:border-[#10B981]/50 focus-within:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),_0_0_15px_rgba(16,185,129,0.15)] transition duration-200">
                {/* Vault Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] flex items-center justify-center">
                      <KeyRound size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-base font-clash text-white">Hardware Credential Vault</p>
                      <span className="text-[10px] text-white/40 font-satoshi">Locked on this device</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 px-2.5 py-1 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                      <span className="text-[10px] font-black text-[#10B981] tracking-wider">LOCKED</span>
                    </div>
                    {renderHeaderActions("Enter a password to share")}
                  </div>
                </div>

                {/* Interactive Card/SIM representation */}
                <div className="p-6 rounded-2xl bg-black border border-[#34322F] mb-3 relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.08)_0%,_transparent_60%)]">
                  <div className="w-10 h-8 rounded-md bg-gradient-to-br from-[#F59E0B] to-[#D97706] border border-[#B45309] absolute top-5 right-5 opacity-80 after:content-[''] after:absolute after:inset-1 after:border after:border-white/20 after:rounded-sm" />

                  <div className="flex flex-col gap-4 max-w-[80%] relative z-10">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-white/30 tracking-wider uppercase">Vault Identity</label>
                      <input
                        type="text"
                        placeholder="Username, Email, or Client ID"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-transparent text-sm font-mono text-white py-1 border-b border-dashed border-[#34322F] focus:border-[#10B981] focus:outline-none placeholder-white/20"
                      />
                    </div>

                    <div className="flex flex-col gap-1 my-1">
                      <PasswordGenerator onPasswordSelect={(pwd) => setPassword(pwd)} currentPassword={password} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-white/30 tracking-wider uppercase">Credential Key</label>
                      <div className="flex items-center border-b border-dashed border-[#34322F] focus-within:border-[#10B981]">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Secret Password or Key Phrase"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-transparent text-sm font-mono text-white py-1 focus:outline-none placeholder-white/20"
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/40 hover:text-white p-1">
                          {showPassword ? <Unlock size={16} /> : <Lock size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-white/30 tracking-wider uppercase">Bundled TOTP Secret (Optional)</label>
                      <input
                        type="text"
                        placeholder="JBSWY3DPEHPK3PXP"
                        value={passwordTotpBundle}
                        onChange={(e) => setPasswordTotpBundle(e.target.value)}
                        className="w-full bg-transparent text-sm font-mono text-white py-1 border-b border-dashed border-[#34322F] focus:border-[#10B981] focus:outline-none placeholder-white/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {kind === 'totp' && (
              <div className="rounded-[24px] bg-[#161412] border border-[#34322F] p-6 shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),_0_2px_3px_-3px_rgba(37,35,33,0.9)] focus-within:border-[#10B981]/50 focus-within:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),_0_0_15px_rgba(16,185,129,0.15)] transition duration-200">
                {/* Authenticator Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] flex items-center justify-center">
                      <Shield size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-base font-clash text-white">Authenticator Generator</p>
                      <span className="text-[10px] text-white/40 font-satoshi">Secure 2FA token seeds</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-[#10B981]/10 border border-[#10B981]/20 px-2.5 py-1 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
                      <span className="text-[10px] font-black text-[#10B981] tracking-wider">ACTIVE</span>
                    </div>
                    {renderHeaderActions("Enter a secret key to share")}
                  </div>
                </div>

                {/* Digital LCD screen representation */}
                <div className="p-6 rounded-2xl bg-black border border-[#34322F] mb-3 relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.05)_0%,_transparent_60%)]">
                  <div className="flex justify-between items-center border border-[#1C1A18] bg-[#0A0908] rounded-xl p-4 mb-6">
                    <div>
                      <span className="text-[10px] text-white/30 font-black tracking-wider uppercase block">
                        {totpIssuer.trim() ? totpIssuer.trim() : 'DEFAULT TOKEN'}
                      </span>
                      <span className="text-3xl font-mono font-black text-[#10B981] tracking-wider mt-1 block">
                        {totpSecret.trim() ? '••• •••' : '000 000'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-white/30 font-black">TIME REMAINING</span>
                      <span className="text-lg font-mono font-black text-white/70 mt-1 block">30s</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-white/30 tracking-wider uppercase">Token Issuer (e.g. Google, AWS, GitHub)</label>
                      <input
                        type="text"
                        placeholder="Google, AWS, GitHub"
                        value={totpIssuer}
                        onChange={(e) => setTotpIssuer(e.target.value)}
                        className="w-full bg-transparent text-sm text-white py-1 border-b border-dashed border-[#34322F] focus:border-[#10B981] focus:outline-none placeholder-white/20"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black text-white/30 tracking-wider uppercase">Secret Authenticator Key</label>
                      <input
                        type="text"
                        placeholder="JBSWY3DPEHPK3PXP"
                        required
                        value={totpSecret}
                        onChange={(e) => setTotpSecret(e.target.value)}
                        className="w-full bg-transparent text-sm font-mono text-white py-1 border-b border-dashed border-[#34322F] focus:border-[#10B981] focus:outline-none placeholder-white/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {kind === 'task' && (
              <div className="rounded-[24px] bg-[#161412] border border-[#34322F] p-6 shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),_0_2px_3px_-3px_rgba(37,35,33,0.9)] focus-within:border-[#A855F7]/50 focus-within:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),_0_0_15px_rgba(168,85,247,0.15)] transition duration-200">
                {/* Task Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#A855F7]/10 border border-[#A855F7]/30 text-[#A855F7] flex items-center justify-center">
                      <ListTodo size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-base font-clash text-white">Execution Goal Planner</p>
                      <span className="text-[10px] text-white/40 font-satoshi">Action items & milestones</span>
                    </div>
                  </div>
                  {renderHeaderActions("Enter a goal title to share")}
                </div>

                {/* Goals Metadata Schema board */}
                <div className="p-6 rounded-2xl bg-black border border-[#34322F] mb-3 relative overflow-hidden bg-[radial-gradient(circle_at_center,_rgba(168,85,247,0.03)_0%,_transparent_80%)]">
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-white/30 tracking-wider uppercase">Goal / Objective</label>
                        <input
                          key="task-title-input"
                          type="text"
                          placeholder="What needs to be achieved?"
                          required
                          value={taskTitle}
                          autoComplete="off"
                          onChange={(e) => setTaskTitle(e.target.value)}
                          onKeyDown={() => setIsTaskTitleManuallyEdited(true)}
                          onMouseDown={() => setIsTaskTitleManuallyEdited(true)}
                          onPaste={() => setIsTaskTitleManuallyEdited(true)}
                          className="w-full bg-transparent text-lg font-bold font-clash text-white py-1 border-b border-dashed border-[#34322F] focus:border-[#A855F7] focus:outline-none placeholder-white/20"
                        />
                      </div>
 
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black text-white/30 tracking-wider uppercase">Execution Details / Sub-steps</label>
                        <textarea
                          key="task-body-textarea"
                          placeholder="Add context, specifications, or step-by-step checklist..."
                          rows={3}
                          value={taskDetail}
                          onChange={(e) => setTaskDetail(e.target.value)}
                          className="w-full bg-transparent text-sm text-white/80 py-1 leading-normal border-b border-dashed border-[#34322F] focus:border-[#A855F7] focus:outline-none placeholder-white/20 resize-y"
                        />
                      </div>
                    </div>

                    {/* Goal Priority Selector */}
                    <div>
                      <label className="text-[10px] font-black text-white/30 tracking-wider uppercase block mb-2">Goal Priority</label>
                      <div className="flex flex-wrap gap-2">
                        {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                          const isSelected = taskPriority === p;
                          const color = p === 'low' ? '#A1A1AA' : p === 'medium' ? '#A855F7' : p === 'high' ? '#F59E0B' : '#EF4444';
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setTaskPriority(p)}
                              className="text-[10px] font-black uppercase px-4 py-2 rounded-lg border transition duration-200"
                              style={{
                                borderColor: isSelected ? color : '#34322F',
                                backgroundColor: isSelected ? `${color}26` : 'transparent',
                                color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Goal Deadline Selector */}
                    <div>
                      <label className="text-[10px] font-black text-white/30 tracking-wider uppercase block mb-2">Goal Target Deadline</label>
                      <div className="flex flex-wrap gap-2">
                        {(['none', 'today', 'tomorrow', 'week'] as const).map((preset) => {
                          const isSelected = taskDuePreset === preset;
                          const label = preset === 'none' ? 'No Due Date' : preset === 'today' ? 'Today' : preset === 'tomorrow' ? 'Tomorrow' : '1 Week';
                          return (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setTaskDuePreset(preset)}
                              className="text-xs font-bold px-4 py-2 rounded-lg border transition duration-200"
                              style={{
                                borderColor: '#A855F7',
                                backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                                color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {kind === 'file' && (
              <div className="rounded-[24px] bg-[#161412] border border-[#34322F] p-6 shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),_0_2px_3px_-3px_rgba(37,35,33,0.9)] focus-within:border-[#6366F1]/50 focus-within:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),_0_0_15px_rgba(99,102,241,0.15)] transition duration-200">
                {/* File Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 border border-[#6366F1]/30 text-[#6366F1] flex items-center justify-center">
                      <Upload size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-base font-clash text-white">Secure File Drop</p>
                      <span className="text-[10px] text-white/40 font-satoshi">Vanishing secure file storage</span>
                    </div>
                  </div>
                  {renderHeaderActions("Choose a file to share")}
                </div>

                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition duration-200 ${
                    dragActive ? 'border-[#6366F1] bg-[#6366F1]/5' : 'border-[#34322F] bg-white/[0.01]'
                  }`}
                >
                  <input
                    type="file"
                    id="send-file-input"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="send-file-input" className="cursor-pointer block">
                    <div className="flex flex-col gap-4 items-center">
                      <div className="w-12 h-12 rounded-full bg-[#161412] border border-[#34322F] text-[#6366F1] flex items-center justify-center">
                        <Upload size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-white font-satoshi">{fileName || 'Click or drag file to share'}</p>
                        <span className="text-xs text-white/40 block mt-1">Max {activeMaxLabel} · Securely encrypted</span>
                      </div>
                      {fileName && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setSendFile(null);
                            setFileName(null);
                          }}
                          className="text-[#FF453A] font-bold text-xs hover:underline mt-2"
                        >
                          Remove File
                        </button>
                      )}
                    </div>
                  </label>
                </div>
              </div>
            )}

            <button
              disabled={!draftValid || isCreating}
              onClick={() => void handleCreateLink()}
              className="w-full py-4 rounded-2xl font-black text-sm text-black transition duration-300 hover:brightness-110 active:scale-[0.99] flex items-center justify-center gap-2 font-clash disabled:bg-white/5 disabled:text-white/15 disabled:cursor-not-allowed"
              style={{
                backgroundColor: draftValid && !isCreating ? themeColor : undefined,
              }}
            >
              {isCreating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" />
              ) : (
                <span>Create {effectiveSecureMode ? 'Secure' : 'Send'} Link</span>
              )}
            </button>
            <p className="text-center text-xs text-[#9B9691] px-4 leading-relaxed mt-4">
              {effectiveSecureMode ? 'Securely stored' : 'Stored'} for this link — they clear automatically after 7 days.
              {effectiveSecureMode && ' The key stays in the link fragment only.'}
            </p>
            </div>

            {/* Desktop Sidebar Stash (hidden on mobile) */}
            {sendSparks.length > 0 && (
              <div className="hidden lg:block bg-[#161412] border border-[#34322F] rounded-3xl p-5 w-full">
                <SendSparkShelf sparks={sendSparks} onSaveSparks={saveSendSparks} onClaim={handleClaimSendSpark} />
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 md:p-12 rounded-[40px] bg-[#161412] border border-[#34322F] text-center shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-black"
              style={{ backgroundColor: `${themeColor}1a`, color: themeColor }}
            >
              <Check size={32} strokeWidth={3} />
            </div>
            <h4 className="text-2xl font-black font-clash text-white mb-3">
              Link Created
            </h4>
            <p className="text-sm text-white/50 mb-8 max-w-[360px] mx-auto">
              Anyone with this link can {effectiveSecureMode ? 'decrypt' : 'view'} the payload. It will vanish automatically in {formatRemaining(expiryMs)}.
            </p>

            <div className="p-4 rounded-2xl bg-black border border-[#34322F] mb-8 flex items-center gap-3">
              <span className="flex-1 font-mono text-xs text-white/70 text-left truncate">
                {createdUrl}
              </span>
              <button 
                onClick={handleCopy} 
                className="p-2 rounded-xl transition hover:bg-white/5"
                style={{ color: themeColor }}
              >
                <Copy size={20} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleCopy}
                className="px-8 py-3.5 rounded-2xl text-black font-black flex items-center justify-center gap-2 font-clash transition duration-200 hover:brightness-110"
                style={{ backgroundColor: themeColor }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3.5 rounded-2xl border border-[#34322F] text-white font-black font-clash transition duration-200 hover:border-[#4A4845] hover:bg-white/5"
              >
                Create Another
              </button>
            </div>
          </div>
        )}

        {/* Spark shelf / history shelf */}
        {sendSparks.length > 0 && (
          <div className="mt-8 md:hidden">
            <div className="rounded-[24px] bg-[#161412] border border-[#34322F] p-6 shadow-[0_4px_4px_-4px_rgba(0,0,0,0.9),_0_2px_3px_-3px_rgba(37,35,33,0.9)]">
              <SendSparkShelf sparks={sendSparks} onSaveSparks={saveSendSparks} onClaim={handleClaimSendSpark} />
            </div>
          </div>
        )}

        <div className="mt-16 border-t border-[#34322F] pt-8 text-center">
          <span className="text-[10px] text-white/20 font-black tracking-widest uppercase font-clash">
            Secure Send · Powered by Kylrix
          </span>
        </div>
      </div>

      {/* Sharing Format Selection Sheet */}
      {kindDrawerOpen && (
        <div className="fixed inset-0 z-[1500] flex items-end justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setKindDrawerOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#161412] border-t border-[#34322F] rounded-t-3xl p-6 text-white max-h-[80vh] overflow-y-auto z-10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <h6 className="text-xl font-bold font-clash">Select Sharing Format</h6>
              <button onClick={() => setKindDrawerOpen(false)} className="text-white/40 hover:text-white text-sm">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {KINDS.map(({ id, label, blurb, Icon }) => {
                const selected = kind === id;
                const itemColor = KIND_COLORS[id];
                return (
                  <button
                    key={id}
                    onClick={() => {
                      setKind(id);
                      setKindDrawerOpen(false);
                      if (id !== 'file') {
                        setSendFile(null);
                        setFileName(null);
                      }
                    }}
                    className="p-4 rounded-xl border text-left flex items-center gap-4 transition duration-200 w-full"
                    style={{
                      borderColor: selected ? itemColor : '#34322F',
                      backgroundColor: selected ? `${itemColor}14` : 'transparent',
                    }}
                  >
                    <div style={{ color: itemColor }}>
                      <Icon size={24} />
                    </div>
                    <div>
                      <p className={`font-bold font-satoshi ${selected ? 'text-white' : 'text-white/80'}`}>{label}</p>
                      <span className={`text-xs block mt-0.5 ${selected ? 'text-white/70' : 'text-white/40'}`}>{blurb}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Security Selector Sheet */}
      {securityDrawerOpen && (
        <div className="fixed inset-0 z-[1500] flex items-end justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSecurityDrawerOpen(false)} />
          <div className="relative w-full max-w-xl bg-[#161412] border-t border-[#34322F] rounded-t-3xl p-6 text-white max-h-[80vh] overflow-y-auto z-10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-6">
              <h6 className="text-xl font-bold font-clash">Sharing Security</h6>
              <button onClick={() => setSecurityDrawerOpen(false)} className="text-white/40 hover:text-white text-sm">Close</button>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  handleSelectSecureMode(true);
                  setSecurityDrawerOpen(false);
                }}
                className="p-4 rounded-xl border text-left flex items-start gap-4 transition w-full"
                style={{
                  borderColor: isSecureMode ? themeColor : '#34322F',
                  backgroundColor: isSecureMode ? `${themeColor}14` : 'transparent',
                }}
              >
                <div style={{ color: themeColor }} className="mt-0.5">
                  <Lock size={20} />
                </div>
                <div>
                  <p className={`font-bold font-satoshi ${isSecureMode ? 'text-white' : 'text-white/80'}`}>Private Sharing</p>
                  <span className="text-xs text-white/40 mt-1 block leading-normal">Encrypted before upload. Only people with the link can open it.</span>
                </div>
              </button>

              <button
                onClick={() => {
                  handleSelectSecureMode(false);
                  setSecurityDrawerOpen(false);
                }}
                className="p-4 rounded-xl border text-left flex items-start gap-4 transition w-full"
                style={{
                  borderColor: !isSecureMode ? '#10B981' : '#34322F',
                  backgroundColor: !isSecureMode ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                }}
              >
                <div className="text-[#10B981] mt-0.5">
                  <Unlock size={20} />
                </div>
                <div>
                  <p className={`font-bold font-satoshi ${!isSecureMode ? 'text-white' : 'text-white/80'}`}>Public Preview</p>
                  <span className="text-xs text-white/40 mt-1 block leading-normal">Fast previews for links that do not need protection.</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expiry Customization Sheet */}
      {expiryDrawerOpen && (
        <div className="fixed inset-0 z-[1500] flex items-end justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setExpiryDrawerOpen(false)} />
          <div className="relative w-full max-w-xl bg-[#161412] border-t border-[#34322F] rounded-t-3xl p-6 text-white max-h-[80vh] overflow-y-auto z-10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-4">
              <h6 className="text-xl font-bold font-clash">Link Expiry</h6>
              <button onClick={() => setExpiryDrawerOpen(false)} className="text-white/40 hover:text-white text-sm">Close</button>
            </div>
            <p className="text-xs text-white/50 mb-6 font-satoshi leading-relaxed">
              Choose when this link should expire and be removed from the server.
            </p>

            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-white/80 font-bold">Selected Duration</span>
              <span className="text-sm font-black font-mono" style={{ color: themeColor }}>
                {formatRemaining(expiryMs)}
              </span>
            </div>

            <input
              type="range"
              value={expiryMs}
              min={SEND_EXPIRY_PRESETS[0].ms}
              max={SEND_MAX_TTL_MS}
              step={60000}
              onChange={(e) => setExpiryMs(Number(e.target.value))}
              className="w-full h-1 bg-[#34322F] rounded-lg appearance-none cursor-pointer mb-6"
              style={{ accentColor: themeColor }}
            />

            <div className="flex justify-between gap-2 flex-wrap mb-4">
              {SEND_EXPIRY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setExpiryMs(p.ms)}
                  className="flex-1 min-w-[70px] py-2 text-xs rounded-lg border transition duration-200 font-bold"
                  style={{
                    borderColor: expiryMs === p.ms ? themeColor : '#34322F',
                    backgroundColor: expiryMs === p.ms ? `${themeColor}14` : 'transparent',
                    color: expiryMs === p.ms ? '#ffffff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discrete Sharing / Collaborator Search Sheet */}
      {discreteDrawerOpen && (
        <div className="fixed inset-0 z-[1500] flex items-end justify-center">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setDiscreteDrawerOpen(false)} />
          <div className="relative w-full max-w-2xl bg-[#161412] border-t border-[#34322F] rounded-t-3xl p-6 text-white max-h-[80vh] overflow-y-auto z-10 shadow-[0_-8px_32px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between mb-2">
              <h6 className="text-xl font-bold font-clash">Discrete Sharing</h6>
              <button onClick={() => setDiscreteDrawerOpen(false)} className="text-white/40 hover:text-white text-sm">Close</button>
            </div>
            <p className="text-xs text-white/50 mb-6 font-satoshi leading-relaxed">
              Send directly to specific users in the ecosystem. They will be added as collaborators with read permissions.
            </p>
            
            <div className="min-h-[220px]">
              <UserSearch
                label=""
                placeholder="Search for users to share with..."
                selectedUsers={selectedUsers}
                onSelect={(u) => setSelectedUsers([...selectedUsers, u])}
                onRemove={(id) => setSelectedUsers(selectedUsers.filter(u => u.id !== id))}
              />
            </div>
          </div>
        </div>
      )}

      <EphemeralClaimDrawer
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        target={claimTarget}
        onConsumed={handleSparkConsumed}
      />
      <AuthDiscoveryDrawer />
    </div>
  );
}
