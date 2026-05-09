'use client';

import React, { useCallback, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  alpha,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  InputLabel,
  Paper,
  Slider,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  Copy,
  FileText,
  KeyRound,
  ListTodo,
  Shield,
  Sparkles,
  Upload,
} from 'lucide-react';

import Logo from '@/components/Logo';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useAuth } from '@/lib/auth';
import { SEND_EXPIRY_PRESETS, SEND_MAX_TTL_MS, SEND_NOTE_ROW_KEYS, clampExpiryMs } from '@/lib/send/constants';
import type { SendDraftPayload, SendKind } from '@/lib/send/types';

const SURFACE = '#161412';
const RIM = '1px solid rgba(255, 255, 255, 0.06)';
const PRIMARY = '#6366F1';

const KINDS: { id: SendKind; label: string; blurb: string; Icon: typeof FileText }[] = [
  { id: 'note', label: 'Note', blurb: 'Text and context', Icon: FileText },
  { id: 'password', label: 'Password', blurb: 'Credential snapshot', Icon: KeyRound },
  { id: 'task', label: 'Task', blurb: 'Action item', Icon: ListTodo },
  { id: 'totp', label: 'TOTP', blurb: 'Authenticator seed', Icon: Shield },
  { id: 'file', label: 'File', blurb: 'Up to 7 days in bucket', Icon: Upload },
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
  const { user } = useAuth();

  const [kind, setKind] = useState<SendKind>('note');
  const [expiryMs, setExpiryMs] = useState(SEND_EXPIRY_PRESETS[2].ms);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDetail, setTaskDetail] = useState('');
  const [totpIssuer, setTotpIssuer] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        return Boolean(fileName);
      default:
        return false;
    }
  }, [kind, noteBody, password, taskTitle, totpSecret, fileName]);

  const handleCreateLink = useCallback(() => {
    const expiresAtMs = Date.now() + clampExpiryMs(expiryMs);
    const payload: SendDraftPayload = {
      kind,
      expiresAtMs,
      title: noteTitle || undefined,
      body: noteBody || undefined,
      username: username || undefined,
      password: password || undefined,
      taskTitle: taskTitle || undefined,
      taskDetail: taskDetail || undefined,
      totpIssuer: totpIssuer || undefined,
      totpSecret: totpSecret || undefined,
      fileName: fileName || undefined,
    };

    try {
      sessionStorage.setItem(
        'kylrix_send_last_draft',
        JSON.stringify({ ...payload, savedAt: Date.now(), markers: SEND_NOTE_ROW_KEYS }),
      );
    } catch {
      // ignore quota / private mode
    }

    const token =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 22)
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setCreatedUrl(`${origin}/send/r/${token}`);
    setCopied(false);
  }, [
    kind,
    expiryMs,
    noteTitle,
    noteBody,
    username,
    password,
    taskTitle,
    taskDetail,
    totpIssuer,
    totpSecret,
    fileName,
  ]);

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
    setFileName(f ? f.name : null);
  }, []);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        position: 'relative',
        bgcolor: '#0A0908',
        color: 'rgba(255,255,255,0.92)',
        overflowX: 'hidden',
      }}
    >
      <Box
        sx={{
          pointerEvents: 'none',
          position: 'fixed',
          inset: 0,
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.28), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 0%, rgba(236, 72, 153, 0.12), transparent 50%), radial-gradient(ellipse 50% 35% at 0% 100%, rgba(16, 185, 129, 0.1), transparent 45%)',
          zIndex: 0,
        }}
      />

      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          borderBottom: RIM,
          background: alpha('#0A0908', 0.72),
          backdropFilter: 'blur(16px)',
        }}
      >
        <Container maxWidth="lg" sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component={NextLink}
            href="/"
            startIcon={<ArrowLeft size={18} />}
            sx={{
              color: 'rgba(255,255,255,0.65)',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.06) },
            }}
          >
            Home
          </Button>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Logo variant="icon" size={28} />
            <Typography sx={{ fontFamily: 'var(--font-clash)', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Send
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          {user?.$id ? (
            <Chip
              label="Signed in"
              size="small"
              sx={{
                bgcolor: alpha(PRIMARY, 0.15),
                color: alpha('#fff', 0.9),
                border: `1px solid ${alpha(PRIMARY, 0.35)}`,
                fontWeight: 600,
              }}
            />
          ) : (
            <Chip
              label="No account needed"
              size="small"
              sx={{
                bgcolor: alpha('#fff', 0.06),
                color: 'rgba(255,255,255,0.75)',
                border: RIM,
                fontWeight: 600,
              }}
            />
          )}
        </Container>
      </Box>

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
                bgcolor: alpha(PRIMARY, 0.12),
                color: alpha('#fff', 0.9),
                border: `1px solid ${alpha(PRIMARY, 0.35)}`,
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
              Live sharing that melts away
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.62)', maxWidth: 520, mx: 'auto', lineHeight: 1.6 }}>
              Ship encrypted send-objects with one link. Anyone can open—no signup wall. Everything expires automatically (max{' '}
              {formatRemaining(SEND_MAX_TTL_MS)}).
            </Typography>
          </Stack>
        </motion.div>

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
                  gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(5, 1fr)' },
                  gap: 1.25,
                }}
              >
                {KINDS.map(({ id, label, blurb, Icon }) => {
                  const selected = kind === id;
                  return (
                    <Button
                      key={id}
                      onClick={() => setKind(id)}
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        textAlign: 'left',
                        textTransform: 'none',
                        p: 1.75,
                        borderRadius: 2,
                        gap: 1,
                        border: selected ? `1px solid ${alpha(PRIMARY, 0.55)}` : RIM,
                        bgcolor: selected ? alpha(PRIMARY, 0.12) : alpha('#fff', 0.02),
                        color: '#fff',
                        minHeight: 108,
                        '&:hover': {
                          bgcolor: selected ? alpha(PRIMARY, 0.18) : alpha('#fff', 0.06),
                          borderColor: alpha('#fff', 0.12),
                        },
                      }}
                    >
                      <Icon size={22} color={selected ? PRIMARY : 'rgba(255,255,255,0.65)'} />
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

              {kind === 'note' && (
                <Stack spacing={2}>
                  <TextField
                    label="Title (optional)"
                    fullWidth
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Note"
                    fullWidth
                    required
                    multiline
                    minRows={6}
                    placeholder="Write what you want to share…"
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
                    Drop one file (UI preview · bucket wiring next)
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
                      bgcolor: dragActive ? alpha(PRIMARY, 0.08) : alpha('#fff', 0.02),
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
                        Stored in <Box component="span" sx={{ fontFamily: 'var(--font-mono)', color: alpha('#fff', 0.65) }}>{APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL}</Box>{' '}
                        with automatic deletion within seven days (planned).
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

            <Button
              variant="contained"
              size="large"
              disabled={!draftValid}
              onClick={handleCreateLink}
              sx={{
                py: 1.75,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '1.05rem',
                bgcolor: PRIMARY,
                boxShadow: `0 12px 40px ${alpha(PRIMARY, 0.35)}`,
                '&:hover': { bgcolor: '#5558E8' },
              }}
            >
              Create secure link
            </Button>

            <Typography sx={{ textAlign: 'center', fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', px: 2 }}>
              {`Persistence hooks (ghost rows + ${SEND_NOTE_ROW_KEYS.kind} + ${APPWRITE_CONFIG.BUCKETS.SEND_EPHEMERAL} bucket) ship next—this page is the production-ready interaction model.`}
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
              Share once. Recipients open instantly—no accounts. This URL is a client-side preview until the send pipeline is wired.
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
              <Button variant="outlined" component={NextLink} href="/send" sx={{ textTransform: 'none', fontWeight: 700, borderColor: alpha('#fff', 0.2), color: '#fff' }}>
                Send another
              </Button>
              <Button
                variant="contained"
                component={NextLink}
                href={createdUrl || '#'}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: PRIMARY }}
              >
                Preview recipient page
              </Button>
            </Stack>
          </Paper>
        )}
      </Container>
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
