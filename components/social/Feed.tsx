'use client';

import React, { useEffect, useLayoutEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';
import { ChatService } from '@/lib/services/chat';
import { useAuth } from '@/lib/auth';
import {
    Box,
    Card,
    CardHeader,
    CardContent,
    CardActions,
    Avatar,
    Typography,
    IconButton,
    TextField,
    Button,
    CircularProgress,
    Divider,
    Menu,
    MenuItem,
    Paper,
    alpha,
    Tooltip,
    Stack,
    Fab,
    useMediaQuery,
    useTheme,
    Skeleton
} from '@mui/material';
import {
    Heart,
    MessageCircle,
    Repeat2,
    Share,
    Bookmark,
    X,
    FileText,
    Calendar,
    Send,
    MapPin,
    Clock,
    MoreHorizontal,
    Trash2,
    Edit,
    Image as ImageIcon,
    Plus,
    Search,
    Phone,
    Video
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById, seedIdentityCache, subscribeIdentityCache } from '@/lib/identity-cache';
import { resolveIdentity, resolveIdentityUsername } from '@/lib/identity-format';
import { seedMomentPreview } from '@/lib/moment-preview';
import { FormattedText } from '../common/FormattedText';
import { FastDraftInput } from "../common/FastDraftInput";
import type { FastDraftInputHandle } from "../common/FastDraftInput";

import { NoteSelectorModal } from './NoteSelectorModal';
import { NoteViewDrawer } from './NoteViewDrawer';
import { EventSelectorModal } from './EventSelectorModal';
import { EventViewDrawer } from './EventViewDrawer';
import { CallSelectorModal } from './CallSelectorModal';
import ActorsListDrawer from './ActorsListDrawer';
import { useAppChrome } from '@/components/providers/AppChromeProvider';
import { useProfile } from '@/components/providers/ProfileProvider';
import { formatPostTimestamp } from '@/lib/time';
import { useCachedProfilePreview } from '@/hooks/useCachedProfilePreview';
import { getUserSubscriptionTier } from '@/lib/user-utils';
import { showUpgradeIsland } from '@/lib/upgrade-island';

import toast from 'react-hot-toast';

const CACHE_KEY = 'kylrix_feed_cache';
const profileRegistry = new Map<string, any>();
const momentCardSx = {
    borderRadius: '20px',
    bgcolor: '#161514',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.06), 0 0 30px rgba(245, 158, 11, 0.12), 0 22px 48px rgba(0, 0, 0, 0.34)',
    overflow: 'hidden',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    '&:hover': {
        bgcolor: '#161514',
        transform: 'translateY(-2px)',
        borderColor: 'rgba(245, 158, 11, 0.18)',
        boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.1), 0 0 38px rgba(245, 158, 11, 0.2), 0 24px 56px rgba(0, 0, 0, 0.38)'
    }
} as const;
type FeedCacheRecord = {
    rows: any[];
    cachedAt: number;
};
const feedAvatarSx = {
    width: 40,
    height: 40,
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
} as const;
const feedTitleSx = {
    fontWeight: 850,
    fontSize: '0.93rem',
    lineHeight: 1.2,
    color: 'white',
    fontFamily: 'var(--font-clash)',
    letterSpacing: '0.01em',
} as const;
const feedSubheaderSx = {
    opacity: 0.42,
    fontWeight: 700,
    fontSize: '0.8rem',
    lineHeight: 1.2,
    fontFamily: 'var(--font-mono)',
} as const;
const feedBodySx = {
    color: 'text.primary',
    fontSize: '0.92rem',
    lineHeight: 1.45,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
} as const;
const feedActionCountSx = { 
    fontWeight: 700,
    opacity: 0.5,
    fontSize: '0.72rem',
    lineHeight: 1,
} as const;

const readFeedCache = (view: string): FeedCacheRecord | null => {
    if (typeof window === 'undefined') return null;

    const cached = localStorage.getItem(`${CACHE_KEY}_${view}`);
    if (!cached) return null;

    try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
            return { rows: parsed, cachedAt: Date.now() };
        }

        if (parsed && Array.isArray(parsed.rows)) {
            return { rows: parsed.rows, cachedAt: Number(parsed.cachedAt) || Date.now() };
        }
    } catch {
        return null;
    }

    return null;
};

const getInitialFeedCache = (view: string) => readFeedCache(view);

const writeFeedCache = (view: string, rows: any[], cachedAt: number = Date.now()) => {
    if (typeof window === 'undefined') return;

    const payload: FeedCacheRecord = {
        rows: rows.slice(0, 50),
        cachedAt,
    };
    localStorage.setItem(`${CACHE_KEY}_${view}`, JSON.stringify(payload));
};

const FeedSkeleton = () => (
    <Stack spacing={3}>
        {[1, 2, 3].map((i) => (
                    <Card key={i} sx={{ borderRadius: '20px', bgcolor: '#000000', border: '1px solid rgba(255, 255, 255, 0.07)', boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.04), 0 0 24px rgba(245, 158, 11, 0.08)' }} elevation={0}>
                        <CardHeader
                    avatar={<Skeleton variant="circular" width={36} height={36} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />}
                    title={<Skeleton width="40%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />}
                    subheader={<Skeleton width="20%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />}
                />
                <CardContent>
                    <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2, bgcolor: 'rgba(255,255,255,0.05)' }} />
                </CardContent>
            </Card>
        ))}
    </Stack>
);

type ComposerFilePreview = {
    file: File;
    url: string;
};

const PostComposer = React.memo(function PostComposer({
    isMobile,
    isOpen,
    user,
    userAvatarUrl,
    editingMoment,
    selectedNote,
    selectedEvent,
    selectedCall,
    pulseTarget,
    selectedFiles,
    posting,
    onCancel,
    onSubmit,
    onSelectFiles,
    onOpenNote,
    onOpenEvent,
    onOpenCall,
    onClearNote,
    onClearEvent,
    onClearCall,
    onClearPulseTarget,
    onRemoveFile,
    composerKey,
    draftInputRef,
    hasDraftText: hasDraftTextProp,
    setHasDraftText,
}: {
    isMobile: boolean;
    isOpen: boolean;
    user: any;
    userAvatarUrl: string | null;
    editingMoment: any;
    selectedNote: any;
    selectedEvent: any;
    selectedCall: any;
    pulseTarget: any;
    selectedFiles: File[];
    posting: boolean;
    composerKey: string;
    onCancel: () => void;
    onSubmit: (content: string) => Promise<void>;
    onSelectFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onOpenNote: () => void;
    onOpenEvent: () => void;
    onOpenCall: () => void;
    onClearNote: () => void;
    onClearEvent: () => void;
    onClearCall: () => void;
    onClearPulseTarget: () => void;
    onRemoveFile: (index: number) => void;
    draftInputRef: React.RefObject<FastDraftInputHandle | null>;
    hasDraftText: boolean;
    setHasDraftText: React.Dispatch<React.SetStateAction<boolean>>;
}) {
    const [filePreviews, setFilePreviews] = React.useState<ComposerFilePreview[]>([]);
    const mediaInputRef = React.useRef<HTMLInputElement | null>(null);
    const isProPlan = getUserSubscriptionTier(user) === 'PRO';

    React.useEffect(() => {
        if (!isOpen) return;
        const value = editingMoment?.caption || '';
        setHasDraftText(Boolean(value.trim()));
        const t = setTimeout(() => {
            draftInputRef.current?.focus();
        }, 0);
        return () => clearTimeout(t);
    }, [composerKey, editingMoment?.caption, draftInputRef, isOpen, setHasDraftText]);

    React.useEffect(() => {
        const previews = selectedFiles.map((file) => ({
            file,
            url: URL.createObjectURL(file),
        }));
        setFilePreviews(previews);
        return () => {
            previews.forEach((preview) => URL.revokeObjectURL(preview.url));
        };
    }, [selectedFiles]);

    const canSubmit = Boolean(
        hasDraftTextProp || selectedNote || selectedEvent || selectedCall || pulseTarget || selectedFiles.length > 0
    );

    return (
        <motion.div
            initial={false}
            animate={isMobile ? (isOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 100 }) : { opacity: isOpen ? 1 : 0.01 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={isMobile ? {
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 2000,
                padding: '16px',
                background: '#161514',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '24px 24px 0 0',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
                transform: 'translateZ(0)',
                willChange: 'transform, opacity',
                backfaceVisibility: 'hidden',
                pointerEvents: isOpen ? 'auto' : 'none',
                visibility: isOpen ? 'visible' : 'hidden',
            } : {
                pointerEvents: isOpen ? 'auto' : 'none',
                visibility: isOpen ? 'visible' : 'hidden',
            }}
            aria-hidden={!isOpen}
        >
                    <Card sx={{
                        mb: isMobile ? 0 : 4,
                        borderRadius: isMobile ? '16px' : '24px',
                        bgcolor: isMobile ? 'transparent' : 'rgba(255, 255, 255, 0.03)',
                        border: isMobile ? 'none' : '1px solid rgba(255, 255, 255, 0.08)'
                    }} elevation={0}>
                        <CardContent sx={{ p: isMobile ? 1 : 3 }}>
                            {isMobile && (
                                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                                    <IconButton onClick={onCancel} sx={{ color: 'rgba(255,255,255,0.3)' }}>
                                        <X size={20} />
                                    </IconButton>
                                </Box>
                            )}
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Avatar
                                    src={userAvatarUrl || undefined}
                                    sx={{ bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B', fontWeight: 800 }}
                                >
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                </Avatar>
                                <FastDraftInput
                                    ref={draftInputRef}
                                    initialValue={editingMoment?.caption || ''}
                                    placeholder={editingMoment ? 'Update your moment...' : 'Share an update with the ecosystem...'}
                                    rows={isMobile ? 4 : 2}
                                    autoFocus
                                    onEmptyChange={setHasDraftText}
                                />
                            </Box>
                            {editingMoment && (
                                <Box sx={{ mt: 1, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 900, letterSpacing: '0.05em' }}>
                                        EDITING MODE
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={onCancel}
                                        sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}
                                    >
                                        Cancel
                                    </Button>
                                </Box>
                            )}
                            {selectedNote && (
                                <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', bgcolor: 'rgba(0, 240, 255, 0.03)', borderColor: 'rgba(0, 240, 255, 0.2)', position: 'relative' }}>
                                    <FileText size={20} color="#6366F1" style={{ marginRight: '16px' }} strokeWidth={1.5} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="subtitle2" fontWeight={800} noWrap>
                                            {selectedNote.title || 'Untitled Note'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                            {selectedNote.content?.substring(0, 60).replace(/[#*`]/g, '')}...
                                        </Typography>
                                    </Box>
                                    <IconButton size="small" onClick={onClearNote} sx={{ ml: 1 }}>
                                        <X size={16} strokeWidth={1.5} />
                                    </IconButton>
                                </Paper>
                            )}
                            {selectedEvent && (
                                <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', bgcolor: 'rgba(0, 163, 255, 0.03)', borderColor: 'rgba(0, 163, 255, 0.2)', position: 'relative' }}>
                                    <Calendar size={20} color="#00A3FF" style={{ marginRight: '16px' }} strokeWidth={1.5} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="subtitle2" fontWeight={800} noWrap>
                                            {selectedEvent.title || 'Untitled Event'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                            {new Date(selectedEvent.startTime).toLocaleString()}
                                        </Typography>
                                    </Box>
                                    <IconButton size="small" onClick={onClearEvent} sx={{ ml: 1 }}>
                                        <X size={16} strokeWidth={1.5} />
                                    </IconButton>
                                </Paper>
                            )}
                            {selectedCall && (
                                <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', bgcolor: 'rgba(245, 158, 11, 0.03)', borderColor: 'rgba(245, 158, 11, 0.2)', position: 'relative' }}>
                                    {selectedCall.type === 'video' ? <Video size={20} color="#F59E0B" style={{ marginRight: '16px' }} strokeWidth={1.5} /> : <Phone size={20} color="#F59E0B" style={{ marginRight: '16px' }} strokeWidth={1.5} />}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="subtitle2" fontWeight={800} noWrap>
                                            {selectedCall.title || `${selectedCall.type.charAt(0).toUpperCase() + selectedCall.type.slice(1)} Call`}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                            Starts: {new Date(selectedCall.startsAt).toLocaleString()}
                                        </Typography>
                                    </Box>
                                    <IconButton size="small" onClick={onClearCall} sx={{ ml: 1 }}>
                                        <X size={16} strokeWidth={1.5} />
                                    </IconButton>
                                </Paper>
                            )}
                            {pulseTarget && (
                                <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3, bgcolor: 'rgba(16, 185, 129, 0.03)', borderColor: 'rgba(16, 185, 129, 0.2)', position: 'relative' }}>
                                    <Repeat2 size={20} color="#10B981" style={{ marginRight: '16px' }} strokeWidth={1.5} />
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="subtitle2" fontWeight={800} noWrap>
                                            Quoting {resolveIdentity(pulseTarget.creator, pulseTarget.userId || pulseTarget.creatorId).handle}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                            {pulseTarget.caption?.substring(0, 60)}...
                                        </Typography>
                                    </Box>
                                    <IconButton size="small" onClick={onClearPulseTarget} sx={{ ml: 1 }}>
                                        <X size={16} strokeWidth={1.5} />
                                    </IconButton>
                                </Paper>
                            )}
                            {filePreviews.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                                    {filePreviews.map((preview, idx) => (
                                        <Box key={`${preview.file.name}-${preview.file.lastModified}-${idx}`} sx={{ position: 'relative', width: 80, height: 80 }}>
                                            <Box
                                                component="img"
                                                src={preview.url}
                                                sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 2, border: '1px solid rgba(255,255,255,0.1)' }}
                                            />
                                            <IconButton
                                                size="small"
                                                sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'rgba(0,0,0,0.6)', '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' } }}
                                                onClick={() => onRemoveFile(idx)}
                                            >
                                                <X size={12} color="white" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </CardContent>
                        <Divider sx={{ opacity: 0.05 }} />
                        <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1.5, bgcolor: '#000000' }}>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                <input
                                    ref={mediaInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    id="media-upload"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        onSelectFiles(e);
                                        e.currentTarget.value = '';
                                    }}
                                />
                                <IconButton
                                    aria-disabled={!isProPlan}
                                    onClick={() => {
                                        if (!isProPlan) {
                                            showUpgradeIsland('attach media to moments');
                                            return;
                                        }
                                        mediaInputRef.current?.click();
                                    }}
                                    sx={{
                                        borderRadius: '10px',
                                        color: isProPlan ? '#F59E0B' : 'rgba(255, 255, 255, 0.28)',
                                        bgcolor: isProPlan ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                        opacity: isProPlan ? 1 : 0.55,
                                        cursor: isProPlan ? 'pointer' : 'not-allowed',
                                        '&:hover': {
                                            bgcolor: isProPlan ? alpha('#F59E0B', 0.1) : 'rgba(255, 255, 255, 0.03)',
                                            color: isProPlan ? '#F59E0B' : 'rgba(255, 255, 255, 0.35)',
                                        }
                                    }}
                                >
                                    <ImageIcon size={20} strokeWidth={1.5} />
                                </IconButton>
                                <Button
                                    startIcon={<FileText size={18} strokeWidth={1.5} />}
                                    onClick={onOpenNote}
                                    sx={{
                                        borderRadius: '10px',
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        color: 'text.secondary',
                                        minWidth: 0,
                                        px: 1.5,
                                        '&:hover': { color: 'primary.main', bgcolor: 'rgba(0, 240, 255, 0.05)' }
                                    }}
                                >
                                    {!isMobile && 'Note'}
                                </Button>
                                <Button
                                    startIcon={<Calendar size={18} strokeWidth={1.5} />}
                                    onClick={onOpenEvent}
                                    sx={{
                                        borderRadius: '10px',
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        color: 'text.secondary',
                                        minWidth: 0,
                                        px: 1.5,
                                        '&:hover': { color: 'primary.main', bgcolor: 'rgba(99, 102, 241, 0.05)' }
                                    }}
                                >
                                    {!isMobile && 'Event'}
                                </Button>
                                <Button
                                    startIcon={<Phone size={18} strokeWidth={1.5} />}
                                    onClick={onOpenCall}
                                    sx={{
                                        borderRadius: '10px',
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        color: 'text.secondary',
                                        minWidth: 0,
                                        px: 1.5,
                                        '&:hover': { color: '#F59E0B', bgcolor: alpha('#F59E0B', 0.05) }
                                    }}
                                >
                                    {!isMobile && 'Call'}
                                </Button>
                            </Box>
                                <Button
                                    variant="contained"
                                    disabled={!canSubmit || posting}
                                    onClick={async () => {
                                        await onSubmit(draftInputRef.current?.getValue() || '');
                                    }}
                                sx={{
                                    borderRadius: '12px',
                                    px: 4,
                                    fontWeight: 800,
                                    textTransform: 'none',
                                    bgcolor: '#F59E0B',
                                    color: 'black',
                                    '&:hover': { bgcolor: alpha('#F59E0B', 0.8) }
                                }}
                            >
                                {posting ? <CircularProgress size={20} color="inherit" /> : (editingMoment ? 'Update' : 'Post')}
                            </Button>
                        </CardActions>
                    </Card>
        </motion.div>
    );
});

type MobileComposerDockHandle = {
    open: () => void;
    close: () => void;
};

const MobileComposerDock = React.memo(forwardRef<MobileComposerDockHandle, {
    isMobile: boolean;
    user: any;
    userAvatarUrl: string | null;
    editingMoment: any;
    selectedNote: any;
    selectedEvent: any;
    selectedCall: any;
    pulseTarget: any;
    selectedFiles: File[];
    posting: boolean;
    onCancel: () => void;
    onSubmit: (content: string) => Promise<void>;
    onSelectFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onOpenNote: () => void;
    onOpenEvent: () => void;
    onOpenCall: () => void;
    onClearNote: () => void;
    onClearEvent: () => void;
    onClearCall: () => void;
    onClearPulseTarget: () => void;
    onRemoveFile: (index: number) => void;
    composerKey: string;
    draftInputRef: React.RefObject<FastDraftInputHandle | null>;
    hasDraftText: boolean;
    setHasDraftText: React.Dispatch<React.SetStateAction<boolean>>;
}>(
function MobileComposerDock({
    isMobile,
    user,
    userAvatarUrl,
    editingMoment,
    selectedNote,
    selectedEvent,
    selectedCall,
    pulseTarget,
    selectedFiles,
    posting,
    onCancel,
    onSubmit,
    onSelectFiles,
    onOpenNote,
    onOpenEvent,
    onOpenCall,
    onClearNote,
    onClearEvent,
    onClearCall,
    onClearPulseTarget,
    onRemoveFile,
    composerKey,
    draftInputRef,
    hasDraftText,
    setHasDraftText,
}, ref) {
    const [open, setOpen] = useState(false);
    const { setChromeState, resetChromeState } = useAppChrome();

    useImperativeHandle(ref, () => ({
        open: () => setOpen(true),
        close: () => setOpen(false),
    }), []);

    useEffect(() => {
        if (open) {
            setChromeState({
                mode: 'compact',
                label: editingMoment ? 'Edit moment' : 'Compose',
            });
            return;
        }

        resetChromeState();
    }, [editingMoment, open, resetChromeState, setChromeState]);

    useEffect(() => {
        return () => resetChromeState();
    }, [resetChromeState]);

    const handleCancel = useCallback(() => {
        onCancel();
        setOpen(false);
    }, [onCancel]);

    return (
        <>
            {isMobile && user && !open && (
                <Fab
                    color="primary"
                    disableRipple
                    disableFocusRipple
                    sx={{
                        position: 'fixed',
                        bottom: 'calc(132px + env(safe-area-inset-bottom))',
                        right: 24,
                        width: 64,
                        height: 64,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        bgcolor: '#000000',
                        color: '#F59E0B',
                        backgroundImage: 'linear-gradient(180deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.06) 100%)',
                        boxShadow: '0 18px 44px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(245, 158, 11, 0.18), 0 0 28px rgba(245, 158, 11, 0.24)',
                        transform: 'translateZ(0)',
                        transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        zIndex: 1400,
                        '&::before': {
                            content: '""',
                            position: 'absolute',
                            inset: 6,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.16), transparent 65%)',
                            pointerEvents: 'none',
                        },
                        '&:hover': {
                        bgcolor: '#000000',
                            color: '#F59E0B',
                            transform: 'translateY(-2px) scale(1.04)',
                            boxShadow: '0 22px 50px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(245, 158, 11, 0.22), 0 0 34px rgba(245, 158, 11, 0.3)',
                        },
                        '&:active': {
                            transform: 'translateY(0) scale(0.98)',
                        },
                    }}
                    onPointerDown={(event) => {
                        if ((event).button !== 0) return;
                        setOpen(true);
                    }}
                    onClick={() => setOpen(true)}
                >
                    <Plus size={26} strokeWidth={2.1} />
                </Fab>
            )}

            <PostComposer
                key={composerKey}
                composerKey={composerKey}
                isMobile={isMobile}
                isOpen={!isMobile || open}
                user={user}
                userAvatarUrl={userAvatarUrl}
                editingMoment={editingMoment}
                selectedNote={selectedNote}
                selectedEvent={selectedEvent}
                selectedCall={selectedCall}
                pulseTarget={pulseTarget}
                selectedFiles={selectedFiles}
                posting={posting}
                onCancel={handleCancel}
                onSubmit={onSubmit}
                onSelectFiles={onSelectFiles}
                onOpenNote={onOpenNote}
                onOpenEvent={onOpenEvent}
                onOpenCall={onOpenCall}
                onClearNote={onClearNote}
                onClearEvent={onClearEvent}
                onClearCall={onClearCall}
                onClearPulseTarget={onClearPulseTarget}
                onRemoveFile={onRemoveFile}
                draftInputRef={draftInputRef}
                hasDraftText={hasDraftText}
                setHasDraftText={setHasDraftText}
            />
        </>
    );
}));

const NewPostsWidget = ({ pendingMoments, onClick }: { pendingMoments: any[], onClick: () => void }) => {
    const router = useRouter();
    return (
        <Box 
            onClick={onClick}
            sx={{ 
                position: 'fixed', 
                top: 80, 
                left: '50%', 
                transform: 'translateX(-50%)', 
                zIndex: 1000,
                bgcolor: '#F59E0B',
                color: 'black',
                px: 2,
                py: 1,
                borderRadius: '50px',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                boxShadow: '0 8px 32px rgba(245, 158, 11, 0.3)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': { transform: 'translateX(-50%) translateY(-2px)', bgcolor: alpha('#F59E0B', 0.9) },
                '&:active': { transform: 'translateX(-50%) scale(0.95)' }
            }}
        >
            <Box sx={{ display: 'flex', ml: -0.5 }}>
                {pendingMoments.slice(0, 3).map((m, i) => (
                                    <Avatar 
                                        key={m.$id} 
                                        onClick={(e) => { e.stopPropagation(); const username = resolveIdentityUsername(m.creator, m.userId || m.creatorId); if (username) { router.push(`/u/${username}`); } }}
                                        src={m.creator?.avatar} 
                                        sx={{ 
                                            width: 24, 
                                            height: 24, 
                                            border: '2px solid #F59E0B', 
                                            ml: i === 0 ? 0 : -1,
                                            zIndex: 3 - i,
                                            fontSize: '0.65rem',
                                            bgcolor: '#000000',
                                            color: '#F59E0B',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {resolveIdentity(m.creator, m.userId || m.creatorId).displayName.charAt(0).toUpperCase()}
                                    </Avatar>
                ))}
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', letterSpacing: '0.02em' }}>
                {pendingMoments.length} new {pendingMoments.length === 1 ? 'post' : 'posts'}
            </Typography>
        </Box>
    );
};

interface FeedProps {
    view?: 'personal' | 'trending' | 'search';
}

export const Feed = ({ view = 'personal' }: FeedProps) => {
    const { user } = useAuth();
    const { profile: myProfile } = useProfile();
    const router = useRouter();
    const initialFeedCache = getInitialFeedCache(view);
    const [moments, setMoments] = useState<any[]>(() => initialFeedCache?.rows || []);
    const [loading, setLoading] = useState<boolean>(() => !initialFeedCache);
    const [posting, setPosting] = useState(false);
    const [pendingMoments, setPendingMoments] = useState<any[]>([]);
    const [showNewPosts, setShowNewPosts] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [momentSearchResults, setMomentSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [selectedNote, setSelectedNote] = useState<any>(null);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [selectedCall, setSelectedCall] = useState<any>(null);
    const [pulseTarget, setPulseTarget] = useState<any>(null);
    const [isNoteModalOpen, setIsNoteSelectorOpen] = useState(false);
    const [isNoteDrawerOpen, setIsNoteDrawerOpen] = useState(false);
    const [viewingNote, setViewingNote] = useState<any>(null);
    const [isEventModalOpen, setIsEventSelectorOpen] = useState(false);
    const [isEventDrawerOpen, setIsEventDrawerOpen] = useState(false);
    const [viewingEvent, setViewingEvent] = useState<any>(null);
    const [isCallModalOpen, setIsCallSelectorOpen] = useState(false);
    const [composerResetToken, setComposerResetToken] = useState(0);
    const [postMenuAnchorEl, setPostMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [pulseMenuAnchorEl, setPulseMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [shareAnchorEl, setShareAnchorEl] = useState<null | HTMLElement>(null);
    const [menuMoment, setMenuMoment] = useState<any>(null);
    const [selectedMoment, setSelectedMoment] = useState<any>(null);
    const [actorsDrawerOpen, setActorsDrawerOpen] = useState(false);
    const [actorsList, setActorsList] = useState<any[]>([]);
    const [actorsTitle, setActorsTitle] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [editingMoment, setEditingMoment] = useState<any>(null);
    const [hasDraftText, setHasDraftText] = useState(Boolean(editingMoment?.caption?.trim()));
    const momentsRef = React.useRef<any[]>([]);
    const feedCacheRef = React.useRef<Record<string, any[]>>({});
    const feedCacheAgeRef = React.useRef<Record<string, number>>({});
    const feedLoadSeqRef = React.useRef(0);
    const feedPrefetchRef = React.useRef<Record<string, Promise<void> | undefined>>({});
    const draftInputRef = React.useRef<FastDraftInputHandle | null>(null);
    const mobileComposerDockRef = React.useRef<MobileComposerDockHandle | null>(null);
    const userAvatarUrl = useCachedProfilePreview(myProfile?.avatar || getCachedIdentityById(user?.$id)?.avatar || ((user?.prefs as any)?.profilePicId as string | undefined) || null, 64, 64);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });

    useLayoutEffect(() => {
        // Hydrate the current view immediately so tab switches feel instant.
        momentsRef.current = [];
        const memoryCached = feedCacheRef.current[view];
        const storageCached = memoryCached ? { rows: memoryCached, cachedAt: feedCacheAgeRef.current[view] || Date.now() } : readFeedCache(view);

        if (storageCached) {
            momentsRef.current = storageCached.rows;
            feedCacheRef.current[view] = storageCached.rows;
            feedCacheAgeRef.current[view] = storageCached.cachedAt;
            setMoments(storageCached.rows);
            setLoading(false);
        } else {
            setLoading(true);
        }
    }, [view]);

    const saveToCache = useCallback((data: any[]) => {
        const sliced = data.slice(0, 50);
        feedCacheRef.current[view] = sliced;
        feedCacheAgeRef.current[view] = Date.now();
        writeFeedCache(view, sliced, feedCacheAgeRef.current[view]);
    }, [view]);

    const handleOpenMoment = useCallback((moment: any) => {
        seedMomentPreview(moment);
        router.push(`/post/${moment.$id}`);
    }, [router]);

    const handleToggleLike = async (e: React.MouseEvent, moment: any) => {
        e.stopPropagation();
        if (!user) {
            toast.error('Please login to like this post');
            return;
        }
        try {
            const creatorId = moment.userId || moment.creatorId;
            const contentSnippet = moment.caption?.substring(0, 30);
            const { liked } = await SocialService.toggleLike(user.$id, moment.$id, creatorId, contentSnippet);
            
            // Update local state
            setMoments((prev: any[]) => {
                const next = prev.map((m: any) => m.$id === moment.$id ? {
                    ...m,
                    isLiked: liked,
                    stats: { ...m.stats, likes: Math.max(0, (m.stats?.likes || 0) + (liked ? 1 : -1)) }
                } : m);
                momentsRef.current = next;
                saveToCache(next);
                return next;
            });
        } catch (_e) {
            toast.error('Failed to update like');
        }
    };

    const handleDeletePost = async (momentId: string) => {
        if (!confirm('Are you sure you want to delete this moment?')) return;
        try {
            await SocialService.deleteMoment(momentId);
            setMoments(prev => {
                const next = prev.filter(m => m.$id !== momentId);
                momentsRef.current = next;
                saveToCache(next);
                return next;
            });
            toast.success('Moment deleted');
            setPostMenuAnchorEl(null);
        } catch (_e) {
            toast.error('Failed to delete moment');
        }
    };

    const loadFeed = useCallback(async () => {
        if (view === 'search') {
            setLoading(false);
            return;
        }

        const requestId = ++feedLoadSeqRef.current;
        const cached = feedCacheRef.current[view];

        // Keep the cached view visible while we decide whether to refresh.
        if (cached) {
            momentsRef.current = cached;
            setMoments(cached);
            setLoading(false);
            return;
        } else {
            setLoading(true);
            momentsRef.current = [];
        }
        
        try {
            const response = view === 'trending' ? 
                await SocialService.getTrendingFeed(user?.$id) : 
                await SocialService.getFeed(user?.$id);

            if (requestId !== feedLoadSeqRef.current) return;
                
            const freshRows = response?.rows || [];
            // Filter out current user's own direct posts from the feed source
            const filteredRows = freshRows.filter((m: any) => {
                const creatorId = m.userId || m.creatorId;
                const type = m.metadata?.type || 'post';
                if (user?.$id && creatorId === user.$id && type === 'post') return false;
                return true;
            });
            
            // Phase 1: Update state with fresh data from server
            // We merge fresh data with existing state to preserve any background hydration (like avatars)
            // but we ALWAYS prioritize fresh stats and content from the server.
            const updated = filteredRows.map((fresh: any) => {
                const existing = momentsRef.current.find(p => p.$id === fresh.$id);
                const creatorId = fresh.userId || fresh.creatorId;
                const cachedCreator = getCachedIdentityById(creatorId);
                // Preserve hydrated creator/source if they exist, but take everything else from fresh
                return {
                    ...fresh,
                    creator: existing?.creator || cachedCreator || fresh.creator,
                    sourceMoment: existing?.sourceMoment ? {
                        ...fresh.sourceMoment,
                        creator: existing.sourceMoment.creator || fresh.sourceMoment?.creator
                    } : fresh.sourceMoment
                };
            });

            momentsRef.current = updated;
            setMoments(updated);
            saveToCache(updated);
            const oppositeView = view === 'personal' ? 'trending' : view === 'trending' ? 'personal' : null;
            if (oppositeView && !feedCacheRef.current[oppositeView]) {
                window.setTimeout(() => {
                    if (feedPrefetchRef.current[oppositeView]) return;
                    feedPrefetchRef.current[oppositeView] = (async () => {
                        try {
                            const prefetchResponse = oppositeView === 'trending'
                                ? await SocialService.getTrendingFeed(user?.$id)
                                : await SocialService.getFeed(user?.$id);
                            const rows = prefetchResponse?.rows || [];
                            const filtered = rows.filter((m: any) => {
                                const creatorId = m.userId || m.creatorId;
                                const type = m.metadata?.type || 'post';
                                if (user?.$id && creatorId === user.$id && type === 'post') return false;
                                return true;
                            });
                            feedCacheRef.current[oppositeView] = filtered.slice(0, 50);
                            feedCacheAgeRef.current[oppositeView] = Date.now();
                            writeFeedCache(oppositeView, filtered, feedCacheAgeRef.current[oppositeView]);
                        } catch (_e) {
                            // best effort
                        } finally {
                            delete feedPrefetchRef.current[oppositeView];
                        }
                    })();
                }, 0);
            }

            setLoading(false);

            // Phase 2: Background Hydration for missing profiles
            const uniqueCreatorIds = Array.from(new Set(filteredRows.map((m: any) => m.userId || m.creatorId)));
            
            await Promise.all(uniqueCreatorIds.map(async (id: any) => {
                if (profileRegistry.has(id)) return;
                const cachedIdentity = getCachedIdentityById(id);
                if (cachedIdentity) {
                    profileRegistry.set(id, cachedIdentity);
                    return;
                }
                
                try {
                    const profile = await UsersService.getProfileById(id);
                    if (requestId !== feedLoadSeqRef.current) return;
                    let avatar = null;
                    if (profile?.avatar && !String(profile.avatar).startsWith('http') && profile.avatar.length > 5) {
                        avatar = String(profile.avatar).startsWith('http')
                            ? profile.avatar
                            : await fetchProfilePreview(profile.avatar, 64, 64) as unknown as string;
                    }
                    const hydratedProfile = { ...profile, avatar };
                    profileRegistry.set(id, hydratedProfile);
                    seedIdentityCache(hydratedProfile);
                    
            // Trigger a single state update for all posts by this creator
            setMoments(prev => {
                const next = prev.map(m => {
                    let nextUpdated = m;
                    const mCreatorId = m.userId || m.creatorId;
                    if (mCreatorId === id) {
                        nextUpdated = { ...nextUpdated, creator: profileRegistry.get(id) };
                    }
                            // Also hydrate sourceMoment creators if they match this ID
                            if (nextUpdated.sourceMoment) {
                                const sCreatorId = nextUpdated.sourceMoment.userId || nextUpdated.sourceMoment.creatorId;
                                if (sCreatorId === id) {
                                    nextUpdated = { 
                                        ...nextUpdated, 
                                        sourceMoment: { ...nextUpdated.sourceMoment, creator: profileRegistry.get(id) } 
                                    };
                                }
                    }
                    return nextUpdated;
                });
                momentsRef.current = next;
                return next;
            });
                } catch (_e) {
                    const fallbackProfile = {
                        username: 'user',
                        displayName: 'User',
                        $id: id,
                        userId: id,
                        avatar: null
                    };
                    profileRegistry.set(id, fallbackProfile);
                    seedIdentityCache(fallbackProfile);
                }
            }));
            
            // Final Cache Save
            setMoments(prev => {
                momentsRef.current = prev;
                saveToCache(prev);
                return prev;
            });

        } catch (error: unknown) {
            console.error('Failed to load feed:', error);
            if (momentsRef.current.length === 0) {
                momentsRef.current = [];
                setMoments([]);
            }
        } finally {
            if (requestId === feedLoadSeqRef.current) {
                setLoading(false);
            }
        }
    }, [user, view, saveToCache]);


    useEffect(() => {
        const unsubscribe = subscribeIdentityCache((identity) => {
            profileRegistry.set(identity.userId, identity);
            setMoments(prev => {
                const next = prev.map((m) => {
                    const creatorId = m.userId || m.creatorId;
                    if (creatorId === identity.userId) {
                        return { ...m, creator: identity };
                    }

                    if (m.sourceMoment) {
                        const sourceCreatorId = m.sourceMoment.userId || m.sourceMoment.creatorId;
                        if (sourceCreatorId === identity.userId) {
                            return {
                                ...m,
                                sourceMoment: { ...m.sourceMoment, creator: identity }
                            };
                        }
                    }

                    return m;
                });
                momentsRef.current = next;
                return next;
            });
        });

        return unsubscribe;
    }, []);

    useEffect(() => {
        moments.slice(0, 20).forEach(seedMomentPreview);
    }, [moments]);

    useEffect(() => {
        if (view === 'search') return;
        loadFeed();
    }, [view, user?.$id, loadFeed]);

    useEffect(() => {
        // Real-time subscription for new posts
        const unsubFunc = SocialService.subscribeToFeed(async (event) => {
            if (event.type === 'create') {
                const payload = event.payload;
                const authorId = payload?.userId || payload?.authorId || payload?.createdBy || payload?.$createdBy || payload?.creatorId || payload?.creator?.$id || payload?.creator?.userId || payload?.user?.$id || payload?.user?.userId;

                if (authorId && user?.$id && authorId === user.$id) {
                    return;
                }

                const enriched = await SocialService.enrichMoment(payload, user?.$id);
                const nextMoment = enriched || payload;
                const authorLabel =
                    nextMoment?.displayName ||
                    nextMoment?.username ||
                    nextMoment?.author?.displayName ||
                    nextMoment?.author?.username ||
                    (authorId ? resolveIdentityUsername(getCachedIdentityById(authorId), authorId) : null) ||
                    'Someone';
                const teaser = (nextMoment?.caption || nextMoment?.content || nextMoment?.text || 'shared a new post').toString().trim();

                setPendingMoments((prev) => [nextMoment, ...prev.filter((moment) => moment.$id !== nextMoment.$id)]);
                setShowNewPosts(true);

                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kylrix:island-notification', {
                        detail: {
                            type: 'connect',
                            title: `New post from ${authorLabel}`,
                            message: teaser,
                            app: 'connect',
                            majestic: true,
                            duration: 7000,
                        },
                    }));
                }
            } else if (event.type === 'delete') {
                setMoments(prev => {
                    const next = prev.filter(m => m.$id !== event.payload.$id);
                    momentsRef.current = next;
                    return next;
                });
            } else if (event.type === 'update') {
                const payload = event.payload;
                
                // If it's an interaction update (like/reply/pulse), refresh stats for that moment
                if (payload._interactionUpdate || payload.messageId) {
                    const momentId = payload.messageId || payload.$id;
                    const updatedStats = await SocialService.getInteractionCounts(momentId);
                    const isLiked = user?.$id ? await SocialService.isLiked(user.$id, momentId) : false;

                    setMoments(prev => {
                        const next = prev.map(m => m.$id === momentId ? {
                            ...m,
                            stats: updatedStats,
                            isLiked
                        } : m);
                        momentsRef.current = next;
                        return next;
                    });
                } else {
                    // Standard update (e.g. caption changed)
                    const enriched = await SocialService.enrichMoment(payload, user?.$id);
                    setMoments(prev => {
                        const next = prev.map(m => m.$id === enriched.$id ? { ...m, ...enriched } : m);
                        momentsRef.current = next;
                        return next;
                    });
                }
            }
        });

        return () => {
            if (typeof unsubFunc === 'function') {
                const result = unsubFunc();
                if (result instanceof Promise) result.catch(e => console.error('Cleanup failed', e));
            }
        };
    }, [user, view, loadFeed, saveToCache]);

    const handleEditMoment = (moment: any) => {
        setEditingMoment(moment);
        // If there are attachments, we'd ideally load them here, but for now we focus on caption
        setPulseTarget(moment.sourceMoment || null);
        setHasDraftText(Boolean(moment.caption?.trim()));
        mobileComposerDockRef.current?.open();
        setPostMenuAnchorEl(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelComposer = useCallback(() => {
        setEditingMoment(null);
        setHasDraftText(false);
        draftInputRef.current?.clear();
        setSelectedNote(null);
        setSelectedEvent(null);
        setSelectedCall(null);
        setPulseTarget(null);
        setSelectedFiles([]);
        setComposerResetToken((value) => value + 1);
    }, []);

    const handlePost = async (draftText: string) => {
        if (!draftText.trim() && !selectedNote && !selectedEvent && !selectedCall && !pulseTarget && selectedFiles.length === 0) return;
        setPosting(true);
        try {
            if (editingMoment) {
                // Update existing moment
                const updated = await SocialService.updateMoment(editingMoment.$id, draftText);
                const enriched = await SocialService.enrichMoment(updated, user!.$id);
                setMoments(prev => {
                    const next = prev.map(m => m.$id === enriched.$id ? { ...m, ...enriched } : m);
                    momentsRef.current = next;
                    saveToCache(next);
                    return next;
                });
                toast.success('Moment updated');
            } else {
                // Upload files first
                const mediaIds: string[] = [];
                if (selectedFiles.length > 0) {
                    for (const file of selectedFiles) {
                        const id = await SocialService.uploadMedia(file);
                        mediaIds.push(id);
                    }
                }

                const type = pulseTarget ? 'quote' : 'post';
                const createdMoment = await SocialService.createMoment(user!.$id, draftText, type, mediaIds, 'public', selectedNote?.$id, selectedEvent?.$id, pulseTarget?.$id, selectedCall?.$id);
                
                // Enrich and add to local state immediately for instant feedback
                const enriched = await SocialService.enrichMoment(createdMoment, user!.$id);
                setMoments(prev => {
                    if (prev.some(m => m.$id === enriched.$id)) return prev;
                    const updated = [enriched, ...prev];
                    momentsRef.current = updated;
                    saveToCache(updated);
                    return updated;
                });
                toast.success('Moment shared');
            }
            handleCancelComposer();
            // Scroll to top to see own post
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error: unknown) {
            console.error('Failed to post:', error);
            toast.error(editingMoment ? 'Failed to update moment' : 'Failed to post moment');
        } finally {
            setPosting(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...files]);
        }
    };

    const handleQuote = (moment: any) => {
        // Open composer with sourceMoment set
        setPulseTarget(moment);
        setPulseMenuAnchorEl(null);
        // Ensure composer is visible and focused
        mobileComposerDockRef.current?.open();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handlePulse = async (moment: any) => {
        if (!user) return;
        const pulse = momentsRef.current.find(m => m.metadata?.type === 'pulse' && m.metadata?.sourceId === moment.$id && (m.userId === user.$id || m.creatorId === user.$id));
        // Double-check against server state to avoid duplicate pulses
        const alreadyPulsed = moment.isPulsed || (user?.$id ? await SocialService.isPulsed(user.$id, moment.$id) : false);

        if (pulse || alreadyPulsed) {
            // Undo Pulse (Unpulse)
            try {
                const success = await SocialService.unpulseMoment(user.$id, moment.$id);
                if (success) {
                    toast.success('Removed from your feed');
                    // remove pulse row from feed if present
                    setMoments(prev => {
                        const next = prev.filter(m => m.$id !== pulse.$id);
                        momentsRef.current = next;
                        saveToCache(next);
                        return next;
                    });
                    // Update the source moment's pulse flag and count locally
                    setMoments(prev => {
                        const next = prev.map(m => m.$id === moment.$id ? ({
                            ...m,
                            isPulsed: false,
                            stats: { ...m.stats, pulses: Math.max(0, (m.stats?.pulses || 0) - 1) }
                        }) : m);
                        momentsRef.current = next;
                        saveToCache(next);
                        return next;
                    });
                }
            } catch (_e) {
                toast.error('Failed to remove pulse');
            }
        } else {
            // Create Pulse
            try {
                // Double-check again before creating to avoid race
                const stillPulsed = user?.$id ? await SocialService.isPulsed(user.$id, moment.$id) : false;
                if (stillPulsed) {
                    // Another client already pulsed; mark locally and exit
                    setMoments(prev => {
                        const next = prev.map(m => m.$id === moment.$id ? ({ ...m, isPulsed: true }) : m);
                        momentsRef.current = next;
                        saveToCache(next);
                        return next;
                    });
                    toast('Already pulsed');
                } else {
                    await SocialService.createMoment(user.$id, '', 'pulse', [], 'public', undefined, undefined, moment.$id);
                    toast.success('Pulsed to your feed');
                    // Optimistically mark this moment as pulsed
                    setMoments(prev => {
                        const next = prev.map(m => m.$id === moment.$id ? ({ ...m, isPulsed: true, stats: { ...m.stats, pulses: (m.stats?.pulses || 0) + 1 } }) : m);
                        momentsRef.current = next;
                        saveToCache(next);
                        return next;
                    });
                }
            } catch (_e) {
                toast.error('Failed to pulse');
            }
        }
        setPulseMenuAnchorEl(null);
    };

    // Fetch minimal actor list for likes
    const fetchActorsForLikes = async (momentId: string) => {
        try {
            // Query interactions table for likes (non-bloated)
            const interactions = await SocialService._listInteractionsFor(momentId, 'like');
            const actors = await Promise.all(interactions.map(async (i: any) => {
                try {
                    const cached = profileRegistry.get(i.userId) || getCachedIdentityById(i.userId);
                    const p = cached || await UsersService.getProfileById(i.userId);
                    const avatar = p?.avatar
                        ? (String(p.avatar).startsWith('http')
                            ? p.avatar
                            : await fetchProfilePreview(p.avatar, 64, 64) as unknown as string)
                        : null;
                    return { $id: i.userId, username: p?.username, displayName: p?.displayName, avatar };
                } catch (_e) {
                    return { $id: i.userId };
                }
            }));
            return actors;
        } catch (e) {
            console.error('Failed to fetch like actors', e);
            return [];
        }
    };

    // Fetch actors for pulses (who pulsed this moment)
    const fetchActorsForPulses = async (momentId: string) => {
        try {
            const pulses = await SocialService._listPulsesFor(momentId);
            const actors = await Promise.all(pulses.map(async (p: any) => {
                try {
                    const profile = profileRegistry.get(p.userId) || getCachedIdentityById(p.userId) || await UsersService.getProfileById(p.userId);
                    const avatar = profile?.avatar
                        ? (String(profile.avatar).startsWith('http')
                            ? profile.avatar
                            : await fetchProfilePreview(profile.avatar, 64, 64) as unknown as string)
                        : null;
                    return { $id: p.userId, username: profile?.username, displayName: profile?.displayName, avatar };
                } catch (_e) { return { $id: p.userId }; }
            }));
            return actors;
        } catch (e) {
            console.error('Failed to fetch pulse actors', e);
            return [];
        }
    };

    const openActorsList = async (title: string, fetcher: () => Promise<any[]>) => {
        setActorsTitle(title);
        setActorsDrawerOpen(true);
        setActorsList([]);
        const data = await fetcher();
        setActorsList(data);
    };

    const handleOpenNote = (note: any) => {
        setViewingNote(note);
        setIsNoteDrawerOpen(true);
    };

    const handleOpenEvent = (event: any) => {
        setViewingEvent(event);
        setIsEventDrawerOpen(true);
    };

    const handleForwardToSaved = async (moment: any) => {
        if (!user) return;
        try {
            // Find saved messages conversation
            const convs = await ChatService.getConversations(user.$id);
            const savedChat = convs.rows.find((c: any) =>
                c.type === 'direct' && c.participants.length === 1 && c.participants[0] === user.$id
            );

            if (savedChat) {
                await ChatService.sendMessage(
                    savedChat.$id,
                    user.$id,
                    `Forwarded Moment from ${resolveIdentity(moment.creator, moment.userId || moment.creatorId).handle}:\n\n${moment.caption}`,
                    'text'
                );
                alert('Saved to Messages');
            }
        } catch (_e) {
            toast.error('Failed to update like');
        }
    };

    const handleForwardToChat = (moment: any) => {
        if (!moment) return;
        setShareAnchorEl(null);
        // This is a placeholder for a more complex "Share to Chat" flow
        // For now, we'll just redirect to the chat list and the user can forward there
        router.push('/messages');
        toast.success("Select a conversation to share this moment");
    };

    const handleSearch = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            setMomentSearchResults([]);
            return;
        }
        setSearching(true);
        try {
            // Search Users and Moments in parallel
            const [userResult, momentResult] = await Promise.all([
                UsersService.searchUsers(query),
                SocialService.searchMoments(query, user?.$id)
            ]);

            // Enrich User Results
            const enrichedUsers = await Promise.all(userResult.rows.map(async (u: any) => {
                let avatar = null;
                const cachedIdentity = getCachedIdentityById(u.userId || u.$id);
                const sourceAvatar = cachedIdentity?.avatar || u.avatar || null;
                if (sourceAvatar) {
                    try {
                        avatar = String(sourceAvatar).startsWith('http')
                            ? sourceAvatar
                            : await fetchProfilePreview(sourceAvatar, 64, 64) as unknown as string;
                    } catch (_e) {}
                }
                return { ...u, avatar };
            }));

            // Enrich Moment Results with Creator Info
            const enrichedMoments = await Promise.all(momentResult.rows.map(async (m: any) => {
                const creatorId = m.userId || m.creatorId;
                if (profileRegistry.has(creatorId)) {
                    return { ...m, creator: profileRegistry.get(creatorId) };
                }
                const cachedCreator = getCachedIdentityById(creatorId);
                if (cachedCreator) {
                    profileRegistry.set(creatorId, cachedCreator);
                    return { ...m, creator: cachedCreator };
                }
                try {
                    const profile = await UsersService.getProfileById(creatorId);
                    let avatar = null;
                    if (profile?.avatar) {
                        avatar = String(profile.avatar).startsWith('http')
                            ? profile.avatar
                            : await fetchProfilePreview(profile.avatar, 64, 64) as unknown as string;
                    }
                    const enrichedCreator = { ...profile, avatar };
                    profileRegistry.set(creatorId, enrichedCreator);
                    return { ...m, creator: enrichedCreator };
                } catch (_e) {
                    return m;
                }
            }));

            setSearchResults(enrichedUsers);
            setMomentSearchResults(enrichedMoments);
        } catch (e) {
            console.error('Search failed', e);
        } finally {
            setSearching(false);
        }
    }, [user?.$id]);

    useEffect(() => {
        if (view === 'search') {
            const timer = setTimeout(() => {
                handleSearch(searchQuery);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [searchQuery, handleSearch, view]);

    const handleNewPostsClick = () => {
        setMoments(prev => {
            const updated = [...pendingMoments, ...prev];
            saveToCache(updated);
            return updated;
        });
        setPendingMoments([]);
        setShowNewPosts(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (view === 'search' || isSearchOpen) {
        return (
            <Box>
                <Paper sx={{ 
                    p: 1.5, 
                    mb: 4, 
                    borderRadius: '20px', 
                    bgcolor: '#000000',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                }}>
                    {isSearchOpen && (
                        <IconButton onClick={() => setIsSearchOpen(false)} sx={{ color: 'rgba(255,255,255,0.5)' }}>
                            <X size={20} />
                        </IconButton>
                    )}
                    <Search size={20} color="#F59E0B" style={{ marginLeft: isSearchOpen ? '0' : '12px', opacity: 0.6 }} />
                    <TextField 
                        fullWidth
                        placeholder="Search for people by name or @username..."
                        variant="standard"
                        InputProps={{ disableUnderline: true, sx: { fontSize: '1rem', fontWeight: 600 } }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </Paper>

                {searching && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: '#F59E0B' }} /></Box>}
                
                <Stack spacing={3}>
                    {searchResults.length > 0 && (
                        <Box>
                            <Typography variant="overline" sx={{ opacity: 0.5, fontWeight: 900, ml: 1, mb: 1, display: 'block' }}>People</Typography>
                            <Stack spacing={1}>
                                {searchResults
                                    .filter(u => u.userId !== user?.$id) // Hide current user from results
                                    .map((u) => (
                                    <Paper 
                                        key={u.$id}
                                        onClick={() => router.push(`/@${u.username}`)}
                                        sx={{ 
                                            p: 2, 
                                            borderRadius: '16px', 
                                            bgcolor: '#000000',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            '&:hover': { bgcolor: '#1C1A18', transform: 'translateX(4px)', borderColor: 'rgba(245, 158, 11, 0.3)' }
                                        }}
                                    >
                                        <Avatar 
                                            onClick={(e) => { e.stopPropagation(); router.push(`/u/${u.username}`); }}
                                            src={u.avatar} 
                                            sx={{ 
                                                width: 48, 
                                                height: 48, 
                                                bgcolor: alpha('#F59E0B', 0.1), 
                                                color: '#F59E0B', 
                                                fontWeight: 800,
                                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {(u.displayName || u.username)?.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontWeight: 800 }}>{u.displayName || u.username}</Typography>
                                            <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 700 }}>@{u.username}</Typography>
                                        </Box>
                                        <IconButton size="small" sx={{ color: '#F59E0B' }}>
                                            <Plus size={20} />
                                        </IconButton>
                                    </Paper>
                                ))}
                            </Stack>
                        </Box>
                    )}

                    {momentSearchResults.length > 0 && (
                        <Box>
                            <Typography variant="overline" sx={{ opacity: 0.5, fontWeight: 900, ml: 1, mb: 1, display: 'block' }}>Moments</Typography>
                            <Stack spacing={2}>
                                {momentSearchResults.map((moment) => {
                                    const isOwnPost = user?.$id === (moment.userId || moment.creatorId);
                                    const creatorId = moment.userId || moment.creatorId;
                                    const cachedCreator = getCachedIdentityById(creatorId);
                                    const resolvedCreator = resolveIdentity(moment.creator || cachedCreator, creatorId);
                                    const creatorName = isOwnPost ? (user?.name || 'You') : resolvedCreator.displayName;
                                    const creatorAvatar = isOwnPost ? userAvatarUrl : (moment.creator?.avatar || cachedCreator?.avatar || undefined);

                                    return (
                                        <Card
                                            key={moment.$id}
                                            onClick={() => handleOpenMoment(moment)}
                                            sx={{ ...momentCardSx, cursor: 'pointer' }}
                                            elevation={0}
                                        >
                                            <CardHeader
                            avatar={<Avatar onClick={(e) => { e.stopPropagation(); const username = resolveIdentityUsername(moment.creator || cachedCreator, creatorId); if (username) router.push(`/u/${username}`); }} src={creatorAvatar} sx={{ ...feedAvatarSx, width: 36, height: 36, cursor: 'pointer' }} />}
                                                sx={{ px: 2, pt: 2, pb: 0.5, '& .MuiCardHeader-content': { minWidth: 0 } }}
                                                title={<Typography sx={feedTitleSx}>{creatorName}</Typography>}
                                                subheader={<Typography sx={feedSubheaderSx}>{new Date(moment.createdAt).toLocaleDateString()}</Typography>}
                                            />
                                            <CardContent sx={{ pt: 0.25, px: 2, pb: 1.5 }}>
                                                <Typography variant="body2" sx={{ ...feedBodySx, opacity: 0.8, WebkitLineClamp: 3 }}>
                                                    {moment.caption}
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Stack>
                        </Box>
                    )}

                    {!searching && searchQuery && searchResults.length === 0 && momentSearchResults.length === 0 && (
                        <Typography sx={{ textAlign: 'center', py: 8, opacity: 0.4, fontWeight: 600 }}>No results found for &quot;{searchQuery}&quot;</Typography>
                    )}
                    {!searchQuery && (
                        <Box sx={{ textAlign: 'center', py: 8, opacity: 0.4 }}>
                            <Search size={48} style={{ marginBottom: '16px' }} />
                            <Typography sx={{ fontWeight: 700 }}>Search the Kylrix Ecosystem</Typography>
                            <Typography variant="body2">Find friends, creators, and moments.</Typography>
                        </Box>
                    )}
                </Stack>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', p: { xs: 1, sm: 2 }, position: 'relative' }}>
            {showNewPosts && pendingMoments.length > 0 && (
                // Exclude user's own direct posts from the new posts widget
                <NewPostsWidget 
                    pendingMoments={pendingMoments.filter(m => {
                        const creatorId = m.userId || m.creatorId;
                        const type = m.metadata?.type || 'post';
                        return !(user?.$id === creatorId && type === 'post');
                    })} 
                    onClick={handleNewPostsClick} 
                />
            )}
            {/* Create Post */}
            {user && (
                <MobileComposerDock
                    ref={mobileComposerDockRef}
                    key={composerResetToken}
                    composerKey={`${editingMoment?.$id || 'new'}-${composerResetToken}`}
                    isMobile={isMobile}
                    user={user}
                    userAvatarUrl={userAvatarUrl}
                    editingMoment={editingMoment}
                    selectedNote={selectedNote}
                    selectedEvent={selectedEvent}
                    selectedCall={selectedCall}
                    pulseTarget={pulseTarget}
                    selectedFiles={selectedFiles}
                    posting={posting}
                    onCancel={handleCancelComposer}
                    onSubmit={handlePost}
                    onSelectFiles={handleFileSelect}
                    onOpenNote={() => setIsNoteSelectorOpen(true)}
                    onOpenEvent={() => setIsEventSelectorOpen(true)}
                    onOpenCall={() => setIsCallSelectorOpen(true)}
                    onClearNote={() => setSelectedNote(null)}
                    onClearEvent={() => setSelectedEvent(null)}
                    onClearCall={() => setSelectedCall(null)}
                    onClearPulseTarget={() => setPulseTarget(null)}
                    onRemoveFile={(index) => setSelectedFiles((prev) => prev.filter((_, i) => i !== index))}
                    draftInputRef={draftInputRef}
                    hasDraftText={hasDraftText}
                    setHasDraftText={setHasDraftText}
                />
            )}

            {/* Feed */}
            {moments.length === 0 && loading && <FeedSkeleton />}

            {/* Filter out the current user's direct posts (type 'post') from the feed. */}
            {moments
                .filter((m) => {
                    const creatorId = m.userId || m.creatorId;
                    const type = m.metadata?.type || 'post';
                    // Hide if it's the current user's own direct post
                    if (user?.$id && creatorId === user.$id && type === 'post') return false;
                    return true;
                })
                .map((moment) => {
                const isOwnPost = user?.$id === (moment.userId || moment.creatorId);
                const creatorId = moment.userId || moment.creatorId;
                const cachedCreator = getCachedIdentityById(creatorId);
                const resolvedCreator = resolveIdentity(moment.creator || cachedCreator, creatorId);
                const creatorName = isOwnPost ? (user?.name || 'You') : resolvedCreator.displayName;
                const creatorAvatar = isOwnPost ? userAvatarUrl : (moment.creator?.avatar || cachedCreator?.avatar || undefined);

                return (
                    <Card key={moment.$id} sx={{ ...momentCardSx, mb: 3 }} elevation={0}>
                        <CardHeader
                            sx={{ px: 2, pt: 2, pb: 0.75, '& .MuiCardHeader-content': { minWidth: 0 } }}
                            avatar={
                                <Avatar
                                    src={creatorAvatar}
                                    sx={{ 
                                        width: 40,
                                        height: 40,
                                        bgcolor: isOwnPost ? '#F59E0B' : '#000000',
                                        color: isOwnPost ? '#000' : 'text.secondary', 
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        fontWeight: 800,
                                        borderRadius: '14px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    {creatorName.charAt(0).toUpperCase()}
                                </Avatar>
                            }
                            title={
                                <Typography sx={{ ...feedTitleSx, color: isOwnPost ? '#F59E0B' : 'white' }}>
                                    {creatorName}
                                    {isOwnPost && (
                                        <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.4, fontWeight: 800, verticalAlign: 'middle', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.62rem' }}>
                                            Author
                                        </Typography>
                                    )}
                                </Typography>
                            }
                            subheader={
                                <Typography variant="caption" sx={feedSubheaderSx}>
                                    {formatPostTimestamp(moment.$createdAt, moment.$updatedAt)}
                                </Typography>
                            }
                            action={
                                isOwnPost && (
                                    <IconButton 
                                        onClick={(e) => { 
                                            setPostMenuAnchorEl(e.currentTarget); 
                                            setMenuMoment(moment); 
                                        }}
                                        sx={{ color: 'rgba(255, 255, 255, 0.2)', '&:hover': { color: 'white', bgcolor: 'rgba(255,255,255,0.05)' } }}
                                    >
                                        <MoreHorizontal size={18} />
                                    </IconButton>
                                )
                            }
                        />
                        <CardContent
                            sx={{ pt: 0.25, px: 2, pb: 1.5, cursor: 'pointer' }}
                            onClick={() => handleOpenMoment(moment)}
                        >
                        {/* Repost/Pulse Header */}
                        {moment.metadata?.type === 'pulse' && moment.sourceMoment && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, color: '#10B981', opacity: 0.9 }}>
                                <Repeat2 size={13} strokeWidth={3} />
                                <Typography variant="caption" sx={{ fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                    {isOwnPost ? 'PULSED BY YOU' : `PULSED BY ${creatorName.toUpperCase()}`}
                                </Typography>
                            </Box>
                        )}

                        {/* Comment Thread Context */}
                        {moment.metadata?.type === 'reply' && moment.sourceMoment && (
                            <Box sx={{ mb: 2, position: 'relative' }}>
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1.5, 
                                    mb: 1, 
                                    opacity: 0.5,
                                    '&:hover': { opacity: 0.8 },
                                    cursor: 'pointer'
                                }} onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMoment(moment.sourceMoment);
                                }}>
                                    <Avatar src={moment.sourceMoment.creator?.avatar} sx={{ width: 16, height: 16, borderRadius: '5px' }} />
                                    <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: '0.02em', fontSize: '0.72rem' }}>
                                        Replying to {resolveIdentity(moment.sourceMoment.creator, moment.sourceMoment.userId || moment.sourceMoment.creatorId).handle}
                                    </Typography>
                                </Box>
                                <Box sx={{ 
                                    position: 'absolute', 
                                    left: 8, 
                                    top: 20, 
                                    bottom: -10, 
                                    width: '1.5px', 
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    borderRadius: '1px'
                                }} />
                                <Paper sx={{ 
                                    p: 1.25, 
                                    ml: 3,
                                    borderRadius: '12px', 
                                    bgcolor: '#000000', 
                                    border: '1px solid rgba(255, 255, 255, 0.04)',
                                    pointerEvents: 'none'
                                }}>
                                    <Typography variant="caption" sx={{ 
                                        opacity: 0.6, 
                                        display: '-webkit-box', 
                                        WebkitLineClamp: 2, 
                                        WebkitBoxOrient: 'vertical', 
                                        overflow: 'hidden',
                                        fontSize: '0.76rem',
                                        lineHeight: 1.4,
                                        fontStyle: 'italic'
                                    }}>
                                        {moment.sourceMoment.caption}
                                    </Typography>
                                </Paper>
                            </Box>
                        )}

                        {moment.caption && moment.caption.trim() !== "" && (
                            <FormattedText 
                                text={moment.caption}
                                variant="body1"
                                sx={{ 
                                    ...feedBodySx,
                                    lineHeight: 1.5,
                                    fontSize: '0.94rem',
                                    mb: (moment.attachedNote || (moment.sourceMoment && moment.metadata?.type !== 'reply') || moment.metadata?.attachments?.length) ? 1.5 : 0,
                                    mt: moment.metadata?.type === 'reply' ? 1 : 0 
                                }}
                            />
                        )}

                        {/* Media Grid */}
                        {moment.metadata?.attachments?.filter((a: any) => a.type === 'image').length > 0 && (
                            <Box sx={{ 
                                display: 'grid', 
                                gap: 1, 
                                gridTemplateColumns: moment.metadata.attachments.filter((a: any) => a.type === 'image').length === 1 ? '1fr' : '1fr 1fr',
                                mb: 2,
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                bgcolor: 'rgba(0,0,0,0.2)'
                            }}>
                                {moment.metadata.attachments.filter((a: any) => a.type === 'image').map((att: any, i: number) => (
                                    <Box 
                                        key={i} 
                                        component="img" 
                                        src={SocialService.getMediaPreview(att.id, 800, 600)} 
                                        sx={{ 
                                            width: '100%', 
                                            height: moment.metadata.attachments.filter((a: any) => a.type === 'image').length === 1 ? 300 : 180, 
                                            objectFit: 'cover',
                                            transition: 'transform 0.5s ease',
                                            '&:hover': { transform: 'scale(1.02)' }
                                        }} 
                                    />
                                ))}
                            </Box>
                        )}

                        {/* Pulsed/Reposted Content */}
                        {moment.metadata?.type === 'pulse' && moment.sourceMoment && (
                            <Paper sx={{ 
                                p: 1.5, 
                                borderRadius: '16px', 
                                bgcolor: 'rgba(255,255,255,0.01)', 
                                border: '1px solid rgba(255,255,255,0.05)',
                                transition: 'all 0.2s ease',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }
                            }}>
                                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                                    <Avatar src={moment.sourceMoment.creator?.avatar} sx={{ width: 20, height: 20, borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }} />
                                    <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{resolveIdentity(moment.sourceMoment.creator, moment.sourceMoment.userId || moment.sourceMoment.creatorId).displayName}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.3, fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>{resolveIdentity(moment.sourceMoment.creator, moment.sourceMoment.userId || moment.sourceMoment.creatorId).handle}</Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ ...feedBodySx, opacity: 0.7, WebkitLineClamp: 3, lineHeight: 1.45, fontSize: '0.84rem' }}>
                                    {moment.sourceMoment.caption}
                                </Typography>
                            </Paper>
                        )}

                        {moment.metadata?.type === 'quote' && moment.sourceMoment && (
                            <Paper sx={{ 
                                p: 1.5, 
                                borderRadius: '16px', 
                                bgcolor: 'rgba(255,255,255,0.01)', 
                                border: '1px solid rgba(255,255,255,0.05)',
                                transition: 'all 0.2s ease',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' }
                            }}>
                                <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                                    <Avatar src={moment.sourceMoment.creator?.avatar} sx={{ width: 20, height: 20, borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }} />
                                    <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{resolveIdentity(moment.sourceMoment.creator, moment.sourceMoment.userId || moment.sourceMoment.creatorId).displayName}</Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.3, fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>{resolveIdentity(moment.sourceMoment.creator, moment.sourceMoment.userId || moment.sourceMoment.creatorId).handle}</Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ ...feedBodySx, opacity: 0.7, WebkitLineClamp: 3, lineHeight: 1.45, fontSize: '0.84rem' }}>
                                    {moment.sourceMoment.caption}
                                </Typography>
                            </Paper>
                        )}

                        {moment.attachedNote && (
                            <Paper
                                variant="outlined"
                                onClick={() => handleOpenNote(moment.attachedNote)}
                                sx={{
                                    p: 0,
                                    borderRadius: 4,
                                    bgcolor: '#000000',
                                    borderColor: 'rgba(255, 255, 255, 0.08)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    overflow: 'hidden',
                                    '&:hover': {
                                        borderColor: 'rgba(99, 102, 241, 0.4)',
                                        transform: 'translateY(-4px)',
                                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(99, 102, 241, 0.1)'
                                    }
                                }}
                            >
                                <Box sx={{
                                    p: 2,
                                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(0, 163, 255, 0.02) 100%)',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                        <Box
                                            sx={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 1.5,
                                                bgcolor: 'rgba(99, 102, 241, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mr: 2,
                                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.15)'
                                            }}
                                        >
                                            <FileText size={20} color="#6366F1" strokeWidth={1.5} />
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="subtitle1" sx={{ ...feedTitleSx, fontSize: '0.9rem' }}>
                                                    {moment.attachedNote.title || 'Untitled Note'}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, fontSize: '0.68rem' }}>
                                                    Public Note • {new Date(moment.attachedNote.updatedAt || moment.attachedNote.$updatedAt).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Typography variant="body2" sx={{ ...feedBodySx, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5, fontSize: '0.86rem', WebkitLineClamp: 4 }}>
                                            {moment.attachedNote.content?.replace(/[#*`]/g, '')}
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                    px: 2,
                                    py: 1.25,
                                    bgcolor: 'rgba(0, 0, 0, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <Typography variant="caption" sx={{ color: '#6366F1', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                        Shared via Kylrix Note
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                        {moment.attachedNote.tags?.slice(0, 2).map((_tag: string, i: number) => (
                                            <Box key={i} sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255, 255, 255, 0.05)', fontSize: '0.62rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 700 }}>
                                                #{_tag}
                                            </Box>
                                        ))}
                                    </Box>
                                </Box>
                            </Paper>
                        )}

                        {moment.attachedEvent && (
                            <Paper
                                variant="outlined"
                                onClick={() => handleOpenEvent(moment.attachedEvent)}
                                sx={{
                                    p: 0,
                                    borderRadius: 4,
                                    bgcolor: '#000000',
                                    borderColor: 'rgba(255, 255, 255, 0.08)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    overflow: 'hidden',
                                    '&:hover': {
                                        borderColor: 'rgba(0, 163, 255, 0.4)',
                                        transform: 'translateY(-4px)',
                                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 163, 255, 0.1)'
                                    }
                                }}
                            >
                                <Box sx={{
                                    p: 2,
                                    background: 'linear-gradient(135deg, rgba(0, 163, 255, 0.05) 0%, rgba(0, 120, 255, 0.02) 100%)',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                        <Box
                                            sx={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 1.5,
                                                bgcolor: 'rgba(0, 163, 255, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mr: 2,
                                                boxShadow: '0 4px 12px rgba(0, 163, 255, 0.15)'
                                            }}
                                        >
                                            <Calendar size={20} color="#00A3FF" strokeWidth={1.5} />
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="subtitle1" sx={{ ...feedTitleSx, fontSize: '0.9rem' }}>
                                                    {moment.attachedEvent.title || 'Untitled Event'}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, fontSize: '0.68rem' }}>
                                                    Kylrix Flow Event • {new Date(moment.attachedEvent.startTime).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                        </Box>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'rgba(255, 255, 255, 0.6)' }}>
                                            <Clock size={13} strokeWidth={1.5} />
                                            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem' }}>
                                                {new Date(moment.attachedEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(moment.attachedEvent.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                        </Box>
                                        {moment.attachedEvent.location && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'rgba(255, 255, 255, 0.6)' }}>
                                                <MapPin size={13} strokeWidth={1.5} />
                                                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem' }}>
                                                    {moment.attachedEvent.location}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </Box>
                                <Box sx={{
                                    px: 2,
                                    py: 1.25,
                                    bgcolor: 'rgba(0, 0, 0, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <Typography variant="caption" sx={{ color: '#00A3FF', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                        Scheduled via Kylrixflow
                                    </Typography>
                                    <Button size="small" variant="text" sx={{ color: '#00A3FF', fontWeight: 800, fontSize: '0.6rem' }}>
                                        View Details
                                    </Button>
                                </Box>
                            </Paper>
                        )}

                        {moment.attachedCall && (
                            <Paper
                                variant="outlined"
                                onClick={() => router.push(`/call/${moment.attachedCall.$id}`)}
                                sx={{
                                    p: 0,
                                    borderRadius: 4,
                                    bgcolor: '#000000',
                                    borderColor: 'rgba(255, 255, 255, 0.08)',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    overflow: 'hidden',
                                    '&:hover': {
                                        borderColor: 'rgba(245, 158, 11, 0.4)',
                                        transform: 'translateY(-4px)',
                                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(245, 158, 11, 0.1)'
                                    }
                                }}
                            >
                                <Box sx={{
                                    p: 2,
                                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(245, 158, 11, 0.02) 100%)',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                                        <Box
                                            sx={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: 1.5,
                                                bgcolor: 'rgba(245, 158, 11, 0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                mr: 2,
                                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
                                            }}
                                        >
                                            {moment.attachedCall.type === 'video' ? <Video size={20} color="#F59E0B" strokeWidth={1.5} /> : <Phone size={20} color="#F59E0B" strokeWidth={1.5} />}
                                        </Box>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="subtitle1" sx={{ ...feedTitleSx, fontSize: '0.9rem' }}>
                                                    {moment.attachedCall.title || `${moment.attachedCall.type.charAt(0).toUpperCase() + moment.attachedCall.type.slice(1)} Call`}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 600, fontSize: '0.68rem' }}>
                                                    Kylrix Connect Call • {new Date(moment.attachedCall.startsAt).toLocaleDateString()}
                                                </Typography>
                                            </Box>
                                        </Box>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'rgba(255, 255, 255, 0.6)' }}>
                                            <Clock size={13} strokeWidth={1.5} />
                                            <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.72rem' }}>
                                                Starts: {new Date(moment.attachedCall.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                                <Box sx={{
                                    px: 2,
                                    py: 1.25,
                                    bgcolor: 'rgba(0, 0, 0, 0.2)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <Typography variant="caption" sx={{ color: '#F59E0B', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.6rem' }}>
                                        Hosted via Kylrix Connect
                                    </Typography>
                                    <Button size="small" variant="text" sx={{ color: '#F59E0B', fontWeight: 800, fontSize: '0.6rem' }}>
                                        Join Call
                                    </Button>
                                </Box>
                            </Paper>
                        ) }
                    </CardContent>
                        <CardActions sx={{ px: 2, pb: 1.25, pt: 1, justifyContent: 'space-around', color: 'rgba(255, 255, 255, 0.4)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <Tooltip title="Reply">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <IconButton 
                                    size="small"
                                    sx={{ 
                                        p: 0.75,
                                        '&:hover': { color: '#6366F1', bgcolor: alpha('#6366F1', 0.1) } 
                                    }}
                                >
                                    <MessageCircle size={17} strokeWidth={1.5} />
                                </IconButton>
                                <Typography variant="caption" sx={feedActionCountSx}>{moment.stats?.replies || 0}</Typography>
                            </Box>
                        </Tooltip>

                        <Tooltip title="Pulse or Quote">
                            <Box
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openActorsList('Pulsed by', async () => await fetchActorsForPulses(moment.$id));
                                }}
                                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                            >
                                <IconButton 
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPulseMenuAnchorEl(e.currentTarget);
                                        setMenuMoment(moment);
                                    }}
                                    sx={{ 
                                        p: 0.75,
                                        color: moment.isPulsed ? '#10B981' : 'inherit',
                                        bgcolor: moment.isPulsed ? 'rgba(16,185,129,0.06)' : 'transparent',
                                        '&:hover': { color: '#10B981', bgcolor: alpha('#10B981', 0.12) } 
                                    }}
                                >
                                    <Repeat2 size={17} strokeWidth={moment.isPulsed ? 2 : 1.5} />
                                </IconButton>
                                <Typography variant="caption" sx={feedActionCountSx}>{moment.stats?.pulses || 0}</Typography>
                            </Box>
                        </Tooltip>

                <Tooltip title="Heart">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton 
                            size="small"
                            onClick={(e) => handleToggleLike(e, moment)}
                            sx={{ 
                                p: 0.75,
                                color: moment.isLiked ? '#F59E0B' : 'inherit',
                                '&:hover': { color: '#F59E0B', bgcolor: alpha('#F59E0B', 0.1) } 
                            }}
                        >
                            <Heart size={17} fill={moment.isLiked ? '#F59E0B' : 'none'} strokeWidth={1.5} />
                        </IconButton>
                        <Box
                            onClick={(e) => {
                                e.stopPropagation();
                                openActorsList('Likes', async () => await fetchActorsForLikes(moment.$id));
                            }}
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
                        >
                            <Typography sx={feedActionCountSx} variant="caption">{moment.stats?.likes || 0}</Typography>
                        </Box>
                    </Box>
                </Tooltip>

                        <Tooltip title="Bookmark">
                            <IconButton 
                                size="small"
                                sx={{ 
                                    p: 0.75,
                                    '&:hover': { color: '#EC4899', bgcolor: alpha('#EC4899', 0.1) } 
                                }}
                            >
                                <Bookmark size={17} strokeWidth={1.5} />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Share">
                            <IconButton
                                size="small"
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    setShareAnchorEl(e.currentTarget); 
                                    setSelectedMoment(moment); 
                                }}
                                sx={{ 
                                    p: 0.75,
                                    '&:hover': { color: '#6366F1', bgcolor: alpha('#6366F1', 0.1) } 
                                }}
                            >
                                <Share size={17} strokeWidth={1.5} />
                            </IconButton>
                        </Tooltip>
                    </CardActions>
                </Card>
                );
            })}

            <Menu
                anchorEl={postMenuAnchorEl}
                open={Boolean(postMenuAnchorEl)}
                onClose={() => setPostMenuAnchorEl(null)}
                PaperProps={{
                    sx: {
                        mt: 1,
                        borderRadius: '16px',
                        bgcolor: '#000000',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        minWidth: 160
                    }
                }}
            >
                <MenuItem 
                    onClick={() => menuMoment && handleEditMoment(menuMoment)}
                    sx={{ gap: 1.5, py: 1.2, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                    <Edit size={16} strokeWidth={2} style={{ opacity: 0.7 }} /> Edit Moment
                </MenuItem>
                <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />
                <MenuItem 
                    onClick={() => menuMoment && handleDeletePost(menuMoment.$id)}
                    sx={{ gap: 1.5, py: 1.2, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ff4d4d' }}
                >
                    <Trash2 size={16} strokeWidth={2} /> Delete Moment
                </MenuItem>
            </Menu>

            <Menu
                anchorEl={pulseMenuAnchorEl}
                open={Boolean(pulseMenuAnchorEl)}
                onClose={() => setPulseMenuAnchorEl(null)}
                PaperProps={{
                    sx: {
                        mt: 1,
                        borderRadius: '16px',
                        bgcolor: '#000000',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        minWidth: 180
                    }
                }}
            >
                <MenuItem 
                    onClick={() => menuMoment && handlePulse(menuMoment)}
                    sx={{ gap: 1.5, py: 1.2, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10B981' }}
                >
                    <Repeat2 size={18} strokeWidth={2} /> {moments.some(m => m.metadata?.type === 'pulse' && m.metadata?.sourceId === menuMoment?.$id && (m.userId === user?.$id || m.creatorId === user?.$id)) ? 'Unpulse Moment' : 'Pulse Now'}
                </MenuItem>
                <MenuItem 
                    onClick={() => menuMoment && handleQuote(menuMoment)}
                    sx={{ gap: 1.5, py: 1.2, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                    <Edit size={18} strokeWidth={2} style={{ opacity: 0.7 }} /> Quote Moment
                </MenuItem>
            </Menu>

            <Menu
                anchorEl={shareAnchorEl}
                open={Boolean(shareAnchorEl)}
                onClose={() => setShareAnchorEl(null)}
                PaperProps={{
                    sx: {
                        mt: 1,
                        borderRadius: '16px',
                        bgcolor: '#000000',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        minWidth: 200
                    }
                }}
            >
                <MenuItem onClick={() => handleForwardToSaved(selectedMoment)} sx={{ gap: 1.5, py: 1.2, fontWeight: 600 }}>
                    <Bookmark size={20} strokeWidth={1.5} style={{ opacity: 0.7 }} /> Save to Messages
                </MenuItem>
                <MenuItem onClick={() => handleForwardToChat(selectedMoment)} sx={{ gap: 1.5, py: 1.2, fontWeight: 600 }}>
                    <Send size={20} strokeWidth={1.5} style={{ opacity: 0.7 }} /> Forward to Chat
                </MenuItem>
            </Menu>

            {moments.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 10, bgcolor: '#000000', borderRadius: '32px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                    <Typography sx={{ color: 'text.secondary', fontWeight: 700 }}>No moments in the feed yet.</Typography>
                    <Typography variant="body2" sx={{ color: 'text.disabled', mt: 1 }}>Be the first to share an update!</Typography>
                </Box>
            )}

            <NoteSelectorModal
                open={isNoteModalOpen}
                onClose={() => setIsNoteSelectorOpen(false)}
                onSelect={(note) => setSelectedNote(note)}
            />

            <NoteViewDrawer
                open={isNoteDrawerOpen}
                onClose={() => setIsNoteDrawerOpen(false)}
                note={viewingNote}
            />

            <EventSelectorModal
                open={isEventModalOpen}
                onClose={() => setIsEventSelectorOpen(false)}
                onSelect={(event) => setSelectedEvent(event)}
            />

            <CallSelectorModal
                open={isCallModalOpen}
                onClose={() => setIsCallSelectorOpen(false)}
                onSelect={(call) => setSelectedCall(call)}
            />

            <EventViewDrawer
                open={isEventDrawerOpen}
                onClose={() => setIsEventDrawerOpen(false)}
                event={viewingEvent}
            />
            <ActorsListDrawer
                open={actorsDrawerOpen}
                onClose={() => setActorsDrawerOpen(false)}
                title={actorsTitle}
                actors={actorsList}
                mobile={isMobile}
                onSelect={(actor) => { setActorsDrawerOpen(false); router.push(`/@${actor.username || actor.$id}`); }}
            />
        </Box>
    );
};
