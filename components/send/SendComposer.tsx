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
} from 'lucide-react';

import { ID, Permission, Role } from 'appwrite';

import { useAuth } from '@/context/auth/AuthContext';
import { EphemeralClaimDrawer, type EphemeralClaimTarget } from '@/components/ephemeral/EphemeralClaimDrawer';
import { SendSparkShelf } from '@/components/send/SendSparkShelf';
import UserSearch from '@/components/UserSearch';
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
const RIM = '1px solid rgba(255, 255, 255, 0.05)';
const PRIMARY = '#6366F1';

const KINDS: { id: SendKind; label: string; blurb: string; Icon: typeof FileText }[] = [
  { id: 'note', label: 'Note', blurb: 'Text and context', Icon: FileText },
  { id: 'password', label: 'Password', blurb: 'Credential snapshot', Icon: KeyRound },
  { id: 'task', label: 'Task', blurb: 'Action item', Icon: ListTodo },
  { id: 'totp', label: 'TOTP', blurb: 'Authenticator seed', Icon: Shield },
  { id: 'file', label: 'File', blurb: 'Up to 7 days in bucket', Icon: Upload },
  { id: 'discussion', label: 'Discussion', blurb: 'Ephemeral thread', Icon: MessageSquare }
];

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
  const activeMaxBytes = isPro ? SEND_MAX_FILE_BYTES_PRO : SEND_MAX_FILE_BYTES_FREE;
  const activeMaxLabel = isPro ? '100 MB' : '20 MB';

  const [kind, setKind] = useState<SendKind>('note');
  const [expiryMs, setExpiryMs] = useState(SEND_EXPIRY_PRESETS[2].ms);
  const [isSecureMode, setIsSecureMode] = useState(false);

  // Forced Secure Mode for Credentials
  const effectiveSecureMode = useMemo(() => {
    if (kind === 'password' || kind === 'totp') return true;
    return isSecureMode;
  }, [kind, isSecureMode]);
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
          return;
        }
        const parsed = JSON.parse(raw) as SendSparkRef[];
        if (!Array.isArray(parsed)) return;
        const cutoff = Date.now() - SEND_MAX_TTL_MS;
        const valid = parsed.filter((s) => new Date(s.createdAt).getTime() > cutoff);
        setSendSparks(valid);
        if (valid.length !== parsed.length) {
          localStorage.setItem(SEND_SPARK_STORAGE_KEY, JSON.stringify(valid));
        }
      } catch {
        setSendSparks([]);
      }
    };
    loadSparks();
    setSendSparksHydrated(true);
    window.addEventListener('storage', loadSparks);
    return () => window.removeEventListener('storage', loadSparks);
  }, []);

  useEffect(() => {
    if (searchParams.get('claimOpen') !== '1') return;
    if (!sendSparksHydrated) return;

    const id = peekEphemeralClaimResume('send');

    const stripClaimQuery = () => {
      router.replace('/send', { scroll: false });
    };

    if (!id) {
      stripClaimQuery();
      return;
    }

    const spark = sendSparks.find((s) => s.id === id);
    if (!spark) {
      clearEphemeralClaimResume();
      stripClaimQuery();
      return;
    }

    clearEphemeralClaimResume();
    setClaimTarget({
      noteId: spark.id,
      claimSecret: spark.deletionSecret,
      sendKind: spark.kind,
      stashKind: 'send',
      sendUrl: spark.url,
    });
    setClaimOpen(true);
    stripClaimQuery();
  }, [searchParams, sendSparks, router, sendSparksHydrated]);

  const handleConsumedSendSpark = useCallback((noteId: string) => {
    setSendSparks((prev) => {
      const next = prev.filter((s) => s.id !== noteId);
      try {
        localStorage.setItem(SEND_SPARK_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      window.dispatchEvent(new Event('storage'));
      return next;
    });
  }, []);

  const handleClaimSendSpark = useCallback((spark: SendSparkRef) => {
    setClaimTarget({
      noteId: spark.id,
      claimSecret: spark.deletionSecret,
      sendKind: spark.kind,
      stashKind: 'send',
      sendUrl: spark.url,
    });
    setClaimOpen(true);
  }, []);

  const expiryLabel = useMemo(() => formatRemaining(expiryMs), [expiryMs]);

  const draftValid = useMemo(() => {
    switch (kind) {
      case 'note':
        return noteBody.trim().length > 0;
      case 'password':
        return password.trim().length > 0;
      case 'task':
        return taskTitle.trim().length > 0;
      case 'totp':
        return totpSecret.trim().length > 0;
      case 'file':
        return Boolean(sendFile && sendFile.size > 0 && sendFile.size <= activeMaxBytes);
      default:
        return false;
    }
  }, [kind, noteBody, password, taskTitle, totpSecret, sendFile, activeMaxBytes]);

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
        if (isSecureMode) {
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
        const bundle: SendTaskPayload = {
          title: taskTitle.trim(),
          detail: taskDetail.trim() || undefined,
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
        
        if (isSecureMode) {
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
        } else {
          outTitle = sparkTitle;
          const formData = new FormData();
          formData.append('file', f);
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
          outContent = JSON.stringify(manifest);
        }
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
    isSecureMode,
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
    selectedUsers,
    activeMaxBytes,
    activeMaxLabel]);

  const handleCopy = useCallback(async () => {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [createdUrl]);

  const onFiles = useCallback((files: FileList | null) => {
    const f = files?.[0];
    if (!f) {
      setSendFile(null);
      setFileName(null);
      return;
    }
    if (f.size > activeMaxBytes) {
      toast.error(`Max file size is ${activeMaxLabel}.`);
      setSendFile(null);
      setFileName(null);
      return;
    }
    setSendFile(f);
    setFileName(f.name);
  }, [activeMaxBytes, activeMaxLabel]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        bgcolor: BG,
        color: 'rgba(255,255,255,0.92)',
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

      <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1, py: { xs: 4, md: 7 }, pb: 10 }}>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <Stack spacing={1} sx={{ mb: 4, textAlign: 'center' }}>
            <Chip
              icon={<Sparkles size={14} />}
              label="Send by Kylrix"
              sx={{
                alignSelf: 'center',
                px: 1,
                bgcolor: alpha(effectiveSecureMode ? PRIMARY : '#10B981', 0.12),
                color: alpha('#fff', 0.9),
                border: `1px solid ${alpha(effectiveSecureMode ? PRIMARY : '#10B981', 0.35)}`,
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
            
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Paper sx={{ 
                    px: 2, 
                    py: 1, 
                    borderRadius: 3, 
                    bgcolor: alpha('#fff', 0.03), 
                    border: RIM,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2
                }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        {effectiveSecureMode ? <Lock size={16} color={PRIMARY} /> : <Unlock size={16} color="#10B981" />}
                        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            {effectiveSecureMode ? 'Secure Mode Active' : 'Normal Mode'}
                        </Typography>
                    </Stack>
                    {(kind !== 'password' && kind !== 'totp') && (
                        <Switch 
                            checked={isSecureMode}
                            onChange={(e) => setIsSecureMode(e.target.checked)}
                            color="primary"
                            size="small"
                        />
                    )}
                </Paper>
            </Box>
          </Stack>
        </motion.div>

        {sendSparks.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              mb: 4,
              p: { xs: 2, sm: 2.5 },
              borderRadius: 3,
              bgcolor: SURFACE,
              border: RIM,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <SendSparkShelf sparks={sendSparks} onSaveSparks={saveSendSparks} onClaim={handleClaimSendSpark} />
          </Paper>
        )}

        {!createdUrl ? (
          <Stack spacing={3}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: 3,
                bgcolor: SURFACE,
                border: RIM,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem', color: 'rgba(255,255,255,0.88)' }}>
                What are you sending?
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
                  gap: 1.25,
                }}
              >
                {KINDS.map(({ id, label, blurb, Icon }) => {
                  const selected = kind === id;
                  const activeColor = isSecureMode ? PRIMARY : '#10B981';
                  return (
                    <Button
                      key={id}
                      onClick={() => {
                        setKind(id);
                        if (id !== 'file') {
                          setSendFile(null);
                          setFileName(null);
                        }
                      }}
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        textTransform: 'none',
                        p: 1.75,
                        borderRadius: 2,
                        gap: 1,
                        border: selected ? `1px solid ${alpha(activeColor, 0.55)}` : RIM,
                        bgcolor: selected ? alpha(activeColor, 0.12) : alpha('#fff', 0.02),
                        color: '#fff',
                        minHeight: 108,
                        '&:hover': {
                          bgcolor: selected ? alpha(activeColor, 0.18) : SURFACE_HOVER,
                          borderColor: alpha('#fff', 0.1),
                        },
                      }}
                    >
                      <Icon size={22} color={selected ? activeColor : 'rgba(255,255,255,0.65)'} />
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{label}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.35 }}>
                          {blurb}
                        </Typography>
                      </Box>
                    </Button>
                  );
                })}
              </Box>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                bgcolor: SURFACE,
                border: RIM,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2.5, fontSize: '0.95rem' }}>Payload</Typography>

              {(kind === 'note' || kind === 'discussion') && (
                <Stack spacing={2}>
                  <TextField
                    label={kind === 'note' ? "Title (optional)" : "Discussion Topic"}
                    fullWidth
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label={kind === 'note' ? "Note" : "Initial Message"}
                    fullWidth
                    required
                    multiline
                    minRows={6}
                    placeholder={kind === 'note' ? "Write what you want to share…" : "Start the conversation…"}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    sx={fieldSx}
                  />
                </Stack>
              )}

              {kind === 'password' && (
                <Stack spacing={2}>
                  <TextField label="Username / URL (optional)" fullWidth value={username} onChange={(e) => setUsername(e.target.value)} sx={fieldSx} />
                  <TextField
                    label="Password"
                    type="password"
                    required
                    fullWidth
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Authenticator secret (optional)"
                    fullWidth
                    placeholder="Base32 — shown as live code for the recipient"
                    value={passwordTotpBundle}
                    onChange={(e) => setPasswordTotpBundle(e.target.value)}
                    sx={fieldSx}
                  />
                </Stack>
              )}

              {kind === 'task' && (
                <Stack spacing={2}>
                  <TextField label="Task title" required fullWidth value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} sx={fieldSx} />
                  <TextField
                    label="Details (optional)"
                    fullWidth
                    multiline
                    minRows={3}
                    value={taskDetail}
                    onChange={(e) => setTaskDetail(e.target.value)}
                    sx={fieldSx}
                  />
                </Stack>
              )}

              {kind === 'totp' && (
                <Stack spacing={2}>
                  <TextField label="Issuer (optional)" fullWidth value={totpIssuer} onChange={(e) => setTotpIssuer(e.target.value)} sx={fieldSx} />
                  <TextField
                    label="Secret key"
                    required
                    fullWidth
                    placeholder="Base32 secret"
                    value={totpSecret}
                    onChange={(e) => setTotpSecret(e.target.value)}
                    sx={fieldSx}
                  />
                  <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                    Receiver adds this to their authenticator. Same expiry rules apply—treat it like a hot credential.
                  </Typography>
                </Stack>
              )}

              {kind === 'file' && (
                <Box>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.55)', mb: 1.25, fontSize: '0.8rem' }}>
                    Drop one file (encrypted client-side before upload · max {activeMaxLabel})
                  </InputLabel>
                  <Paper
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragActive(false);
                      onFiles(e.dataTransfer.files);
                    }}
                    sx={{
                      border: dragActive ? `1px dashed ${alpha(PRIMARY, 0.65)}` : `1px dashed ${alpha('#fff', 0.14)}`,
                      borderRadius: 2,
                      p: 4,
                      textAlign: 'center',
                      bgcolor: dragActive ? alpha(PRIMARY, 0.08) : alpha(SURFACE_HOVER, 0.35),
                      cursor: 'pointer',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    component="label"
                  >
                    <input type="file" hidden onChange={(e) => onFiles(e.target.files)} />
                    <Stack spacing={1} alignItems="center">
                      <Upload size={28} color={PRIMARY} />
                      <Typography sx={{ fontWeight: 600 }}>Drop or tap to choose</Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                        Appwrite bucket <Box component="span" sx={{ fontFamily: 'var(--font-mono)', color: alpha('#fff', 0.65) }}>{APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL}</Box> holds ciphertext only; decrypt with the link key.
                      </Typography>
                      {fileName && (
                        <Chip label={fileName} sx={{ mt: 1, bgcolor: alpha('#fff', 0.08), color: '#fff' }} />
                      )}
                    </Stack>
                  </Paper>
                </Box>
              )}
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                bgcolor: SURFACE,
                border: RIM,
              }}
            >
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
                  <Typography sx={{ fontWeight: 700 }}>Expires in · {expiryLabel}</Typography>
                  <Stack direction="row" gap={1} flexWrap="wrap">
                    {SEND_EXPIRY_PRESETS.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.label}
                        onClick={() => setExpiryMs(p.ms)}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: expiryMs === p.ms ? alpha(PRIMARY, 0.22) : alpha('#fff', 0.06),
                          color: '#fff',
                          border: expiryMs === p.ms ? `1px solid ${alpha(PRIMARY, 0.45)}` : RIM,
                          fontWeight: 600,
                        }}
                      />
                    ))}
                  </Stack>
                </Stack>
                <Slider
                  value={expiryMs}
                  min={5 * 60 * 1000}
                  max={SEND_MAX_TTL_MS}
                  step={5 * 60 * 1000}
                  onChange={(_, v) => setExpiryMs(Array.isArray(v) ? v[0] : v)}
                  sx={{
                    color: PRIMARY,
                    '& .MuiSlider-thumb': { border: `2px solid ${alpha('#fff', 0.85)}` },
                  }}
                />
              </Stack>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 3,
                bgcolor: SURFACE,
                border: RIM,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <Typography sx={{ fontWeight: 700, mb: 2, fontSize: '0.95rem' }}>
                Discrete Sharing (Optional)
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', mb: 2 }}>
                Send directly to specific users in the ecosystem. They will be added as collaborators.
              </Typography>
              <UserSearch
                label=""
                placeholder="Search for users to share with..."
                selectedUsers={selectedUsers}
                onSelect={(u) => setSelectedUsers([...selectedUsers, u])}
                onRemove={(id) => setSelectedUsers(selectedUsers.filter(u => u.id !== id))}
              />
            </Paper>

            <Button
              variant="contained"
              size="large"
              disabled={!draftValid || isCreating}
              onClick={() => void handleCreateLink()}
              sx={{
                py: 1.75,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1.05rem',
                bgcolor: isSecureMode ? PRIMARY : '#10B981',
                boxShadow: `0 12px 40px ${alpha(isSecureMode ? PRIMARY : '#10B981', 0.35)}`,
                '&:hover': { bgcolor: isSecureMode ? '#5558E8' : '#059669' },
              }}
            >
              {isCreating ? <CircularProgress size={26} color="inherit" /> : `Create ${isSecureMode ? 'secure' : 'send'} link`}
            </Button>

            <Typography sx={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', px: 2, lineHeight: 1.6 }}>
              {isSecureMode ? 'Encrypted' : 'Unencrypted'} ghost rows in the note database — same 7-day auto-clearing relay.
              {isSecureMode && ' The key stays in the link fragment only.'}
            </Typography>
          </Stack>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 3,
              bgcolor: SURFACE,
              border: RIM,
              textAlign: 'center',
              boxShadow: `0 24px 80px ${alpha('#000', 0.45)}`,
            }}
          >
            <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 700, fontSize: '1.5rem', mb: 1 }}>
              Link ready
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', mb: 3, lineHeight: 1.55 }}>
              Share once. Recipients open instantly with this URL — no account required. The key stays in the link fragment only on your device until you copy it.
            </Typography>

            <Paper
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#000', 0.35),
                border: RIM,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 3,
              }}
            >
              <Typography sx={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '0.82rem', wordBreak: 'break-all', textAlign: 'left' }}>
                {createdUrl}
              </Typography>
              <Tooltip title={copied ? 'Copied' : 'Copy'}>
                <IconButton onClick={handleCopy} sx={{ color: PRIMARY }}>
                  {copied ? <Check size={20} /> : <Copy size={20} />}
                </IconButton>
              </Tooltip>
            </Paper>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
              <Button variant="outlined" component={Link} href="/send" sx={{ textTransform: 'none', fontWeight: 700, borderColor: alpha('#fff', 0.2), color: '#fff' }}>
                Send another
              </Button>
              <Button
                variant="contained"
                component={Link}
                href={createdUrl || '#'}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: PRIMARY }}
              >
                Preview recipient page
              </Button>
            </Stack>
          </Paper>
        )}
      </Container>

      <EphemeralClaimDrawer
        open={claimOpen}
        onClose={() => {
          setClaimOpen(false);
          setClaimTarget(null);
        }}
        target={claimTarget}
        onConsumed={handleConsumedSendSpark}
      />
    </Box>
  );
}

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: alpha('#fff', 0.03),
    borderRadius: 2,
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.55)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.12) },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.2) },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: alpha(PRIMARY, 0.55) },
  '& .MuiInputBase-input': { color: '#fff' },
} as const;
