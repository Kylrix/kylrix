'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Search,
    Edit2,
    Check,
    X,
    ShieldAlert,
    User,
    Image as ImageIcon,
    Globe,
    MessageSquare,
    Loader2 as SpinnerIcon
} from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/context/auth/AuthContext';
import { APPWRITE_CONFIG } from '@/lib/appwrite/config';
import { storage } from '@/lib/appwrite/client';
import { getUserProfilePicId } from '@/lib/user-utils';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import toast from 'react-hot-toast';
import SudoModal from '@/components/overlays/SudoModal';

const ACCENT_CONNECT = '#F59E0B';
const ACCENT_AVATAR = '#10B981';
const ACCENT_MESSAGE = '#6366F1';

// Custom tailwind switch
function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? 'bg-[#6366F1]' : 'bg-white/10'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export const DiscoverabilitySettings = () => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [savingDiscoverable, setSavingDiscoverable] = useState(false);
    const [savingContact, setSavingContact] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [username, setUsername] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [isSudoOpen, setIsSudoOpen] = useState(false);
    const [avatarPublicRead, setAvatarPublicRead] = useState(false);

    const resolvedAvatarFileId = useMemo(() => {
        const rowId = typeof profile?.avatar === 'string' ? profile.avatar.trim() : '';
        if (rowId && !rowId.startsWith('http')) return rowId;
        const prefsId = getUserProfilePicId(user);
        if (prefsId && !String(prefsId).startsWith('http')) return String(prefsId);
        return null;
    }, [profile?.avatar, user]);

    const loadProfile = useCallback(async () => {
        if (!user?.$id) return;
        try {
            const p = await UsersService.getProfileById(user.$id);
            setProfile(p);
            if (p) {
                const u = p.username || '';
                setUsername(u);
                setNewUsername(u);
            } else {
                setUsername('');
                setNewUsername('');
            }
        } catch (_e: unknown) {
            console.error('Failed to load profile', _e);
        } finally {
            setLoading(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (user?.$id) loadProfile();
    }, [user?.$id, loadProfile]);

    useEffect(() => {
        let cancelled = false;
        const id = profile?.avatar || getUserProfilePicId(user);
        if (!id) {
            setPreviewUrl(null);
            return;
        }
        if (typeof id === 'string' && id.startsWith('http')) {
            setPreviewUrl(id);
            return;
        }
        (async () => {
            try {
                const { fetchProfilePreview } = await import('@/lib/profile-preview');
                const url = await fetchProfilePreview(id, 96, 96);
                if (!cancelled) setPreviewUrl(url);
            } catch {
                if (!cancelled) setPreviewUrl(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [profile?.avatar, user]);

    useEffect(() => {
        let cancelled = false;
        const fileId = resolvedAvatarFileId;
        if (!fileId) {
            setAvatarPublicRead(false);
            return;
        }

        void (async () => {
            try {
                const f = await storage.getFile(APPWRITE_CONFIG.BUCKETS.PROFILE_PICTURES, fileId);
                if (cancelled) return;
                const pub =
                    Array.isArray((f as any).$permissions) &&
                    ((f as any).$permissions as string[]).some((p: string) => typeof p === 'string' && p.includes('read("any")'));
                setAvatarPublicRead(!!pub);
            } catch {
                if (!cancelled) setAvatarPublicRead(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [resolvedAvatarFileId]);

    useEffect(() => {
        const check = async () => {
            const normalized = newUsername
                .toLowerCase()
                .trim()
                .replace(/^@/, '')
                .replace(/[^a-z0-9_]/g, '');
            if (!normalized || normalized === username || normalized.length < 3) {
                setIsAvailable(null);
                return;
            }

            setCheckingAvailability(true);
            try {
                const available = await UsersService.isUsernameAvailable(normalized);
                setIsAvailable(available);
            } catch (e) {
                console.error('Check failed', e);
                setIsAvailable(null);
            } finally {
                setCheckingAvailability(false);
            }
        };

        const timeoutId = setTimeout(check, 500);
        return () => clearTimeout(timeoutId);
    }, [newUsername, username]);

    const handleToggleDiscoverability = async (checked: boolean) => {
        if (!user?.$id) return;

        if (!profile) {
            setIsEditing(true);
            toast.error('Set a username first to enable discovery');
            return;
        }

        setSavingDiscoverable(true);
        try {
            const p = await UsersService.setProfileDiscoverable(user.$id, checked);
            setProfile(p || profile);
            toast.success(checked ? 'Profile is now discoverable in global search' : 'Profile discoverability turned off');
        } catch (e: any) {
            toast.error(e.message || 'Failed to toggle profile discoverability');
        } finally {
            setSavingDiscoverable(false);
        }
    };

    const handleToggleAvatarVisibility = async (checked: boolean) => {
        if (!user?.$id) return;

        const fileId = resolvedAvatarFileId;
        if (!fileId || String(fileId).startsWith('http')) {
            toast.error('Set a profile picture first to manage visibility');
            return;
        }

        setSavingAvatar(true);
        try {
            const p = await UsersService.setAvatarVisible(user.$id, fileId, checked);
            setProfile(p || profile);
            setAvatarPublicRead(checked);
            toast.success(checked ? 'Profile image is visible where your profile appears' : 'Profile image visibility restricted');
        } catch (e: any) {
            toast.error(e.message || 'Failed to toggle avatar visibility');
        } finally {
            setSavingAvatar(false);
        }
    };

    const handleToggleContact = async (checked: boolean) => {
        if (!user?.$id) return;

        if (checked) {
            if (!ecosystemSecurity.status.isUnlocked) {
                setIsSudoOpen(true);
                return;
            }

            setSavingContact(true);
            try {
                const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                if (pub) {
                    const p = await UsersService.updateProfile(user.$id, { publicKey: pub });
                    setProfile(p || { ...profile, publicKey: pub });
                    toast.success('People can reach you with encrypted messages');
                }
            } catch (e: any) {
                toast.error(`Failed to enable contact: ${e.message}`);
            } finally {
                setSavingContact(false);
            }
        } else {
            setSavingContact(true);
            try {
                const p = await UsersService.updateProfile(user.$id, { publicKey: '' });
                setProfile(p || { ...profile, publicKey: '' });
                toast.success('Secure contact disabled');
            } catch (e: any) {
                toast.error(`Failed to disable contact: ${e.message}`);
            } finally {
                setSavingContact(false);
            }
        }
    };

    const handleSyncE2E = async () => {
        if (!user?.$id || !profile) return;

        if (!ecosystemSecurity.status.isUnlocked) {
            toast.error('Unlock your vault to publish secure messaging keys');
            return;
        }

        setSaving(true);
        setSyncError(null);
        try {
            const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
            if (pub) {
                const updated = await UsersService.updateProfile(user.$id, { publicKey: pub });
                setProfile(updated || { ...profile, publicKey: pub });
                toast.success('Encryption keys synced to your profile');
            } else {
                setSyncError('Identity exists locally but could not be published.');
            }
        } catch (e: any) {
            console.error('Sync error:', e);
            setSyncError(e.message || 'Failed to sync identity keys');
            toast.error('Failed to sync keys');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveUsername = async () => {
        if (!user?.$id || !newUsername) return;
        const normalized = newUsername.toLowerCase().trim().replace(/^@/, '').replace(/[^a-z0-9_]/g, '');

        if (normalized.length < 3) {
            toast.error('Username must be at least 3 characters');
            return;
        }

        setSaving(true);
        try {
            let publicKey: string | undefined;
            try {
                if (ecosystemSecurity.status.isUnlocked) {
                    const pub = await ecosystemSecurity.ensureE2EIdentity(user.$id);
                    if (pub) publicKey = pub;
                }
            } catch (_e) {
                /* ignore */
            }

            if (profile) {
                const updated = await UsersService.updateProfile(user.$id, {
                    username: normalized,
                    ...(typeof publicKey === 'string' ? { publicKey } : {}),
                });
                setUsername(normalized);
                setProfile(updated || { ...profile, username: normalized, publicKey });
                toast.success('Handle updated');
            } else {
                const p = await UsersService.createProfile(user.$id, normalized, {
                    displayName: user.name || (normalized.charAt(0).toUpperCase() + normalized.slice(1)),
                    publicKey,
                    bio: '',
                });
                setProfile(p);
                setUsername(normalized);
                toast.success('Universal identity initialized');
            }
            setIsEditing(false);
            setShowConfirm(false);
        } catch (e: any) {
            toast.error(e.message || 'Failed to save handle');
        } finally {
            setSaving(false);
        }
    };

    if (!user?.$id) {
        return (
            <p className="text-white/50 text-sm font-semibold font-sans">
                Sign in to manage discoverability.
            </p>
        );
    }

    if (loading) {
        return (
            <div className="flex justify-center p-4">
                <SpinnerIcon className="animate-spin text-[#F59E0B]" size={24} />
            </div>
        );
    }

    const isDiscoverable = profile?.isPublic !== false && profile?.isGuest !== false;
    const isContactable = !!profile?.publicKey;

    return (
        <div className="flex flex-col gap-6">
            <h3 className="text-[#F5F3F0] font-black text-lg tracking-tight leading-tight flex items-center gap-2 mb-2 font-mono">
                <Search size={20} className="text-[#F59E0B]" />
                <span>Discoverability</span>
            </h3>

            <div className="p-6 bg-[#161412] border border-white/5 rounded-[28px] shadow-2xl flex flex-col gap-6">
                
                {/* Discoverability Switch */}
                <div className="flex items-center justify-between gap-4 flex-wrap select-none">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center flex-shrink-0">
                            <Globe size={18} />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-white font-extrabold text-sm truncate">
                                Global search discoverability
                            </span>
                            <span className="block text-white/40 text-[11px] font-semibold font-sans mt-0.5">
                                Allow others to find your profile via global search across Kylrix
                            </span>
                        </div>
                    </div>
                    <Switch
                        checked={!!isDiscoverable}
                        onChange={handleToggleDiscoverability}
                        disabled={savingDiscoverable}
                    />
                </div>

                <div className="h-[1px] bg-white/5 w-full" />

                {/* Avatar Visibility Switch */}
                <div className="flex items-center justify-between gap-4 flex-wrap select-none">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] flex items-center justify-center flex-shrink-0">
                            <ImageIcon size={18} />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-white font-extrabold text-sm truncate">
                                Profile picture visibility
                            </span>
                            <span className="block text-white/40 text-[11px] font-semibold font-sans mt-0.5">
                                Let your universal avatar render for others where your profile is shown
                            </span>
                        </div>
                    </div>
                    <Switch
                        checked={resolvedAvatarFileId ? profile?.isAvatar !== false : false}
                        onChange={handleToggleAvatarVisibility}
                        disabled={savingAvatar || !resolvedAvatarFileId}
                    />
                </div>

                <div className="h-[1px] bg-white/5 w-full" />

                {/* Secure Contact Switch */}
                <div className="flex items-center justify-between gap-4 flex-wrap select-none">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] flex items-center justify-center flex-shrink-0">
                            <MessageSquare size={18} />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-white font-extrabold text-sm truncate">
                                Allow people to contact you
                            </span>
                            <span className="block text-white/40 text-[11px] font-semibold font-sans mt-0.5">
                                Publish your secure messaging key so others can DM you encrypted
                            </span>
                        </div>
                    </div>
                    <Switch
                        checked={isContactable}
                        onChange={handleToggleContact}
                        disabled={savingContact}
                    />
                </div>

                {profile && !profile.publicKey && (
                    <>
                        <div className="h-[1px] bg-white/5 w-full" />
                        <div className="p-4 rounded-2xl bg-[#F59E0B]/5 border border-[#F59E0B]/20 flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 text-[#F59E0B] flex items-center justify-center flex-shrink-0">
                                    <ShieldAlert size={20} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span className="block text-sm font-extrabold text-[#F59E0B] truncate">
                                        Messaging keys not published
                                    </span>
                                    <span className="block text-[11px] text-white/40 font-semibold font-sans mt-0.5">
                                        Unlock the vault and sync so others can reach you securely.
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={handleSyncE2E}
                                disabled={saving}
                                className="h-8 px-4 rounded-lg bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black font-extrabold text-xs flex items-center justify-center transition-all"
                            >
                                {saving ? <SpinnerIcon className="animate-spin text-black" size={14} /> : 'Sync keys'}
                            </button>
                        </div>
                        {syncError && (
                            <span className="text-red-400 text-xs font-semibold block mt-1">
                                {syncError}
                            </span>
                        )}
                    </>
                )}

                <div className="h-[1px] bg-white/5 w-full" />

                {/* Username handle */}
                <div>
                    <div className="flex items-center gap-1.5 mb-2 select-none">
                        <User size={14} className="text-white/40" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-white/40 font-mono">
                            Universal handle
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 p-1 pl-4 rounded-2xl bg-[#0A0908] border border-white/5 focus-within:border-[#F59E0B]/40 transition-colors">
                        <div className="flex-1 py-2.5 min-w-0">
                            {isEditing ? (
                                <div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[#F59E0B] font-black text-sm font-mono">@</span>
                                        <input
                                            type="text"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            placeholder="your_handle"
                                            autoFocus
                                            className="bg-transparent border-none outline-none font-mono font-extrabold text-sm text-white flex-1 min-w-0"
                                        />
                                        <div className="flex items-center gap-1 pr-1 flex-shrink-0">
                                            {checkingAvailability && (
                                                <SpinnerIcon className="animate-spin text-[#F59E0B]" size={14} />
                                            )}
                                            {!checkingAvailability && isAvailable === true && (
                                                <Check size={16} className="text-[#F59E0B]" strokeWidth={3} />
                                            )}
                                            {!checkingAvailability && isAvailable === false && (
                                                <X size={16} className="text-red-400" strokeWidth={3} />
                                            )}
                                        </div>
                                    </div>
                                    {isAvailable === false && (
                                        <span className="text-red-400 text-[10px] font-bold mt-1 block">
                                            Handle unavailable
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <span className={`block font-mono font-extrabold text-sm tracking-tight ${
                                        isDiscoverable || !profile ? 'text-white' : 'text-white/40'
                                    }`}>
                                        @{username || 'not_set'}
                                    </span>
                                    <span className="block text-[10px] text-white/40 font-semibold mt-0.5">
                                        {!profile
                                            ? 'Set a handle to activate discovery toggles'
                                            : isDiscoverable
                                              ? 'Visible in ecosystem search'
                                              : 'Discoverability off'}
                                    </span>
                                </>
                            )}
                        </div>

                        <div className="flex gap-1.5 pr-1.5 flex-shrink-0">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setIsEditing(false);
                                            setNewUsername(username);
                                            setIsAvailable(null);
                                        }}
                                        className="w-8 h-8 rounded-lg bg-[#161412] hover:bg-red-500/10 text-white/40 hover:text-red-400 border border-white/5 flex items-center justify-center transition-all"
                                        aria-label="Cancel edit"
                                    >
                                        <X size={16} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => setShowConfirm(true)}
                                        disabled={
                                            saving ||
                                            !newUsername ||
                                            isAvailable === false ||
                                            checkingAvailability ||
                                            (newUsername === username && !!profile)
                                        }
                                        className="w-8 h-8 rounded-lg bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-black flex items-center justify-center transition-all disabled:opacity-20"
                                        aria-label="Save handle"
                                    >
                                        <Check size={16} strokeWidth={3} />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className={`h-8 px-4 rounded-lg font-extrabold text-xs flex items-center gap-1.5 border transition-all ${
                                        !profile
                                            ? 'bg-[#F59E0B] border-[#F59E0B] text-black hover:bg-[#F59E0B]/90'
                                            : 'bg-[#F59E0B]/5 border-[#F59E0B]/20 text-[#F59E0B] hover:bg-[#F59E0B]/10 hover:border-[#F59E0B]/40'
                                    }`}
                                >
                                    <Edit2 size={12} strokeWidth={2.5} />
                                    <span>{profile ? 'Edit' : 'Set up'}</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Profile image preview box */}
            <div className="p-4 bg-[#161412] border border-white/5 rounded-2xl flex items-center gap-3 shadow-xl select-none">
                <div className="w-12 h-12 rounded-full border border-white/8 bg-[#1C1A18] overflow-hidden flex items-center justify-center font-black text-lg select-none text-white/80">
                    {previewUrl ? (
                        <img src={previewUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        (username || user.name || '?').slice(0, 1).toUpperCase()
                    )}
                </div>
                <div>
                    <h4 className="text-white font-extrabold text-sm leading-none mb-1">Preview</h4>
                    <p className="text-white/40 text-[10px] font-semibold leading-none">Roughly how you appear in discovery and chats</p>
                </div>
            </div>

            {/* Confirm Dialog Modal */}
            {showConfirm && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className="bg-[#161412] border border-white/5 p-6 rounded-[28px] max-w-sm w-full shadow-2xl relative select-none animate-in fade-in zoom-in duration-200">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldAlert className="text-[#F59E0B]" size={20} />
                    <h3 className="text-white text-base font-black tracking-tight leading-none font-mono">Confirm handle</h3>
                  </div>
                  <p className="text-xs text-white/50 font-medium leading-relaxed mb-4">
                    Your universal handle affects how people find you in search and mentions. Pick something you intend to keep.
                  </p>
                  <div className="p-3 bg-[#0A0908] rounded-xl border border-dashed border-white/10 mb-6">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-white/40 mb-1 font-mono">NEW HANDLE</span>
                    <span className="font-mono font-extrabold text-[#F59E0B]">@{newUsername.toLowerCase().trim()}</span>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 text-xs font-bold text-white/50 hover:text-white transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveUsername}
                      disabled={saving}
                      className="px-5 py-2.5 text-xs font-extrabold text-black bg-[#F59E0B] hover:bg-[#F59E0B]/90 rounded-xl transition-all disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <SudoModal
                isOpen={isSudoOpen}
                onCancel={() => setIsSudoOpen(false)}
                app="vault"
                onSuccess={() => {
                    setIsSudoOpen(false);
                    void handleToggleContact(true);
                }}
            />
        </div>
    );
};
