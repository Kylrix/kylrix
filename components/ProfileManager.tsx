'use client';

import React, { useState, useEffect } from 'react';
import { Camera, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { account, client } from '@/lib/appwrite/client';
import { Storage } from 'appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
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
              lastModified: Date.now()});
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
  onProfileUpdate?: (data: any) => void;
}

export default function ProfileManager({ onProfileUpdate }: ProfileManagerProps) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [isGuest, setIsGuest] = useState<boolean>(true);
  const [isAvatar, setIsAvatar] = useState<boolean>(true);
  const [isContact, setIsContact] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Profile picture local state
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [removePicRequested, setRemovePicRequested] = useState(false);

  useEffect(() => {
    loadUserAndProfile();
  }, []);

  const loadUserAndProfile = async () => {
    try {
      setLoading(false);
      const userData = await account.get();
      setUser(userData);
      
      const prof = await UsersService.getProfileById(userData.$id);
      setProfile(prof);
      
      if (prof) {
        setUsername(prof.username || '');
        setBio(prof.bio || '');
        setDisplayName(prof.displayName || '');
        setIsPublic(prof.isPublic ?? true);
        setIsGuest(prof.isGuest ?? true);
        setIsAvatar(prof.isAvatar ?? true);
        setIsContact(prof.isContact ?? true);
        
        const targetAvatarId = prof.userId || prof.$id;
        if (targetAvatarId) {
          try {
            const url = storage.getFilePreview(AVATAR_BUCKET_ID, targetAvatarId, 160, 160);
            setProfilePicUrl(url.toString());
          } catch (err) {
            console.warn('Failed to fetch initial profile preview:', err);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load identity data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username === profile?.username) {
        setIsAvailable(null);
        return;
      }

      if (username.length < 3) {
        setIsAvailable(false);
        return;
      }

      setIsChecking(true);
      try {
        const available = await UsersService.isUsernameAvailable(username);
        setIsAvailable(available);
      } catch (err: unknown) {
        console.error('Failed to check username:', err);
      } finally {
        setIsChecking(false);
      }
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username, profile?.username]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        return;
      }
      setError('');
      try {
        const compressed = await compressImage(file, 512, 512, 0.7);
        if (compressed.size > 1024 * 1024) {
          setError('Maximum file size of 1MB exceeded after compression.');
          return;
        }
        setProfilePic(compressed);
        setProfilePicUrl(URL.createObjectURL(compressed));
        setRemovePicRequested(false);
      } catch (_err) {
        if (file.size > 1024 * 1024) {
          setError('Maximum file size of 1MB exceeded.');
          return;
        }
        setProfilePic(file);
        setProfilePicUrl(URL.createObjectURL(file));
        setRemovePicRequested(false);
      }
    }
  };

  const handleRemovePic = () => {
    setProfilePic(null);
    setProfilePicUrl(null);
    setRemovePicRequested(true);
  };

  const handleSave = async () => {
    if (!user?.$id) return;
    
    if (username !== profile?.username && isAvailable === false) {
      setError('Please pick an available username');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const userId = user.$id;
      
      if (removePicRequested) {
        const currentPrefs = user?.prefs || {};
        await account.updatePrefs({ ...currentPrefs, profilePicId: null });
      }

      if (profilePic) {
        const formData = new FormData();
        formData.append('file', profilePic);
        formData.append('bucketId', AVATAR_BUCKET_ID);
        formData.append('fileId', userId);
        
        const uploadedFile = await secureUploadFile(formData);
        const currentPrefs = user?.prefs || {};
        await account.updatePrefs({ ...currentPrefs, profilePicId: uploadedFile.$id });
      }

      let avatarVal = profile?.avatar;
      if (removePicRequested) {
        avatarVal = null;
      } else if (profilePic) {
        avatarVal = userId;
      }

      let publicKey: string | undefined;
      try {
        if (ecosystemSecurity.status.isUnlocked) {
          const pub = await ecosystemSecurity.ensureE2EIdentity(userId);
          if (pub) publicKey = pub;
        }
      } catch (e) {
        console.warn("Could not sync public key during profile update", e);
      }

      await UsersService.updateProfile(userId, {
        username,
        bio,
        displayName,
        avatar: avatarVal,
        publicKey,
        isPublic,
        isGuest,
        isAvatar,
        isContact
      });

      try {
        if (displayName || username) {
          if (displayName) await account.updateName(displayName);
          const currentPrefs = user?.prefs || {};
          await account.updatePrefs({
            ...currentPrefs,
            username: username.toLowerCase().trim()
          });
        }
      } catch (prefErr) {
        console.warn('Failed to sync display name or username to account prefs', prefErr);
      }

      setSuccess('Ecosystem profile updated successfully.');
      if (onProfileUpdate) {
        onProfileUpdate({
          name: displayName,
          username,
          profilePicId: profilePic ? userId : (removePicRequested ? null : user?.prefs?.profilePicId)
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full text-white flex flex-col">
      <div className="pb-6 mb-6 border-b border-white/8">
        <h3 className="text-white text-lg font-black tracking-tight leading-tight">Edit Profile</h3>
        <p className="text-white/40 text-[11px] font-bold mt-1">Configure your public handle & visibility</p>
      </div>

      <div className="space-y-6">
        {/* Profile Picture Uploader */}
        <div className="flex flex-col items-center gap-4 pb-2">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 bg-[#0F0E0D]">
              {profilePicUrl ? (
                <img 
                  src={profilePicUrl} 
                  alt="Avatar Preview" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 text-3xl font-black">
                  {(displayName || username || 'U').slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#6366F1] hover:bg-[#5254E8] text-white flex items-center justify-center cursor-pointer shadow-lg transition-all">
              <Camera size={14} />
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />
            </label>
          </div>
          {profilePicUrl && (
            <button
              onClick={handleRemovePic}
              className="flex items-center gap-1.5 text-xs font-bold text-[#EF4444] hover:text-[#FF6B6B] transition-colors bg-transparent border-none cursor-pointer"
            >
              <Trash2 size={12} />
              <span>Remove Photo</span>
            </button>
          )}
        </div>

        {/* Username */}
        <div className="space-y-2">
          <label className="text-xs font-black tracking-wider text-white/40 uppercase">Username</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6366F1] font-black">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl pl-8 pr-12 py-3 text-sm font-semibold focus:outline-none transition-all text-white"
              placeholder="handle"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {isChecking && <div className="w-4 h-4 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />}
              {!isChecking && isAvailable === true && username !== profile?.username && <CheckCircle size={16} className="text-[#10B981]" />}
              {!isChecking && isAvailable === false && username !== profile?.username && <AlertCircle size={16} className="text-[#EF4444]" />}
            </div>
          </div>
          <p className="text-[10px] font-bold text-white/40">
            {isAvailable === false && username !== profile?.username 
              ? 'Username is already taken' 
              : 'Only lowercase letters, numbers, and underscores allowed'}
          </p>
        </div>

        {/* Display Name */}
        <div className="space-y-2">
          <label className="text-xs font-black tracking-wider text-white/40 uppercase">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-all text-white"
            placeholder="Name"
          />
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-xs font-black tracking-wider text-white/40 uppercase">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-all resize-none text-white"
            placeholder="Tell the world about yourself..."
          />
        </div>

        <div className="h-px bg-white/8" />

        {/* Privacy & Visibility */}
        <div className="space-y-4">
          <h4 className="text-xs font-black tracking-wider text-[#F59E0B] uppercase">Privacy & Visibility</h4>
          
          <div className="space-y-4">
            {/* Public Profile */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Public Profile</p>
                <p className="text-xs text-white/40 font-semibold">Allow anyone to find your profile</p>
              </div>
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
              />
            </div>

            {/* Guest Visibility */}
            <div className="flex items-center justify-between opacity-80">
              <div>
                <p className="text-sm font-bold text-white">Guest Visibility</p>
                <p className="text-xs text-white/40 font-semibold">Allow non-logged in users to view details</p>
              </div>
              <input
                type="checkbox"
                checked={isGuest}
                disabled={!isPublic}
                onChange={(e) => setIsGuest(e.target.checked)}
                className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            {/* Show Avatar */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Show Avatar</p>
                <p className="text-xs text-white/40 font-semibold">Make your profile picture visible</p>
              </div>
              <input
                type="checkbox"
                checked={isAvatar}
                onChange={(e) => setIsAvatar(e.target.checked)}
                className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
              />
            </div>

            {/* Allow Contact */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">Allow Contact</p>
                <p className="text-xs text-white/40 font-semibold">Allow direct messages</p>
              </div>
              <input
                type="checkbox"
                checked={isContact}
                onChange={(e) => setIsContact(e.target.checked)}
                className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-xs font-bold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 p-3 rounded-xl">
            {error}
          </p>
        )}

        {success && (
          <p className="text-xs font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 p-3 rounded-xl">
            {success}
          </p>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-white/8 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || (isAvailable === false && username !== profile?.username)}
          className="w-full py-3.5 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-none"
        >
          {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
