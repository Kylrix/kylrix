'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import { UsersService } from '@/lib/services/users';
import { useAuth } from '@/lib/auth';
import { account } from '@/lib/appwrite/client';
import { ecosystemSecurity } from '@/lib/ecosystem/security';

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

    const profileId = profile?.$id;
    useEffect(() => {
        if (profile) {
            setUsername(profile.username || '');
            setBio(profile.bio || '');
            setDisplayName(profile.displayName || '');
            setIsPublic(profile.isPublic ?? true);
            setIsGuest(profile.isGuest ?? true);
            setIsAvatar(profile.isAvatar ?? true);
            setIsContact(profile.isContact ?? true);
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
            <div className="fixed bottom-0 left-0 right-0 max-h-[90vh] md:max-h-none md:top-0 md:right-0 md:left-auto md:w-[450px] bg-[#161412] border-t md:border-t-0 md:border-l border-white/8 rounded-t-[28px] md:rounded-t-none z-[1200] text-white flex flex-col animate-slide-up md:animate-slide-in">
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
                    {/* Username */}
                    <div className="space-y-2">
                        <label className="text-xs font-black tracking-wider text-white/40 uppercase">Ecosystem Handle</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00F0FF] font-black">@</span>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                className="w-full bg-white/4 border border-white/8 focus:border-[#00F0FF] rounded-xl pl-8 pr-12 py-3 text-sm font-semibold focus:outline-none transition-all"
                                placeholder="handle"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                                {isChecking && <div className="w-4 h-4 border-2 border-[#00F0FF] border-t-transparent rounded-full animate-spin" />}
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
                            className="w-full bg-white/4 border border-white/8 focus:border-[#00F0FF] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-all"
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
                            className="w-full bg-white/4 border border-white/8 focus:border-[#00F0FF] rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none transition-all resize-none"
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
                                    className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#00F0FF] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
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
                                    className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#00F0FF] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
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
                                    className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#00F0FF] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
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
                                    className="w-9 h-5 bg-white/10 rounded-full appearance-none checked:bg-[#00F0FF] cursor-pointer relative transition-all before:content-[''] before:absolute before:w-4 before:h-4 before:bg-white before:rounded-full before:top-0.5 before:left-0.5 checked:before:translate-x-4 before:transition-transform"
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
                        className="flex-1 py-3 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#33f3ff] text-black text-sm font-black transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </>
    );
}
