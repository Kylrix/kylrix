'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from '@/lib/mui-tailwind/material';
import { 
    Edit3 as EditIcon, 
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
import { ActorsListDrawer } from '../social/ActorsListDrawer';
import type { Actor } from '../social/ActorsListDrawer';

import { getCachedIdentityByUsername, seedIdentityCache, subscribeIdentityCache } from '@/lib/identity-cache';
import { getProfileView, stageProfileView } from '@/lib/profile-handoff';
import { IdentityAvatar, IdentityName, computeIdentityFlags } from '../common/IdentityBadge';
import ReportUserDialog from './ReportUserDialog';
import { useTokenOps } from '@/context/TokenOpsContext';
import { useWalletOverlay } from '@/context/WalletOverlayContext';

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
    const [loading, setLoading] = useState(() => !normalizedUsername || !(preloadedProfile || cachedUsernameProfile));
    const [isFollowing, setIsFollowing] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const { openTokenUserSearch } = useTokenOps();
    const { openWalletWithIntent } = useWalletOverlay();

    const [moments, setMoments] = useState<any[]>([]);
    const [momentsLoading, setMomentsLoading] = useState(false);
    const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });

    const [actorsDrawerOpen, setActorsDrawerOpen] = useState(false);
    const [actorsTitle, setActorsTitle] = useState('');
    const [actorsList, setActorsList] = useState<Actor[]>([]);
    const morphFromPanel = searchParams.get('transition') === 'profile';
    const targetUserId = profile?.userId || profile?.$id || null;

    const isOwnProfile = Boolean(currentUser && targetUserId && currentUser.$id === targetUserId);
    const identityFlags = computeIdentityFlags({
        createdAt: profile?.$createdAt || profile?.createdAt || null,
        lastUsernameEdit: profile?.last_username_edit || profile?.preferences?.last_username_edit || null,
        profilePicId: profile?.avatar || profile?.profilePicId || null,
        username: profile?.username || null,
        bio: profile?.bio || null,
        tier: profile?.tier || null,
        publicKey: profile?.publicKey || null,
    });

    // Subscribe to identity cache updates for this specific username
    // Use debouncing to prevent rapid re-renders from multiple cache updates
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastProfileRef = useRef<any>(profile);

    useEffect(() => {
        if (!normalizedUsername) return;

        const unsubscribe = subscribeIdentityCache((identity) => {
            // Only proceed if the username matches
            if (identity.username !== normalizedUsername) return;

            // Clear existing debounce timer
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

            // Debounce the update: only set profile after 50ms of no updates
            debounceTimerRef.current = setTimeout(() => {
                setProfile((prev: any) => {
                    // Only update if data actually changed to avoid unnecessary renders
                    if (
                        prev &&
                        prev.$id === identity.$id &&
                        prev.username === identity.username &&
                        prev.bio === identity.bio &&
                        prev.displayName === identity.displayName &&
                        prev.avatar === identity.avatar &&
                        JSON.stringify(prev.socialStats) === JSON.stringify(identity.socialStats)
                    ) {
                        return prev;
                    }
                    lastProfileRef.current = identity;
                    return identity;
                });
            }, 50);
        });

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            unsubscribe();
        };
    }, [normalizedUsername]);

    const loadRelatedData = useCallback(async (data: any) => {
        if (!data) return;

        const targetId = data.userId || data.$id;
        if (!targetId) return;

        setMomentsLoading(true);
        try {
            const [feedRes, followStats, followingStatus] = await Promise.all([
                SocialService.getFeed(currentUser?.$id, targetId),
                SocialService.getFollowStats(targetId),
                currentUser ? SocialService.isFollowing(currentUser.$id, targetId) : Promise.resolve(false)]);

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
            stageProfileView(stagedProfile as any, null);
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
                stageProfileView(data, null);
                setProfile((prev: any) => {
                    if (prev && prev.$id === data.$id && prev.username === data.username && prev.bio === data.bio && prev.displayName === data.displayName && prev.avatar === data.avatar) {
                        return prev;
                    }
                    return data;
                });
                void loadRelatedData(data);
            } else {
                setProfile(null);
            }
        } catch (error: unknown) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    }, [cachedUsernameProfile, currentUser, loadRelatedData, myProfile, normalizedUsername, preloadedProfile]);

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
        const targetId = targetUserId;
        if (!targetId) return;
        router.push(`/chats?userId=${targetId}`);
    };

    const handleTip = () => {
        if (!currentUser || !profile || !targetUserId) return;
        openWalletWithIntent({
            mode: 'send',
            toUser: {
                id: String(targetUserId),
                username: String(profile.username || ''),
                displayName: String(profile.displayName || profile.username || 'User'),
            },
        });
    };

    const handleRequest = () => {
        if (!currentUser || !profile || !targetUserId) return;
        openTokenUserSearch({
            mode: 'request',
            fromUserId: currentUser.$id,
            source: 'profile_request',
            preselectedUser: {
                id: String(targetUserId),
                username: String(profile.username || ''),
                displayName: String(profile.displayName || profile.username || 'User'),
            },
        });
    };

    if (loading && !profile) {
        return (
            <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 4 } }}>
                <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: '28px', mb: 4, bgcolor: '#161412', border: '1px solid rgba(255, 255, 255, 0.06)' }} elevation={0}>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Skeleton variant="rounded" width={140} height={140} sx={{ borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.04)' }} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="40%" height={36} sx={{ bgcolor: 'rgba(255,255,255,0.04)', mb: 1 }} />
                            <Skeleton width="25%" sx={{ bgcolor: 'rgba(255,255,255,0.04)', mb: 2 }} />
                            <Skeleton width="60%" sx={{ bgcolor: 'rgba(255,255,255,0.04)' }} />
                        </Box>
                    </Stack>
                </Paper>
                <Stack spacing={2}>
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} variant="rounded" height={100} sx={{ borderRadius: '20px', bgcolor: 'rgba(255,255,255,0.04)' }} />
                    ))}
                </Stack>
            </Box>
        );
    }

    if (!profile) return (
        <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 }, textAlign: 'center', py: { xs: 8, sm: 12 } }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 800, fontFamily: 'var(--font-clash)' }}>
                Profile not found
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1, mb: 4, opacity: 0.6 }}>
                The user @{username} doesn&apos;t exist in our ecosystem.
            </Typography>
            <Button 
                variant="contained" 
                onClick={() => router.push('/')}
                sx={{ 
                    bgcolor: '#F59E0B',
                    color: '#0A0908',
                    fontWeight: 700,
                    borderRadius: '12px',
                    px: 3,
                    py: 1,
                    '&:hover': { bgcolor: '#DBA400' },
                    textTransform: 'none'
                }}
            >
                Go Home
            </Button>
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
        <Box sx={{ maxWidth: 900, mx: 'auto', p: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 4 } }}>
                {/* Profile Header Card */}
                <Paper sx={{ 
                    p: { xs: 3, sm: 5 }, 
                    borderRadius: '28px', 
                    mb: 5,
                    background: '#161412',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)',
                        borderRadius: '28px'
                    }
                }} elevation={0}>
                {/* Accent gradient - static, no re-render triggers */}
                <Box sx={{
                    position: 'absolute',
                    top: -100,
                    right: -100,
                    width: 200,
                    height: 200,
                    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0) 70%)',
                    filter: 'blur(35px)',
                    willChange: 'auto',
                    zIndex: 0
                }} />

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 3, sm: 5 }} alignItems={{ xs: 'center', sm: 'flex-start' }} position="relative" zIndex={1}>
                    {/* Avatar Section */}
                    <Box sx={{ flexShrink: 0, textAlign: 'center' }}>
                        <Box onClick={handleNavigateToPublic} sx={{ cursor: 'pointer', mb: 2 }}>
                            <IdentityAvatar
                                fileId={profile?.avatar}
                                alt={profile.displayName || profile.username || 'profile'}
                                fallback={(profile.displayName || profile.username || 'U').charAt(0).toUpperCase()}
                                verified={identityFlags.verified}
                                pro={identityFlags.pro}
                                size={160}
                                verifiedSize={24}
                                borderRadius="28px"
                            />
                        </Box>
                    </Box>

                    {/* Profile Info Section */}
                    <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
                        <Typography onClick={handleNavigateToPublic} variant="h2" sx={{ 
                            fontWeight: 900, 
                            mb: 0.5,
                            fontFamily: 'var(--font-clash)',
                            letterSpacing: '-0.04em',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            fontSize: { xs: '1.75rem', sm: '2rem' },
                            '&:hover': { opacity: 0.8 }
                        }}>
                            <IdentityName verified={identityFlags.verified} sx={{ fontWeight: 900 }}>
                                {profile.displayName || profile.username || 'Anonymous'}
                            </IdentityName>
                        </Typography>
                        <Typography variant="body1" sx={{ 
                            opacity: 0.5, 
                            mb: 2,
                            fontWeight: 600,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.85rem',
                            letterSpacing: '0.02em'
                        }}>
                            @{profile.username}
                        </Typography>
                        
                        {profile.bio && (
                            <Typography variant="body2" sx={{ 
                                mt: 2.5, 
                                lineHeight: 1.7,
                                color: 'rgba(255, 255, 255, 0.75)',
                                maxWidth: '100%',
                                fontWeight: 500,
                                mb: 3
                            }}>
                                {profile.bio}
                            </Typography>
                        )}

                        {/* Action Buttons */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3.5 }} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
                            {isOwnProfile ? (
                                <>
                                    <Button
                                        variant="contained"
                                        startIcon={<EditIcon size={16} />}
                                        sx={{ 
                                            borderRadius: '12px',
                                            px: 2.5,
                                            py: 0.75,
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            bgcolor: '#F59E0B',
                                            color: '#0A0908',
                                            '&:hover': { 
                                                bgcolor: '#DBA400'
                                            },
                                            textTransform: 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={() => setIsEditModalOpen(true)}
                                        >
                                        Edit Profile
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        variant={isFollowing ? "outlined" : "contained"}
                                        startIcon={<PersonAddIcon size={16} />}
                                        sx={{ 
                                            borderRadius: '12px',
                                            px: 2.5,
                                            py: 0.75,
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            bgcolor: isFollowing ? 'transparent' : '#F59E0B',
                                            color: isFollowing ? '#F59E0B' : '#0A0908',
                                            borderColor: isFollowing ? '#F59E0B' : 'transparent',
                                            '&:hover': { 
                                                bgcolor: isFollowing ? 'rgba(245, 158, 11, 0.08)' : '#DBA400'
                                            },
                                            textTransform: 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={handleFollow}
                                        disabled={followLoading || !currentUser}
                                    >
                                        {isFollowing ? 'Following' : 'Follow'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<ChatIcon size={16} />}
                                        sx={{ 
                                            borderRadius: '12px',
                                            px: 2.5,
                                            py: 0.75,
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            color: 'rgba(255, 255, 255, 0.7)',
                                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                                            '&:hover': { 
                                                borderColor: 'rgba(99, 102, 241, 0.4)',
                                                bgcolor: 'rgba(99, 102, 241, 0.04)'
                                            },
                                            textTransform: 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={handleMessage}
                                    >
                                        Message
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        sx={{
                                            borderRadius: '12px',
                                            px: 2.5,
                                            py: 0.75,
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            color: 'rgba(255, 255, 255, 0.7)',
                                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                                            '&:hover': {
                                                borderColor: 'rgba(99, 102, 241, 0.4)',
                                                bgcolor: 'rgba(99, 102, 241, 0.04)'
                                            },
                                            textTransform: 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={handleTip}
                                        disabled={!currentUser}
                                    >
                                        Tip
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        sx={{
                                            borderRadius: '12px',
                                            px: 2.5,
                                            py: 0.75,
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            color: '#F59E0B',
                                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                                            '&:hover': {
                                                borderColor: '#F59E0B',
                                                bgcolor: 'rgba(245, 158, 11, 0.06)'
                                            },
                                            textTransform: 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={handleRequest}
                                        disabled={!currentUser}
                                    >
                                        Request Tokens
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<Flag size={16} />}
                                        sx={{ 
                                            borderRadius: '12px',
                                            px: 2.5,
                                            py: 0.75,
                                            fontWeight: 700,
                                            fontSize: '0.9rem',
                                            borderColor: 'rgba(255, 255, 255, 0.12)',
                                            color: 'rgba(255, 255, 255, 0.6)',
                                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                                            '&:hover': { 
                                                borderColor: 'rgba(239, 68, 68, 0.4)',
                                                color: 'rgba(239, 68, 68, 0.8)',
                                                bgcolor: 'rgba(239, 68, 68, 0.04)'
                                            },
                                            textTransform: 'none',
                                            whiteSpace: 'nowrap'
                                        }}
                                        onClick={() => setIsReportModalOpen(true)}
                                        disabled={!currentUser}
                                    >
                                        Report
                                    </Button>
                                </>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </Paper>

            {!isOwnProfile && targetUserId && (
                <ReportUserDialog
                    open={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                    targetUserId={targetUserId}
                    targetUsername={profile.username}
                    contextType="profile"
                    contextId={profile.$id}
                    contextUrl={typeof window !== 'undefined' ? window.location.href : null}
                    sourceApp="kylrix"
                />
            )}

            {/* Stats Section */}
            <Box sx={{ mb: 6 }}>
                <Typography variant="h6" sx={{ 
                    fontWeight: 800, 
                    mb: 2.5, 
                    fontFamily: 'var(--font-clash)',
                    fontSize: '0.95rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    opacity: 0.6
                }}>
                    Activity
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <Paper sx={{ 
                        p: { xs: 2.5, sm: 3 }, 
                        textAlign: 'center', 
                        borderRadius: '20px', 
                        flex: 1,
                        background: '#161412',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '1px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '20px'
                        }
                    }} elevation={0}>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-clash)', fontSize: '1.8rem' }}>
                            {stats.posts}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em', mt: 1, display: 'block' }}>
                            Posts
                        </Typography>
                    </Paper>
                    <Paper sx={{ 
                        p: { xs: 2.5, sm: 3 }, 
                        textAlign: 'center', 
                        borderRadius: '20px', 
                        flex: 1,
                        background: '#161412',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                            borderColor: 'rgba(99, 102, 241, 0.2)'
                        },
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '1px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '20px'
                        }
                    }} elevation={0} onClick={handleOpenFollowers}>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: 'var(--color-primary)', fontFamily: 'var(--font-clash)', fontSize: '1.8rem' }}>
                            {stats.followers}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em', mt: 1, display: 'block' }}>
                            Followers
                        </Typography>
                    </Paper>
                    <Paper sx={{ 
                        p: { xs: 2.5, sm: 3 }, 
                        textAlign: 'center', 
                        borderRadius: '20px', 
                        flex: 1,
                        background: '#161412',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            bgcolor: 'rgba(255, 255, 255, 0.02)',
                            borderColor: 'rgba(245, 158, 11, 0.2)'
                        },
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '1px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '20px'
                        }
                    }} elevation={0} onClick={handleOpenFollowing}>
                        <Typography variant="h4" sx={{ fontWeight: 900, color: '#F59E0B', fontFamily: 'var(--font-clash)', fontSize: '1.8rem' }}>
                            {stats.following}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em', mt: 1, display: 'block' }}>
                            Following
                        </Typography>
                    </Paper>
                </Stack>
            </Box>

            {/* Moments Section */}
            <Box>
                <Typography variant="h6" sx={{ 
                    fontWeight: 800, 
                    mb: 2.5, 
                    fontFamily: 'var(--font-clash)',
                    fontSize: '0.95rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    opacity: 0.6
                }}>
                    Activity Feed
                </Typography>

                {momentsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                        <CircularProgress size={32} sx={{ color: '#F59E0B' }} />
                    </Box>
                ) : moments.length === 0 ? (
                    <Paper sx={{
                        p: 4,
                        textAlign: 'center',
                        borderRadius: '20px',
                        background: '#161412',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        position: 'relative',
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '1px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '20px'
                        }
                    }} elevation={0}>
                        <Typography sx={{ opacity: 0.4, fontWeight: 600 }}>
                            No posts yet. Check back soon.
                        </Typography>
                    </Paper>
                ) : (
                    <Stack spacing={2}>
                        {moments.map((moment) => (
                            <Paper
                                key={moment.$id}
                                onClick={() => router.push(`/connect/post/${moment.$id}`)}
                                sx={{
                                    p: 3,
                                    borderRadius: '18px',
                                    bgcolor: '#161412',
                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                                    '&:hover': {
                                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                                        borderColor: 'rgba(245, 158, 11, 0.2)',
                                        transform: 'translateY(-1px)',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                    },
                                    '&::before': {
                                        content: '""',
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '1px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '18px'
                                    }
                                }}
                                elevation={0}
                            >
                                <Typography variant="body2" sx={{ mb: 2.5, color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.6, fontWeight: 500 }}>
                                    {moment.caption}
                                </Typography>
                                <Stack direction="row" spacing={3} sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <Heart size={14} fill={moment.isLiked ? '#F59E0B' : 'none'} color={moment.isLiked ? '#F59E0B' : 'currentColor'} />
                                        <Typography variant="caption" fontWeight={600} sx={{ color: moment.isLiked ? '#F59E0B' : 'inherit' }}>
                                            {moment.stats?.likes || 0}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <MessageCircle size={14} />
                                        <Typography variant="caption" fontWeight={600}>
                                            {moment.stats?.replies || 0}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                        <Repeat2 size={14} />
                                        <Typography variant="caption" fontWeight={600}>
                                            {moment.stats?.pulses || 0}
                                        </Typography>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
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
    );
};
