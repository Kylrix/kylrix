'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { UsersService } from '@/lib/services/users';
import { SocialService } from '@/lib/services/social';
import { useAuth } from '@/lib/auth';
import {
    Box,
    Typography,
    Paper,
    Button,
    CircularProgress,
    Skeleton,
    Stack,
    alpha
} from '@mui/material';
import { 
    Edit3 as EditIcon, 
    Settings as SettingsIcon, 
    UserPlus as PersonAddIcon, 
    MessageSquare as ChatIcon,
    Activity,
    Heart,
    MessageCircle,
    Repeat2,
    Flag
} from 'lucide-react';
import { useRouter, useSearchParams  } from 'next/navigation';
import { useProfile } from '@/components/providers/ProfileProvider';
import { EditProfileModal } from './EditProfileModal';
import { ActorsListDrawer } from "../social/ActorsListDrawer";
import type { Actor } from "../social/ActorsListDrawer";

import { getUserProfilePicId } from '@/lib/user-utils';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityByUsername, seedIdentityCache, subscribeIdentityCache } from '@/lib/identity-cache';
import { getProfileView, stageProfileView } from '@/lib/profile-handoff';
import { IdentityAvatar, IdentityName, computeIdentityFlags } from '../common/IdentityBadge';
import ReportUserDialog from './ReportUserDialog';

interface ProfileProps {
    username?: string;
}

const normalizeUsername = (value?: string | null) => {
    if (!value) return null;
    return value.toString().trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '') || null;
};

export const Profile = ({ username }: ProfileProps) => {
    const { user: currentUser } = useAuth();
    const { profile: myProfile, refreshProfile: refreshMyProfile } = useProfile();
    const router = useRouter();
    const searchParams = useSearchParams();
    const normalizedUsername = normalizeUsername(username);
    const preloadedProfile = normalizedUsername ? getProfileView(normalizedUsername)?.profile || null : null;
    const cachedUsernameProfile = normalizedUsername ? getCachedIdentityByUsername(normalizedUsername) : null;
    const [profile, setProfile] = useState<any>(() => preloadedProfile || cachedUsernameProfile);
    const [profileUrl, setProfileUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(() => !normalizedUsername || !(preloadedProfile || cachedUsernameProfile));
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    const [moments, setMoments] = useState<any[]>([]);
    const [momentsLoading, setMomentsLoading] = useState(false);
    const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });

    const [actorsDrawerOpen, setActorsDrawerOpen] = useState(false);
    const [actorsTitle, setActorsTitle] = useState('');
    const [actorsList, setActorsList] = useState<Actor[]>([]);
    const morphFromPanel = searchParams.get('transition') === 'profile';

    // Load the profile avatar preview. Prefer the viewed profile's avatar if present;
    // fall back to the logged-in user's profile pic when viewing an identity without an avatar.
    useEffect(() => {
        let mounted = true;

        const profilePicId = profile?.avatar || getUserProfilePicId(currentUser);
        const cached = getCachedProfilePreview(profilePicId || undefined);
        if (cached !== undefined && mounted) {
            setProfileUrl(cached ?? null);
        }

        const fetchPreview = async () => {
            try {
                if (profilePicId?.startsWith('http')) {
                    setProfileUrl(profilePicId);
                } else if (profilePicId) {
                    const url = await fetchProfilePreview(profilePicId, 140, 140);
                    if (mounted) setProfileUrl(url as unknown as string);
                } else if (mounted) setProfileUrl(null);
            } catch (_err: unknown) {
                if (mounted) setProfileUrl(null);
            }
        };

        fetchPreview();
        return () => { mounted = false; };
    }, [profile, currentUser]);

    useEffect(() => {
        const unsubscribe = subscribeIdentityCache((identity) => {
            if (normalizedUsername && identity.username === normalizedUsername) {
                setProfile(identity);
            } else if (profile?.userId && identity.userId === profile.userId) {
                setProfile(identity);
            }
        });

        return unsubscribe;
    }, [normalizedUsername, profile?.userId]);

    // Determine whether the viewed profile belongs to the logged-in user.
    // Previously we compared the URL username to the viewed profile username which
    // incorrectly marked any viewed profile as "own" when the username in the URL
    // matched the profile (even for other users). Instead, prefer ID-based checks
    // and fall back to comparing against the logged-in user's profile username.
    // Only consider this the "own profile" when the fetched profile's userId
    // exactly matches the currently authenticated user's id. This prevents
    // accidental "Edit Profile" controls from appearing when viewing other
    // users that happen to share a username or when context usernames collide.
    const isOwnProfile = Boolean(currentUser && profile && profile.userId && currentUser.$id && profile.userId === currentUser.$id);
    const identityFlags = computeIdentityFlags({
        createdAt: profile?.$createdAt || profile?.createdAt || null,
        lastUsernameEdit: profile?.last_username_edit || profile?.preferences?.last_username_edit || null,
        profilePicId: profile?.avatar || profile?.profilePicId || null,
        username: profile?.username || null,
        bio: profile?.bio || null,
        tier: profile?.tier || null,
        publicKey: profile?.publicKey || null,
        preferences: profile?.preferences || null,
    });

    const loadRelatedData = useCallback(async (data: any) => {
        if (!data) return;

        const targetId = data.userId || data.$id;
        if (!targetId) return;

        setMomentsLoading(true);
        try {
            const [feedRes, followStats, followingStatus] = await Promise.all([
                SocialService.getFeed(currentUser?.$id, targetId),
                SocialService.getFollowStats(targetId),
                currentUser ? SocialService.isFollowing(currentUser.$id, targetId) : Promise.resolve(false),
            ]);

            setMoments(feedRes.rows);
            setStats({
                posts: feedRes.total,
                followers: typeof followStats.followers === 'number' ? followStats.followers : (followStats.followerRows ? followStats.followerRows.length : 0),
                following: typeof followStats.following === 'number' ? followStats.following : (followStats.followingRows ? followStats.followingRows.length : 0),
            });
            setIsFollowing(Boolean(followingStatus));
        } catch (error: unknown) {
            console.error('Failed to load profile activity:', error);
        } finally {
            setMomentsLoading(false);
        }
    }, [currentUser]);

    const loadProfile = useCallback(async () => {
        const stagedProfile = normalizedUsername ? (preloadedProfile || cachedUsernameProfile) : null;

        if (stagedProfile) {
            seedIdentityCache(stagedProfile);
            stageProfileView(stagedProfile, null);
            setProfile(stagedProfile);
            setLoading(false);
            void loadRelatedData(stagedProfile);
            return;
        }

        setLoading(true);

        try {
            let data;
            if (normalizedUsername) {
                // Always fetch the profile for the username in the URL from the
                // canonical public "chat.profiles" table. This is the single source
                // of truth when visiting /u/:username — do not substitute the
                // currently-logged-in user's profile here.
                data = await UsersService.getProfile(normalizedUsername);
                // If no profile is found, we intentionally do NOT fall back to
                // the logged-in user's profile. Showing someone else's page must
                // always reflect that target owner's data or show Not Found.
            } else if (currentUser) {
                const synced = await UsersService.forceSyncProfileWithIdentity(currentUser);
                data = synced || (myProfile && myProfile.userId === currentUser.$id ? myProfile : null);

                if (!data) {
                    data = await UsersService.ensureProfileForUser(currentUser);
                }
            }

            if (data) {
                seedIdentityCache(data);
                stageProfileView(data, profileUrl || null);
                setProfile((prev: any) => {
                    if (prev && prev.$id === data.$id && prev.username === data.username && prev.bio === data.bio && prev.displayName === data.displayName && prev.avatar === data.avatar) {
                        return prev;
                    }
                    return data;
                });
                stageProfileView(data, null);
                void loadRelatedData(data);
            } else {
                setProfile(null);
            }
        } catch (error: unknown) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    }, [cachedUsernameProfile, currentUser, loadRelatedData, myProfile, normalizedUsername, preloadedProfile, profileUrl]);

    useEffect(() => {
        loadProfile();
    }, [loadProfile]);

    const getTargetId = () => profile?.userId || profile?.$id;

    const handleFollow = async () => {
        if (!currentUser || !profile) return;
        setFollowLoading(true);
        try {
            const targetId = getTargetId();
            if (!targetId) return;

            if (isFollowing) {
                await SocialService.unfollowUser(currentUser.$id, targetId);
                setIsFollowing(false);
            } else {
                await SocialService.followUser(currentUser.$id, targetId);
                setIsFollowing(true);
            }

            // Refresh follow stats from authoritative source
            try {
                const newStats = await SocialService.getFollowStats(targetId);
                setStats(prev => ({ ...prev, followers: newStats.followers, following: newStats.following }));
            } catch (e) {
                console.warn('Failed to refresh follow stats after follow/unfollow', e);
            }
        } catch (error: unknown) {
            console.error('Follow operation failed:', error);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleOpenFollowers = async () => {
        const targetId = getTargetId();
        if (!targetId) return;
        setActorsTitle('Followers');
        setActorsDrawerOpen(true);
        setActorsList([]); // Reset while loading
        const followers = await SocialService.getFollowers(targetId, currentUser?.$id);
        setActorsList(followers as unknown as Actor[]);
    };

    const handleOpenFollowing = async () => {
        const targetId = getTargetId();
        if (!targetId) return;
        setActorsTitle('Following');
        setActorsDrawerOpen(true);
        setActorsList([]); // Reset while loading
        const following = await SocialService.getFollowing(targetId, currentUser?.$id);
        setActorsList(following as unknown as Actor[]);
    };

    const handleActorAction = async (actor: Actor, type: 'follow' | 'unfollow') => {
        if (!currentUser) return;
        const targetId = actor.userId || actor.$id;

        if (type === 'follow') {
            await SocialService.followUser(currentUser.$id, targetId);
        } else {
            await SocialService.unfollowUser(currentUser.$id, targetId);
        }

        // Update local list state to reflect the change
        setActorsList(prev => prev.map(a => 
            (a.$id === actor.$id || a.userId === actor.userId) 
            ? { ...a, isFollowing: type === 'follow' } 
            : a
        ));

        // If this actor is the one whose profile we are currently viewing, update the follow button too
        if (getTargetId() === targetId) {
            setIsFollowing(type === 'follow');
        }

        // Refresh stats
        const newStats = await SocialService.getFollowStats(getTargetId());
        setStats(prev => ({ ...prev, followers: newStats.followers, following: newStats.following }));
    };

    const handleMessage = () => {
        if (!profile) return;
        const targetId = profile.userId || profile.$id;
        router.push(`/chats?userId=${targetId}`);
    };

    if (loading && !profile) {
        return (
            <Box sx={{ maxWidth: 800, mx: 'auto', p: 2, pt: 4 }}>
                <Paper sx={{ p: 4, borderRadius: '32px', mb: 4, bgcolor: '#161412', border: '1px solid rgba(255, 255, 255, 0.05)' }} elevation={0}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Skeleton variant="rounded" width={72} height={72} sx={{ borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.05)' }} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="35%" height={32} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                            <Skeleton width="20%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                            <Skeleton width="50%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                        </Box>
                    </Stack>
                </Paper>
                <Stack spacing={2}>
                    <Skeleton variant="rounded" height={140} sx={{ borderRadius: 4, bgcolor: 'rgba(255,255,255,0.05)' }} />
                    <Skeleton variant="rounded" height={140} sx={{ borderRadius: 4, bgcolor: 'rgba(255,255,255,0.05)' }} />
                </Stack>
            </Box>
        );
    }

    if (!profile) return (
        <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h5" gutterBottom>Profile not found</Typography>
            <Typography color="text.secondary">The user @{username} doesn&apos;t exist in our ecosystem.</Typography>
            <Button sx={{ mt: 2 }} variant="contained" onClick={() => router.push('/')}>Go Home</Button>
        </Box>
    );

    // When rendering the profile avatar/name in other UI, navigating must go to /u/:username
    const handleNavigateToPublic = () => {
        if (!profile) return;
        const uname = profile.username;
        if (uname) {
            // Use router.push for smooth SPA navigation; avoid redundant navigation
            if (window.location.pathname === `/u/${uname}`) return;
            router.push(`/u/${encodeURIComponent(uname)}`);
        }
    };

    return (
        <motion.div
            initial={morphFromPanel ? { opacity: 0, y: 18, scale: 0.985 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
        <Box sx={{ maxWidth: 800, mx: 'auto', p: 2, pt: 4 }}>
                <Paper sx={{ 
                    p: 4, 
                    borderRadius: '32px', 
                    mb: 4,
                    background: '#161412',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '32px'
                    }
                }} elevation={0}>
                {/* Brand Accent Blur */}
                <Box sx={{
                    position: 'absolute',
                    top: -100,
                    right: -100,
                    width: 200,
                    height: 200,
                    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0) 70%)',
                    filter: 'blur(40px)',
                    zIndex: 0
                }} />

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 4, position: 'relative', zIndex: 1 }}>
                    <Box onClick={handleNavigateToPublic} sx={{ cursor: 'pointer' }}>
                        <IdentityAvatar
                            src={profileUrl || profile.avatar}
                            alt={profile.displayName || profile.username || 'profile'}
                            fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                            verified={identityFlags.verified}
                            verifiedOn={identityFlags.verifiedOn}
                            pro={identityFlags.pro}
                            size={140}
                            verifiedSize={22}
                            borderRadius="28px"
                        />
                    </Box>
                    <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                        <Typography onClick={handleNavigateToPublic} variant="h3" sx={{ 
                            fontWeight: 900, 
                            mb: 0.5,
                            fontFamily: 'var(--font-clash)',
                            letterSpacing: '-0.04em'
                        }}>
                            <IdentityName verified={identityFlags.verified} verifiedOn={identityFlags.verifiedOn} sx={{ fontWeight: 900 }}>
                                {profile.displayName || profile.username || 'Anonymous'}
                            </IdentityName>
                        </Typography>
                        <Typography variant="body1" sx={{ 
                            opacity: 0.5, 
                            mb: 2,
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.9rem'
                        }}>
                            @{profile.username}
                        </Typography>
                        <Typography variant="body1" sx={{ 
                            mt: 2, 
                            lineHeight: 1.6,
                            color: 'var(--color-gunmetal)',
                            maxWidth: '500px',
                            opacity: profile?.__isFallback ? 0.4 : 1
                        }}>
                            {profile.bio || (profile?.__isFallback ? 'This identity is private within Connect.' : 'No bio yet. This user prefers to stay mysterious.')}
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1.5, mt: 4, justifyContent: { xs: 'center', sm: 'flex-start' }, flexWrap: 'wrap' }}>
                            {isOwnProfile ? (
                                <>
                                    <Button
                                        variant="contained"
                                        startIcon={<EditIcon size={18} />}
                                        sx={{ 
                                            borderRadius: '14px',
                                            px: 3,
                                            py: 1,
                                            fontWeight: 700,
                                            bgcolor: '#F59E0B',
                                            color: 'black',
                                            '&:hover': { bgcolor: alpha('#F59E0B', 0.8) }
                                        }}
                                        onClick={() => setIsEditModalOpen(true)}
                                    >
                                        Edit Profile
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<SettingsIcon size={18} />}
                                        sx={{ 
                                            borderRadius: '14px',
                                            px: 3,
                                            py: 1,
                                            fontWeight: 700,
                                            borderColor: 'rgba(255, 255, 255, 0.1)',
                                            color: 'var(--color-titanium)',
                                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                                            '&:hover': { 
                                                borderColor: '#6366F1',
                                                bgcolor: alpha('#6366F1', 0.05)
                                            }
                                        }}
                                        onClick={() => {
                                            const domain = process.env.NEXT_PUBLIC_DOMAIN || 'kylrix.space';
                                            const idSubdomain = process.env.NEXT_PUBLIC_AUTH_SUBDOMAIN || 'accounts';
                                            window.location.href = `https://${idSubdomain}.${domain}/settings?source=${encodeURIComponent(window.location.origin)}`;
                                        }}
                                    >
                                        Settings
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant={isFollowing ? "outlined" : "contained"}
                                        startIcon={<PersonAddIcon size={18} />}
                                        sx={{ 
                                            borderRadius: '14px',
                                            px: 3,
                                            py: 1,
                                            fontWeight: 700,
                                            bgcolor: isFollowing ? 'transparent' : '#F59E0B',
                                            color: isFollowing ? '#F59E0B' : 'black',
                                            borderColor: isFollowing ? '#F59E0B' : 'none',
                                            '&:hover': { 
                                                bgcolor: isFollowing ? alpha('#F59E0B', 0.05) : alpha('#F59E0B', 0.8) 
                                            }
                                        }}
                                        onClick={handleFollow}
                                        disabled={followLoading || !currentUser}
                                    >
                                        {isFollowing ? 'Following' : 'Follow'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<ChatIcon size={18} />}
                                        sx={{ 
                                            borderRadius: '14px',
                                            px: 3,
                                            py: 1,
                                            fontWeight: 700,
                                            borderColor: 'rgba(255, 255, 255, 0.1)',
                                            color: 'var(--color-titanium)',
                                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                                            '&:hover': { 
                                                borderColor: '#6366F1',
                                                bgcolor: alpha('#6366F1', 0.05)
                                            }
                                        }}
                                        onClick={handleMessage}
                                    >
                                        Message
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Flag size={18} />}
                                        sx={{ 
                                            borderRadius: '14px',
                                            px: 3,
                                            py: 1,
                                            fontWeight: 700,
                                            borderColor: 'rgba(255, 255, 255, 0.1)',
                                            color: 'var(--color-titanium)',
                                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                                            '&:hover': { 
                                                borderColor: '#EF4444',
                                                bgcolor: alpha('#EF4444', 0.06)
                                            }
                                        }}
                                        onClick={() => setIsReportModalOpen(true)}
                                        disabled={!currentUser}
                                    >
                                        Report
                                    </Button>
                                </>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Paper>

            {!isOwnProfile && profile?.userId && (
                <ReportUserDialog
                    open={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    targetUserId={profile.userId || profile.$id}
                    targetUsername={profile.username}
                    contextType="profile"
                    contextId={profile.$id}
                    contextUrl={typeof window !== 'undefined' ? window.location.href : null}
                    sourceApp="connect"
                />
            )}

            <Typography variant="h6" sx={{ 
                fontWeight: 800, 
                mb: 3, 
                fontFamily: 'var(--font-clash)',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                opacity: 0.8
            }}>
                <Activity size={20} color="#F59E0B" /> Activity Stats
            </Typography>
            <Stack direction="row" spacing={2}>
                <Paper sx={{ 
                    p: 3, 
                    textAlign: 'center', 
                    borderRadius: '24px', 
                    flex: 1,
                    background: '#161412',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                    position: 'relative',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '24px'
                    }
                }} elevation={0}>
                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-clash)' }}>{stats.posts}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', mt: 1 }}>Posts</Typography>
                </Paper>
                <Paper sx={{ 
                    p: 3, 
                    textAlign: 'center', 
                    borderRadius: '24px', 
                    flex: 1,
                    background: '#161412',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        borderColor: 'rgba(99, 102, 241, 0.3)'
                    },
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '24px'
                    }
                }} elevation={0} onClick={handleOpenFollowers}>
                    <Typography variant="h4" sx={{ fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-clash)' }}>{stats.followers}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', mt: 1 }}>Followers</Typography>
                </Paper>
                <Paper sx={{ 
                    p: 3, 
                    textAlign: 'center', 
                    borderRadius: '24px', 
                    flex: 1,
                    background: '#161412',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: '0 1px 0 rgba(0,0,0,0.4)',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                        borderColor: 'rgba(245, 158, 11, 0.3)'
                    },
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '24px'
                    }
                }} elevation={0} onClick={handleOpenFollowing}>
                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-clash)' }}>{stats.following}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em', mt: 1 }}>Following</Typography>
                </Paper>
            </Stack>

            <Box sx={{ mt: 6 }}>
                <Typography variant="h6" sx={{ 
                    fontWeight: 800, 
                    mb: 3, 
                    fontFamily: 'var(--font-clash)',
                    opacity: 0.8
                }}>
                    Moments
                </Typography>

                {momentsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                ) : (
                    <Stack spacing={2}>
                        {moments.map((moment) => (
                            <Paper
                                key={moment.$id}
                                onClick={() => router.push(`/post/${moment.$id}`)}
                                sx={{
                                    p: 2.5,
                                    borderRadius: 5,
                                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.04)',
                                        borderColor: 'rgba(245, 158, 11, 0.3)',
                                        transform: 'translateY(-2px)'
                                    }
                                }}
                            >
                                <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.6 }}>
                                    {moment.caption}
                                </Typography>
                                <Stack direction="row" spacing={3} sx={{ color: 'text.disabled' }}>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <Heart size={14} fill={moment.isLiked ? '#F59E0B' : 'none'} color={moment.isLiked ? '#F59E0B' : 'currentColor'} />
                                        <Typography variant="caption" fontWeight={700}>{moment.stats?.likes || 0}</Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <MessageCircle size={14} />
                                        <Typography variant="caption" fontWeight={700}>{moment.stats?.replies || 0}</Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <Repeat2 size={14} />
                                        <Typography variant="caption" fontWeight={700}>{moment.stats?.pulses || 0}</Typography>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
                        {moments.length === 0 && (
                            <Typography sx={{ textAlign: 'center', py: 4, opacity: 0.4, fontWeight: 600 }}>No moments shared yet.</Typography>
                        )}
                    </Stack>
                )}
            </Box>

            <EditProfileModal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                profile={profile}
                onUpdate={() => {
                    refreshMyProfile();
                    loadProfile();
                }}
            />

            <ActorsListDrawer
                open={actorsDrawerOpen}
                onClose={() => setActorsDrawerOpen(false)}
                title={actorsTitle}
                actors={actorsList}
                onSelect={(actor) => { setActorsDrawerOpen(false); router.push(`/u/${actor.username}`); }}
                onAction={handleActorAction}
            />
        </Box>
        </motion.div>
    );
};
