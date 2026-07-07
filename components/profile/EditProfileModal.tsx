'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Camera, Trash2 } from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
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

interface EditProfileModalProps {
    open: boolean;
    onClose: () => void;
    profile: any;
    onUpdate: () => void;
}

export function EditProfileModal({ open, onClose, profile, onUpdate }: EditProfileModalProps) {
    const { user } = useAuth();
    const [username, setUsername] = useState(profile?.username || '');
    const [bio, setBio] = useState(profile?.bio || '');
    const [displayName, setDisplayName] = useState(profile?.displayName || '');
    const [isPublic, setIsPublic] = useState<boolean>(profile?.isPublic ?? true);
    const [isGuest, setIsGuest] = useState<boolean>(profile?.isGuest ?? true);
    const [isAvatar, setIsAvatar] = useState<boolean>(profile?.isAvatar ?? true);
    const [isContact, setIsContact] = useState<boolean>(profile?.isContact ?? true);
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Extended profile preferences: links, tags, tipping
    const [links, setLinks] = useState<Array<{ title?: string; url: string }>>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [tipEnabled, setTipEnabled] = useState(false);
    const [hasWallet, setHasWallet] = useState(false);
    const [showAdvancedDiscovery, setShowAdvancedDiscovery] = useState(false);

    // Profile picture local state
    const [profilePic, setProfilePic] = useState<File | null>(null);
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const [removePicRequested, setRemovePicRequested] = useState(false);

    const profileId = profile?.$id;
    
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
            } catch (e) {
                setLinks([]);
                setTags([]);
                setTipEnabled(false);
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
    }, [profileId, open]);

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
                // Compress the image first
                const compressed = await compressImage(file, 512, 512, 0.7);
                if (compressed.size > 1024 * 1024) {
                    setError('Maximum file size of 1MB exceeded after compression.');
                    return;
                }
                setProfilePic(compressed);
                setProfilePicUrl(URL.createObjectURL(compressed));
                setRemovePicRequested(false);
            } catch (err) {
                // If compression fails, verify the original file size
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

    // Links & Tags helper functions
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
        if (!profile?.$id) return;
        
        if (username !== profile.username && isAvailable === false) {
            setError('Please pick an available username');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const userId = profile.userId || profile.$id;
            
            // 1. Process profile picture delete + upload logic using userId as ID
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
                formData.append('fileId', userId); // Upload using userId directly
                
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

            // Serialize preferences
            const currentPrefsObj = (() => {
                try {
                    return typeof profile.preferences === 'string'
                        ? JSON.parse(profile.preferences)
                        : profile.preferences || {};
                } catch {
                    return {};
                }
            })();

            const serializedPreferences = JSON.stringify({
                ...currentPrefsObj,
                links: links.filter(l => l.url.trim() !== ''),
                tags,
                tipEnabled: tipEnabled && hasWallet
            });

            await UsersService.updateProfile(userId, {
                username,
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

            onUpdate();
            onClose();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to update profile';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] transition-opacity duration-300 ease-in-out cursor-default"
                onClick={onClose}
            />

            {/* Custom Drawer */}
            <div className="fixed bottom-0 left-0 right-0 max-h-[60vh] md:max-h-none md:top-0 md:right-0 md:left-auto md:w-[450px] bg-[#161412] border-t md:border-t-0 md:border-l border-white/8 rounded-t-[28px] md:rounded-t-none z-[1200] text-white flex flex-col animate-slide-up md:animate-slide-in">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/8">
                    <div>
                        <h3 className="text-white text-lg font-black tracking-tight leading-tight">Edit Profile</h3>
                        <p className="text-white/40 text-[11px] font-bold mt-1">Configure your public handle & visibility</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white bg-white/2 hover:bg-white/5 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Profile Picture Uploader section */}
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
                                className="flex items-center gap-1.5 text-xs font-bold text-[#EF4444] hover:text-[#FF6B6B] transition-colors"
                            >
                                <Trash2 size={12} />
                                <span>Remove Photo</span>
                            </button>
                        )}
                    </div>

                    {/* Username */}
                    <div className="space-y-2">
                        <label className="text-xs font-black tracking-wider text-white/40 uppercase">Ecosystem Handle</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6366F1] font-black">@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl pl-8 pr-12 py-3 text-sm font-semibold focus:outline-none transition-all"
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
                            className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-all"
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
                            className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-all resize-none"
                            placeholder="Tell the world about yourself..."
                        />
                    </div>

                    <div className="h-px bg-white/8" />

                    {/* Tags Section */}
                    <div className="space-y-2">
                        <label className="text-xs font-black tracking-wider text-white/40 uppercase">Profile Tags (Max 5)</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                                className="flex-1 bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-xl px-4 py-2.5 text-sm font-semibold focus:outline-none"
                                placeholder="Add custom tag (e.g. developer)"
                            />
                            <button
                                type="button"
                                onClick={handleAddTag}
                                className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all border border-white/8"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg bg-[#6366F1]/10 text-[#6366F1] text-xs font-extrabold border border-[#6366F1]/20"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTag(tag)}
                                        className="hover:text-white ml-0.5"
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Links Section */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black tracking-wider text-white/40 uppercase">Profile Links (Max 3)</label>
                            {links.length < 3 && (
                                <button
                                    type="button"
                                    onClick={handleAddLink}
                                    className="text-xs font-bold text-[#6366F1] hover:text-[#5254E8]"
                                >
                                    + Add Link
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {links.map((link, idx) => (
                                <div key={idx} className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-white/30">Link #{idx + 1}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveLink(idx)}
                                            className="text-xs text-red-400 hover:text-red-300 font-bold"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        value={link.title || ''}
                                        onChange={(e) => handleLinkChange(idx, 'title', e.target.value)}
                                        className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                                        placeholder="Title (optional, e.g. GitHub or My Blog)"
                                    />
                                    <input
                                        type="text"
                                        value={link.url}
                                        onChange={(e) => handleLinkChange(idx, 'url', e.target.value)}
                                        className="w-full bg-white/4 border border-white/8 focus:border-[#6366F1] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                                        placeholder="URL (e.g. https://github.com/username)"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Tipping Section */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-bold text-white">Enable Tips</p>
                                <p className="text-xs text-white/40 font-semibold">
                                    {hasWallet 
                                        ? 'Allow visitors to tip your wallet directly' 
                                        : 'Please set up a wallet to enable tips'}
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={tipEnabled && hasWallet}
                                disabled={!hasWallet}
                                onChange={(e) => setTipEnabled(e.target.checked)}
                                className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                        </div>
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
                                    checked={isPublic || isGuest}
                                    disabled={isGuest}
                                    onChange={(e) => {
                                        setIsPublic(e.target.checked);
                                        if (!e.target.checked) {
                                            setIsGuest(false);
                                        }
                                    }}
                                    className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform disabled:opacity-50"
                                />
                            </div>

                            {/* Contracted Advanced Discovery Section for Guest View */}
                            <div className="border border-white/5 rounded-xl bg-white/[0.01] overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowAdvancedDiscovery(!showAdvancedDiscovery)}
                                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/2 transition-all text-xs font-black text-white/40 uppercase tracking-wider"
                                >
                                    <span>Profile Discoverability Options</span>
                                    <span>{showAdvancedDiscovery ? 'Hide' : 'Show'}</span>
                                </button>
                                {showAdvancedDiscovery && (
                                    <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-white">Allow guest access</p>
                                                <p className="text-[10px] text-white/40 font-semibold leading-normal">
                                                    Allow people outside Kylrix to see your profile
                                                </p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isGuest}
                                                onChange={(e) => {
                                                    setIsGuest(e.target.checked);
                                                    if (e.target.checked) {
                                                        setIsPublic(true);
                                                    }
                                                }}
                                                className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#6366F1] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
                                            />
                                        </div>
                                    </div>
                                )}
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
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/8 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-3 px-4 rounded-xl border border-white/8 hover:bg-white/5 text-sm font-bold transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || (isAvailable === false && username !== profile?.username)}
                        className="flex-1 py-3 px-4 rounded-xl bg-[#6366F1] hover:bg-[#5254E8] text-white text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
