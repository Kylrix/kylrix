'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Avatar,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  alpha,
} from '@mui/material';
import { Users, ShieldCheck, ArrowRight } from 'lucide-react';

import { AppShell } from '@/components/layout/AppShell';
import { account } from '@/lib/appwrite/client';
import { useAuth } from '@/lib/auth';
import { KYLRIX_AUTH_URI } from '@/lib/constants';

type InvitePreview = {
  resourceType: string;
  resourceId: string;
  name: string | null;
  avatarUrl: string | null;
  description: string | null;
  participantCount: number;
  inviteEnabled: boolean;
};

export default function GroupInvitePage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;
  const { user, isLoading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [requestState, setRequestState] = useState<'idle' | 'loading' | 'pending' | 'joined' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const buildAuthHeaders = async () => {
    const headers: Record<string, string> = {};
    const jwt = await account.createJWT().catch(() => null);
    if (jwt?.jwt) {
      headers.Authorization = `Bearer ${jwt.jwt}`;
    }
    return headers;
  };

  const inviteUrl = useMemo(() => {
    if (!conversationId || typeof window === 'undefined') return '';
    return `${window.location.origin}/groups/invite/${conversationId}`;
  }, [conversationId]);

  useEffect(() => {
    if (isLoading || user || !inviteUrl) return;

    const loginUrl = new URL('/login', 'https://accounts.kylrix.space');
    loginUrl.searchParams.set('source', inviteUrl);
    window.location.replace(loginUrl.toString());
  }, [inviteUrl, isLoading, user]);

  useEffect(() => {
    if (!conversationId || isLoading) return;

    let active = true;
    const loadPreview = async () => {
      setRequestState('loading');
      setError(null);

      try {
        const requesterId = user?.$id ? `&requesterId=${encodeURIComponent(user.$id)}` : '';
        const response = await fetch(
          `${KYLRIX_AUTH_URI}/api/connect/join-requests?resourceType=chat.conversation&resourceId=${encodeURIComponent(conversationId)}${requesterId}`,
          { credentials: 'include' }
        );

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Group does not exist');
        }

        if (!active) return;

        setPreview(data.resource || null);
        if (data.alreadyJoined || data.request?.status === 'accepted') {
          setRequestState('joined');
        } else if (data.request?.status === 'pending') {
          setRequestState('pending');
        } else {
          setRequestState('idle');
        }
      } catch (loadError: any) {
        if (!active) return;
        setPreview(null);
        setRequestState('error');
        setError(loadError?.message || 'Group does not exist');
      }
    };

    void loadPreview();
    return () => {
      active = false;
    };
  }, [conversationId, isLoading, user?.$id]);

  const handleRequestJoin = async () => {
    if (!conversationId) return;

    setRequestState('loading');
    setError(null);

    try {
      const authHeaders = user ? await buildAuthHeaders() : {};
      const response = await fetch(`${KYLRIX_AUTH_URI}/api/connect/join-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include',
        body: JSON.stringify({
          resourceType: 'chat.conversation',
          resourceId: conversationId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to request access');
      }

      if (data.alreadyJoined) {
        setRequestState('joined');
        router.push(`/chat/${conversationId}`);
        return;
      }

      setRequestState('pending');
    } catch (requestError: any) {
      setRequestState('error');
      setError(requestError?.message || 'Failed to request access');
    }
  };

  return (
    <AppShell>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Paper
          sx={{
            p: 3,
            borderRadius: 4,
            bgcolor: '#161412',
            border: '1px solid rgba(255,255,255,0.08)',
            backgroundImage: 'none',
          }}
        >
          <Stack spacing={2.5} alignItems="center" textAlign="center">
            <Avatar
              src={preview?.avatarUrl || undefined}
              imgProps={{ referrerPolicy: 'no-referrer' }}
              sx={{
                width: 72,
                height: 72,
                bgcolor: alpha('#F59E0B', 0.12),
                color: '#F59E0B',
                border: '1px solid rgba(255,255,255,0.08)',
                '& img': { objectFit: 'cover' },
              }}
            >
              <Users size={30} />
            </Avatar>

            <Box>
              <Typography sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.4rem' }}>
                {preview?.name || 'Group invite'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.68, mt: 0.75 }}>
                {preview?.description || 'Request access to this private group.'}
              </Typography>
            </Box>

            {preview ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="center">
                <ChipLike>{preview.participantCount} members</ChipLike>
                <ChipLike>Invite enabled</ChipLike>
              </Stack>
            ) : null}

            {requestState === 'error' ? (
              <Box sx={{ width: '100%' }}>
                <Typography sx={{ fontWeight: 800, color: '#F87171' }}>
                  {error || 'Group does not exist'}
                </Typography>
              </Box>
            ) : null}

            <Stack spacing={1.25} sx={{ width: '100%' }}>
              {requestState === 'joined' ? (
                <Typography variant="body2" sx={{ opacity: 0.72, fontWeight: 700 }}>
                  Already in group
                </Typography>
              ) : null}

              {requestState === 'joined' ? (
                <Button fullWidth variant="contained" endIcon={<ArrowRight size={16} />} onClick={() => router.push(`/chat/${conversationId}`)}>
                  Go to chat
                </Button>
              ) : requestState === 'pending' ? (
                <Button fullWidth variant="outlined" disabled>
                  Request pending
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<ShieldCheck size={16} />}
                  onClick={() => void handleRequestJoin()}
                  disabled={requestState === 'loading' || !preview}
                >
                  {preview ? 'Request access' : 'Loading...'}
                </Button>
              )}
            </Stack>

            {inviteUrl ? (
              <Typography variant="caption" sx={{ opacity: 0.45, wordBreak: 'break-all' }}>
                {inviteUrl}
              </Typography>
            ) : null}
          </Stack>
        </Paper>
      </Container>
    </AppShell>
  );
}

function ChipLike({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        px: 1.25,
        py: 0.5,
        borderRadius: 999,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.78rem',
        fontWeight: 700,
      }}
    >
      {children}
    </Box>
  );
}
