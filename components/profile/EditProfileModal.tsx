'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  ArrowUpRight, 
  ArrowLeft, 
  Copy, 
  Check, 
  ShieldCheck, 
  User, 
  Link as LinkIcon,
  Tag
} from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { account, client } from '@/lib/appwrite/client';
import { Storage } from 'appwrite';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { secureUploadFile } from '@/lib/actions/client-ops';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan, getEffectiveUsername } from '@/lib/utils';
import { toast } from 'react-hot-toast';

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
              lastModified: Date.now()
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

export type ProfileDrawerMode = 'full' | 'username_only' | 'avatar_only' | 'privacy_only';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile?: any;
  onUpdate?: () => void;
  initialMode?: ProfileDrawerMode;
}

export function EditProfileModal({ 
  open, 
  onClose, 
  profile: initialProfile, 
  onUpdate, 
  initialMode = 'full' 
}: EditProfileModalProps) {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [activeMode, setActiveMode] = useState<ProfileDrawerMode>(initialMode);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Form Fields
  const [username, setUsername] = useState(initialProfile?.username || '');
  const [bio, setBio] = useState(initialProfile?.bio || '');
  const [displayName, setDisplayName] = useState(initialProfile?.displayName || '');
  const [isPublic, setIsPublic] = useState<boolean>(initialProfile?.isPublic ?? true);
  const [isGuest, setIsGuest] = useState<boolean>(initialProfile?.isGuest ?? true);
  const [isAvatar, setIsAvatar] = useState<boolean>(initialProfile?.isAvatar ?? true);
  const [isContact, setIsContact] = useState<boolean>(initialProfile?.isContact ?? true);
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Extended profile preferences: links, tags, tipping
  const [links, setLinks] = useState<Array<{ title?: string; url: string }>>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [tipEnabled, setTipEnabled] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);
  const [hideSensitiveInfo, setHideSensitiveInfo] = useState(false);

  const { openProUpgrade } = useProUpgrade();
  const isPro = hasPaidKylrixPlan(user);

  // Profile picture local state
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [removePicRequested, setRemovePicRequested] = useState(false);

  // Sync mode from initialMode
  useEffect(() => {
    setActiveMode(initialMode);
  }, [initialMode, open]);

  // Load Profile if not supplied
  const loadProfile = useCallback(async () => {
    if (initialProfile) {
      setProfile(initialProfile);
      return;
    }
    const targetUsername = getEffectiveUsername(user);
    if (!targetUsername) return;
    try {
      const data = await UsersService.getProfile(targetUsername);
      if (data) setProfile(data);
    } catch (e) {
      console.warn('Failed to load profile for edit modal:', e);
    }
  }, [initialProfile, user]);

  useEffect(() => {
    if (open) {
      void loadProfile();
    }
  }, [open, loadProfile]);

  // Check wallet status
  useEffect(() => {
    if (user?.$id) {
      import('@/lib/services/wallets').then(({ WalletService }) => {
        WalletService.listMainWallets(user.$id)
          .then(list => setHasWallet(list.length > 0))
          .catch(() => setHasWallet(false));
      });
    }
  }, [user?.$id, open]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setDisplayName(profile.displayName || '');
      setIsPublic(profile.isPublic ?? true);
      setIsGuest(profile.isGuest ?? true);
      setIsAvatar(profile.isAvatar ?? true);
      setIsContact(profile.isContact ?? true);
      setProfilePic(null);
      setProfilePicUrl(null);
      setRemovePicRequested(false);
      
      // Parse preferences JSON
      try {
        const prefsObj = typeof profile.preferences === 'string'
          ? JSON.parse(profile.preferences)
          : profile.preferences || {};
        setLinks(prefsObj.links || []);
        setTags(prefsObj.tags || []);
        setTipEnabled(prefsObj.tipEnabled ?? false);
        setHideSensitiveInfo(prefsObj.hideSensitiveInfo ?? false);
      } catch (_e) {
        setLinks([]);
        setTags([]);
        setTipEnabled(false);
        setHideSensitiveInfo(false);
      }

      // Set initial picture preview url if profile has avatar field
      const targetAvatarId = profile.userId || profile.$id;
      if (targetAvatarId) {
        try {
          const url = storage.getFilePreview(AVATAR_BUCKET_ID, targetAvatarId, 160, 160);
          setProfilePicUrl(url.toString());
        } catch (err) {
          console.warn('Failed to fetch initial profile preview:', err);
        }
      }
    }
  }, [profile, open]);

  // Username availability check
  useEffect(() => {
    const checkUsername = async () => {
      const clean = username.trim().toLowerCase();
      if (!clean || clean === profile?.username?.toLowerCase()) {
        setIsAvailable(null);
        return;
      }

      if (clean.length < 3) {
        setIsAvailable(false);
        return;
      }

      setIsChecking(true);
      try {
        const available = await UsersService.isUsernameAvailable(clean);
        setIsAvailable(available);
      } catch (err: unknown) {
        console.error('Failed to check username:', err);
      } finally {
        setIsChecking(false);
      }
    };

    const timer = setTimeout(checkUsername, 400);
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

  const handleAddLink = () => {
    if (links.length >= 3) return;
    setLinks([...links, { title: '', url: '' }]);
  };

  const handleLinkChange = (index: number, key: 'title' | 'url', value: string) => {
    const updated = [...links];
    updated[index] = { ...updated[index], [key]: value };
    setLinks(updated);
  };

  const handleRemoveLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!tag) return;
    if (tags.length >= 5) {
      setError('Maximum of 5 tags allowed.');
      return;
    }
    if (tags.includes(tag)) {
      setNewTag('');
      return;
    }
    setTags([...tags, tag]);
    setNewTag('');
    setError('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleSave = async () => {
    const userId = profile?.userId || profile?.$id || user?.$id;
    if (!userId) return;
    
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername !== profile?.username && isAvailable === false) {
      setError('Please pick an available username');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // 1. Process profile picture delete / upload
      if (removePicRequested) {
        try {
          await storage.deleteFile(AVATAR_BUCKET_ID, userId);
        } catch (e) {
          console.warn('Best effort deletion of profile photo failed:', e);
        }
        const currentPrefs = user?.prefs || {};
        await account.updatePrefs({ ...currentPrefs, profilePicId: null });
      }

      if (profilePic) {
        if (profilePic.size > 1024 * 1024) {
          throw new Error('Maximum file size of 1MB exceeded.');
        }
        
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

      // 2. Setup public key E2E identity if unlocked
      let publicKey: string | undefined;
      try {
        if (ecosystemSecurity.status.isUnlocked) {
          const pub = await ecosystemSecurity.ensureE2EIdentity(userId);
          if (pub) publicKey = pub;
        }
      } catch (e) {
        console.warn("Could not sync public key during profile update", e);
      }

      // 3. Serialize preferences
      const currentPrefsObj = (() => {
        try {
          return typeof profile?.preferences === 'string'
            ? JSON.parse(profile.preferences)
            : profile?.preferences || {};
        } catch {
          return {};
        }
      })();

      const serializedPreferences = JSON.stringify({
        ...currentPrefsObj,
        links: links.filter(l => l.url.trim() !== ''),
        tags,
        tipEnabled: tipEnabled && hasWallet,
        hideSensitiveInfo: hideSensitiveInfo && isPro
      });

      await UsersService.updateProfile(userId, {
        username: cleanUsername,
        bio,
        displayName,
        avatar: avatarVal,
        publicKey,
        isPublic,
        isGuest,
        isAvatar,
        isContact,
        preferences: serializedPreferences
      });

      try {
        if (displayName || cleanUsername) {
          if (displayName) await account.updateName(displayName);
          const currentPrefs = user?.prefs || {};
          await account.updatePrefs({
            ...currentPrefs,
            username: cleanUsername
          });
        }
      } catch (prefErr) {
        console.warn('Failed to sync display name or username to account prefs', prefErr);
      }

      await refreshUser(true);
      toast.success('Profile updated');
      onUpdate?.();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePopOut = () => {
    const target = username || profile?.username;
    if (target) {
      window.open(`/u/${target}`, '_blank');
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 z-[1100] transition-opacity duration-200 ease-in-out cursor-default"
        onClick={onClose}
      />

      {/* Central Profile Drawer */}
      <div className={
        isFullscreen 
          ? "fixed inset-0 z-[1200] w-screen h-screen bg-[#161412] text-white flex flex-col select-none overflow-hidden" 
          : "fixed bottom-0 left-0 right-0 h-[60dvh] max-h-[60dvh] min-h-[60dvh] md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-[500px] md:h-full md:max-h-full bg-[#161412] border-t md:border-t-0 md:border-l border-white/[0.08] rounded-t-[28px] md:rounded-t-none z-[1200] text-white flex flex-col shadow-2xl overflow-hidden animate-slide-up select-none"
      }>
        {/* Top Minimalist Header Layer */}
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.06] bg-[#161412] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {activeMode !== 'full' ? (
              <button
                type="button"
                onClick={() => setActiveMode('full')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors text-xs font-bold cursor-pointer"
                title="Back to full profile"
              >
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 truncate">
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider font-bold truncate">
                  {activeMode === 'username_only' ? 'Username Claim' : 'Identity & Profile'}
                </span>
              </div>
            )}
          </div>

          {/* Standardized Trailing Action Buttons: Pop Out -> Expand/Contract -> Close */}
          <div className="flex items-center gap-1 shrink-0">
            {(username || profile?.username) && (
              <button 
                type="button"
                onClick={handlePopOut} 
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                title="View Public Profile"
              >
                <ArrowUpRight size={16} />
              </button>
            )}
            <button 
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)} 
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button 
              type="button"
              onClick={onClose} 
              className="p-1.5 text-white/50 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body with Pitch-Black Child Wells */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5 min-h-0">
          {/* STATE: Username Only (Focused Claim / Change State) */}
          {activeMode === 'username_only' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
                <div className="flex items-center gap-2 text-white font-black text-sm">
                  <User size={16} className="text-[#6366F1]" />
                  <span>Choose Your Username</span>
                </div>
                <p className="text-xs text-white/50 m-0 leading-relaxed">
                  Your unique handle across workspaces, collaboration requests, and your public profile page (<code className="text-[#818cf8]">kylrix.space/u/{username || '...'}</code>).
                </p>

                <div className="relative pt-1">
                  <span className="absolute left-3.5 top-[calc(50%+2px)] -translate-y-1/2 text-[#6366F1] font-bold text-sm">@</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    autoFocus
                    placeholder="yourhandle"
                    className="w-full h-11 bg-[#161412] border border-white/[0.08] focus:border-[#6366F1] rounded-xl pl-8 pr-10 text-xs font-mono text-white focus:outline-none transition-colors"
                  />
                  <div className="absolute right-3.5 top-[calc(50%+2px)] -translate-y-1/2 flex items-center">
                    {isChecking && <div className="w-4 h-4 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />}
                    {!isChecking && isAvailable === true && username !== profile?.username && <CheckCircle2 size={16} className="text-emerald-400" />}
                    {!isChecking && isAvailable === false && username !== profile?.username && <AlertCircle size={16} className="text-rose-400" />}
                  </div>
                </div>

                <p className="text-[11px] font-mono text-white/40 m-0">
                  {isAvailable === false && username !== profile?.username
                    ? '⚠️ Handle is already claimed by another user.'
                    : 'Use lowercase letters, numbers, and underscores (min 3 chars).'}
                </p>
              </div>
            </div>
          )}

          {/* STATE: Full Profile Configuration */}
          {activeMode === 'full' && (
            <>
              {/* Profile Avatar & Identity Card */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center gap-4">
                <div className="relative shrink-0">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 bg-[#161412] flex items-center justify-center">
                    {profilePicUrl ? (
                      <img 
                        src={profilePicUrl} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-black font-clash text-white/40">
                        {(displayName || username || 'U').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-lg bg-[#6366F1] hover:bg-[#5254E8] text-white flex items-center justify-center cursor-pointer shadow-lg transition-all">
                    <Camera size={13} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <h4 className="text-sm font-bold text-white truncate m-0 font-clash">
                    {displayName || username || 'Ecosystem Member'}
                  </h4>
                  <p className="text-xs font-mono text-[#818cf8] truncate m-0">
                    @{username || 'handle'}
                  </p>
                  {profilePicUrl && (
                    <button
                      type="button"
                      onClick={handleRemovePic}
                      className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer pt-0.5"
                    >
                      <Trash2 size={11} />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Basic Details (Display Name, Handle, Bio) */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono m-0">
                  Basic Information
                </h4>

                {/* Display Name */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono">Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-10 bg-[#161412] border border-white/[0.08] focus:border-[#6366F1] rounded-xl px-3.5 text-xs font-semibold text-white focus:outline-none transition-colors"
                    placeholder="Your Public Name"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono">Username Handle</label>
                    {isChecking && <span className="text-[10px] font-mono text-white/40">Checking…</span>}
                    {!isChecking && isAvailable === true && username !== profile?.username && <span className="text-[10px] font-mono text-emerald-400 font-bold">Available</span>}
                    {!isChecking && isAvailable === false && username !== profile?.username && <span className="text-[10px] font-mono text-rose-400 font-bold">Taken</span>}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6366F1] font-bold text-xs">@</span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full h-10 bg-[#161412] border border-white/[0.08] focus:border-[#6366F1] rounded-xl pl-8 pr-3.5 text-xs font-mono text-white focus:outline-none transition-colors"
                      placeholder="handle"
                    />
                  </div>
                </div>

                {/* Bio */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider font-mono">Bio & Summary</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={3}
                    className="w-full bg-[#161412] border border-white/[0.08] focus:border-[#6366F1] rounded-xl p-3 text-xs text-white focus:outline-none transition-colors resize-none leading-relaxed"
                    placeholder="Short bio for your public workspace profile..."
                  />
                </div>
              </div>

              {/* Account Email Box (Centralized Relay) */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/40 font-bold block">
                    Primary Account Email
                  </span>
                  <span className="text-xs font-mono text-white font-bold truncate block mt-0.5">
                    {user?.email || 'No email attached'}
                  </span>
                </div>
                {user?.email && (
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(user.email);
                      setCopiedEmail(true);
                      toast.success('Email copied');
                      setTimeout(() => setCopiedEmail(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                  >
                    {copiedEmail ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>

              {/* Links Section */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono m-0 flex items-center gap-1.5">
                    <LinkIcon size={13} className="text-[#6366F1]" />
                    <span>Public Links (Max 3)</span>
                  </h4>
                  {links.length < 3 && (
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="text-[11px] text-[#818cf8] hover:text-white font-bold transition-colors cursor-pointer"
                    >
                      + Add Link
                    </button>
                  )}
                </div>

                {links.length === 0 ? (
                  <p className="text-xs text-white/40 m-0">No links added. Add your GitHub, X, or website.</p>
                ) : (
                  <div className="space-y-2">
                    {links.map((link, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Title (e.g. GitHub)"
                          value={link.title || ''}
                          onChange={(e) => handleLinkChange(idx, 'title', e.target.value)}
                          className="w-1/3 h-9 bg-[#161412] border border-white/[0.08] rounded-xl px-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1]"
                        />
                        <input
                          type="url"
                          placeholder="https://..."
                          value={link.url}
                          onChange={(e) => handleLinkChange(idx, 'url', e.target.value)}
                          className="flex-1 h-9 bg-[#161412] border border-white/[0.08] rounded-xl px-2.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1]"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="p-2 text-white/30 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags Section */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono m-0 flex items-center gap-1.5">
                  <Tag size={13} className="text-[#6366F1]" />
                  <span>Profile Tags (Max 5)</span>
                </h4>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                    placeholder="e.g. engineer, designer, rust"
                    className="flex-1 h-9 bg-[#161412] border border-white/[0.08] rounded-xl px-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-[#6366F1]"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3.5 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#161412] border border-white/10 text-xs font-mono text-zinc-300"
                      >
                        <span>#{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="text-white/40 hover:text-rose-400 cursor-pointer ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Privacy & Discoverability */}
              <div className="p-4 rounded-2xl bg-[#0A0908] border border-white/[0.06] space-y-3.5">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono m-0 flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-[#6366F1]" />
                  <span>Privacy & Visibility</span>
                </h4>

                <div className="space-y-3">
                  {/* Public Profile */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white m-0">Public Profile</p>
                      <p className="text-[11px] text-white/40 m-0">Allow members to find and view your profile</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isPublic || isGuest}
                      disabled={isGuest}
                      onChange={(e) => {
                        setIsPublic(e.target.checked);
                        if (!e.target.checked) setIsGuest(false);
                      }}
                      className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform disabled:opacity-50"
                    />
                  </div>

                  {/* Allow Guest Access */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white m-0">Allow Guest Access</p>
                      <p className="text-[11px] text-white/40 m-0">Make profile accessible to unauthenticated visitors</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isGuest}
                      onChange={(e) => {
                        setIsGuest(e.target.checked);
                        if (e.target.checked) setIsPublic(true);
                      }}
                      className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
                    />
                  </div>

                  {/* Allow Direct Messages */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white m-0">Allow Contact</p>
                      <p className="text-[11px] text-white/40 m-0">Allow other members to send direct chats</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isContact}
                      onChange={(e) => setIsContact(e.target.checked)}
                      className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
                    />
                  </div>

                  {/* Hide Sensitive Info (Pro) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-white m-0">Hide Sensitive Details</p>
                        <span className="text-[8px] font-mono uppercase px-1.5 py-0.2 bg-[#F59E0B]/15 text-[#F59E0B] font-bold rounded">
                          Pro
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 m-0">Hide join date, user ID, and username history</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={hideSensitiveInfo && isPro}
                      onChange={(e) => {
                        if (!isPro) {
                          openProUpgrade();
                          return;
                        }
                        setHideSensitiveInfo(e.target.checked);
                      }}
                      className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold leading-relaxed">
              {error}
            </div>
          )}
        </div>

        {/* Fixed Non-Scrolling Action Footer */}
        <div className="shrink-0 border-t border-white/[0.06] bg-[#161412] px-5 py-3 md:py-3.5 z-10">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || (isAvailable === false && username.trim().toLowerCase() !== profile?.username?.toLowerCase())}
            className="w-full h-11 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-[#6366F1]/10"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <span>{activeMode === 'username_only' ? 'Save Username' : 'Save Profile Changes'}</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
