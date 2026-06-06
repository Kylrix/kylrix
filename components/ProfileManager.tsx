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
  Camera,
  Trash2,
  Save,
  Info,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw
} from 'lucide-react';
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
      
      setError(null);
      try {
        // Attempt compression first to improve UX for large files
        const compressed = await compressImage(file, 512, 512, 0.7);
        
        if (compressed.size > 1024 * 1024) {
          setError('Maximum file size of 1MB exceeded even after compression.');
          return;
        }

        setProfilePic(compressed);
        setProfilePicUrl(URL.createObjectURL(compressed));
      } catch (err: any) {
        console.warn('Instant compression failed, checking original size:', err);
        
        // Fallback to original if compression fails, but enforce the limit
        if (file.size > 1024 * 1024) {
          setError('Maximum file size of 1MB exceeded.');
          return;
        }

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

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={8} alignItems={{ xs: 'center', md: 'flex-start' }}>
        <Box sx={{ textAlign: 'center', position: 'relative' }}>
          <Box sx={{ position: 'relative', mb: 3 }}>
            <IdentityAvatar
              src={profilePicUrl || (user?.prefs?.profilePicId ? profilePicUrl : undefined)}
              userId={user?.$id}
              alt={name || user?.email || 'profile'}
              fallback={initials || 'U'}
              verified={identitySignals.verified}
              pro={identitySignals.pro}
              size={180}
              verifiedSize={28}
              borderRadius="50%"
              isPreview={!!profilePic}
              sx={{
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              }}
            />
            
            {/* Upload Floating Action Button */}
            {!profilePic && (
              <Box
                component="label"
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: brandIndigo,
                  color: 'white',
                  '&:hover': { bgcolor: '#4f46e5', transform: 'scale(1.1)' },
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '3px solid #161514',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  zIndex: 10,
                }}
              >
                <input hidden accept="image/*" type="file" onChange={handleFileChange} />
                <Camera size={20} />
              </Box>
            )}

            {/* Clear/Reset selection if previewing */}
            {profilePic && (
              <IconButton
                onClick={() => {
                  setProfilePic(null);
                  setProfilePicUrl(user?.prefs?.profilePicId ? storage.getFilePreview(AVATAR_BUCKET_ID, user.prefs.profilePicId, 320, 320).toString() : null);
                }}
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: '#0A0908',
                  color: 'white',
                  '&:hover': { bgcolor: '#1C1A18', color: '#ef4444', transform: 'scale(1.1)' },
                  width: 32,
                  height: 32,
                  border: '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.2s ease',
                  zIndex: 10,
                }}
              >
                <RotateCcw size={16} />
              </IconButton>
            )}
          </Box>

          <Stack direction="row" spacing={1} justifyContent="center">
            {user?.prefs?.profilePicId && !profilePic && (
              <Button
                size="small"
                variant="text"
                color="error"
                startIcon={<Trash2 size={16} />}
                onClick={handleRemovePic}
                disabled={isRemovingPic || saving}
                sx={{ 
                  borderRadius: '12px', 
                  textTransform: 'none', 
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  letterSpacing: '0.02em',
                  opacity: 0.6,
                  '&:hover': { backgroundColor: 'rgba(239, 68, 68, 0.1)', opacity: 1 }
                }}
              >
                REMOVE PHOTO
              </Button>
            )}
          </Stack>
          
          {profilePic && (
             <Typography sx={{ fontSize: '10px', fontWeight: 900, color: brandIndigo, mt: 2, textTransform: 'uppercase', letterSpacing: '0.1em', animation: 'pulse 2s infinite' }}>
                Unsaved Preview
             </Typography>
          )}
        </Box>

        <Stack spacing={4} sx={{ flex: 1, width: '100%' }}>
          <Box>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', fontWeight: 900, textTransform: 'uppercase', mb: 1.5, ml: 0.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>Legal Identity</Typography>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              variant="outlined"
              placeholder="Your full name"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  borderRadius: '18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.015)',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.04)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                  '&.Mui-focused fieldset': { borderColor: brandIndigo, borderWidth: '2px' },
                }
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', fontWeight: 900, textTransform: 'uppercase', mb: 1.5, ml: 0.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>Ecosystem Handle</Typography>
            <TextField
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              fullWidth
              variant="outlined"
              placeholder="username"
              InputProps={{
                startAdornment: <Typography sx={{ color: brandIndigo, mr: 1, fontWeight: 900, fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>@</Typography>
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: 'white',
                  borderRadius: '18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.015)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.04)' },
                  '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.08)' },
                  '&.Mui-focused fieldset': { borderColor: brandIndigo, borderWidth: '2px' },
                }
              }}
            />
            {user?.prefs?.last_username_edit && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.25)', mt: 2, ml: 0.5, display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                <Info size={12} style={{ color: brandIndigo }} />
                LAST PROTOCOL SYNC: {new Date(user.prefs.last_username_edit).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}
              </Typography>
            )}
          </Box>

          <Box>
            <Typography sx={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.3)', fontWeight: 900, textTransform: 'uppercase', mb: 1.5, ml: 0.5, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>Presence & Visibility</Typography>
            <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'rgba(255, 255, 255, 0.01)', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
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
                        <Box sx={{ ml: 1 }}>
                            <Typography sx={{ color: 'white', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '-0.01em' }}>Broadcast Live Status</Typography>
                            <Typography sx={{ color: 'white/40', fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.4, mt: 0.25 }}>Enable real-time presence across Note, Flow, and Connect nodes.</Typography>
                        </Box>
                    }
                    sx={{ margin: 0, width: '100%', alignItems: 'flex-start' }}
                />
            </Paper>
          </Box>

          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save size={18} />}
            onClick={handleSave}
            disabled={saving || (name === user.name && username === (user.prefs?.username || '') && isOnlineVisible === (profileRecord?.isOnlineVisible !== false) && !profilePic)}
            sx={{
              py: 2.25,
              borderRadius: '18px',
              bgcolor: brandIndigo,
              color: 'white',
              fontWeight: 900,
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              boxShadow: `0 8px 32px ${alpha(brandIndigo, 0.25)}`,
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              '&:hover': { 
                bgcolor: '#4f46e5',
                boxShadow: `0 12px 48px ${alpha(brandIndigo, 0.4)}`,
                transform: 'translateY(-2px)'
              },
              '&.Mui-disabled': {
                bgcolor: 'rgba(255, 255, 255, 0.02)',
                color: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.04)'
              }
            }}
          >
            {saving ? 'Synchronizing Ecosystem Identity...' : 'Commit Profile Changes'}
          </Button>
          
          <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
             <div className="flex items-center gap-2">
                <IdentityName verified={identitySignals.verified} sx={{ color: 'white', fontWeight: 900, fontSize: '0.9rem' }}>
                  {name || user?.email}
                </IdentityName>
                {identitySignals.pro && (
                  <span className="bg-[#6366F1]/10 text-[#6366F1] text-[9px] font-black px-2 py-0.5 rounded-lg border border-[#6366F1]/20 uppercase tracking-widest">
                    PRO
                  </span>
                )}
             </div>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
