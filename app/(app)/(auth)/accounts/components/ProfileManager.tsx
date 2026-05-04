'use client';

import { useState, useEffect } from 'react';
import { account, AppwriteService, client } from '@/lib/appwrite';
import { useColors } from '@/lib/theme-context';
import { Storage, ID } from 'appwrite';
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Stack,
  alpha,
  IconButton
} from "@mui/material";
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  InfoOutlined as InfoIcon,
  PhotoCamera as PhotoCameraIcon
} from "@mui/icons-material";
import { IdentityAvatar, IdentityName, computeIdentityFlags } from './IdentityBadge';

const storage = new Storage(client);
const AVATAR_BUCKET_ID = 'profile_pictures';

interface ProfileManagerProps {
  onProfileUpdate?: (data: { name?: string; username?: string; profilePicId?: string | null }) => void;
}

export default function ProfileManager({ onProfileUpdate }: ProfileManagerProps) {
  const dynamicColors = useColors();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [isRemovingPic, setIsRemovingPic] = useState(false);
  const [profileRecord, setProfileRecord] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProfileRecord = async () => {
      if (!user?.$id) return;
      try {
        const status = await AppwriteService.getGlobalProfileStatus(user.$id);
        if (!mounted) return;
        setProfileRecord(status?.profile || null);
      } catch (_err) {
        // keep local render working if profile lookup fails
      }
    };
    loadProfileRecord();
    return () => { mounted = false; };
  }, [user?.$id]);

  const identitySignals = computeIdentityFlags({
    createdAt: user?.$createdAt || user?.createdAt || null,
    lastUsernameEdit: user?.prefs?.last_username_edit || profileRecord?.last_username_edit || null,
    profilePicId: user?.prefs?.profilePicId || profileRecord?.profilePicId || null,
    username: user?.prefs?.username || profileRecord?.username || null,
    bio: user?.prefs?.bio || profileRecord?.bio || null,
    tier: profileRecord?.tier || user?.prefs?.tier || null,
    publicKey: profileRecord?.publicKey || null,
    emailVerified: Boolean(user?.emailVerification),
  });

  const loadUser = async () => {
    try {
      setLoading(true);
      const userData = await account.get();
      setUser(userData);
      setName(userData.name || '');
      setUsername(userData.prefs?.username || '');
      
      const picId = userData.prefs?.profilePicId;
      if (picId) {
        try {
          const url = storage.getFilePreview(AVATAR_BUCKET_ID, picId, 320, 320);
          setProfilePicUrl(url.toString());
        } catch (_e: unknown) {
          console.warn('Failed to load avatar preview');
        }
      }
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePic(file);
      setProfilePicUrl(URL.createObjectURL(file));
    }
  };

  const handleRemovePic = async () => {
    if (!user?.prefs?.profilePicId) return;
    
    setIsRemovingPic(true);
    setError(null);
    try {
      const oldId = user.prefs.profilePicId;
      
      // Update prefs first
      const newPrefs = { ...user.prefs, profilePicId: null };
      await account.updatePrefs(newPrefs);
      
      // Attempt to delete from storage (best effort)
      try {
        await storage.deleteFile(AVATAR_BUCKET_ID, oldId);
      } catch (_e: unknown) {
        console.warn('Failed to delete old avatar from storage');
      }
      
      setProfilePicUrl(null);
      setProfilePic(null);
      setUser({ ...user, prefs: newPrefs });
      setSuccess('Profile picture removed');
      
      if (onProfileUpdate) {
        onProfileUpdate({ profilePicId: null });
      }

      // Sync to global directory
      await AppwriteService.ensureGlobalProfile({ ...user, prefs: newPrefs }, true);
    } catch (_err: unknown) {
      setError('Failed to remove profile picture');
    } finally {
      setIsRemovingPic(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const currentPrefs = { ...(user.prefs || {}) };
      const updatedUser = { ...user };

      // 1. Handle Profile Picture Upload
      if (profilePic) {
        try {
          const uploadedFile = await storage.createFile(AVATAR_BUCKET_ID, ID.unique(), profilePic);
          const oldId = currentPrefs.profilePicId;
          
          currentPrefs.profilePicId = uploadedFile.$id;
          await account.updatePrefs(currentPrefs);
          
          if (oldId) {
            try { await storage.deleteFile(AVATAR_BUCKET_ID, oldId); } catch (_e: unknown) {}
          }
        } catch (_e: unknown) {
          throw new Error('Failed to upload profile picture');
        }
      }

      // 2. Handle Name Update
      if (name !== user.name) {
        await account.updateName(name);
        updatedUser.name = name;
      }

      // 3. Handle Username Update
      const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
      if (cleanUsername !== (user.prefs?.username || '')) {
        currentPrefs.username = cleanUsername;
        currentPrefs.last_username_edit = new Date().toISOString();
        await account.updatePrefs(currentPrefs);
      }

      const finalUser = { ...updatedUser, prefs: currentPrefs };
      setUser(finalUser);
      setProfilePic(null);

      const syncType = name !== user.name || username !== (user.prefs?.username || '')
        ? 'username_change'
        : 'profile_sync';
      await AppwriteService.recordProfileEvent({
        type: syncType,
        userId: user.$id,
        newUsername: username ? username.toLowerCase().trim() : undefined,
        profilePatch: {
          username: username ? username.toLowerCase().trim() : undefined,
          displayName: name || updatedUser.name,
          bio: user.prefs?.bio || '',
          profilePicId: currentPrefs.profilePicId || null,
        },
        metadata: {
          source: 'accounts.profile-manager',
        },
      });
      
      if (onProfileUpdate) {
        onProfileUpdate({ 
          name: updatedUser.name, 
          username: cleanUsername, 
          profilePicId: currentPrefs.profilePicId 
        });
      }

      // 4. Force sync to global directory (Kylrix Connect)
      await AppwriteService.ensureGlobalProfile(finalUser, true);
      
      setSuccess('Profile updated successfully');
    } catch (_err: unknown) {
      const err = _err as any;
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={40} sx={{ color: dynamicColors.primary }} />
      </Box>
    );
  }

  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : user?.email?.[0].toUpperCase();
  const brandIndigo = '#6366F1';

  return (
    <Box>
       {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 4, 
            borderRadius: '12px', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            '& .MuiAlert-icon': { color: '#ef4444' }
          }}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 4, 
            borderRadius: '12px', 
            backgroundColor: 'rgba(34, 197, 94, 0.1)', 
            color: '#22c55e',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            '& .MuiAlert-icon': { color: '#22c55e' }
          }}
        >
          {success}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={6} alignItems={{ xs: 'center', md: 'flex-start' }}>
        <Box sx={{ textAlign: 'center' }}>
          {!profilePic && (
            <>
              <Box sx={{ position: 'relative', mb: 3 }}>
                <IdentityAvatar
                  src={user?.prefs?.profilePicId ? profilePicUrl : undefined}
                  alt={name || user?.email || 'profile'}
                  fallback={initials || 'U'}
                  verified={identitySignals.verified}
                  pro={identitySignals.pro}
                  size={160}
                  verifiedSize={26}
                  borderRadius="28px"
                />
                <IconButton
                  component="label"
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    bgcolor: brandIndigo,
                    color: 'white',
                    '&:hover': { bgcolor: '#4f46e5' },
                    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                    width: 40,
                    height: 40,
                    border: '2px solid #000'
                  }}
                >
                  <input hidden accept="image/*" type="file" onChange={handleFileChange} />
                  <PhotoCameraIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>

              <Stack direction="row" spacing={1} justifyContent="center">
                {user?.prefs?.profilePicId && (
                  <Button
                    size="small"
                    variant="text"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleRemovePic}
                    disabled={isRemovingPic || saving}
                    sx={{ 
                      borderRadius: '12px', 
                      textTransform: 'none', 
                      fontWeight: 700,
                      '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.1)' }
                    }}
                  >
                    Remove Photo
                  </Button>
                )}
              </Stack>
            </>
          )}

          {profilePic && profilePicUrl && (
            <>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, textTransform: 'uppercase', mb: 1.5, fontFamily: '"JetBrains Mono", monospace' }}>
                Preview
              </Typography>
              <Box sx={{ position: 'relative', mb: 3, display: 'inline-block' }}>
                <IdentityAvatar
                  src={profilePicUrl}
                  alt={name || user?.email || 'profile'}
                  fallback={initials || 'U'}
                  isPreview={true}
                  size={160}
                  verifiedSize={26}
                  borderRadius="28px"
                />
              </Box>
              <Typography sx={{ fontSize: '0.75rem', color: 'rgba(99, 102, 241, 0.7)', mb: 2, fontFamily: '"JetBrains Mono", monospace', fontStyle: 'italic' }}>
                Click &quot;Update Ecosystem Identity&quot; to save
              </Typography>
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={() => {
                  setProfilePic(null);
                  setProfilePicUrl(null);
                }}
                disabled={saving}
                sx={{ 
                  borderRadius: '12px', 
                  textTransform: 'none', 
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': { 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.8)'
                  }
                }}
              >
                Discard Selected
              </Button>
            </>
          )}
        </Box>

        <Stack spacing={4} sx={{ flex: 1, width: '100%' }}>
          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, textTransform: 'uppercase', mb: 1, ml: 1, fontFamily: '"JetBrains Mono", monospace' }}>Display Name</Typography>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder="Your full name"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&.Mui-focused fieldset': { borderColor: brandIndigo },
                }
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, textTransform: 'uppercase', mb: 1, ml: 1, fontFamily: '"JetBrains Mono", monospace' }}>Ecosystem Handle</Typography>
            <TextField
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              fullWidth
              variant="outlined"
              placeholder="username"
              InputProps={{
                startAdornment: <Typography sx={{ color: brandIndigo, mr: 0.5, fontWeight: 900, fontSize: '1.2rem' }}>@</Typography>
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  borderRadius: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '1rem',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&.Mui-focused fieldset': { borderColor: brandIndigo },
                }
              }}
            />
            {user?.prefs?.last_username_edit && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', mt: 1.5, ml: 1, display: 'flex', alignItems: 'center', gap: 0.75, fontFamily: '"JetBrains Mono", monospace', fontSize: '0.7rem' }}>
                <InfoIcon sx={{ fontSize: '0.9rem', color: brandIndigo }} />
                IDENTITY LAST SYNCED: {new Date(user.prefs.last_username_edit).toLocaleDateString().toUpperCase()}
              </Typography>
            )}
          </Box>

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || (name === user.name && username === (user.prefs?.username || '') && !profilePic)}
            sx={{
              py: 2,
              borderRadius: '16px',
              bgcolor: brandIndigo,
              color: 'white',
              fontWeight: 800,
              fontSize: '1rem',
              textTransform: 'none',
              boxShadow: `0 8px 24px ${alpha(brandIndigo, 0.2)}`,
              '&:hover': { 
                bgcolor: '#4f46e5',
                boxShadow: `0 12px 32px ${alpha(brandIndigo, 0.3)}`,
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                color: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }
            }}
          >
            {saving ? 'Synchronizing Profile...' : 'Update Ecosystem Identity'}
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IdentityName verified={identitySignals.verified} sx={{ color: 'white', fontWeight: 800 }}>
              {name || user?.email}
            </IdentityName>
            {identitySignals.pro && (
              <Typography sx={{ color: '#6366F1', fontWeight: 800, fontSize: '0.8rem' }}>PRO</Typography>
            )}
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
