'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Typography, Button, Paper, Stack, CircularProgress, alpha, Chip, Container } from '@/lib/mui-tailwind/material';
import { ShieldAlert, CheckCircle, ArrowRight, LogIn, ExternalLink } from 'lucide-react';
import { useAuth } from '@/context/auth/AuthContext';
import { account } from '@/lib/appwrite/client';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { getProjectInviteDetailsSecure, acceptProjectInviteSecure } from '@/lib/actions/secure-ops';
import { IdentityAvatar } from '@/components/common/IdentityBadge';
import { AppwriteService } from '@/lib/appwrite';

export default function ProjectInvitePage() {
  const { projectId } = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { open: openUnified } = useUnifiedDrawer();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteData, setInviteDetails] = useState<any | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<any | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setLoading(false);
      return;
    }

    const loadDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const { jwt } = await account.createJWT();
        const data = await getProjectInviteDetailsSecure(projectId as string, jwt);
        
        if (!data) {
          setError("This project workspace does not exist, or you do not have permission to access it.");
          return;
        }

        setInviteDetails(data);

        // Fetch owner details for a personalized premium feel
        if (data.project?.ownerId) {
          try {
            const users = await AppwriteService.getUsersByIds([data.project.ownerId]);
            if (users && users[0]) {
              setOwnerProfile(users[0]);
            }
          } catch (e) {
            console.warn('Failed to resolve owner details for invite:', e);
          }
        }

        // If they are already an active collaborator or owner, redirect to the full app projects dashboard!
        if (!data.isPending) {
          router.replace(`/projects/${projectId}`);
        }
      } catch (err: any) {
        console.error('Failed to load project details secure:', err);
        setError(err.message || "You do not have permission to view this project.");
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [user, authLoading, projectId, router]);

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      const { jwt } = await account.createJWT();
      await acceptProjectInviteSecure(projectId as string, jwt);
      router.push(`/projects/${projectId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation. Please try again.');
      setAccepting(false);
    }
  };

  const renderShell = (content: React.ReactNode) => (
    <Box sx={{ minHeight: '85vh', bgcolor: '#0A0908', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Container maxWidth="xs" sx={{ p: 0 }}>
        {content}
      </Container>
    </Box>
  );

  // 1. Loading States
  if (authLoading || loading) {
    return renderShell(
      <Stack spacing={3} alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress size={40} sx={{ color: '#6366F1' }} />
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
          Authenticating secure workspace connection...
        </Typography>
      </Stack>
    );
  }

  // 2. Unauthenticated State
  if (!user) {
    return renderShell(
      <Paper elevation={0} sx={{ p: 4, borderRadius: '28px', bgcolor: '#161412', border: '1px solid #1C1A18', textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: '#F59E0B', marginBottom: '16px' }} />
        <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', mb: 1, letterSpacing: '-0.02em' }}>
          Secure Workspace
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6, mb: 4 }}>
          This project details page is private and secure. Please log in or pair your account to view the invitation.
        </Typography>
        <Button
          variant="contained"
          fullWidth
          startIcon={<LogIn size={18} />}
          onClick={() => openUnified('login')}
          sx={{ borderRadius: '14px', py: 1.75, bgcolor: '#6366F1', color: '#000', fontWeight: 900, fontFamily: 'var(--font-satoshi)', textTransform: 'none', '&:hover': { bgcolor: alpha('#6366F1', 0.9) } }}
        >
          Sign In to Join
        </Button>
      </Paper>
    );
  }

  // 3. Error / Access Denied States
  if (error) {
    return renderShell(
      <Paper elevation={0} sx={{ p: 4, borderRadius: '28px', bgcolor: '#161412', border: '1px solid #1C1A18', textAlign: 'center' }}>
        <ShieldAlert size={48} style={{ color: '#FF453A', marginBottom: '16px' }} />
        <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', mb: 1.5, letterSpacing: '-0.02em' }}>
          Access Denied
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-satoshi)', lineHeight: 1.6, mb: 4 }}>
          {error}
        </Typography>
        <Button
          variant="outlined"
          fullWidth
          onClick={() => router.push('/projects')}
          sx={{ borderRadius: '14px', py: 1.5, borderColor: '#1C1A18', color: 'rgba(255,255,255,0.6)', fontWeight: 800, fontFamily: 'var(--font-satoshi)', textTransform: 'none', '&:hover': { borderColor: 'rgba(255,255,255,0.15)' } }}
        >
          Return to Dashboard
        </Button>
      </Paper>
    );
  }

  // 4. Pending Invitation Screen
  if (inviteData?.isPending) {
    return renderShell(
      <Paper elevation={0} sx={{ p: 4, borderRadius: '28px', bgcolor: '#161412', border: '1px solid #1C1A18', textAlign: 'center' }}>
        <Stack spacing={3} alignItems="center" sx={{ mb: 4 }}>
          {/* Owner Identity Badge */}
          <Box sx={{ position: 'relative' }}>
            <IdentityAvatar
              size={64}
              fileId={ownerProfile?.profilePicId || ownerProfile?.avatar || null}
              alt={ownerProfile?.displayName || ownerProfile?.name || 'Owner'}
              fallback={(ownerProfile?.displayName || ownerProfile?.name || 'O').charAt(0).toUpperCase()}
              verified={ownerProfile?.verified ?? true}
            />
          </Box>
          <Box>
            <Chip 
              label="Pending Invitation" 
              size="small" 
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 900, fontFamily: 'var(--font-satoshi)', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', border: '1px solid rgba(245, 158, 11, 0.15)', mb: 1.5 }} 
            />
            <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', mb: 1 }}>
              {inviteData.project?.title || 'Project Workspace'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-satoshi)', lineHeight: 1.5 }}>
              <b>{ownerProfile?.displayName || ownerProfile?.name || 'A teammate'}</b> has invited you to collaborate as an <b>{inviteData.role}</b>.
            </Typography>
          </Box>
        </Stack>

        {/* Project Summary Preview Box */}
        {inviteData.project?.summary && (
          <Box sx={{ p: 2, borderRadius: '16px', bgcolor: '#0A0908', border: '1px solid #1C1A18', textAlign: 'left', mb: 4 }}>
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.65rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', mb: 1, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-satoshi)' }}>
              Project Scope
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-satoshi)', fontSize: '0.82rem', lineHeight: 1.5 }}>
              {inviteData.project.summary}
            </Typography>
          </Box>
        )}

        <Stack spacing={2}>
          <Button
            variant="contained"
            fullWidth
            onClick={handleAccept}
            disabled={accepting}
            endIcon={accepting ? <CircularProgress size={18} color="inherit" /> : <ArrowRight size={18} />}
            sx={{ borderRadius: '14px', py: 1.75, bgcolor: '#6366F1', color: '#000', fontWeight: 900, fontFamily: 'var(--font-satoshi)', textTransform: 'none', '&:hover': { bgcolor: alpha('#6366F1', 0.9) } }}
          >
            {accepting ? 'Connecting...' : 'Accept & Join Project'}
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => router.push('/projects')}
            sx={{ borderRadius: '14px', py: 1.5, borderColor: '#1C1A18', color: 'rgba(255,255,255,0.6)', fontWeight: 800, fontFamily: 'var(--font-satoshi)', textTransform: 'none', '&:hover': { borderColor: 'rgba(255,255,255,0.15)', bgcolor: 'rgba(255,255,255,0.01)' } }}
          >
            Decline
          </Button>
        </Stack>
      </Paper>
    );
  }

  // 5. Active Collaborator redirect fallback
  return renderShell(
    <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ py: 8 }}>
      <CircularProgress size={30} sx={{ color: '#6366F1' }} />
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
        Redirecting to project workspace...
      </Typography>
    </Stack>
  );
}
