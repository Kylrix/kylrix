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
  IconButton,
  Switch,
  FormControlLabel,
  Paper
} from '@/lib/mui-tailwind/material';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  InfoOutlined as InfoIcon,
  PhotoCamera as PhotoCameraIcon
} from '@/lib/mui-tailwind/icons';
import { IdentityAvatar, IdentityName, computeIdentityFlags } from './IdentityBadge';
import { secureUploadFile } from '@/lib/actions/client-ops';

const storage = new Storage(client);
const AVATAR_BUCKET_ID = 'profile_pictures';

const compressImage = (file: File, maxWidth = 512, maxHeight = 512, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas compression failed'));
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

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
  const [isOnlineVisible, setIsOnlineVisible] = useState(true);

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
        if (status?.profile) {
            setIsOnlineVisible(status.profile.isOnlineVisible !== false);
        }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        return;
      }
      if (file.size > 1024 * 1024) {
        setError('Maximum file size of 1MB exceeded.');
        return;
      }
      setError(null);
      try {
        const compressed = await compressImage(file, 512, 512, 0.7);
        setProfilePic(compressed);
        setProfilePicUrl(URL.createObjectURL(compressed));
      } catch (err: any) {
        console.warn('Instant compression failed, using original:', err);
        setProfilePic(file);
        setProfilePicUrl(URL.createObjectURL(file));
      }
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
          // Strict check on the raw selected file size first: must be <= 1MB
          if (profilePic.size > 1024 * 1024) {
            throw new Error('Maximum file size of 1MB exceeded.');
          }
          const formData = new FormData();
          formData.append('file', profilePic);
          formData.append('bucketId', AVATAR_BUCKET_ID);
          const uploadedFile = await secureUploadFile(formData);
          const oldId = currentPrefs.profilePicId;
          
          currentPrefs.profilePicId = uploadedFile.$id;
          await account.updatePrefs(currentPrefs);
          
          if (oldId) {
            try { await storage.deleteFile(AVATAR_BUCKET_ID, oldId); } catch (_e: unknown) {}
          }
        } catch (_e: unknown) {
          const errMsg = _e instanceof Error ? _e.message : 'Failed to upload profile picture';
          throw new Error(errMsg);
        }
      }

      // 2. Handle Name Update
      if (name !== user.name) {
        await account.updateName(name);
        updatedUser.name = name;
      }

      // 3. Handle Username Update
      const cleanUsername = username.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');
      let prefsUpdated = false;
      
      if (cleanUsername !== (user.prefs?.username || '')) {
        currentPrefs.username = cleanUsername;
        currentPrefs.last_username_edit = new Date().toISOString();
        prefsUpdated = true;
      }
      if (currentPrefs.isOnlineVisible !== isOnlineVisible) {
        currentPrefs.isOnlineVisible = isOnlineVisible;
        prefsUpdated = true;
      }
      if (prefsUpdated) {
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
          isOnlineVisible: isOnlineVisible,
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

          <Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700, textTransform: 'uppercase', mb: 1, ml: 1, fontFamily: '"JetBrains Mono", monospace' }}>Privacy Settings</Typography>
            <Paper sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <FormControlLabel
                    control={
                        <Switch 
                            checked={isOnlineVisible}
                            onChange={(e) => setIsOnlineVisible(e.target.checked)}
                            sx={{
                                '& .MuiSwitch-switchBase.Mui-checked': { color: brandIndigo },
                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: brandIndigo },
                            }}
                        />
                    }
                    label={
                        <Box>
                            <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>Show Online Status</Typography>
                            <Typography variant="caption" sx={{ color: '#9B9691', display: 'block' }}>Allow others to see when you are active in the ecosystem.</Typography>
                        </Box>
                    }
                />
            </Paper>
          </Box>

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || (name === user.name && username === (user.prefs?.username || '') && isOnlineVisible === (profileRecord?.isOnlineVisible !== false) && !profilePic)}
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
