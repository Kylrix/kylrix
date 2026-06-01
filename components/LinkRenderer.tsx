import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, Box, IconButton, Typography, Tooltip, CircularProgress, Button, alpha } from '@mui/material';
import { Play, Pause, Key, Lock, Shield, Copy, Check } from 'lucide-react';
import { StorageService } from '@/lib/services/storage';
import { useAppwriteVault } from '@/context/appwrite-context';
import { useDataNexus } from '@/context/DataNexusContext';
import { MasterPassDrawer } from '@/components/overlays/MasterPassDrawer';
import { authenticator } from 'otplib';
import toast from 'react-hot-toast';
import type { Credentials, TotpSecrets } from '@/types/appwrite';

export const generateTOTP = (
  secret: string,
  period: number = 30,
  digits: number = 6,
  algorithm: string = 'SHA1',
): string => {
  try {
    if (!secret || secret.includes('[DECRYPTION_FAILED]')) return 'Locked';
    const normalized = (secret || '').replace(/\s+/g, '').toUpperCase();
    if (!normalized) return '------';
    const algo = (algorithm || 'sha1').toLowerCase();

    authenticator.options = {
      step: period || 30,
      digits: digits || 6,
      // @ts-expect-error - types can be strict
      algorithm: algo,
      window: 0
    };

    return authenticator.generate(normalized);
  } catch (err: unknown) {
    console.warn('TOTP Generation warning for secret ending in ...', secret?.slice(-4), err);
    if (algorithm?.toLowerCase() !== 'sha1') {
      try {
        // @ts-expect-error - type mismatch
        authenticator.options = { step: 30, digits: 6, algorithm: 'sha1' };
        return authenticator.generate((secret || '').replace(/\s+/g, ''));
      } catch { }
    }
    return 'Invalid';
  }
};

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
      totpSecret.period || 30,
      totpSecret.digits || 6,
      totpSecret.algorithm || 'SHA1'
    );
  }, [totpSecret, currentTime]);

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
  
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
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

