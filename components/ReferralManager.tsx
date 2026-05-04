'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { Check, Copy, Link as LinkIcon, Search } from 'lucide-react';
import { AppwriteService } from '@/lib/appwrite';

interface ReferralStatus {
  success?: boolean;
  hasReferral?: boolean;
  referralLink?: string | null;
  referrer?: {
    userId: string;
    username: string;
    displayName?: string;
    avatar?: string | null;
  } | null;
  referralEvent?: any;
  error?: string;
}

interface ReferralProfile {
  $id: string;
  userId?: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
}

export default function ReferralManager() {
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReferralProfile[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const hasReferral = Boolean(status?.hasReferral);
  const referralLink = status?.referralLink || null;

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const data = await AppwriteService.getReferralStatus();
    setStatus(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    let mounted = true;

    const t = setTimeout(async () => {
      if (!query.trim()) {
        setResults([]);
        return;
      }

      const docs = await AppwriteService.searchGlobalProfiles(query.trim(), 8);
      if (!mounted) return;
      setResults(docs as any as ReferralProfile[]);
    }, 250);

    return () => {
      mounted = false;
      clearTimeout(t);
    };
  }, [query]);

  const copyReferralLink = useCallback(async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setMessage('Referral link copied.');
  }, [referralLink]);

  const applyReferral = useCallback(async (profile: ReferralProfile) => {
    if (hasReferral || submitting) return;
    setSubmitting(true);
    setMessage(null);
    const res = await AppwriteService.applyReferral(profile.username, profile.userId || profile.$id);
    if (res?.success) {
      setStatus(prev => ({
        ...(prev || {}),
        hasReferral: true,
        referralEvent: res.referralEvent || prev?.referralEvent,
        referrer: res.referrer || prev?.referrer,
        referralLink: res.referralLink || prev?.referralLink,
      }));
      setMessage(`Referral linked to @${profile.username}.`);
      setQuery('');
      setResults([]);
    } else {
      setMessage(res?.error || 'Could not apply referral.');
    }
    setSubmitting(false);
  }, [hasReferral, submitting]);

  const referrerLabel = useMemo(() => {
    if (!status?.referrer) return 'No referral linked yet.';
    return `Referred by @${status.referrer.username}`;
  }, [status?.referrer]);

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: '24px',
        bgcolor: alpha('#161412', 0.85),
        border: '1px solid rgba(255,255,255,0.06)',
        backgroundImage: 'none',
      }}
    >
      <Stack spacing={2}>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: 'white' }}>
            Referral & Rewards
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.55)', mt: 0.5, fontSize: '0.92rem' }}>
            Your referral link is tied to your username and the record is kept in the account events table.
          </Typography>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <>
            {message && (
              <Alert severity="info" sx={{ bgcolor: alpha('#6366F1', 0.08), color: 'white' }}>
                {message}
              </Alert>
            )}

            <Box
              sx={{
                p: 2,
                borderRadius: '18px',
                bgcolor: '#0A0908',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', mb: 1 }}>
                Your referral link
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <LinkIcon size={16} color="#6366F1" />
                <Typography
                  sx={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.88rem',
                    color: 'white',
                    wordBreak: 'break-all',
                    flex: 1,
                  }}
                >
                  {referralLink || 'Set up your profile username to generate a link.'}
                </Typography>
                <Button
                  onClick={copyReferralLink}
                  disabled={!referralLink}
                  startIcon={<Copy size={14} />}
                  size="small"
                  sx={{
                    borderRadius: '10px',
                    fontWeight: 800,
                    color: '#6366F1',
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                  }}
                  variant="outlined"
                >
                  Copy
                </Button>
              </Stack>
            </Box>

            <Box
              sx={{
                p: 2,
                borderRadius: '18px',
                bgcolor: '#0A0908',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', mb: 1 }}>
                Referral status
              </Typography>
              <Typography sx={{ color: 'white', fontWeight: 700 }}>
                {referrerLabel}
              </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', mb: 1 }}>
                Manually add referrer
              </Typography>
              <TextField
                fullWidth
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type username"
                disabled={hasReferral}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search size={16} color="rgba(255,255,255,0.35)" />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#0A0908',
                    borderRadius: '14px',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.08)' },
                  },
                  '& input': { color: 'white' },
                }}
              />

              {results.length > 0 && !hasReferral && (
                <List disablePadding sx={{ mt: 1, maxHeight: 260, overflowY: 'auto' }}>
                  {results.map((profile) => (
                    <ListItem
                      key={profile.$id}
                      onClick={() => applyReferral(profile)}
                      sx={{
                        cursor: 'pointer',
                        borderRadius: '14px',
                        mb: 1,
                        bgcolor: '#1C1A18',
                        border: '1px solid rgba(255,255,255,0.05)',
                        '&:hover': { bgcolor: alpha('#6366F1', 0.08) },
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar src={profile.avatar || undefined} sx={{ bgcolor: '#6366F1' }}>
                          {(profile.displayName || profile.username || '?').charAt(0).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={profile.displayName || profile.username}
                        secondary={`@${profile.username}`}
                        primaryTypographyProps={{ sx: { color: 'white', fontWeight: 800 } }}
                        secondaryTypographyProps={{ sx: { color: 'rgba(255,255,255,0.45)' } }}
                      />
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          applyReferral(profile);
                        }}
                        variant="contained"
                        disabled={submitting}
                        startIcon={<Check size={14} />}
                        sx={{
                          bgcolor: '#6366F1',
                          color: '#000',
                          fontWeight: 800,
                          borderRadius: '10px',
                          '&:hover': { bgcolor: '#4F46E5' },
                        }}
                      >
                        Select
                      </Button>
                    </ListItem>
                  ))}
                </List>
              )}

              {hasReferral && (
                <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem' }}>
                  Referral is already locked in. You can still copy your link, but the referrer cannot be changed.
                </Typography>
              )}
            </Box>
          </>
        )}
      </Stack>
    </Paper>
  );
}
