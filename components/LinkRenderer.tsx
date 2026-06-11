import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, Box, IconButton, Typography, Tooltip, CircularProgress, Button, Drawer, alpha } from '@/lib/mui-tailwind/material';
import { Play, Pause, Key, Lock, Shield, Copy, Check, ArrowLeft, X, Eye, EyeOff, Download } from 'lucide-react';
import { StorageService } from '@/lib/services/storage';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useDataNexus } from '@/context/DataNexusContext';
import { MasterPassDrawer } from '@/components/overlays/MasterPassDrawer';
import { generateTOTP } from '@/lib/totp-util';
import toast from 'react-hot-toast';
import type { Credentials, TotpSecrets, Notes } from '@/types/appwrite';
import { isSendObjectMeta, parseSendGhostMetadata } from '@/lib/send/metadata';
import { decryptGhostData, decryptGhostBinaryFromBytes } from '@/lib/encryption/ghost-crypto';
import { storage } from '@/lib/appwrite/client';
import type { SendPasswordPayload, SendTotpPayload, SendFilePayload } from '@/lib/send/types';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { usePresence } from '@/components/providers/PresenceProvider';
import { HuddleChatWindow } from '@/components/chat/HuddleChatWindow';
import { getRowSecure } from '@/lib/actions/secure-ops';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

export function VoiceNotePlayer({ fileId }: { fileId: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = StorageService.getFileView(fileId, 'voice').toString();

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progress = duration > 0 ? (currentTime / duration) : 0;
  
  // Generating a static pseudo-waveform heights array for visual delight
  const waveHeights = [8, 14, 18, 12, 16, 20, 14, 10, 16, 12];

  return (
    <Box
      onClick={togglePlay}
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.75,
        py: 0.75,
        mx: 0.5,
        bgcolor: '#161412',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        verticalAlign: 'middle',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          bgcolor: '#1F1D1B',
          borderColor: 'rgba(255, 255, 255, 0.16)',
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        },
        '&:active': {
          transform: 'translateY(0)',
        }
      }}
    >
      <IconButton
        size="small"
        onClick={togglePlay}
        sx={{
          p: 0.5,
          bgcolor: isPlaying ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          color: isPlaying ? '#6366F1' : '#fff',
          border: `1px solid ${isPlaying ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
          '&:hover': {
            bgcolor: isPlaying ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.1)',
          }
        }}
      >
        {isPlaying ? <Pause size={14} fill={isPlaying ? '#6366F1' : 'none'} /> : <Play size={14} fill="#fff" />}
      </IconButton>

      {/* Pseudo-Waveform Display */}
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 20 }}>
        {waveHeights.map((height, idx) => {
          const threshold = (idx / waveHeights.length);
          const active = progress >= threshold;
          return (
            <Box
              key={idx}
              component="span"
              sx={{
                width: '3px',
                height: `${height}px`,
                borderRadius: '1px',
                bgcolor: active ? '#6366F1' : 'rgba(255, 255, 255, 0.15)',
                boxShadow: active ? '0 0 8px rgba(99, 102, 241, 0.5)' : 'none',
                transition: 'all 0.15s ease-in-out',
                // Wave micro-animation if playing
                animation: isPlaying && active ? `wavePulse 1.2s ease-in-out infinite alternate` : 'none',
                animationDelay: `${idx * 0.1}s`,
              }}
            />
          );
        })}
      </Box>

      <Typography
        variant="caption"
        component="span"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: isPlaying ? '#6366F1' : 'rgba(255, 255, 255, 0.65)',
          minWidth: 60,
          textAlign: 'right',
          display: 'inline-block'
        }}
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </Typography>

      <style>{`
        @keyframes wavePulse {
          0% { transform: scaleY(1); }
          100% { transform: scaleY(1.4); }
        }
      `}</style>
    </Box>
  );
}

export function VaultTotpLink({ href, children }: { href: string; children?: React.ReactNode }) {
  const credentialId = href.replace('source:kylrixvault:', '');
  const { user, isVaultUnlocked } = useAppwriteVault();
  const { getCachedData } = useDataNexus();
  const [isUnlocked, setIsUnlocked] = useState(isVaultUnlocked());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [totpSecret, setTotpSecret] = useState<TotpSecrets | null>(null);
  const [credentialName, setCredentialName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Listen to vault unlock events to dynamically refresh state
  useEffect(() => {
    setIsUnlocked(isVaultUnlocked());
  }, [isVaultUnlocked]);

  // Sync current time for progress wheel and live code recalculation
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch or retrieve from cache
  const loadData = useCallback(async () => {
    if (!user?.$id) return;
    
    // Only load if vault is unlocked
    const unlocked = isVaultUnlocked();
    setIsUnlocked(unlocked);
    if (!unlocked) {
      setTotpSecret(null);
      return;
    }

    setLoading(true);
    try {
      // 1. Try to fetch from memory (Data Nexus)
      const cachedTotps = getCachedData<TotpSecrets[]>(`v_totp_total_${user.$id}`);
      const cachedCreds = getCachedData<{ total: number; rows: Credentials[] }>(`v_creds_total_${user.$id}`);

      let targetTotpId = credentialId;
      let name = '';

      // Check if ID matches a credential row in cache
      if (cachedCreds?.rows) {
        const match = cachedCreds.rows.find(c => c.$id === credentialId);
        if (match) {
          name = match.name;
          if (match.totpId) {
            targetTotpId = match.totpId;
          }
        }
      }

      // Check if we have the secret in cached TOTPs list
      if (cachedTotps) {
        // Either matches direct credentialId or targetTotpId
        const match = cachedTotps.find(t => t.$id === targetTotpId || t.$id === credentialId);
        if (match) {
          setTotpSecret(match);
          setCredentialName(name || match.issuer || match.accountName || 'TOTP');
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to direct fetching via VaultService
      const { VaultService } = await import('@/lib/appwrite/vault');
      
      let fetchedTotpId = targetTotpId;
      try {
        const cred = await VaultService.getCredential(credentialId);
        if (cred) {
          name = cred.name;
          if (cred.totpId) {
            fetchedTotpId = cred.totpId;
          }
        }
      } catch (e) {
        // Not a credential ID, or credential load failed; we will try to fetch directly as a totpSecret
      }

      const totp = await VaultService.getTOTPSecret(fetchedTotpId);
      if (totp) {
        setTotpSecret(totp);
        setCredentialName(name || totp.issuer || totp.accountName || 'TOTP');
      }
    } catch (err) {
      console.warn('[VaultTotpLink] Error fetching TOTP info:', err);
    } finally {
      setLoading(false);
    }
  }, [user, credentialId, getCachedData, isVaultUnlocked]);

  // Load when vault unlocks or link is mounted
  useEffect(() => {
    loadData();
  }, [isUnlocked, loadData]);

  // Handle drawer unlock success
  const handleDrawerClose = useCallback(() => {
    setIsDrawerOpen(false);
    // Double check state
    setIsUnlocked(isVaultUnlocked());
  }, [isVaultUnlocked]);

  // Copy code to clipboard
  const handleCopy = useCallback((code: string) => {
    if (code === 'Locked' || code === 'Invalid' || code === '------') return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('TOTP code copied!');
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // Compute live values
  const period = totpSecret?.period || 30;
  const timeRemaining = period - (Math.floor(currentTime / 1000) % period);
  const progress = (timeRemaining / period) * 100;

  const currentCode = useMemo(() => {
    if (!totpSecret || !totpSecret.secretKey) return '------';
    return generateTOTP(
      totpSecret.secretKey,
      {
        step: totpSecret.period || 30,
        digits: totpSecret.digits || 6
      }
    );
  }, [totpSecret]);

  return (
    <>
      <Tooltip
        disableInteractive={false}
        arrow
        placement="top"
        enterDelay={200}
        leaveDelay={300}
        slotProps={{
          tooltip: {
            sx: {
              bgcolor: 'rgba(10, 9, 8, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              borderRadius: '12px',
              p: 2,
              minWidth: '220px',
              maxWidth: '300px',
              color: '#fff',
            }
          },
          arrow: {
            sx: {
              color: 'rgba(10, 9, 8, 0.95)',
            }
          }
        }}
        title={
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Header: Item details */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', pb: 0.75, mb: 0.5 }}>
              <Shield size={14} style={{ color: '#10B981' }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {credentialName || totpSecret?.issuer || '2FA Vault Link'}
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1.5 }}>
                <CircularProgress size={16} sx={{ color: '#10B981' }} />
              </Box>
            ) : !isUnlocked ? (
              // Locked state
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 1 }}>
                <Typography variant="body2" sx={{ fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center' }}>
                  Vault is locked. Unlock to generate 2FA token.
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setIsDrawerOpen(true)}
                  startIcon={<Lock size={12} />}
                  sx={{
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    py: 0.5,
                    px: 1.5,
                    borderRadius: '20px',
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: '#10B981',
                      bgcolor: 'rgba(16, 185, 129, 0.05)',
                    }
                  }}
                >
                  Unlock Vault
                </Button>
              </Box>
            ) : (
              // Unlocked state showing live TOTP
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 0.5 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography
                    variant="h6"
                    onClick={() => handleCopy(currentCode)}
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '1.4rem',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      color: copied ? '#10B981' : '#fff',
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      '&:hover': {
                        color: '#10B981'
                      }
                    }}
                  >
                    {currentCode}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)' }}>
                    Expires in {timeRemaining}s
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {/* Decaying Circular Progress */}
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <CircularProgress
                      variant="determinate"
                      value={progress}
                      size={20}
                      thickness={5}
                      sx={{
                        color: timeRemaining <= 5 ? '#EF4444' : '#10B981',
                        '& .MuiCircularProgress-circle': {
                          strokeLinecap: 'round',
                        }
                      }}
                    />
                  </Box>

                  {/* Copy Button */}
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(currentCode)}
                    sx={{
                      color: copied ? '#10B981' : 'rgba(255, 255, 255, 0.6)',
                      bgcolor: 'rgba(255, 255, 255, 0.04)',
                      p: 0.5,
                      '&:hover': {
                        color: '#fff',
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                      }
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </IconButton>
                </Box>
              </Box>
            )}
          </Box>
        }
      >
        <Link
          href={href}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Clicking triggers unlock if locked, or copies the current token if unlocked
            if (!isUnlocked) {
              setIsDrawerOpen(true);
            } else if (totpSecret) {
              handleCopy(currentCode);
            }
          }}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: '#10B981',
            textDecoration: 'none',
            fontWeight: 700,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderBottom: '1px dashed rgba(16, 185, 129, 0.4)',
            cursor: 'pointer',
            verticalAlign: 'middle',
            '&:hover': {
              color: alpha('#10B981', 0.8),
              borderBottomColor: '#10B981',
              bgcolor: alpha('#10B981', 0.05),
              borderRadius: '4px',
              px: 0.5,
              mx: -0.5
            }
          }}
        >
          <Key size={14} style={{ transform: 'rotate(-45deg)' }} />
          {children || 'Vault 2FA'}
        </Link>
      </Tooltip>

      {/* Render MasterPassDrawer so the user can unlock the vault inline */}
      <MasterPassDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        intent="unlock"
      />
    </>
  );
}

/**
 * Custom link component for ReactMarkdown that styles links in Electric Teal
 * Intercepts voice: schema to render high-fidelity audio voice note players inline.
 */
export function LinkComponent({ href, children }: { href?: string; children?: React.ReactNode }) {
  if (!href) return <span>{children}</span>;

  if (href.startsWith('voice:')) {
    const fileId = href.replace('voice:', '');
    return <VoiceNotePlayer fileId={fileId} />;
  }

  if (href.startsWith('source:kylrixvault:')) {
    return <VaultTotpLink href={href}>{children}</VaultTotpLink>;
  }

  if (href.startsWith('source:kylrixflow:') || href.startsWith('source:kylrixgoal:')) {
    return <FlowPresencePulseLink href={href}>{children}</FlowPresencePulseLink>;
  }

  // Parse for `/flow/form/[id]` internal or absolute kylrix form links
  const formUrlMatch = href.match(/(?:\/flow\/form\/|source:kylrixform:)([a-zA-Z0-9_-]+)/);
  if (formUrlMatch) {
    const formId = formUrlMatch[1];
    return <KylrixFormBadgeLink href={href} formId={formId}>{children}</KylrixFormBadgeLink>;
  }

  // Parse for `/send/[id]/[key]` or `/send/[id]`
  const sendMatch = href.match(/\/send\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?/);
  if (sendMatch) {
    const noteId = sendMatch[1];
    const keyParam = sendMatch[2] || null;
    return <SendRelayPreviewCard href={href} noteId={noteId} keyParam={keyParam}>{children}</SendRelayPreviewCard>;
  }
  
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        // Intercept form links if they are standard absolute links on kylrix domains
        if (href.includes('/flow/form/')) {
          const match = href.match(/\/flow\/form\/([a-zA-Z0-9_-]+)/);
          if (match) {
            e.preventDefault();
            e.stopPropagation();
// eslint-disable-next-line react-hooks/rules-of-hooks
            const { open } = useUnifiedDrawer();
            open('form', { formId: match[1] });
            return;
          }
        }
        e.stopPropagation();
      }}
      sx={{
        color: '#6366F1',
        textDecoration: 'none',
        fontWeight: 700,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderBottom: '1px solid transparent',
        '&:hover': {
          color: alpha('#6366F1', 0.8),
          borderBottomColor: alpha('#6366F1', 0.4),
          bgcolor: alpha('#6366F1', 0.05),
          borderRadius: '4px',
          px: 0.5,
          mx: -0.5
        }
      }}
    >
      {children}
    </Link>
  );
}

interface SendFlapOverProps {
  isOpen: boolean;
  onClose: () => void;
  note: Notes | null;
  noteId: string;
  keyParam: string | null;
  decryptedTitle: string;
}

export function SendFlapOver({
  isOpen,
  onClose,
  note,
  noteId,
  keyParam,
  decryptedTitle
}: SendFlapOverProps) {
  const [decryptedContent, setDecryptedContent] = useState<string>('');
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Payloads
  const [passwordPayload, setPasswordPayload] = useState<SendPasswordPayload | null>(null);
  const [totpPayload, setTotpPayload] = useState<SendTotpPayload | null>(null);
  const [fileManifest, setFileManifest] = useState<SendFilePayload | null>(null);
  const [downloading, setDownloading] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [totpLive, setTotpLive] = useState('------');
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Listen to live clock updates for TOTP countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const meta = useMemo(() => {
    return note ? parseSendGhostMetadata(note.metadata) : null;
  }, [note]);

  const sendKind = useMemo(() => {
    return meta && isSendObjectMeta(meta) ? meta.send_object.kind : 'note';
  }, [meta]);

  // Generate TOTP if secret is present
  const activeTotpSecret = useMemo(() => {
    if (sendKind === 'totp' && totpPayload?.secret) return totpPayload.secret;
    if (sendKind === 'password' && passwordPayload?.totpSecret) return passwordPayload.totpSecret;
    return null;
  }, [sendKind, totpPayload, passwordPayload]);

  useEffect(() => {
    if (!activeTotpSecret) return;
    try {
      const code = generateTOTP(activeTotpSecret);
      setTotpLive(code);
    } catch {
      setTotpLive('—');
    }
  }, [activeTotpSecret, currentTime]);

  const decryptPayload = useCallback(async () => {
    if (!note) return;
    setDecrypting(true);
    setError(null);
    try {
      const isEncrypted = note.isEncrypted === true || (meta as any).isEncrypted;

      if (!isEncrypted) {
        setDecryptedContent(note.content || '');
        setDecrypting(false);
        return;
      }

      if (!keyParam) {
        throw new Error('Decryption key missing.');
      }

      const dk = keyParam.trim();
      const plain = await decryptGhostData(note.content || '', dk);
      setDecryptedContent(plain);

      // Process structural payload (JSON files, passwords, etc)
      if (meta && isSendObjectMeta(meta)) {
        const kind = meta.send_object.kind;
        if (kind === 'password') {
          setPasswordPayload(JSON.parse(plain));
        } else if (kind === 'totp') {
          setTotpPayload(JSON.parse(plain));
        } else if (kind === 'file') {
          let manifest = JSON.parse(plain) as SendFilePayload;
          const bucketId = meta.send_object.bucketId || manifest.bucketId;
          const fileId = meta.send_object.fileId || manifest.fileId;
          if (bucketId && fileId) {
            setFileManifest({ ...manifest, bucketId, fileId });
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Decryption failed.');
    } finally {
      setDecrypting(false);
    }
  }, [note, keyParam, meta]);

  useEffect(() => {
    decryptPayload();
  }, [decryptPayload]);

  // Decrypt and download file in browser
  const handleDownloadFile = async () => {
    if (!fileManifest || !keyParam) return;
    setDownloading(true);
    try {
      const bucketId = fileManifest.bucketId;
      const fileId = fileManifest.fileId;
      if (!bucketId || !fileId) throw new Error('Missing file manifest details.');

      const downloadUrl = storage.getFileDownload(bucketId, fileId);
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Download request failed.');
      
      const fileBuf = await res.arrayBuffer();
      const plainBuf = decryptGhostBinaryFromBytes(fileBuf, keyParam.trim());
      
      const blob = new Blob([plainBuf], { type: fileManifest.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = fileManifest.originalName || 'downloaded_file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('File decrypted and downloaded!');
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const kindColors: Record<string, string> = {
    password: '#10B981',   // Emerald
    totp: '#10B981',       // Emerald
    file: '#3B82F6',       // Blue
    discussion: '#F59E0B', // Amber
    note: '#6366F1'        // Indigo
  };

  const period = 30;
  const timeRemaining = period - (Math.floor(currentTime / 1000) % period);
  const progress = (timeRemaining / period) * 100;

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
          }
        }
      }}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: '420px' },
          bgcolor: '#0A0908',
          color: '#fff',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.6)', '&:hover': { color: '#fff' } }}>
            <ArrowLeft size={18} />
          </IconButton>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {decryptedTitle || 'Secure Relay'}
            </Typography>
            {meta && isSendObjectMeta(meta) && (
              <Typography variant="caption" sx={{ color: kindColors[sendKind], fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                Secure {sendKind}
              </Typography>
            )}
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#fff' } }}>
          <X size={18} />
        </IconButton>
      </Box>

      {/* Main Content Viewport */}
      <Box sx={{ p: 3, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {decrypting ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, py: 10 }}>
            <CircularProgress size={32} sx={{ color: kindColors[sendKind] || '#6366F1' }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
              Decrypting payload locally...
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ p: 2.5, bgcolor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" sx={{ color: '#EF4444', fontWeight: 800 }}>
              Decryption Failed
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
              {error}
            </Typography>
          </Box>
        ) : (
          /* Render payloads based on send kind */
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
            {sendKind === 'password' && passwordPayload && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {/* Username Box */}
                {passwordPayload.username && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Username
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', px: 2, py: 1.25 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: '#fff' }}>
                        {passwordPayload.username}
                      </Typography>
                      <IconButton size="small" onClick={() => {
                        navigator.clipboard.writeText(passwordPayload.username || '');
                        toast.success('Username copied!');
                      }} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                        <Copy size={14} />
                      </IconButton>
                    </Box>
                  </Box>
                )}

                {/* Password Box */}
                {passwordPayload.password && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Password
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', px: 2, py: 1.25 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 800, letterSpacing: showPassword ? '0.05em' : '0.25em', color: '#fff' }}>
                        {showPassword ? passwordPayload.password : '••••••••••••'}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => setShowPassword(!showPassword)} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </IconButton>
                        <IconButton size="small" onClick={() => {
                          navigator.clipboard.writeText(passwordPayload.password || '');
                          toast.success('Password copied!');
                        }} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                          <Copy size={14} />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                )}



                {/* Linked TOTP Box */}
                {passwordPayload.totpSecret && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Two-Factor Authentication (2FA)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'rgba(16,185,129,0.03)', border: '1px solid rgba(16,185,129,0.1)', borderRadius: '10px', px: 2.5, py: 1.5 }}>
                      <Box>
                        <Typography variant="h5" sx={{ fontFamily: 'monospace', fontWeight: 800, letterSpacing: '0.08em', color: '#10B981' }}>
                          {totpLive}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.68rem' }}>
                          Code expires in {timeRemaining}s
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CircularProgress variant="determinate" value={progress} size={22} thickness={5} sx={{ color: timeRemaining <= 5 ? '#EF4444' : '#10B981' }} />
                        <IconButton size="small" onClick={() => {
                          navigator.clipboard.writeText(totpLive);
                          toast.success('2FA code copied!');
                        }} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#10B981' } }}>
                          <Copy size={14} />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {sendKind === 'totp' && totpPayload && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', py: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.8)' }}>
                    {totpPayload.issuer || 'Verification Code'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                    {totpPayload.account || '2FA Seed'}
                  </Typography>
                </Box>

                {/* Big Live Token Circle */}
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 160, height: 160 }}>
                  <CircularProgress
                    variant="determinate"
                    value={progress}
                    size={160}
                    thickness={3}
                    sx={{
                      color: timeRemaining <= 5 ? '#EF4444' : '#10B981',
                      position: 'absolute'
                    }}
                  />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={() => {
                    navigator.clipboard.writeText(totpLive);
                    toast.success('Code copied!');
                  }}>
                    <Typography variant="h4" sx={{ fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.05em', color: '#fff' }}>
                      {totpLive}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem', fontWeight: 700 }}>
                      Expires in {timeRemaining}s
                    </Typography>
                  </Box>
                </Box>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(totpLive);
                    toast.success('Code copied!');
                  }}
                  startIcon={<Copy size={12} />}
                  sx={{
                    borderColor: 'rgba(16,185,129,0.2)',
                    color: '#10B981',
                    textTransform: 'none',
                    borderRadius: '20px',
                    px: 3,
                    '&:hover': {
                      borderColor: '#10B981',
                      bgcolor: 'rgba(16,185,129,0.05)'
                    }
                  }}
                >
                  Copy 2FA Code
                </Button>
              </Box>
            )}

            {sendKind === 'file' && fileManifest && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, alignItems: 'center', py: 4 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center' }}>
                  <Typography variant="body1" sx={{ fontWeight: 800, color: '#fff' }}>
                    {fileManifest.originalName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                    Size: {(fileManifest.size / (1024 * 1024)).toFixed(2)} MB • Mime: {fileManifest.mimeType}
                  </Typography>
                </Box>

                <Button
                  variant="contained"
                  disabled={downloading}
                  onClick={handleDownloadFile}
                  startIcon={downloading ? <CircularProgress size={14} sx={{ color: '#000' }} /> : <Download size={14} />}
                  sx={{
                    bgcolor: '#3B82F6',
                    color: '#fff',
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: '24px',
                    px: 4,
                    py: 1.25,
                    boxShadow: '0 4px 16px rgba(59, 130, 246, 0.25)',
                    '&:hover': {
                      bgcolor: '#2563EB',
                      boxShadow: '0 6px 20px rgba(59, 130, 246, 0.35)'
                    }
                  }}
                >
                  {downloading ? 'Decrypting binary...' : 'Download & Decrypt File'}
                </Button>
              </Box>
            )}

            {sendKind === 'note' && decryptedContent && (
              <Box 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.9)', 
                  fontSize: '0.95rem', 
                  lineHeight: 1.65, 
                  '& p': { mb: 2 },
                  '& code': { bgcolor: 'rgba(255,255,255,0.08)', px: 0.75, py: 0.25, borderRadius: '4px', fontSize: '0.85em', fontFamily: 'monospace', color: '#818CF8' },
                  '& pre': { bgcolor: 'rgba(0,0,0,0.4)', p: 2, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto', my: 2 },
                  '& pre code': { bgcolor: 'transparent', p: 0, color: 'inherit' }
                }}
                dangerouslySetInnerHTML={{ __html: typeof window !== 'undefined' ? DOMPurify.sanitize(marked.parse(decryptedContent) as string) : decryptedContent }}
              />
            )}
          </Box>
        )}
      </Box>

      {/* Footer Info */}
      {meta?.expiresAt && (
        <Box sx={{ p: 2.5, borderTop: '1px solid rgba(255, 255, 255, 0.08)', bgcolor: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.38)', fontWeight: 700 }}>
            This ephemeral relay purges automatically on {new Date(meta.expiresAt).toLocaleDateString()}
          </Typography>
        </Box>
      )}
    </Drawer>
  );
}

export function SendRelayPreviewCard({
  href,
  noteId,
  keyParam,
  children
}: {
  href: string;
  noteId: string;
  keyParam: string | null;
  children?: React.ReactNode;
}) {
  const { getCachedData, setCachedData } = useDataNexus();
  const [note, setNote] = useState<Notes | null>(null);
  const [decryptedTitle, setDecryptedTitle] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse metadata & decrypt title
  const loadMetadata = useCallback(async () => {
    // 1. Try to fetch from memory (Data Nexus)
    const cacheKey = `send_relay_${noteId}`;
    const cached = getCachedData<{ note: Notes; title: string }>(cacheKey);
    if (cached) {
      setNote(cached.note);
      setDecryptedTitle(cached.title);
      return;
    }

    setLoading(true);
    try {
      const { getPublicNoteDataSecure } = await import('@/lib/actions/secure-ops');
      const data = await getPublicNoteDataSecure(noteId);
      if (!data) throw new Error('Could not load secure relay.');
      
      const meta = parseSendGhostMetadata(data.metadata);
      if (meta.expiresAt && new Date(meta.expiresAt) < new Date()) {
        setError('Expired');
        setLoading(false);
        return;
      }

      setNote(data);

      const isEncrypted = data.isEncrypted === true || (meta as any).isEncrypted;
      let title = data.title || 'Secure Relay';

      if (isEncrypted && keyParam) {
        try {
          title = await decryptGhostData(data.title || '', keyParam.trim());
        } catch {
          title = 'Encrypted Payload';
        }
      }

      setDecryptedTitle(title);
      setCachedData(cacheKey, { note: data, title });
    } catch (err) {
      setError('Error');
    } finally {
      setLoading(false);
    }
  }, [noteId, keyParam, getCachedData, setCachedData]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Prevent default page navigation and open Flap-Over drawer
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrawerOpen(true);
  };

  const meta = note ? parseSendGhostMetadata(note.metadata) : null;
  const sendKind = meta && isSendObjectMeta(meta) ? meta.send_object.kind : 'note';

  const kindColors: Record<string, string> = {
    password: '#10B981',   // Emerald
    totp: '#10B981',       // Emerald
    file: '#3B82F6',       // Blue
    discussion: '#F59E0B', // Amber
    note: '#6366F1'        // Indigo
  };

  return (
    <>
      <Box
        onClick={handleClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.5,
          px: 1.5,
          py: 0.75,
          mx: 0.5,
          my: 0.5,
          bgcolor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          cursor: 'pointer',
          userSelect: 'none',
          verticalAlign: 'middle',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          '&:hover': {
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            borderColor: '#6366F1',
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.18)',
          },
          '&:active': {
            transform: 'translateY(0)',
          }
        }}
      >
        <Shield size={14} style={{ color: kindColors[sendKind] || '#6366F1' }} />
        <Typography
          variant="body2"
          component="span"
          sx={{
            fontWeight: 700,
            fontSize: '0.82rem',
            color: 'rgba(255, 255, 255, 0.95)',
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {loading ? 'Decrypting...' : error === 'Expired' ? 'Expired Relay' : error === 'Error' ? 'Secure Relay' : decryptedTitle}
        </Typography>

        {meta && isSendObjectMeta(meta) && (
          <Box
            component="span"
            sx={{
              fontSize: '0.62rem',
              fontWeight: 900,
              px: 1,
              py: 0.25,
              borderRadius: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              bgcolor: alpha(kindColors[sendKind] || '#6366F1', 0.12),
              color: kindColors[sendKind] || '#6366F1',
              border: `1px solid ${alpha(kindColors[sendKind] || '#6366F1', 0.25)}`
            }}
          >
            {sendKind}
          </Box>
        )}
      </Box>

      {/* Slide-out Flap-Over Panel */}
      {isDrawerOpen && (
        <SendFlapOver
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          note={note}
          noteId={noteId}
          keyParam={keyParam}
          decryptedTitle={decryptedTitle}
        />
      )}
    </>
  );
}

interface FlowPresenceFlapOverProps {
  isOpen: boolean;
  onClose: () => void;
  task: any | null;
  taskId: string;
}

export function FlowPresenceFlapOver({
  isOpen,
  onClose,
  task,
  taskId
}: FlowPresenceFlapOverProps) {
  const { user } = useAppwriteVault();
  const { openCallLauncher } = useCallLauncher();

  const handleJoinCall = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const participantIds = Array.from(new Set([task?.creatorId || '', ...(task?.assigneeIds || [])].filter(Boolean)));
    openCallLauncher({
      source: 'task',
      taskId: taskId,
      participantIds,
      title: task?.title ? `Task Huddle: ${task.title}` : 'Task Huddle',
    });
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={isOpen}
      onClose={onClose}
      keepMounted={false}
      disablePortal={true}
      slotProps={{
        backdrop: {
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
          }
        }
      }}
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: '420px' },
          bgcolor: '#0A0908',
          color: '#fff',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2.5, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
          <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.6)', '&:hover': { color: '#fff' } }}>
            <ArrowLeft size={18} />
          </IconButton>
          <Box sx={{ overflow: 'hidden' }}>
            <Typography variant="body1" sx={{ fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {task?.title || 'Milestone discussion'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#A855F7', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
              Milestone Feed
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#fff' } }}>
          <X size={18} />
        </IconButton>
      </Box>

      {/* WebRTC Live Huddle Entry */}
      <Box sx={{ px: 3, pt: 3 }}>
        <Button
          fullWidth
          variant="contained"
          onClick={handleJoinCall}
          sx={{
            bgcolor: 'rgba(161, 161, 170, 0.08)',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            py: 1.25,
            '&:hover': {
              bgcolor: 'rgba(161, 161, 170, 0.15)',
              borderColor: 'rgba(255, 255, 255, 0.16)'
            }
          }}
        >
          Join Live WebRTC Huddle
        </Button>
      </Box>

      {/* Discussion Thread Panel */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <HuddleChatWindow
          chatNoteId={taskId}
          user={user}
          title={task?.title || 'Goal Discussion'}
          standalone={true}
          onBack={onClose}
        />
      </Box>
    </Drawer>
  );
}

export function FlowPresencePulseLink({ href, children }: { href: string; children?: React.ReactNode }) {
  const taskId = href.replace('source:kylrixflow:', '').replace('source:kylrixgoal:', '');
  const { getCachedData, setCachedData } = useDataNexus();
  const { resourcePresence } = usePresence();
  const { openCallLauncher } = useCallLauncher();
  const [task, setTask] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch task metadata
  const loadTask = useCallback(async () => {
    const cacheKey = `task_meta_${taskId}`;
    const cached = getCachedData<any>(cacheKey);
    if (cached) {
      setTask(cached);
      return;
    }
    setLoading(true);
    try {
      const fetched = await getRowSecure(
        APPWRITE_CONFIG.DATABASES.FLOW,
        APPWRITE_CONFIG.TABLES.FLOW.TASKS,
        taskId
      );
      if (fetched) {
        setTask(fetched);
        setCachedData(cacheKey, fetched);
      }
    } catch (err) {
      console.warn('[FlowPresencePulseLink] Error loading task:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId, getCachedData, setCachedData]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  // Check if teammates are active in task huddle or project thread
  const activeTeammates = resourcePresence[taskId] || [];
  const projectTeammates = task?.projectId ? (resourcePresence[task.projectId] || []) : [];
  const hasPresence = activeTeammates.length > 0 || projectTeammates.length > 0;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDrawerOpen(true);
  };

  const isGoal = href.startsWith('source:kylrixgoal:');
  const themeColor = isGoal ? '#F59E0B' : '#A855F7'; // Amber for Goal, Purple for Flow

  return (
    <>
      <Box
        component="span"
        onClick={handleClick}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          color: themeColor,
          fontWeight: 700,
          cursor: 'pointer',
          verticalAlign: 'middle',
          mx: 0.5,
          position: 'relative',
          transition: 'color 0.2s',
          '&:hover': {
            color: alpha(themeColor, 0.8),
          }
        }}
      >
        {children || task?.title || 'Milestone'}

        {/* Pulse Dot */}
        {hasPresence && (
          <Box
            component="span"
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#A1A1AA', // ash color
              boxShadow: '0 0 6px rgba(161, 161, 170, 0.6)',
              display: 'inline-block',
              animation: 'ashPresencePulse 2s infinite',
              '@keyframes ashPresencePulse': {
                '0%': {
                  boxShadow: '0 0 0 0 rgba(161, 161, 170, 0.4)',
                },
                '70%': {
                  boxShadow: '0 0 0 6px rgba(161, 161, 170, 0)',
                },
                '100%': {
                  boxShadow: '0 0 0 0 rgba(161, 161, 170, 0)',
                }
              }
            }}
          />
        )}
      </Box>

      {/* Slide-out Flap-Over Panel */}
      {isDrawerOpen && (
        <FlowPresenceFlapOver
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          task={task}
          taskId={taskId}
        />
      )}
    </>
  );
}

export function KylrixFormBadgeLink({ href, formId, children }: { href: string; formId: string; children?: React.ReactNode }) {
  const { open } = useUnifiedDrawer();
  const { getCachedData, setCachedData } = useDataNexus();
  const [formTitle, setFormTitle] = useState<string>('');

  useEffect(() => {
    if (!formId) return;
    const cacheKey = `form_title_meta_${formId}`;
    const cached = getCachedData<string>(cacheKey);
    if (cached) {
      setFormTitle(cached);
      return;
    }
    
    // Asynchronously fetch name/title of form to enrich label
    import('@/lib/services/forms').then(async ({ FormsService }) => {
      try {
        const data = await FormsService.getForm(formId);
        if (data?.title) {
          setFormTitle(data.title);
          setCachedData(cacheKey, data.title);
        }
      } catch (e) {
        console.warn('[KylrixFormBadgeLink] Fail to fetch form title:', e);
      }
    });
  }, [formId, getCachedData, setCachedData]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    open('form', { formId });
  };

  return (
    <Box
      component="span"
      onClick={handleClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        color: '#10B981', // green accent color for forms/intake
        fontWeight: 700,
        cursor: 'pointer',
        verticalAlign: 'middle',
        mx: 0.5,
        borderBottom: '1px solid transparent',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          color: alpha('#10B981', 0.85),
          borderBottomColor: alpha('#10B981', 0.4),
          bgcolor: alpha('#10B981', 0.05),
          borderRadius: '4px',
          px: 0.5,
          mx: 0
        }
      }}
    >
      <span>{children || formTitle || 'Fill Form'}</span>
    </Box>
  );
}

