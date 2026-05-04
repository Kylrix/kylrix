'use client';

import { useState, useEffect, ReactElement } from 'react';
import { account } from '@/lib/appwrite';
import {
  Box,
  Typography,
  Button,
  Alert,
  AlertTitle,
  CircularProgress,
  Stack,
  Drawer,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { Models } from 'appwrite';

type Identity = Models.Identity;

interface ConnectedIdentitiesProps {
  onIdentitiesLoaded?: (count: number) => void;
}

const PROVIDER_LOGOS: Record<string, string> = {
  google: '🔵',
  github: '⚫',
  facebook: '👍',
  apple: '🍎',
  discord: '💜',
  twitter: '🐦',
  microsoft: '💻',
  linkedin: '💼',
  amazon: '🛒',
  reddit: '🔴',
  twitch: '💬',
  spotify: '🎵',
};

const PROVIDER_ICONS: Record<string, ReactElement> = {
  google: (
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
  github: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  ),
};

const PROVIDER_NAMES: Record<string, string> = {
  google: 'Google',
  github: 'GitHub',
  facebook: 'Facebook',
  apple: 'Apple',
  discord: 'Discord',
  twitter: 'Twitter/X',
  microsoft: 'Microsoft',
  linkedin: 'LinkedIn',
  amazon: 'Amazon',
  reddit: 'Reddit',
  twitch: 'Twitch',
  spotify: 'Spotify',
};

export default function ConnectedIdentities({ onIdentitiesLoaded }: ConnectedIdentitiesProps) {
  const [loading, setLoading] = useState(true);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadIdentities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadIdentities = async () => {
    try {
      setLoading(true);
      setError(null);
      const identityList = await account.listIdentities();
      setIdentities(identityList.identities || []);
      onIdentitiesLoaded?.((identityList.identities || []).length);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (identity: Identity) => {
    setSelectedIdentity(identity);
    setDeleteDrawerOpen(true);
  };

  const handleDeleteIdentity = async () => {
    if (!selectedIdentity) return;
    try {
      setDeleting(true);
      setError(null);
      await account.deleteIdentity(selectedIdentity.$id);
      setIdentities(identities.filter((i) => i.$id !== selectedIdentity.$id));
      setDeleteDrawerOpen(false);
      setSelectedIdentity(null);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const getProviderLogo = (provider: string): ReactElement | string => {
    if (provider === 'google' || provider === 'github') {
      return PROVIDER_ICONS[provider] || PROVIDER_LOGOS[provider] || '🔗';
    }
    return PROVIDER_LOGOS[provider] || '🔗';
  };

  const getProviderName = (provider: string): string => {
    return PROVIDER_NAMES[provider] || provider;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && identities.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={40} sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#FCA5A5', borderRadius: '10px' }}>
          <AlertTitle sx={{ fontWeight: 700 }}>Error</AlertTitle>
          {error}
        </Alert>
      )}

      {identities.length === 0 ? (
        <Box
          sx={{
            backgroundColor: '#161514',
            borderRadius: '12px',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.95rem' }}>
            No connected identities. Connect a social account to link your profile.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={4}>
          {identities.map((identity) => (
            <Box
              key={identity.$id}
              sx={{
                backgroundColor: '#161514',
                borderRadius: '12px',
                p: 2,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
                overflow: 'hidden',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: '#1F1D1B',
                },
              }}
            >
              {/* Content Section */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 44,
                      height: 44,
                      borderRadius: '10px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)',
                      fontSize: '1.5rem',
                      color: '#FFFFFF',
                      flexShrink: 0,
                      '& svg': { width: 24, height: 24 },
                    }}
                  >
                    {getProviderLogo(identity.provider)}
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getProviderName(identity.provider)}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {identity.providerEmail || identity.providerUid}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 4, mt: 2.5, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Connected
                    </Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, mt: 0.5 }}>
                      {formatDate(identity.$createdAt)}
                    </Typography>
                  </Box>
                  {identity.providerAccessTokenExpiry && (
                    <Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Token Expires
                      </Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, mt: 0.5 }}>
                        {formatDate(identity.providerAccessTokenExpiry)}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Delete Button */}
              <IconButton
                onClick={() => handleDeleteClick(identity)}
                sx={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  margin: 0,
                  flexShrink: 0,
                  color: '#EF4444',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  transition: 'all 0.2s ease-out',
                  '&:hover': {
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                  },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DeleteIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Box>
          ))}
        </Stack>
      )}

      {/* Delete Confirmation Bottom Drawer */}
      <Drawer
        anchor="bottom"
        open={deleteDrawerOpen}
        onClose={() => setDeleteDrawerOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: '#161514',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#FFFFFF', mb: 1.5 }}>
              Disconnect Identity
            </Typography>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.6 }}>
              Are you sure you want to disconnect{' '}
              <Typography component="span" sx={{ color: '#FFFFFF', fontWeight: 600 }}>
                {selectedIdentity && getProviderName(selectedIdentity.provider)}
              </Typography>
              ? You will no longer be able to login with this account.
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
            <Button
              onClick={handleDeleteIdentity}
              disabled={deleting}
              variant="contained"
              fullWidth
              sx={{
                backgroundColor: '#EF4444',
                color: '#FFFFFF',
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.5,
                fontSize: '1rem',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: '#DC2626',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(239, 68, 68, 0.5)',
                },
              }}
            >
              {deleting ? 'Disconnecting...' : 'Disconnect'}
            </Button>
            <Button
              onClick={() => setDeleteDrawerOpen(false)}
              fullWidth
              sx={{
                color: '#FFFFFF',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.5,
                fontSize: '1rem',
                backgroundColor: 'transparent',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
              }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      </Drawer>
    </Box>
  );
}
