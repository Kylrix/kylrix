'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  const activeMaxBytes = 10 * 1024 * 1024; // Strict 10MB limit for Send
  const activeMaxLabel = '10 MB';

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

  const draftValid = useMemo(() => {
    if (kind === 'note') return noteBody.trim().length > 0;
    if (kind === 'password') return password.trim().length > 0;
    if (kind === 'task') return taskTitle.trim().length > 0;
    if (kind === 'totp') return totpSecret.trim().length > 0;
    if (kind === 'file') return !!sendFile;
    if (kind === 'discussion') return noteTitle.trim().length > 0;
    return false;
  }, [kind, noteBody, password, taskTitle, totpSecret, sendFile, noteTitle]);

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
    selectedUsers,
    activeMaxBytes,
    activeMaxLabel]);

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

  const fieldSx = {
    '& .MuiOutlinedInput-root': { bgcolor: alpha('#fff', 0.03), borderRadius: 2 },
    '& .MuiInputLabel-root': { color: alpha('#fff', 0.55) },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.12) },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha('#fff', 0.2) },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: alpha(PRIMARY, 0.55) },
    '& .MuiInputBase-input': { color: '#fff' },
  } as const;

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
                  const activeColor = effectiveSecureMode ? PRIMARY : '#10B981';
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
                  <TextField
                    label="Username / Email"
                    fullWidth
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Password"
                    fullWidth
                    required
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label="TOTP Secret (optional)"
                    fullWidth
                    placeholder="JBSWY3DPEHPK3PXP"
                    value={passwordTotpBundle}
                    onChange={(e) => setPasswordTotpBundle(e.target.value)}
                    sx={fieldSx}
                  />
                </Stack>
              )}

              {kind === 'totp' && (
                <Stack spacing={2}>
                  <TextField
                    label="Issuer (e.g. Google, AWS)"
                    fullWidth
                    value={totpIssuer}
                    onChange={(e) => setTotpIssuer(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Secret Key"
                    fullWidth
                    required
                    placeholder="JBSWY3DPEHPK3PXP"
                    value={totpSecret}
                    onChange={(e) => setTotpSecret(e.target.value)}
                    sx={fieldSx}
                  />
                </Stack>
              )}

              {kind === 'task' && (
                <Stack spacing={2}>
                  <TextField
                    label="Task Title"
                    fullWidth
                    required
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Task Details"
                    fullWidth
                    multiline
                    minRows={3}
                    placeholder="Context or sub-steps…"
                    value={taskDetail}
                    onChange={(e) => setTaskDetail(e.target.value)}
                    sx={fieldSx}
                  />
                </Stack>
              )}

              {kind === 'file' && (
                <Box
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  sx={{
                    border: `2px dashed ${dragActive ? alpha(PRIMARY, 0.45) : alpha('#fff', 0.1)}`,
                    borderRadius: 3,
                    p: 4,
                    textAlign: 'center',
                    bgcolor: dragActive ? alpha(PRIMARY, 0.04) : alpha('#fff', 0.01),
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
                          bgcolor: alpha(PRIMARY, 0.1),
                          color: PRIMARY,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Upload size={24} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>
                          {fileName || 'Click or drag file to share'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                          Max {activeMaxLabel} · Always end-to-end encrypted
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
                          sx={{ color: '#FF453A', textTransform: 'none' }}
                        >
                          Remove
                        </Button>
                      )}
                    </Stack>
                  </label>
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
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <InputLabel sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Link Expiry
                </InputLabel>
                <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: PRIMARY }}>
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
                  color: PRIMARY,
                  '& .MuiSlider-rail': { bgcolor: alpha('#fff', 0.1) },
                  '& .MuiSlider-thumb': {
                    width: 14,
                    height: 14,
                    bgcolor: '#fff',
                    boxShadow: `0 0 0 4px ${alpha(PRIMARY, 0.2)}`,
                    '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 8px ${alpha(PRIMARY, 0.3)}` },
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                {SEND_EXPIRY_PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    size="small"
                    onClick={() => setExpiryMs(p.ms)}
                    sx={{
                      minWidth: 0,
                      fontSize: '0.7rem',
                      color: expiryMs === p.ms ? PRIMARY : 'rgba(255,255,255,0.4)',
                      fontWeight: expiryMs === p.ms ? 800 : 500,
                    }}
                  >
                    {p.label}
                  </Button>
                ))}
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
                bgcolor: effectiveSecureMode ? PRIMARY : '#10B981',
                boxShadow: `0 12px 40px ${alpha(effectiveSecureMode ? PRIMARY : '#10B981', 0.35)}`,
                '&:hover': { bgcolor: effectiveSecureMode ? '#5558E8' : '#059669' },
              }}
            >
              {isCreating ? <CircularProgress size={26} color="inherit" /> : `Create ${effectiveSecureMode ? 'secure' : 'send'} link`}
            </Button>

            <Typography sx={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', px: 2, lineHeight: 1.6 }}>
              {effectiveSecureMode ? 'Encrypted' : 'Unencrypted'} ghost rows in the note database — same 7-day auto-clearing relay.
              {effectiveSecureMode && ' The key stays in the link fragment only.'}
            </Typography>
          </Stack>
        ) : (
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 5 },
              borderRadius: 4,
              bgcolor: SURFACE,
              border: RIM,
              textAlign: 'center',
              boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
            }}
          >
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: alpha(effectiveSecureMode ? PRIMARY : '#10B981', 0.1),
                color: effectiveSecureMode ? PRIMARY : '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3,
              }}
            >
              <Check size={32} strokeWidth={3} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5, fontFamily: 'var(--font-clash)' }}>
              Link is ready to ship
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, maxWidth: 360, mx: 'auto' }}>
              Anyone with this link can {effectiveSecureMode ? 'decrypt' : 'view'} the payload. It will vanish automatically in {formatRemaining(expiryMs)}.
            </Typography>

            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha('#000', 0.25),
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
              <IconButton onClick={handleCopy} size="small" sx={{ color: effectiveSecureMode ? PRIMARY : '#10B981' }}>
                <Copy size={18} />
              </IconButton>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
              <Button
                variant="contained"
                onClick={handleCopy}
                startIcon={copied ? <Check size={18} /> : <Copy size={18} />}
                sx={{
                  px: 4,
                  py: 1.25,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: effectiveSecureMode ? PRIMARY : '#10B981',
                  '&:hover': { bgcolor: effectiveSecureMode ? '#5558E8' : '#059669' },
                }}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button
                variant="outlined"
                onClick={handleReset}
                sx={{
                  px: 3,
                  py: 1.25,
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderColor: alpha('#fff', 0.1),
                  color: alpha('#fff', 0.7),
                  '&:hover': { borderColor: alpha('#fff', 0.2), bgcolor: alpha('#fff', 0.02) },
                }}
              >
                Create Another
              </Button>
            </Stack>
          </Paper>
        )}

        <Box sx={{ mt: 8, borderTop: RIM, pt: 4, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>
            POLYMORPHIC GHOST RELAY · POWERED BY KYLRIX ORGANIZATION
          </Typography>
        </Box>
      </Container>

      <EphemeralClaimDrawer
        open={claimOpen}
        onClose={() => setClaimOpen(false)}
        target={claimTarget}
        onConsumed={handleSparkConsumed}
      />
    </Box>
  );
}
