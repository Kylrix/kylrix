'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Avatar,
  Paper,
  Button,
  CircularProgress,
  Stack,
  alpha,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Chat as ChatIcon,
  Language as GlobeIcon,
  CalendarMonth as CalendarIcon,
  Description as NoteIcon,
  Verified as VerifiedIcon,
  ArrowBack as BackIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { getGlobalProfile, getProfilePicturePreview } from '@/lib/appwrite';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params.username as string;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      if (!username) return;
      setLoading(true);
      try {
        const data = await getGlobalProfile(username);
        setProfile(data);
        if (data) {
          const fileId = data.avatarFileId || data.profilePicId;
          if (fileId) {
            const url = await getProfilePicturePreview(fileId, 240, 240);
            setAvatarUrl(url);
          } else if (data.avatarUrl) {
            setAvatarUrl(data.avatarUrl);
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [username]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: '#000' }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#000', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontWeight: 900, mb: 2, letterSpacing: '-0.04em' }}>404</Typography>
        <Typography variant="h5" sx={{ color: 'rgba(255,255,255,0.5)', mb: 4, fontWeight: 500 }}>Entity &quot;@{username}&quot; not found in the Kylrix ecosystem.</Typography>
        <Button 
          variant="outlined" 
          onClick={() => router.push('/')}
          sx={{ borderRadius: '12px', borderColor: 'rgba(255,255,255,0.1)', color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'white' } }}
        >
          Return to Hub
        </Button>
      </Box>
    );
  }

  const apps = profile.appsActive || [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', color: 'white', pt: { xs: 4, md: 12 }, pb: 8 }}>
      <Container maxWidth="md">
        {/* Header Navigation */}
        <Box sx={{ mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton onClick={() => router.back()} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
            <BackIcon />
          </IconButton>
          <IconButton sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}>
            <ShareIcon />
          </IconButton>
        </Box>

        {/* Profile Card */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            borderRadius: '32px',
            bgcolor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(20px)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background Glow */}
          <Box sx={{
            position: 'absolute',
            top: '-10%',
            right: '-10%',
            width: '40%',
            height: '40%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
            filter: 'blur(40px)',
            zIndex: 0,
          }} />

          <Stack spacing={4} sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'center', md: 'flex-start' }, gap: 4 }}>
              <Avatar
                src={avatarUrl || undefined}
                sx={{
                  width: 140,
                  height: 140,
                  fontSize: 48,
                  fontWeight: 900,
                  bgcolor: '#6366F1',
                  color: '#000',
                  border: '4px solid rgba(255,255,255,0.05)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
                }}
              >
                {profile.username?.charAt(0).toUpperCase()}
              </Avatar>

              <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'center', md: 'flex-start' }, gap: 1, mb: 1 }}>
                  <Typography variant="h3" sx={{ fontWeight: 900, letterSpacing: '-0.03em', fontFamily: 'var(--font-clash-display, inherit)' }}>
                    {profile.displayName || profile.username}
                  </Typography>
                  <VerifiedIcon sx={{ color: '#6366F1', fontSize: 28 }} />
                </Box>
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, mb: 3, fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
                  @{profile.username}
                </Typography>
                
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, fontSize: '1.1rem', maxWidth: '600px' }}>
                  {profile.bio || 'This operative has not yet initialized their biographical data stream.'}
                </Typography>
              </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)' }} />

            {/* Ecosystem Presence */}
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', mb: 3 }}>
                ACTIVE NODE CONNECTIONS
              </Typography>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
                {apps.map((app: string) => (
                  <Paper
                    key={app}
                    sx={{
                      px: 3,
                      py: 1.5,
                      borderRadius: '16px',
                      bgcolor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.05)',
                        borderColor: alpha('#6366F1', 0.3),
                        transform: 'translateY(-2px)'
                      }
                    }}
                  >
                    {app === 'flow' && <CalendarIcon sx={{ fontSize: 20, color: '#6366F1' }} />}
                    {app === 'note' && <NoteIcon sx={{ fontSize: 20, color: '#10B981' }} />}
                    {app === 'connect' && <ChatIcon sx={{ fontSize: 20, color: '#00D1DA' }} />}
                    <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {app}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            </Box>

            {/* Actions */}
            <Box sx={{ pt: 2, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button
                variant="contained"
                startIcon={<ChatIcon />}
                onClick={() => window.location.href = `https://connect.kylrix.space/chat?userId=${profile.$id}`}
                sx={{
                  flex: 1,
                  py: 2,
                  borderRadius: '16px',
                  bgcolor: '#6366F1',
                  color: '#000',
                  fontWeight: 900,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                  '&:hover': { bgcolor: '#00D1DA' }
                }}
              >
                INITIALIZE CONTACT
              </Button>
              <Button
                variant="outlined"
                sx={{
                  flex: 1,
                  py: 2,
                  borderRadius: '16px',
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '1rem',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'white' }
                }}
              >
                SECURE HANDSHAKE
              </Button>
            </Box>
          </Stack>
        </Paper>

        {/* Footer Meta */}
        <Box sx={{ mt: 6, textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.2)', fontWeight: 600, letterSpacing: '0.05em' }}>
            KYLRIX ECOSYSTEM IDENTITY VERIFIED • {new Date(profile.$createdAt).getFullYear()}
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
