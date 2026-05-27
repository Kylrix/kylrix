'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  IconButton,
  InputLabel,
  Paper,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Switch,
  FormControlLabel,
  Drawer,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
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
  Calendar,
  Flag,
  Clock,
} from 'lucide-react';

import MuralPattern from '@/components/chat/MuralPattern';
import { buildAutoTitleFromContent } from '@/constants/noteTitle';

import { ID, Permission, Role } from 'appwrite';

import { useAuth } from '@/context/auth/AuthContext';
import { EphemeralClaimDrawer, type EphemeralClaimTarget } from '@/components/ephemeral/EphemeralClaimDrawer';
import { SendSparkShelf } from '@/components/send/SendSparkShelf';
import UserSearch from '@/components/UserSearch';
import Logo from '@/components/Logo';
import { AppwriteService } from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { storage } from '@/lib/appwrite/client';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { encryptGhostBinaryToBytes, encryptGhostData } from '@/lib/encryption/ghost-crypto';
import { sha256HexUtf8 } from '@/lib/crypto/sha256-hex';
import { clearEphemeralClaimResume, peekEphemeralClaimResume } from '@/lib/ephemeral/claim-session';
import {
  SEND_EXPIRY_PRESETS,
  SEND_MAX_FILE_BYTES_FREE,
  SEND_MAX_FILE_BYTES_PRO,
  SEND_MAX_TTL_MS,
  SEND_SPARK_STORAGE_KEY,
  SEND_SPARKS_MAX,
  clampExpiryMs,
} from '@/lib/send/constants';
import type {
  SendFilePayload,
  SendKind,
  SendPasswordPayload,
  SendSparkRef,
  SendTaskPayload,
  SendTotpPayload,
} from '@/lib/send/types';
import { hasPaidKylrixPlan } from '@/lib/utils';
import toast from 'react-hot-toast';

const BG = '#0A0908';
const SURFACE = '#161412';
const SURFACE_HOVER = '#1C1A18';
const RIM = '1px solid #34322F';
const PRIMARY = '#6366F1';

const cardStyle = {
  p: { xs: 2, sm: 2.5 },
  borderRadius: '24px',
  bgcolor: '#161412',
  border: '1px solid #34322F',
  boxShadow: '0 4px 4px -4px rgba(0,0,0,0.9), 0 2px 3px -3px rgba(37,35,33,0.9)',
  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  position: 'relative',
} as const;

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

export function SendComposer() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const isPro = useMemo(() => user ? hasPaidKylrixPlan(user) : false, [user]);
  const activeMaxBytes = 10 * 1024 * 1024; // Strict 10MB limit for Send
  const activeMaxLabel = '10 MB';

  const [kind, setKind] = useState<SendKind>('note');
  const themeColor = KIND_COLORS[kind];
  const [expiryMs, setExpiryMs] = useState(SEND_EXPIRY_PRESETS[2].ms);
  const [isSecureMode, setIsSecureMode] = useState(false);

  // Mandatory Secure Types: Credentials, Files, and Discussions
  const isMandatorySecure = useMemo(() => {
    return kind === 'password' || kind === 'totp' || kind === 'file' || kind === 'discussion';
  }, [kind]);

  const effectiveSecureMode = useMemo(() => {
    if (isMandatorySecure) return true;
    return isSecureMode;
  }, [isMandatorySecure, isSecureMode]);

  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [taskDuePreset, setTaskDuePreset] = useState<'none' | 'today' | 'tomorrow' | 'week'>('none');
  const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [kindDrawerOpen, setKindDrawerOpen] = useState(false);
  const [securityDrawerOpen, setSecurityDrawerOpen] = useState(false);
  const [expiryDrawerOpen, setExpiryDrawerOpen] = useState(false);
  const [discreteDrawerOpen, setDiscreteDrawerOpen] = useState(false);

  // Load persistent security preferences per format
  useEffect(() => {
    const saved = localStorage.getItem(`send_sec_pref_${kind}`);
    if (saved !== null) {
      setIsSecureMode(saved === 'true');
    } else {
      setIsSecureMode(false); // default is unencrypted
    }
  }, [kind]);

  const handleSelectSecureMode = (val: boolean) => {
    setIsSecureMode(val);
    localStorage.setItem(`send_sec_pref_${kind}`, String(val));
  };

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [totpIssuer, setTotpIssuer] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  /** Optional TOTP seed bundled with password sends */
  const [passwordTotpBundle, setPasswordTotpBundle] = useState('');
  const [sendFile, setSendFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Discrete Sharing
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sendSparks, setSendSparks] = useState<SendSparkRef[]>([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<EphemeralClaimTarget | null>(null);
  const [sendSparksHydrated, setSendSparksHydrated] = useState(false);

  const saveSendSparks = useCallback((next: SendSparkRef[]) => {
    try {
      localStorage.setItem(SEND_SPARK_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
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
        /* ignore */
      }
      setSendSparksHydrated(true);
    };
    loadSparks();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SEND_SPARK_STORAGE_KEY) loadSparks();
    };
    window.addEventListener('storage', handleStorage);

    // Resume claim after auth if param is present
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

  // Reset title edit state on format change
  useEffect(() => {
    setIsTitleManuallyEdited(false);
  }, [kind]);

  // Seamless auto-title logic
  useEffect(() => {
    if (isTitleManuallyEdited) return;

    const generatedTitle = buildAutoTitleFromContent(noteBody);
    if (noteBody.trim()) {
      if (generatedTitle !== noteTitle) {
        setNoteTitle(generatedTitle);
      }
    } else {
      setNoteTitle('');
    }
  }, [noteBody, isTitleManuallyEdited, noteTitle]);

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
        sparkTitle = noteTitle.trim() || 'Note';
        const { t, c } = await processData(sparkTitle, noteBody.trim());
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
        const bundle: SendTaskPayload & { priority?: string } = {
          title: taskTitle.trim(),
          detail: priorityHeader + (taskDetail.trim() || ''),
          dueAt: calculatedDueAt,
          priority: taskPriority
        };
        sparkTitle = bundle.title;
        const { t, c } = await processData(bundle.title, JSON.stringify(bundle));
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
        sparkTitle = noteTitle.trim() || 'Discussion';
        const { t, c } = await processData(sparkTitle, noteBody.trim() || 'Welcome to the thread.');
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
        
        // Files are ALWAYS encrypted for security, but metadata/title can be public for previews
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

      // Handle discrete sharing (collaborators)
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
          /* ignore */
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
      /* ignore */
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
      <Stack direction="row" spacing={1.5} alignItems="center">
        {/* Link Expiry Button */}
        <Tooltip title={`Expiry Configuration (${formatRemaining(expiryMs)})`}>
          <IconButton 
            size="medium"
            onClick={() => setExpiryDrawerOpen(true)}
            sx={{ 
              color: isExpiryCustomized ? themeColor : 'rgba(255,255,255,0.4)',
              bgcolor: isExpiryCustomized ? alpha(themeColor, 0.08) : 'transparent',
              border: isExpiryCustomized ? `1px solid ${alpha(themeColor, 0.2)}` : '1px solid transparent',
              '&:hover': {
                bgcolor: alpha(themeColor, 0.12),
                color: themeColor,
              },
              transition: 'all 0.2s ease',
            }}
          >
            <Clock size={18} />
          </IconButton>
        </Tooltip>

        {/* Discrete Sharing Button */}
        <Tooltip title={isSharingCustomized ? `${selectedUsers.length} collaborator(s) added` : "Discrete Sharing (Optional)"}>
          <IconButton 
            size="medium"
            onClick={() => setDiscreteDrawerOpen(true)}
            sx={{ 
              color: isSharingCustomized ? themeColor : 'rgba(255,255,255,0.4)',
              bgcolor: isSharingCustomized ? alpha(themeColor, 0.08) : 'transparent',
              border: isSharingCustomized ? `1px solid ${alpha(themeColor, 0.2)}` : '1px solid transparent',
              '&:hover': {
                bgcolor: alpha(themeColor, 0.12),
                color: themeColor,
              },
              transition: 'all 0.2s ease',
            }}
          >
            <UsersIcon size={18} />
          </IconButton>
        </Tooltip>

        {/* Main Share/Link Generation Button */}
        <Tooltip title={!draftValid ? tooltipText : "Create & copy send link"}>
          <span>
            <IconButton 
              size="medium"
              disabled={!draftValid || isCreating}
              onClick={() => void handleCreateLink()}
              sx={{ 
                color: !draftValid ? 'rgba(255,255,255,0.15)' : themeColor,
                bgcolor: draftValid ? alpha(themeColor, 0.08) : 'transparent',
                border: draftValid ? `1px solid ${alpha(themeColor, 0.35)}` : '1px solid transparent',
                transform: draftValid ? 'scale(1.15)' : 'scale(1.0)',
                '&:hover': {
                  bgcolor: alpha(themeColor, 0.15),
                  transform: draftValid ? 'scale(1.2)' : 'scale(1.0)',
                },
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                p: 1.25,
              }}
            >
              {isCreating ? <CircularProgress size={18} color="inherit" /> : <Share2 size={20} />}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': { bgcolor: '#000000', borderRadius: '12px' },
    '& .MuiInputLabel-root': { color: '#9B9691', fontFamily: 'var(--font-satoshi)' },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#34322F' },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4A4845' },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: PRIMARY },
    '& .MuiInputBase-input': { color: '#ffffff', fontFamily: 'var(--font-satoshi)' },
  } as const;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        bgcolor: '#0A0908',
        color: '#ffffff',
        fontFamily: 'var(--font-satoshi)',
        overflowX: 'hidden',
      }}
    >


      <Box
        sx={{
          pointerEvents: 'none',
          position: 'fixed',
          inset: 0,
          background: effectiveSecureMode ?
            'radial-gradient(ellipse 78% 48% at 50% -18%, rgba(99, 102, 241, 0.22), transparent 56%), radial-gradient(ellipse 55% 38% at 100% 0%, rgba(236, 72, 153, 0.07), transparent 52%), radial-gradient(ellipse 48% 32% at 0% 100%, rgba(16, 185, 129, 0.06), transparent 46%)' :
            'radial-gradient(ellipse 78% 48% at 50% -18%, rgba(16, 185, 129, 0.15), transparent 56%), radial-gradient(ellipse 55% 38% at 100% 0%, rgba(99, 102, 241, 0.05), transparent 52%)',
          zIndex: 0,
        }}
      />

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 12 }, pb: 10 }}>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Stack spacing={1} sx={{ mb: 4, textAlign: 'center' }}>
            <Chip
              icon={<Sparkles size={14} style={{ color: themeColor }} />}
              label="Send by Kylrix"
              sx={{
                alignSelf: 'center',
                px: 1,
                bgcolor: alpha(themeColor, 0.12),
                color: alpha('#fff', 0.9),
                border: `1px solid ${alpha(themeColor, 0.35)}`,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                fontSize: '0.7rem',
              }}
            />
            <Typography
              variant="h3"
              sx={{
                fontFamily: 'var(--font-clash)',
                fontWeight: 600,
                letterSpacing: '-0.03em',
                fontSize: { xs: '2rem', md: '2.75rem' },
              }}
            >
              {effectiveSecureMode ? "Zero-Knowledge Sharing" : "Instant Preview Sharing"}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.62)', maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}>
              {effectiveSecureMode ? 
                "End-to-end encrypted objects with one link. We never see your data. Keys stay on your device." :
                "Fast, unencrypted previews for notes, tasks, and files. Perfect for discovery and public sharing."
              }
            </Typography>
            
          </Stack>
        </motion.div>

        {!createdUrl ? (
          <Stack spacing={3}>
            {/* Unified Dropdown Controls */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
              <Button
                onClick={() => setKindDrawerOpen(true)}
                endIcon={<ChevronDown size={16} />}
                startIcon={React.createElement(KINDS.find(k => k.id === kind)?.Icon || FileText, { size: 18, color: KIND_COLORS[kind] })}
                sx={{
                  bgcolor: alpha('#fff', 0.02),
                  border: RIM,
                  borderColor: alpha(KIND_COLORS[kind], 0.25),
                  borderRadius: '12px',
                  px: 2.5,
                  py: 1.5,
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 800,
                  fontFamily: 'var(--font-clash)',
                  '&:hover': { bgcolor: SURFACE_HOVER, borderColor: alpha(KIND_COLORS[kind], 0.55) },
                }}
              >
                {KINDS.find(k => k.id === kind)?.label || 'Note'}
              </Button>

              {(!isMandatorySecure) && (
                <Button
                  onClick={() => setSecurityDrawerOpen(true)}
                  endIcon={<ChevronDown size={16} />}
                  startIcon={effectiveSecureMode ? <Lock size={16} color={KIND_COLORS[kind]} /> : <Unlock size={16} color="#10B981" />}
                  sx={{
                    bgcolor: alpha('#fff', 0.02),
                    border: RIM,
                    borderColor: alpha(KIND_COLORS[kind], 0.25),
                    borderRadius: '12px',
                    px: 2.5,
                    py: 1.5,
                    color: '#ffffff',
                    textTransform: 'none',
                    fontWeight: 800,
                    fontFamily: 'var(--font-clash)',
                    '&:hover': { bgcolor: SURFACE_HOVER, borderColor: alpha(KIND_COLORS[kind], 0.55) },
                  }}
                >
                  {effectiveSecureMode ? 'Zero-Knowledge Sharing' : 'Instant Preview Sharing'}
                </Button>
              )}
            </Box>

            {kind === 'note' && (
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  p: 0,
                  overflow: 'hidden',
                  '&:focus-within': {
                      borderColor: alpha('#EC4899', 0.45),
                      boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 15px ${alpha('#EC4899', 0.15)}`
                  }
                }}
              >
                {/* Editor Header */}
                <Box sx={{ 
                    px: 3, 
                    py: 2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #34322F',
                    bgcolor: alpha('#fff', 0.01)
                }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1, 
                        px: 1.5, 
                        py: 0.5, 
                        borderRadius: '8px', 
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                      <Typography
                          variant="caption"
                          sx={{
                              color: noteBody.length >= 65000 ? '#FF453A' : 'rgba(255, 255, 255, 0.4)',
                              fontWeight: 700,
                              fontFamily: 'var(--font-jetbrains-mono)',
                              letterSpacing: '0.05em'
                          }}
                      >
                          {noteBody.length.toLocaleString()} / 65,000
                      </Typography>
                    </Box>
                    {effectiveSecureMode && (
                      <Tooltip title="This content is zero-knowledge encrypted before upload.">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#EC4899' }}>
                              <Lock size={12} />
                              <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '0.65rem', textTransform: 'uppercase' }}>SECURE</Typography>
                          </Box>
                      </Tooltip>
                    )}
                  </Stack>

                  {renderHeaderActions("Type a note to share")}
                </Box>

                {/* Main Inputs */}
                <Box sx={{ p: { xs: 3, sm: 5 }, pt: { xs: 2.5, sm: 3 } }}>
                  {(noteBody.trim().length > 0 || noteTitle.trim().length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.2 }}
                    >
                      <TextField
                        fullWidth
                        placeholder="Note Title"
                        value={noteTitle}
                        onChange={(e) => {
                          setNoteTitle(e.target.value);
                          setIsTitleManuallyEdited(true);
                        }}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { 
                            fontSize: '2.25rem', 
                            fontWeight: 900, 
                            fontFamily: 'var(--font-clash)',
                            color: 'white', 
                            mb: 1.5,
                            '&::placeholder': { opacity: 0.2, color: '#ffffff' }
                          }
                        }}
                      />
                    </motion.div>
                  )}
                  <TextField
                    fullWidth
                    required
                    multiline
                    minRows={10}
                    maxRows={20}
                    placeholder="Start typing your brilliant thoughts…"
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    variant="standard"
                    InputProps={{
                      disableUnderline: true,
                      sx: { 
                        fontSize: '1.1rem', 
                        lineHeight: 1.7,
                        color: 'rgba(255, 255, 255, 0.75)',
                        fontFamily: 'var(--font-satoshi)',
                        '&::placeholder': { opacity: 0.2, color: '#ffffff' }
                      }
                    }}
                  />
                </Box>
              </Paper>
            )}

            {kind === 'discussion' && (
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  p: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  '&:focus-within': {
                      borderColor: alpha('#F59E0B', 0.45),
                      boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 15px ${alpha('#F59E0B', 0.15)}`
                  }
                }}
              >
                {/* Mural Pattern Background */}
                <MuralPattern />
                
                {/* Secure Chat Header */}
                <Box sx={{ 
                    px: 3, 
                    py: 2, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #34322F',
                    bgcolor: alpha('#0A0908', 0.85),
                    backdropFilter: 'blur(8px)',
                    zIndex: 1,
                    position: 'relative',
                }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        bgcolor: '#10B981', 
                        boxShadow: '0 0 8px #10B981',
                    }} />
                    <Typography
                        variant="caption"
                        sx={{
                            color: '#ffffff',
                            fontWeight: 900,
                            fontFamily: 'var(--font-clash)',
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                        }}
                    >
                        EPHEMERAL HUDDLE ROOM
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#F59E0B' }}>
                      <Lock size={12} />
                      <Typography variant="caption" sx={{ fontWeight: 900, fontSize: '0.65rem', textTransform: 'uppercase' }}>E2EE</Typography>
                    </Box>
                  </Stack>

                  {renderHeaderActions("Type a message to share")}
                </Box>

                {/* Simulated Chat Feed */}
                <Box 
                  sx={{ 
                    p: 3, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 2, 
                    minHeight: 220, 
                    justifyContent: 'flex-end', 
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {/* System Note */}
                  <Box sx={{ alignSelf: 'center', bgcolor: 'rgba(0,0,0,0.6)', border: RIM, borderRadius: '12px', px: 2, py: 1, maxWidth: '85%', textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-satoshi)', display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
                      <Lock size={12} color="#F59E0B" />
                      Messages are encrypted. Huddle automatically purges in 7 days.
                    </Typography>
                  </Box>

                  {/* Outgoing Bubble Preview */}
                  {noteBody.trim().length > 0 && (
                    <Box sx={{ alignSelf: 'flex-end', maxWidth: '80%', display: 'flex', gap: 1.5, alignItems: 'flex-end' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                        <Box sx={{ 
                          bgcolor: '#F59E0B', 
                          color: '#0A0908', 
                          px: 2.5, 
                          py: 1.75, 
                          borderRadius: '20px 20px 4px 20px',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
                        }}>
                          <Typography sx={{ fontSize: '0.95rem', fontFamily: 'var(--font-satoshi)', whiteSpace: 'pre-wrap', lineHeight: 1.5, fontWeight: 700 }}>
                            {noteBody}
                          </Typography>
                        </Box>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.7rem' }}>
                          <Lock size={10} color="#F59E0B" /> Zero-Knowledge Secured
                        </Typography>
                      </Box>
                      <Box sx={{ 
                        width: 32, 
                        height: 32, 
                        borderRadius: '50%', 
                        bgcolor: '#34322F', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 900,
                        border: RIM,
                        color: '#ffffff'
                      }}>
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* Chat Composer Well */}
                <Box sx={{ 
                  p: 3, 
                  borderTop: '1px solid #34322F', 
                  bgcolor: alpha('#0A0908', 0.95), 
                  backdropFilter: 'blur(8px)',
                  position: 'relative',
                  zIndex: 1,
                }}>
                  {/* Conditional Topic Field */}
                  {(noteBody.trim().length > 0 || noteTitle.trim().length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.2 }}
                    >
                      <TextField
                        fullWidth
                        placeholder="Discussion Topic / Room Name"
                        value={noteTitle}
                        onChange={(e) => {
                          setNoteTitle(e.target.value);
                          setIsTitleManuallyEdited(true);
                        }}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { 
                            fontSize: '1.25rem', 
                            fontWeight: 800, 
                            fontFamily: 'var(--font-clash)',
                            color: 'white', 
                            mb: 2,
                            px: 1,
                            '&::placeholder': { opacity: 0.3, color: '#ffffff' }
                          }
                        }}
                      />
                    </motion.div>
                  )}

                  <Box sx={{ 
                    bgcolor: '#000000', 
                    borderRadius: '16px', 
                    border: '1px solid #34322F',
                    '&:focus-within': { borderColor: '#F59E0B' },
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                  }}>
                    <TextField
                      fullWidth
                      required
                      multiline
                      minRows={3}
                      maxRows={10}
                      placeholder="Open the huddle with a clear message…"
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      variant="standard"
                      InputProps={{
                        disableUnderline: true,
                        sx: { 
                          fontSize: '1rem', 
                          lineHeight: 1.6,
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontFamily: 'var(--font-satoshi)',
                          px: 1,
                          '&::placeholder': { opacity: 0.3, color: '#ffffff' }
                        }
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                      <Stack direction="row" spacing={1}>
                        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ffffff' } }}>
                          <Paperclip size={16} />
                        </IconButton>
                        <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#ffffff' } }}>
                          <Mic size={16} />
                        </IconButton>
                      </Stack>
                      <Button
                        size="small"
                        disabled={!draftValid || isCreating}
                        onClick={() => void handleCreateLink()}
                        endIcon={isCreating ? <CircularProgress size={14} color="inherit" /> : <SendIcon size={14} />}
                        sx={{
                          bgcolor: draftValid ? '#F59E0B' : 'transparent',
                          color: draftValid ? '#0A0908' : 'rgba(255,255,255,0.2)',
                          textTransform: 'none',
                          fontWeight: 800,
                          borderRadius: '8px',
                          px: 2,
                          py: 0.75,
                          '&:hover': {
                            bgcolor: draftValid ? '#D97706' : 'transparent',
                          }
                        }}
                      >
                        Share Huddle
                      </Button>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            )}

            {kind === 'password' && (
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  '&:focus-within': {
                      borderColor: alpha('#10B981', 0.45),
                      boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 15px ${alpha('#10B981', 0.15)}`
                  }
                }}
              >
                {/* Vault Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: '8px', 
                      bgcolor: alpha('#10B981', 0.1),
                      border: `1px solid ${alpha('#10B981', 0.3)}`,
                      color: '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <KeyRound size={16} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-clash)', color: '#ffffff' }}>
                        Hardware Credential Vault
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)' }}>
                        Sealed with local AES-256 E2EE
                      </Typography>
                    </Box>
                  </Stack>
                  
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {/* Glowing state indicator */}
                    <Tooltip title="High Entropy Cryptographic Seal Active">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: alpha('#10B981', 0.08), border: `1px solid ${alpha('#10B981', 0.2)}`, px: 1, py: 0.5, borderRadius: '6px' }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10B981', boxShadow: '0 0 6px #10B981' }} />
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: '#10B981', letterSpacing: '0.05em' }}>SEALED</Typography>
                      </Box>
                    </Tooltip>
                    
                    {renderHeaderActions("Enter a password to share")}
                  </Stack>
                </Box>

                {/* Interactive Card/Token Geometry Mock */}
                <Box sx={{ 
                  p: 3, 
                  borderRadius: '16px', 
                  bgcolor: '#000000', 
                  border: RIM, 
                  mb: 3,
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08) 0%, transparent 60%)',
                }}>
                  {/* Interactive SIM/Chip Geometry */}
                  <Box sx={{ 
                    width: 40, 
                    height: 32, 
                    borderRadius: '6px', 
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', 
                    border: '1px solid #B45309',
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    opacity: 0.8,
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      inset: 4,
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '2px',
                    }
                  }} />

                  <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, maxWidth: '80%' }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                        Vault Identity
                      </Typography>
                      <TextField
                        placeholder="Username, Email, or Client ID"
                        fullWidth
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { 
                            fontSize: '1rem', 
                            fontFamily: 'var(--font-jetbrains-mono)',
                            color: '#ffffff',
                            py: 0.5,
                            borderBottom: '1px dashed #34322F',
                            '&::placeholder': { opacity: 0.2 }
                          }
                        }}
                      />
                    </Box>

                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                        Credential Key
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px dashed #34322F' }}>
                        <TextField
                          placeholder="Secret Password or Key Phrase"
                          fullWidth
                          required
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          variant="standard"
                          InputProps={{
                            disableUnderline: true,
                            sx: { 
                              fontSize: '1rem', 
                              fontFamily: 'var(--font-jetbrains-mono)',
                              color: '#ffffff',
                              py: 0.5,
                              '&::placeholder': { opacity: 0.2 }
                            }
                          }}
                        />
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)} sx={{ color: 'rgba(255,255,255,0.4)', p: 0.5 }}>
                          {showPassword ? <Unlock size={16} /> : <Lock size={16} />}
                        </IconButton>
                      </Box>
                    </Box>

                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                        Bundled TOTP Secret (Optional)
                      </Typography>
                      <TextField
                        placeholder="JBSWY3DPEHPK3PXP"
                        fullWidth
                        value={passwordTotpBundle}
                        onChange={(e) => setPasswordTotpBundle(e.target.value)}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { 
                            fontSize: '1rem', 
                            fontFamily: 'var(--font-jetbrains-mono)',
                            color: '#ffffff',
                            py: 0.5,
                            borderBottom: '1px dashed #34322F',
                            '&::placeholder': { opacity: 0.2 }
                          }
                        }}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Paper>
            )}

            {kind === 'totp' && (
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  '&:focus-within': {
                      borderColor: alpha('#10B981', 0.45),
                      boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 15px ${alpha('#10B981', 0.15)}`
                  }
                }}
              >
                {/* Authenticator Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: '8px', 
                      bgcolor: alpha('#10B981', 0.1),
                      border: `1px solid ${alpha('#10B981', 0.3)}`,
                      color: '#10B981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Shield size={16} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-clash)', color: '#ffffff' }}>
                        Authenticator Generator
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)' }}>
                        Secure 2FA token seeds
                      </Typography>
                    </Box>
                  </Stack>
                  
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    {/* Glowing LED countdown simulation indicator */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', px: 1, py: 0.5, borderRadius: '6px' }}>
                      <Box sx={{ 
                        width: 6, 
                        height: 6, 
                        borderRadius: '50%', 
                        bgcolor: '#10B981', 
                        boxShadow: '0 0 6px #10B981',
                      }} />
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: '#10B981', letterSpacing: '0.05em' }}>ACTIVE</Typography>
                    </Box>

                    {renderHeaderActions("Enter a secret key to share")}
                  </Stack>
                </Box>

                {/* Digital LCD screen representation */}
                <Box sx={{ 
                  p: 3, 
                  borderRadius: '16px', 
                  bgcolor: '#000000', 
                  border: RIM, 
                  mb: 3,
                  position: 'relative',
                  overflow: 'hidden',
                  background: 'radial-gradient(circle at top left, rgba(16, 185, 129, 0.05) 0%, transparent 60%)',
                }}>
                  {/* Mock Token Monospace Screen display */}
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    border: '1px solid #1C1A18',
                    bgcolor: '#0A0908',
                    borderRadius: '12px',
                    p: 2.5,
                    mb: 3.5
                  }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {totpIssuer.trim() ? totpIssuer.trim() : 'DEFAULT TOKEN'}
                      </Typography>
                      <Typography sx={{ fontSize: '2rem', fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 900, color: '#10B981', letterSpacing: '0.05em', mt: 0.5 }}>
                        {totpSecret.trim() ? '••• •••' : '000 000'}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 800 }}>TIME REMAINING</Typography>
                      <Typography sx={{ fontSize: '1.25rem', fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 900, color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                        30s
                      </Typography>
                    </Box>
                  </Box>

                  <Stack spacing={2}>
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                        Token Issuer (e.g. Google, AWS, GitHub)
                      </Typography>
                      <TextField
                        placeholder="Google, AWS, GitHub"
                        fullWidth
                        value={totpIssuer}
                        onChange={(e) => setTotpIssuer(e.target.value)}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { 
                            fontSize: '1rem', 
                            fontFamily: 'var(--font-satoshi)',
                            color: '#ffffff',
                            py: 0.5,
                            borderBottom: '1px dashed #34322F',
                            '&::placeholder': { opacity: 0.2 }
                          }
                        }}
                      />
                    </Box>

                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                        Secret Authenticator Key
                      </Typography>
                      <TextField
                        placeholder="JBSWY3DPEHPK3PXP"
                        fullWidth
                        required
                        value={totpSecret}
                        onChange={(e) => setTotpSecret(e.target.value)}
                        variant="standard"
                        InputProps={{
                          disableUnderline: true,
                          sx: { 
                            fontSize: '1rem', 
                            fontFamily: 'var(--font-jetbrains-mono)',
                            color: '#ffffff',
                            py: 0.5,
                            borderBottom: '1px dashed #34322F',
                            '&::placeholder': { opacity: 0.2 }
                          }
                        }}
                      />
                    </Box>
                  </Stack>
                </Box>
              </Paper>
            )}

            {kind === 'task' && (
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  '&:focus-within': {
                      borderColor: alpha('#A855F7', 0.45),
                      boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 15px ${alpha('#A855F7', 0.15)}`
                  }
                }}
              >
                {/* Task Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: '8px', 
                      bgcolor: alpha('#A855F7', 0.1),
                      border: '1px solid rgba(168, 85, 247, 0.3)',
                      color: '#A855F7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <ListTodo size={16} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-clash)', color: '#ffffff' }}>
                        Execution Goal Planner
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)' }}>
                        Action items & milestones
                      </Typography>
                    </Box>
                  </Stack>
                  
                  {renderHeaderActions("Enter a goal title to share")}
                </Box>

                {/* Goals Metadata Schema board */}
                <Box sx={{ 
                  p: 3, 
                  borderRadius: '16px', 
                  bgcolor: '#000000', 
                  border: RIM, 
                  mb: 3,
                  background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.03) 0%, transparent 80%)',
                }}>
                  <Stack spacing={3.5}>
                    {/* Goal Title & Detail */}
                    <Stack spacing={2}>
                      <Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                          Goal / Objective
                        </Typography>
                        <TextField
                          placeholder="What needs to be achieved?"
                          fullWidth
                          required
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          variant="standard"
                          InputProps={{
                            disableUnderline: true,
                            sx: { 
                              fontSize: '1.25rem', 
                              fontWeight: 800,
                              fontFamily: 'var(--font-clash)',
                              color: '#ffffff',
                              py: 0.5,
                              borderBottom: '1px dashed #34322F',
                              '&::placeholder': { opacity: 0.2 }
                            }
                          }}
                        />
                      </Box>

                      <Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 0.5 }}>
                          Execution Details / Sub-steps
                        </Typography>
                        <TextField
                          placeholder="Add context, specifications, or step-by-step checklist..."
                          fullWidth
                          multiline
                          minRows={3}
                          value={taskDetail}
                          onChange={(e) => setTaskDetail(e.target.value)}
                          variant="standard"
                          InputProps={{
                            disableUnderline: true,
                            sx: { 
                              fontSize: '0.95rem', 
                              fontFamily: 'var(--font-satoshi)',
                              color: 'rgba(255,255,255,0.8)',
                              py: 0.5,
                              lineHeight: 1.5,
                              '&::placeholder': { opacity: 0.2 }
                            }
                          }}
                        />
                      </Box>
                    </Stack>

                    {/* Goal Priority Selector */}
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.5 }}>
                        Goal Priority
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {(['low', 'medium', 'high', 'urgent'] as const).map((p) => {
                          const isSelected = taskPriority === p;
                          const color = p === 'low' ? '#A1A1AA' : p === 'medium' ? '#A855F7' : p === 'high' ? '#F59E0B' : '#EF4444';
                          return (
                            <Button
                              key={p}
                              size="small"
                              onClick={() => setTaskPriority(p)}
                              sx={{
                                textTransform: 'uppercase',
                                fontSize: '0.7rem',
                                fontWeight: 900,
                                px: 2,
                                py: 0.75,
                                borderRadius: '8px',
                                border: isSelected ? `1px solid ${color}` : '1px solid #34322F',
                                bgcolor: isSelected ? alpha(color, 0.15) : 'transparent',
                                color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)',
                                '&:hover': {
                                  bgcolor: isSelected ? alpha(color, 0.25) : 'rgba(255,255,255,0.02)',
                                  borderColor: isSelected ? color : '#4A4845',
                                },
                                transition: 'all 0.25s ease',
                              }}
                            >
                              {p}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Goal Deadline Selector */}
                    <Box>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.5 }}>
                        Goal Target Deadline
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {(['none', 'today', 'tomorrow', 'week'] as const).map((preset) => {
                          const isSelected = taskDuePreset === preset;
                          const label = preset === 'none' ? 'No Due Date' : preset === 'today' ? 'Today' : preset === 'tomorrow' ? 'Tomorrow' : '1 Week';
                          return (
                            <Button
                              key={preset}
                              size="small"
                              onClick={() => setTaskDuePreset(preset)}
                              sx={{
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                px: 2,
                                py: 0.75,
                                borderRadius: '8px',
                                border: isSelected ? `1px solid #A855F7` : '1px solid #34322F',
                                bgcolor: isSelected ? alpha('#A855F7', 0.15) : 'transparent',
                                color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)',
                                '&:hover': {
                                  bgcolor: isSelected ? alpha('#A855F7', 0.25) : 'rgba(255,255,255,0.02)',
                                  borderColor: isSelected ? '#A855F7' : '#4A4845',
                                },
                                transition: 'all 0.25s ease',
                              }}
                            >
                              {label}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  </Stack>
                </Box>
              </Paper>
            )}

            {kind === 'file' && (
              <Paper
                elevation={0}
                sx={{
                  ...cardStyle,
                  '&:focus-within': {
                      borderColor: alpha('#6366F1', 0.45),
                      boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 15px ${alpha('#6366F1', 0.15)}`
                  }
                }}
              >
                {/* File Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: '8px', 
                      bgcolor: alpha('#6366F1', 0.1),
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      color: '#6366F1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Upload size={16} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-clash)', color: '#ffffff' }}>
                        Secure File Drop
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)' }}>
                        Vanishing secure file storage
                      </Typography>
                    </Box>
                  </Stack>
                  
                  {renderHeaderActions("Choose a file to share")}
                </Box>

                <Box
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  sx={{
                    border: `2px dashed ${dragActive ? alpha(PRIMARY, 0.45) : '#34322F'}`,
                    borderRadius: 3,
                    p: 4,
                    textAlign: 'center',
                    bgcolor: dragActive ? alpha(PRIMARY, 0.04) : 'rgba(255,255,255,0.01)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <input
                    type="file"
                    id="send-file-input"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="send-file-input" style={{ cursor: 'pointer' }}>
                    <Stack spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          bgcolor: '#161412',
                          border: '1px solid #34322F',
                          color: '#6366F1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Upload size={24} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-satoshi)' }}>
                          {fileName || 'Click or drag file to share'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9B9691', fontFamily: 'var(--font-satoshi)', display: 'block', mt: 0.5 }}>
                          Max {activeMaxLabel} · Securely encrypted
                        </Typography>
                      </Box>
                      {fileName && (
                        <Button
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();
                            setSendFile(null);
                            setFileName(null);
                          }}
                          sx={{ color: '#FF453A', textTransform: 'none', fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}
                        >
                          Remove
                        </Button>
                      )}
                    </Stack>
                  </label>
                </Box>
              </Paper>
            )}



            <Button
              variant="contained"
              size="large"
              disabled={!draftValid || isCreating}
              onClick={() => void handleCreateLink()}
              sx={{
                py: 2,
                borderRadius: '16px',
                textTransform: 'none',
                fontWeight: 900,
                fontSize: '1.05rem',
                bgcolor: themeColor,
                fontFamily: 'var(--font-clash)',
                boxShadow: `0 12px 40px ${alpha(themeColor, 0.35)}`,
                '&:hover': { bgcolor: themeColor, filter: 'brightness(1.15)' },
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                '&.Mui-disabled': {
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  color: 'rgba(255, 255, 255, 0.15)',
                }
              }}
            >
              {isCreating ? <CircularProgress size={26} color="inherit" /> : `Create ${effectiveSecureMode ? 'Zero-Knowledge' : 'Send'} Link`}
            </Button>

            <Typography sx={{ textAlign: 'center', fontSize: '0.8rem', color: '#9B9691', px: 2, lineHeight: 1.6, fontFamily: 'var(--font-satoshi)' }}>
              {effectiveSecureMode ? 'Encrypted' : 'Unencrypted'} ghost rows in the note database — same 7-day auto-clearing relay.
              {effectiveSecureMode && ' The key stays in the link fragment only.'}
            </Typography>
          </Stack>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, sm: 6 },
              borderRadius: '40px',
              bgcolor: SURFACE,
              border: RIM,
              textAlign: 'center',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            }}
          >
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                bgcolor: alpha(themeColor, 0.1),
                color: themeColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <Check size={36} strokeWidth={3} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1.5, fontFamily: 'var(--font-clash)', color: '#ffffff' }}>
              Relay Link Generated
            </Typography>
            <Typography sx={{ color: '#9B9691', mb: 4, maxWidth: 360, mx: 'auto', fontFamily: 'var(--font-satoshi)' }}>
              Anyone with this link can {effectiveSecureMode ? 'decrypt' : 'view'} the payload. It will vanish automatically in {formatRemaining(expiryMs)}.
            </Typography>

            <Box
              sx={{
                p: 2.5,
                borderRadius: '16px',
                bgcolor: '#000000',
                border: RIM,
                mb: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <Typography
                noWrap
                sx={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  color: alpha('#fff', 0.7),
                  textAlign: 'left',
                }}
              >
                {createdUrl}
              </Typography>
              <IconButton onClick={handleCopy} size="small" sx={{ color: themeColor }}>
                <Copy size={20} />
              </IconButton>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
              <Button
                variant="contained"
                onClick={handleCopy}
                startIcon={copied ? <Check size={20} /> : <Copy size={20} />}
                sx={{
                  px: 5,
                  py: 1.75,
                  borderRadius: '14px',
                  textTransform: 'none',
                  fontWeight: 900,
                  fontSize: '1rem',
                  bgcolor: themeColor,
                  fontFamily: 'var(--font-clash)',
                  '&:hover': { bgcolor: themeColor, filter: 'brightness(1.15)' },
                }}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{
                  px: 4,
                  py: 1.75,
                  borderRadius: '14px',
                  textTransform: 'none',
                  fontWeight: 900,
                  fontSize: '1rem',
                  borderColor: '#34322F',
                  color: '#ffffff',
                  fontFamily: 'var(--font-clash)',
                  '&:hover': { borderColor: '#4A4845', bgcolor: 'rgba(255,255,255,0.02)' },
                }}
              >
                Create Another
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Stash (sends on this device) rendered as the last element above signature */}
        {sendSparks.length > 0 && (
          <Box sx={{ mt: 6 }}>
            <Paper
              elevation={0}
              sx={cardStyle}
            >
              <SendSparkShelf sparks={sendSparks} onSaveSparks={saveSendSparks} onClaim={handleClaimSendSpark} />
            </Paper>
          </Box>
        )}

        <Box sx={{ mt: 10, borderTop: RIM, pt: 5, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em', fontWeight: 900, textTransform: 'uppercase', fontFamily: 'var(--font-clash)' }}>
            Universal Polymorphic Ghost Relay · Powered by Kylrix Organization
          </Typography>
        </Box>
      </Container>

      {/* Conditional Overlays strictly unmounted when closed */}
      {kindDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={kindDrawerOpen}
          onClose={() => setKindDrawerOpen(false)}
          keepMounted={false}
          disablePortal={true}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              borderTop: '1px solid #34322F',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              p: 3,
              color: '#ffffff',
              fontFamily: 'var(--font-satoshi)',
              maxWidth: 'md',
              mx: 'auto',
              maxHeight: '60vh',
              overflowY: 'auto',
            }
          }}
        >
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, mb: 2 }}>
            Select Sharing Format
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              gap: 1.5,
            }}
          >
            {KINDS.map(({ id, label, blurb, Icon }) => {
              const selected = kind === id;
              const itemColor = KIND_COLORS[id];
              return (
                <ListItemButton
                  key={id}
                  onClick={() => {
                    setKind(id);
                    setKindDrawerOpen(false);
                    if (id !== 'file') {
                      setSendFile(null);
                      setFileName(null);
                    }
                  }}
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    border: selected ? `1px solid ${itemColor}` : '1px solid #34322F',
                    bgcolor: selected ? alpha(itemColor, 0.08) : 'transparent',
                    '&:hover': { bgcolor: alpha(itemColor, 0.12) },
                    display: 'flex',
                    gap: 2,
                    alignItems: 'center',
                    textAlign: 'left',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 0, color: itemColor }}>
                    <Icon size={24} style={{ color: itemColor }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography sx={{ fontWeight: 800, fontFamily: 'var(--font-satoshi)', color: selected ? '#ffffff' : 'rgba(255,255,255,0.8)' }}>{label}</Typography>}
                    secondary={<Typography sx={{ fontSize: '0.75rem', color: selected ? alpha(itemColor, 0.7) : 'rgba(255,255,255,0.4)' }}>{blurb}</Typography>}
                  />
                </ListItemButton>
              );
            })}
          </Box>
        </Drawer>
      )}

      {securityDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={securityDrawerOpen}
          onClose={() => setSecurityDrawerOpen(false)}
          keepMounted={false}
          disablePortal={true}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              borderTop: '1px solid #34322F',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              p: 3,
              color: '#ffffff',
              fontFamily: 'var(--font-satoshi)',
              maxWidth: 'md',
              mx: 'auto',
              maxHeight: '60vh',
              overflowY: 'auto',
            }
          }}
        >
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, mb: 2 }}>
            Sharing Security
          </Typography>
          <Stack spacing={1.5}>
            <ListItemButton
              onClick={() => {
                handleSelectSecureMode(true);
                setSecurityDrawerOpen(false);
              }}
              sx={{
                p: 2,
                borderRadius: '12px',
                border: isSecureMode ? `1px solid ${themeColor}` : '1px solid #34322F',
                bgcolor: isSecureMode ? alpha(themeColor, 0.08) : 'transparent',
                '&:hover': { bgcolor: alpha(themeColor, 0.12) },
              }}
            >
              <ListItemIcon sx={{ color: themeColor }}>
                <Lock size={20} />
              </ListItemIcon>
              <ListItemText
                primary={<Typography sx={{ fontWeight: 800, fontFamily: 'var(--font-satoshi)', color: isSecureMode ? '#ffffff' : 'rgba(255,255,255,0.8)' }}>Zero-Knowledge Sharing</Typography>}
                secondary={<Typography sx={{ fontSize: '0.75rem', color: isSecureMode ? alpha(themeColor, 0.7) : 'rgba(255,255,255,0.4)', mt: 0.5 }}>End-to-end encrypted before upload. We never see your data.</Typography>}
              />
            </ListItemButton>

            <ListItemButton
              onClick={() => {
                handleSelectSecureMode(false);
                setSecurityDrawerOpen(false);
              }}
              sx={{
                p: 2,
                borderRadius: '12px',
                border: !isSecureMode ? '1px solid #10B981' : '1px solid #34322F',
                bgcolor: !isSecureMode ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.12)' },
              }}
            >
              <ListItemIcon sx={{ color: '#10B981' }}>
                <Unlock size={20} />
              </ListItemIcon>
              <ListItemText
                primary={<Typography sx={{ fontWeight: 800, fontFamily: 'var(--font-satoshi)', color: !isSecureMode ? '#ffffff' : 'rgba(255,255,255,0.8)' }}>Instant Preview Sharing</Typography>}
                secondary={<Typography sx={{ fontSize: '0.75rem', color: !isSecureMode ? alpha('#10B981', 0.7) : 'rgba(255,255,255,0.4)', mt: 0.5 }}>Fast, unencrypted previews. Perfect for public sharing.</Typography>}
              />
            </ListItemButton>
          </Stack>
        </Drawer>
      )}

      {/* Expiry Drawer */}
      {expiryDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={expiryDrawerOpen}
          onClose={() => setExpiryDrawerOpen(false)}
          keepMounted={false}
          disablePortal={true}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              borderTop: '1px solid #34322F',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              p: 4,
              color: '#ffffff',
              fontFamily: 'var(--font-satoshi)',
              maxWidth: 'md',
              mx: 'auto',
              maxHeight: '60vh',
              overflowY: 'auto',
            }
          }}
        >
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, mb: 1 }}>
            Link Expiry
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: '#9B9691', mb: 3, fontFamily: 'var(--font-satoshi)' }}>
            Choose when your polymorphic secure link will automatically purge from the servers.
          </Typography>
          
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography sx={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
              Selected Duration
            </Typography>
            <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, color: themeColor, fontFamily: 'var(--font-mono)' }}>
              {formatRemaining(expiryMs)}
            </Typography>
          </Stack>
          <Slider
            value={expiryMs}
            min={SEND_EXPIRY_PRESETS[0].ms}
            max={SEND_MAX_TTL_MS}
            step={60000}
            onChange={(_, v) => setExpiryMs(v as number)}
            sx={{
              color: themeColor,
              mb: 3,
              '& .MuiSlider-rail': { bgcolor: '#34322F', opacity: 1 },
              '& .MuiSlider-thumb': {
                width: 16,
                height: 16,
                bgcolor: '#ffffff',
                boxShadow: `0 0 0 4px ${alpha(themeColor, 0.2)}`,
                '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 8px ${alpha(themeColor, 0.3)}` },
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {SEND_EXPIRY_PRESETS.map((p) => (
              <Button
                key={p.id}
                size="small"
                onClick={() => setExpiryMs(p.ms)}
                sx={{
                  flex: 1,
                  minWidth: '60px',
                  py: 1,
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  border: expiryMs === p.ms ? `1px solid ${themeColor}` : '1px solid #34322F',
                  bgcolor: expiryMs === p.ms ? alpha(themeColor, 0.08) : 'transparent',
                  color: expiryMs === p.ms ? '#ffffff' : 'rgba(255,255,255,0.4)',
                  fontWeight: expiryMs === p.ms ? 900 : 600,
                  fontFamily: 'var(--font-satoshi)',
                  '&:hover': {
                    bgcolor: expiryMs === p.ms ? alpha(themeColor, 0.12) : 'rgba(255,255,255,0.02)',
                    borderColor: expiryMs === p.ms ? themeColor : '#4A4845',
                  }
                }}
              >
                {p.label}
              </Button>
            ))}
          </Box>
        </Drawer>
      )}

      {/* Discrete Sharing Drawer */}
      {discreteDrawerOpen && (
        <Drawer
          anchor="bottom"
          open={discreteDrawerOpen}
          onClose={() => setDiscreteDrawerOpen(false)}
          keepMounted={false}
          disablePortal={true}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              borderTop: '1px solid #34322F',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              p: 4,
              color: '#ffffff',
              fontFamily: 'var(--font-satoshi)',
              maxWidth: 'md',
              mx: 'auto',
              maxHeight: '60vh',
              overflowY: 'auto',
            }
          }}
        >
          <Typography variant="h6" sx={{ fontFamily: 'var(--font-clash)', fontWeight: 800, mb: 1 }}>
            Discrete Sharing
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: '#9B9691', mb: 3, fontFamily: 'var(--font-satoshi)', lineHeight: 1.5 }}>
            Send directly to specific users in the ecosystem. They will be added as collaborators with read permissions.
          </Typography>
          
          <Box sx={{ minHeight: 200 }}>
            <UserSearch
              label=""
              placeholder="Search for users to share with..."
              selectedUsers={selectedUsers}
              onSelect={(u) => setSelectedUsers([...selectedUsers, u])}
              onRemove={(id) => setSelectedUsers(selectedUsers.filter(u => u.id !== id))}
            />
          </Box>
        </Drawer>
      )}

      <EphemeralClaimDrawer
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        target={claimTarget}
        onConsumed={handleSparkConsumed}
      />
    </Box>
  );
}
