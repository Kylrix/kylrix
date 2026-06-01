'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { formatNoteCreatedDate, formatNoteUpdatedDate } from '@/lib/date-utils';
import type { Notes } from '@/types/appwrite';
import { 
  AccessTime as ClockIcon, 
  Visibility as EyeIcon, 
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowRightIcon
} from '@mui/icons-material';
import { 
  Shield,
  KeyRound,
  ListTodo,
  FileText,
  Upload,
  MessageSquare,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Waves
} from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { NoteContentRenderer } from '@/components/NoteContentRenderer';
import { 
  realtime,
  APPWRITE_DATABASE_ID,
  isNoteEditableByAnyone
} from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useToast } from '@/components/ui/Toast';
import {
  Box,
  Chip,
  Typography,
  Button,
  Container,
  Paper,
  IconButton,
  CircularProgress,
  AppBar,
  Toolbar,
  Stack,
  Tooltip,
  alpha,
  Link as MuiLink,
  keyframes,
  LinearProgress,
  TextField,
  Avatar
} from '@mui/material';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import CommentsSection from '@/app/(app)/note/(app)/notes/Comments';
import NoteReactions from '@/app/(app)/note/(app)/notes/NoteReactions';
import MuralPattern from '@/components/chat/MuralPattern';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';

import Logo from '@/components/common/Logo';
import { getEcosystemUrl } from '@/constants/ecosystem';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { decryptGhostData, decryptGhostBinaryFromBytes } from '@/lib/encryption/ghost-crypto';
import { storage } from '@/lib/appwrite/client';
import { isSendObjectMeta, parseSendGhostMetadata } from '@/lib/send/metadata';
import { sharedNotePublicUrl } from '@/lib/send/shared-note-api';
import type { SendFilePayload, SendKind, SendPasswordPayload, SendTaskPayload, SendTotpPayload } from '@/lib/send/types';
import { authenticator } from 'otplib';
import { getEffectiveDisplayName } from '@/lib/utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const PRIMARY = '#6366F1';
const RIM = '1px solid #34322F';

const KIND_COLORS: Record<string, string> = {
  note: '#EC4899',       // Pink
  password: '#10B981',   // Green
  totp: '#10B981',       // Green
  task: '#A855F7',       // Purple
  discussion: '#F59E0B', // Amber
  file: '#6366F1',       // Indigo
};

const readOnlyFieldSx = {
  '& .MuiOutlinedInput-root': { bgcolor: '#000000', borderRadius: '12px' },
  '& .MuiInputLabel-root': { color: '#9B9691', fontFamily: 'var(--font-satoshi)' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#34322F' },
  '& .MuiInputBase-input': { color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '0.95rem' },
} as const;

interface Props {
  noteId: string;
  keyParam?: string;
}

export function SendReceiveClient({ noteId, keyParam }: Props) {
  const router = useRouter();
  const [verifiedNote, setVerifiedNote] = useState<Notes | null>(null);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingNote, setIsLoadingNote] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isCopied, setIsCopied] = React.useState(false);
  const { showSuccess, showError } = useToast();
  
  // Send Specific State
  const [kind, setKind] = useState<SendKind | null>(null);
  const [plainTitle, setPlainTitle] = useState('');
  const [plainContent, setPlainContent] = useState('');
  const [passwordPayload, setPasswordPayload] = useState<SendPasswordPayload | null>(null);
  const [totpPayload, setTotpPayload] = useState<SendTotpPayload | null>(null);
  const [taskPayload, setTaskPayload] = useState<SendTaskPayload | null>(null);
  const [fileManifest, setFileManifest] = useState<SendFilePayload | null>(null);
  const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);

  const themeColor = KIND_COLORS[kind || 'note'] || PRIMARY;
  const [totpLive, setTotpLive] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hasKey = Boolean(keyParam?.trim());

  const tickTotp = useCallback((secret: string) => {
    try {
      authenticator.options = {
        ...authenticator.options,
        step: 30,
        digits: 6,
        algorithm: 'sha1',
      } as typeof authenticator.options;
      const normalized = secret.replace(/\s+/g, '').toUpperCase();
      const code = authenticator.generate(normalized);
      setTotpLive(code);
    } catch {
      setTotpLive('—');
    }
  }, []);

  const parseMeta = useCallback((note: Notes) => {
    try {
      return parseSendGhostMetadata(note.metadata);
    } catch {
      return {};
    }
  }, []);

  const decryptData = useCallback(async (note: Notes) => {
    const meta = parseMeta(note);
    const isEncrypted = note.isEncrypted === true || (meta as any).isEncrypted;

    if (!isEncrypted) {
      return {
        title: note.title || '',
        content: note.content || ''
      };
    }

    if (!hasKey) {
      throw new Error('This send link is encrypted and requires a valid decryption key in the URL.');
    }

    const dk = keyParam!.trim();
    
    // Support both Legacy T4 and new Ghost encryption
    if ((meta as any).encryptionVersion === 'T4') {
        const keyBuffer = ecosystemSecurity.decodeBase64(dk);
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyBuffer as any,
          { name: 'AES-GCM', length: 256 },
          true,
          ['decrypt']
        );
        return {
            title: await ecosystemSecurity.decryptWithKey((meta as any).encryptedTitle || note.title || '', cryptoKey),
            content: await ecosystemSecurity.decryptWithKey(note.content || '', cryptoKey),
        };
    }

    return {
      title: await decryptGhostData(note.title || '', dk),
      content: await decryptGhostData(note.content || '', dk),
    };
  }, [keyParam, hasKey, parseMeta]);

  const processPolymorphicPayload = useCallback(async (note: Notes, plainContent: string, isEncrypted: boolean) => {
    const meta = parseMeta(note);
    if (!isSendObjectMeta(meta)) return;

    const dk = keyParam?.trim() || '';

    switch (meta.send_object.kind) {
      case 'password': {
        try {
          const parsed = JSON.parse(plainContent) as SendPasswordPayload;
          setPasswordPayload(parsed);
          if (parsed.totpSecret) tickTotp(parsed.totpSecret);
        } catch { throw new Error('Invalid password payload.'); }
        break;
      }
      case 'totp': {
        try {
          const parsed = JSON.parse(plainContent) as SendTotpPayload;
          setTotpPayload(parsed);
          tickTotp(parsed.secret);
        } catch { throw new Error('Invalid TOTP payload.'); }
        break;
      }
      case 'task': {
        try { setTaskPayload(JSON.parse(plainContent)); } catch { throw new Error('Invalid task payload.'); }
        break;
      }
      case 'file': {
        try {
          let manifest = JSON.parse(plainContent) as SendFilePayload;
          const bucketId = meta.send_object?.bucketId || manifest.bucketId;
          const fileId = meta.send_object?.fileId || manifest.fileId;
          if (!bucketId || !fileId) throw new Error('Incomplete file manifest.');
          manifest = { ...manifest, bucketId, fileId };

          const downloadUrl = storage.getFileDownload(bucketId, fileId);
          const fileRes = await fetch(downloadUrl);
          if (!fileRes.ok) throw new Error('Could not download file.');
          const fileBuf = await fileRes.arrayBuffer();
          const plainBuf = isEncrypted ? decryptGhostBinaryFromBytes(fileBuf, dk) : fileBuf;
          const blob = new Blob([plainBuf], { type: manifest.mimeType || 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          setFileManifest(manifest);
          setFileBlobUrl(url);
          const mime = manifest.mimeType || '';
          if (mime.startsWith('text/') || mime === 'application/json') {
            try { setTextPreview(new TextDecoder().decode(plainBuf)); } catch { setTextPreview(null); }
          }
        } catch (e: any) { throw new Error(`File processing failed: ${e.message}`); }
        break;
      }
    }
  }, [keyParam, parseMeta, tickTotp]);

  const fetchNote = useCallback(async (force: boolean = false) => {
    setIsLoadingNote(true);
    setError(null);
    try {
      const url = sharedNotePublicUrl(noteId);
      const res = await fetch(url, { cache: 'no-store' });
      const contentType = res.headers.get('content-type');
      
      if (!res.ok) {
        if (contentType?.includes('application/json')) {
            const body = await res.json();
            throw new Error(body.error || 'Could not load link.');
        }
        throw new Error(`Server returned error (${res.status}).`);
      }

      if (!contentType?.includes('application/json')) {
          throw new Error('Server returned an invalid response format (Expected JSON).');
      }

      const note = await res.json() as Notes;
      const meta = parseMeta(note);

      if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
        throw new Error('This send link has expired.');
      }

      const isEncrypted = note.isEncrypted === true || (meta as any).isEncrypted;
      const { title, content } = await decryptData(note);

      setVerifiedNote(note);
      setPlainTitle(title);
      setPlainContent(content);
      setKind(meta.send_object?.kind || 'note');

      await processPolymorphicPayload(note, content, isEncrypted);

      if (note.userId) {
          try {
            const { getSharedProfilesSecure } = await import('@/lib/actions/secure-ops');
            const profilesRes = await getSharedProfilesSecure([note.userId]);
            const author = profilesRes.documents?.[0];
            if (author) setAuthorProfile(author as any);
          } catch (profileErr) {
            console.warn('Failed to resolve author profile:', profileErr);
          }
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the link.');
    } finally {
      setIsLoadingNote(false);
    }
  }, [noteId, parseMeta, decryptData, processPolymorphicPayload]);

  useEffect(() => {
    fetchNote();
  }, [fetchNote]);

  useEffect(() => {
    let mounted = true;
    const resolveAuthorAvatar = async () => {
      if (!authorProfile) return;
      const rawAvatar = authorProfile.avatar || authorProfile.profilePicId || null;
      if (!rawAvatar) return;
      const cached = getCachedProfilePreview(rawAvatar);
      if (cached !== undefined) {
        if (mounted) setAuthorAvatarUrl(cached);
        return;
      }
      try {
        const preview = await fetchProfilePreview(rawAvatar, 64, 64);
        if (mounted) setAuthorAvatarUrl(preview);
      } catch {
        if (mounted) setAuthorAvatarUrl(null);
      }
    };
    resolveAuthorAvatar();
    return () => { mounted = false; };
  }, [authorProfile]);

  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchNote(true);
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [fetchNote]);

  // Realtime
  useEffect(() => {
    if (!noteId) return;
    const channel = `databases.${APPWRITE_DATABASE_ID}.collections.${APPWRITE_CONFIG.DATABASES.NOTE}.notes.documents.${noteId}`;
    const sub = realtime.subscribe(channel, (response) => {
      if (response.events.some(e => e.endsWith('.delete'))) {
        setError('This link has been deleted or expired.');
        setVerifiedNote(null);
      } else if (response.events.some(e => e.endsWith('.update'))) {
          fetchNote(true);
      }
    });
    return () => { if (typeof sub === 'function') (sub as any)(); };
  }, [noteId, fetchNote]);

  useEffect(() => {
    const secret = passwordPayload?.totpSecret || totpPayload?.secret || null;
    if (!secret) return;
    tickTotp(secret);
    const id = window.setInterval(() => tickTotp(secret), 1000);
    return () => window.clearInterval(id);
  }, [passwordPayload?.totpSecret, totpPayload?.secret, tickTotp]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(label);
      showSuccess('Copied to clipboard');
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      setCopiedField(null);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(plainContent || '');
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (!verifiedNote) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4 }}>
        <Box sx={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-clash)', color: 'white' }}>
            {isLoadingNote ? 'Opening Send Link' : 'Cannot open link'}
          </Typography>
          {error ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 3 }}>{error}</Typography>
              <Button
                variant="contained"
                onClick={() => fetchNote(true)}
                sx={{ borderRadius: '12px', bgcolor: PRIMARY, fontWeight: 700 }}
              >
                Retry
              </Button>
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 3 }}>Fetching the payload. Please wait.</Typography>
          )}
          {isLoadingNote && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress size={32} sx={{ color: themeColor }} />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  const meta = parseMeta(verifiedNote);
  const isEncrypted = verifiedNote.isEncrypted === true || (meta as any).isEncrypted;



  const NoteContent = () => {
    return (
      <Paper 
        elevation={0}
        sx={{ 
          borderRadius: '32px', 
          border: '1px solid rgba(255, 255, 255, 0.05)',
          bgcolor: '#161412',
          overflow: 'hidden',
          color: 'white',
          boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)'
        }}
      >
        <Box sx={{ p: { xs: 4, md: 6 }, borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 3 }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                   <Box sx={{ 
                       width: 48, height: 48, borderRadius: 2, display: 'grid', placeItems: 'center',
                       bgcolor: alpha(isEncrypted ? themeColor : '#10B981', 0.1),
                       border: `1px solid ${alpha(isEncrypted ? themeColor : '#10B981', 0.3)}`,
                       color: isEncrypted ? themeColor : '#10B981'
                   }}>
                      {kind === 'password' ? <KeyRound /> : kind === 'totp' ? <Shield /> : kind === 'file' ? <Upload /> : kind === 'task' ? <ListTodo /> : <FileText />}
                   </Box>
                   <Box>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          fontWeight: 900, 
                          fontFamily: 'var(--font-clash)', 
                          lineHeight: 1.1,
                          background: 'linear-gradient(to bottom, #FFF 0%, rgba(255,255,255,0.7) 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        {kind === 'file' ? fileManifest?.originalName || plainTitle || 'File' : plainTitle || 'Untitled'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {kind} · {isEncrypted ? 'Private' : 'Preview'}
                      </Typography>
                   </Box>
              </Stack>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip 
                    icon={isEncrypted ? <Lock size={14} /> : <Unlock size={14} />}
                    label={isEncrypted ? "Secure" : "Open"}
                    size="small"
                    sx={{ 
                        borderRadius: '8px', 
                        bgcolor: alpha(isEncrypted ? themeColor : '#10B981', 0.1),
                        color: isEncrypted ? themeColor : '#10B981',
                        fontWeight: 800,
                        border: `1px solid ${alpha(isEncrypted ? themeColor : '#10B981', 0.2)}`,
                    }} 
                  />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.4)' }}>
                <ClockIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
                  Vanish {new Date(meta.expiresAt || 0).toLocaleString()}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255, 255, 255, 0.4)' }}>
                <EyeIcon sx={{ fontSize: 16 }} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>Link Active</Typography>
              </Box>
              {authorProfile && (
                <MuiLink 
                  component={NextLink}
                  href={authorProfile.username ? `${getEcosystemUrl('connect')}/u/${authorProfile.username}` : '#'} 
                  target="_blank"
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1.5, 
                    textDecoration: 'none',
                    bgcolor: '#1C1A18',
                    py: 0.5,
                    px: 1.5,
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': {
                      bgcolor: '#252220',
                      borderColor: alpha(themeColor, 0.3),
                      transform: 'translateY(-1px)'
                    }
                  }}
                >
                  <Avatar 
                    src={authorAvatarUrl || undefined}
                    sx={{ width: 20, height: 20, fontSize: '0.65rem', fontWeight: 900, bgcolor: themeColor, color: '#000' }}
                  >
                    {getEffectiveDisplayName(authorProfile)[0].toUpperCase()}
                  </Avatar>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: themeColor, fontFamily: 'var(--font-satoshi)' }}>
                    {authorProfile.username ? `@${authorProfile.username}` : getEffectiveDisplayName(authorProfile)}
                  </Typography>
                </MuiLink>
              )}
            </Box>
          </Stack>
        </Box>

        <Box sx={{ position: 'relative', p: { xs: 4, md: 6 }, bgcolor: 'rgba(0, 0, 0, 0.1)' }}>
          {/* Polymorphic Body */}
          {kind === 'password' && passwordPayload && (
              <Stack spacing={3}>
                  <TextField label="Username / URL" value={passwordPayload.username || '—'} fullWidth InputProps={{ readOnly: true }} sx={readOnlyFieldSx} />
                  <TextField 
                      label="Password" 
                      type={showPw ? 'text' : 'password'} 
                      value={passwordPayload.password} 
                      fullWidth 
                      InputProps={{
                          readOnly: true,
                          endAdornment: (
                              <IconButton onClick={() => setShowPw(!showPw)} edge="end" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                              </IconButton>
                          ),
                      }} 
                      sx={readOnlyFieldSx} 
                  />
                  <Button variant="contained" onClick={() => copy('pw', passwordPayload.password)} fullWidth sx={{ py: 1.5, textTransform: 'none', fontWeight: 800, bgcolor: themeColor, borderRadius: '14px' }}>
                      Copy Password
                  </Button>
                  {passwordPayload.totpSecret && (
                      <Paper sx={{ p: 3, borderRadius: '16px', bgcolor: '#000000', border: '1px solid #34322F', textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '0.75rem', color: '#9B9691', mb: 1, fontWeight: 700 }}>AUTHENTICATOR CODE</Typography>
                          <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 900, letterSpacing: '0.2em', color: '#ffffff' }}>{totpLive}</Typography>
                      </Paper>
                  )}
              </Stack>
          )}

          {kind === 'totp' && totpPayload && (
              <Stack spacing={3}>
                  <Paper sx={{ p: 4, borderRadius: '16px', bgcolor: '#000000', border: '1px solid #34322F', textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#9B9691', mb: 1, fontWeight: 700 }}>CURRENT CODE</Typography>
                      <Typography sx={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', fontWeight: 900, letterSpacing: '0.25em', color: '#ffffff' }}>{totpLive}</Typography>
                      <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}>{totpPayload.issuer || 'Unknown Issuer'}</Typography>
                  </Paper>
                  <Button variant="outlined" onClick={() => copy('secret', totpPayload.secret)} fullWidth sx={{ py: 1.5, textTransform: 'none', fontWeight: 800, borderColor: '#34322F', color: 'white', borderRadius: '14px' }}>
                      Copy Secret Key
                  </Button>
              </Stack>
          )}

          {kind === 'task' && taskPayload && (
              <Stack spacing={2}>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{taskPayload.title}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{taskPayload.detail || 'No description provided.'}</Typography>
                  {taskPayload.dueAt && (
                      <Chip label={`Due: ${new Date(taskPayload.dueAt).toLocaleString()}`} sx={{ alignSelf: 'flex-start', bgcolor: alpha('#fff', 0.05), fontWeight: 700 }} />
                  )}
              </Stack>
          )}

          {kind === 'file' && fileManifest && fileBlobUrl && (
              <Stack spacing={3}>
                  <Paper sx={{ p: 3, borderRadius: '16px', bgcolor: '#000', border: RIM, display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Upload color={themeColor} />
                      <Box>
                          <Typography sx={{ fontWeight: 800 }}>{fileManifest.originalName}</Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                               {fileManifest.size >= 1024 * 1024 ? `${(fileManifest.size / (1024 * 1024)).toFixed(2)} MB` : `${(fileManifest.size / 1024).toFixed(1)} KB`} · {fileManifest.mimeType}
                          </Typography>
                      </Box>
                  </Paper>
                  <Button variant="contained" component="a" href={fileBlobUrl} download={fileManifest.originalName} fullWidth sx={{ py: 2, textTransform: 'none', fontWeight: 800, bgcolor: themeColor, borderRadius: '14px' }}>
                      Download Decrypted File
                  </Button>
                  {fileManifest.mimeType?.startsWith('image/') && (
                      <Box component="img" src={fileBlobUrl} sx={{ maxWidth: '100%', borderRadius: '16px', border: RIM }} />
                  )}
              </Stack>
          )}

          {kind === 'note' && (
              <Box sx={{ position: 'relative' }}>
                  <IconButton
                      onClick={handleCopyContent}
                      sx={{
                          position: 'absolute',
                          top: -12,
                          right: -12,
                          bgcolor: isCopied ? alpha(themeColor, 0.1) : '#1C1A18',
                          border: '1px solid',
                          borderColor: isCopied ? themeColor : 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          color: isCopied ? themeColor : 'rgba(255, 255, 255, 0.4)',
                          transition: 'all 0.2s',
                          zIndex: 2,
                          '&:hover': { bgcolor: '#252220', color: 'white' }
                      }}
                  >
                      {isCopied ? <CheckIcon /> : <CopyIcon />}
                  </IconButton>
                  <NoteContentRenderer
                      content={plainContent}
                      format={(verifiedNote.format as 'text' | 'doodle') || 'text'}
                      emptyFallback={<Typography sx={{ color: 'rgba(255, 255, 255, 0.2)', fontStyle: 'italic' }}>This payload is empty.</Typography>}
                  />
              </Box>
          )}
        </Box>

        <Box sx={{ p: 3, bgcolor: '#161412', borderTop: '1px solid rgba(255, 255, 255, 0.03)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontFamily: 'var(--font-jetbrains-mono)', fontWeight: 700 }}>
              LINK ID: {verifiedNote.$id.toUpperCase()}
            </Typography>
            <Typography variant="caption" sx={{ color: themeColor, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-clash)' }}>
              SECURE LINK · KYLRIX
            </Typography>
          </Box>
        </Box>
      </Paper>
    );
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: 'white' }}>
      <Box sx={{ 
        bgcolor: '#0E0C0A', 
        borderBottom: '1px solid #1C1A18', 
        height: '88px', 
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1300
      }}>
        <Container maxWidth="md">
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <Typography variant="body2" sx={{ color: alpha('#FFFFFF', 0.5), fontWeight: 600 }}>
              {isEncrypted ? 'This link is protected by encryption.' : 'You are viewing a public preview of a shared item.'}
            </Typography>
            <Button 
              component={NextLink}
              href="/send" 
              startIcon={<ArrowBackIcon />}
              sx={{ fontWeight: 800, color: themeColor, textTransform: 'none' }}
            >
              Back to Send
            </Button>
          </Box>
        </Container>
      </Box>

      {kind === 'discussion' ? (
        <HuddleChatWindow
          chatNoteId={noteId}
          user={user}
          title={plainTitle || 'Discussion Huddle'}
          standalone={true}
          onBack={() => router.push('/send')}
          expiresAt={meta.expiresAt}
          shareLink={typeof window !== 'undefined' ? window.location.href : ''}
        />
      ) : (
        <Container maxWidth="md" sx={{ pt: '108px', pb: 8 }}>
          <NoteContent />

          <Box sx={{ mt: 4 }}>
            <NoteReactions targetId={noteId} />
          </Box>

          <Box sx={{ mt: 4 }}>
            <CommentsSection noteId={noteId} decryptionKey={keyParam} />
          </Box>

          <Box sx={{ mt: 8, textAlign: 'center' }}>
            <Paper
              sx={{
                p: 6,
                borderRadius: '32px',
                bgcolor: '#161412',
                border: '1px solid rgba(99, 102, 241, 0.1)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)'
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 2, fontFamily: 'var(--font-clash)', color: 'white' }}>
                Create Your Own Notes
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 4, maxWidth: 500, mx: 'auto' }}>
                Join thousands of users who trust Kylrix Note to capture, organize, and share their thoughts.
              </Typography>
              <Button
                component={MuiLink}
                href="/"
                variant="contained"
                size="large"
                endIcon={<ArrowRightIcon />}
                sx={{ 
                  borderRadius: '16px', 
                  px: 4, 
                  py: 1.5,
                  bgcolor: themeColor,
                  color: '#000',
                  fontWeight: 800,
                  boxShadow: `0 8px 24px ${alpha(themeColor, 0.2)}`,
                  '&:hover': { bgcolor: alpha(themeColor, 0.8) }
                }}
              >
                Start Writing for Free
              </Button>
            </Paper>
          </Box>
        </Container>
      )}
    </Box>
  );
}
