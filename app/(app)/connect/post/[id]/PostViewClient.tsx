'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { SocialService } from '@/lib/services/social';
import { UsersService } from '@/lib/services/users';
import { getEcosystemUrl } from '@/lib/constants';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/components/providers/ProfileProvider';
import {
    Box,
    Avatar,
    Typography,
    IconButton,
    Button,
    CircularProgress,
    Fab,
    alpha,
    Stack,
    Drawer,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    useMediaQuery,
    useTheme,
    Skeleton,
    Paper, TextField, InputAdornment, Alert, Menu, MenuItem 
} from '@mui/material';
import ActorsListDrawer from '@/components/social/ActorsListDrawer';
import {
    Heart,
    MessageCircle,
    Repeat2,
    LogIn,
    Link2,
    Send,
    Edit,
    Image as ImageIcon,
    Download,
    BarChart3,
    SlidersHorizontal,
    ArrowDownWideNarrow,
    ArrowLeft,
} from 'lucide-react';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { getCachedIdentityById, seedIdentityCache } from '@/lib/identity-cache';
import { resolveIdentity } from '@/lib/identity-format';
import { getCachedMomentPreview, seedMomentPreview } from '@/lib/moment-preview';
import { getCachedMomentThread, isFreshMomentThread, seedMomentThread, THREAD_CACHE_STALE_AFTER_MS } from '@/lib/moment-thread-cache';
import { FormattedText } from '@/components/common/FormattedText';
import toast from 'react-hot-toast';
import { formatPostTimestamp } from '@/lib/time';
import { useCachedProfilePreview } from '@/hooks/useCachedProfilePreview';

const EXPORT_CARD = '#161514';
const EXPORT_PAD = 16;
const EXPORT_MIN_WIDTH = 375;
const EXPORT_MAX_WIDTH = 430;

const clampText = (value: string, limit: number) => {
    const clean = String(value || '').trim();
    return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
};

const getMomentTimeLabel = (moment: any) => {
    return formatPostTimestamp(moment?.$createdAt || moment?.createdAt, moment?.$updatedAt || moment?.updatedAt) || 'Just now';
};

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let current = words.shift() || '';
    for (const word of words) {
        const next = `${current} ${word}`;
        if (ctx.measureText(next).width <= maxWidth) {
            current = next;
        } else {
            lines.push(current);
            current = word;
        }
    }
    lines.push(current);
    return lines;
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
};

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
});

const resolveExportImageSrc = async (src?: string | null) => {
    if (!src) return null;
    if (/^(https?:|data:|blob:)/.test(src)) return src;
    try {
        return await fetchProfilePreview(src, 96, 96);
    } catch (_e) {
        return null;
    }
};

const resolveExportAvatarSource = async (identity: any) => {
    const rawSource = identity?.avatar || identity?.profilePicId || identity?.preferences?.avatar || identity?.preferences?.profilePicId || null;
    return resolveExportImageSrc(rawSource);
};

const drawAvatar = async (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, src?: string | null, label = 'U') => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x, y, size, size);
    const avatar = await loadImage((await resolveExportImageSrc(src)) || '');
    if (avatar) {
        ctx.drawImage(avatar, x, y, size, size);
    } else {
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#161514';
        ctx.font = `700 ${Math.floor(size * 0.45)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.slice(0, 1).toUpperCase(), x + size / 2, y + size / 2 + 2);
    }
    ctx.restore();
};

const drawMetricBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, value: number, label: string, color: string) => {
    ctx.fillStyle = color;
    ctx.font = '900 14px sans-serif';
    ctx.fillText(String(value), x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '800 10px sans-serif';
    ctx.fillText(label.toUpperCase(), x + 18, y);
};

const drawCommentIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 5);
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 4, Math.PI * 1.08, Math.PI * 1.98, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.42, y + size - 6);
    ctx.lineTo(x + size * 0.3, y + size - 1);
    ctx.lineTo(x + size * 0.52, y + size - 3);
    ctx.stroke();
    ctx.restore();
};

const drawRepeatIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(x + size * 0.42, y + size * 0.42, size * 0.24, Math.PI * 1.15, Math.PI * 0.15, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.68, y + size * 0.18);
    ctx.lineTo(x + size * 0.84, y + size * 0.21);
    ctx.lineTo(x + size * 0.74, y + size * 0.36);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size * 0.58, y + size * 0.58, size * 0.24, Math.PI * 0.15, Math.PI * 1.15, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.32, y + size * 0.82);
    ctx.lineTo(x + size * 0.16, y + size * 0.79);
    ctx.lineTo(x + size * 0.26, y + size * 0.64);
    ctx.stroke();
    ctx.restore();
};

const drawHeartIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, filled = false) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = filled ? color : 'transparent';
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const left = x + size * 0.5;
    const top = y + size * 0.28;
    ctx.moveTo(left, y + size * 0.85);
    ctx.bezierCurveTo(x + size * 0.12, y + size * 0.6, x + size * 0.1, top, x + size * 0.33, top);
    ctx.bezierCurveTo(x + size * 0.48, top, x + size * 0.5, y + size * 0.46, left, y + size * 0.36);
    ctx.bezierCurveTo(x + size * 0.5, y + size * 0.46, x + size * 0.52, top, x + size * 0.67, top);
    ctx.bezierCurveTo(x + size * 0.9, top, x + size * 0.88, y + size * 0.6, left, y + size * 0.85);
    if (filled) ctx.fill(); else ctx.stroke();
    ctx.restore();
};

const drawLinkIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(x + size * 0.36, y + size * 0.52, size * 0.2, Math.PI * 0.2, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size * 0.64, y + size * 0.48, size * 0.2, Math.PI * 1.2, Math.PI * 0.85, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + size * 0.48, y + size * 0.4);
    ctx.lineTo(x + size * 0.56, y + size * 0.4);
    ctx.stroke();
    ctx.restore();
};

const drawSendIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 3, y + size * 0.58);
    ctx.lineTo(x + size - 2, y + 4);
    ctx.lineTo(x + size * 0.56, y + size * 0.9);
    ctx.lineTo(x + size * 0.48, y + size * 0.62);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
};

type ThreadPostViewProps = {
    name: string;
    handle: string;
    timeLabel: string;
    caption: string;
    attachments?: { type: string; id: string }[];
    avatarSrc?: string | null;
    avatarLabel: string;
    replyingTo?: string | null;
    stats: { replies?: number; pulses?: number; likes?: number; views?: number };
    threadLineMode?: 'up' | 'down' | 'both' | 'none';
    variant?: 'card' | 'thread';
    onClick?: () => void;
    onLike?: (event: React.MouseEvent) => void;
    onPulse?: (event: React.MouseEvent) => void;
    liked?: boolean;
};

const ThreadPostView = ({
    name,
    handle,
    timeLabel,
    caption,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attachments,
    avatarSrc,
    avatarLabel,
    replyingTo,
    stats,
    threadLineMode = 'none',
    variant = 'card',
    onClick,
    onLike,
    onPulse,
    liked,
}: ThreadPostViewProps) => (
    <Box
        component="article"
        onClick={onClick}
        sx={{
            display: 'flex',
            px: 2,
            py: 1.5,
            position: 'relative',
            cursor: onClick ? 'pointer' : 'default',
            bgcolor: variant === 'card' ? '#161514' : 'transparent',
            border: variant === 'card' ? '1px solid rgba(255,255,255,0.07)' : 'none',
            borderRadius: variant === 'card' ? '20px' : 0,
            boxShadow: variant === 'card' ? '0 0 0 1px rgba(245, 158, 11, 0.08), 0 0 30px rgba(245, 158, 11, 0.12), 0 18px 42px rgba(0, 0, 0, 0.34)' : 'none',
            overflow: 'hidden',
            '&:hover': onClick ? { bgcolor: variant === 'card' ? '#1F1D1B' : 'rgba(255,255,255,0.02)', borderColor: 'rgba(245, 158, 11, 0.16)' } : undefined,
        }}
    >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mr: 1.5, flexShrink: 0, width: 48 }}>
            <Box sx={{ position: 'relative', width: 48, height: '100%', display: 'flex', justifyContent: 'center' }}>
                {(threadLineMode === 'up' || threadLineMode === 'both') && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            bottom: '50%',
                            width: '2px',
                            transform: 'translateX(-1px)',
                            bgcolor: 'rgba(255,255,255,0.16)',
                        }}
                    />
                )}
                <Avatar
                    src={avatarSrc || undefined}
                    sx={{
                        width: 48,
                        height: 48,
                        bgcolor: 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        position: 'relative',
                        zIndex: 1,
                    }}
                >
                    {avatarLabel}
                </Avatar>
                {(threadLineMode === 'down' || threadLineMode === 'both') && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            bottom: 0,
                            width: '2px',
                            transform: 'translateX(-1px)',
                            bgcolor: 'rgba(255,255,255,0.16)',
                        }}
                    />
                )}
            </Box>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'baseline', flexWrap: 'wrap', mb: 0.25 }}>
                <Typography sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.95rem', lineHeight: 1.2 }}>
                    {name}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.93rem', lineHeight: 1.2 }}>
                    {handle}
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.93rem', lineHeight: 1.2 }}>
                    ·
                </Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.93rem', lineHeight: 1.2 }}>
                    {timeLabel}
                </Typography>
            </Box>
            {replyingTo && (
                <Typography sx={{ color: 'text.secondary', fontSize: '0.93rem', mb: 0.25 }}>
                    Replying to <Box component="span" sx={{ color: '#6366F1' }}>{replyingTo}</Box>
                </Typography>
            )}
            <FormattedText
                text={caption}
                variant="body2"
                sx={{
                    color: 'text.primary',
                    fontSize: '0.95rem',
                    lineHeight: 1.35,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: 425, mt: 1.25, color: 'text.secondary', fontSize: '0.8rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <IconButton size="small" sx={{ p: 0.35, color: '#536471' }}>
                        <MessageCircle size={16} strokeWidth={1.8} />
                    </IconButton>
                    <Typography sx={{ fontSize: '0.8rem', color: '#536471' }}>{stats.replies || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <IconButton size="small" onClick={onPulse} sx={{ p: 0.35, color: '#10B981' }}>
                        <Repeat2 size={16} strokeWidth={1.8} />
                    </IconButton>
                    <Typography sx={{ fontSize: '0.8rem', color: '#10B981' }}>{stats.pulses || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <IconButton size="small" onClick={onLike} sx={{ p: 0.35, color: liked ? '#F59E0B' : '#536471' }}>
                        <Heart size={16} fill={liked ? '#F59E0B' : 'none'} strokeWidth={1.8} />
                    </IconButton>
                    <Typography sx={{ fontSize: '0.8rem', color: liked ? '#F59E0B' : '#536471' }}>{stats.likes || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <IconButton size="small" sx={{ p: 0.35, color: '#536471' }}>
                        <BarChart3 size={16} strokeWidth={1.8} />
                    </IconButton>
                    <Typography sx={{ fontSize: '0.8rem', color: '#536471' }}>{stats.views || 0}</Typography>
                </Box>
            </Box>
        </Box>
    </Box>
);

const QuoteMomentView = ({
    name,
    handle,
    timeLabel,
    caption,
    avatarSrc,
    avatarLabel,
    quotedAvatarSrc,
    quotedCaption,
    quotedName,
    quotedHandle,
    attachments,
    stats,
    onClick,
    onLike,
    onPulse,
    liked,
}: {
    name: string;
    handle: string;
    timeLabel: string;
    caption: string;
    avatarSrc?: string | null;
    avatarLabel: string;
    quotedAvatarSrc?: string | null;
    quotedCaption: string;
    quotedName: string;
    quotedHandle: string;
    attachments?: { type: string; id: string }[];
    stats: { replies?: number; pulses?: number; likes?: number; views?: number };
    onClick?: () => void;
    onLike?: (event: React.MouseEvent) => void;
    onPulse?: (event: React.MouseEvent) => void;
    liked?: boolean;
}) => (
    <Box
        component="article"
        onClick={onClick}
        sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            px: 2,
            py: 1.5,
            position: 'relative',
            cursor: onClick ? 'pointer' : 'default',
            bgcolor: '#000000',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.08), 0 0 30px rgba(245, 158, 11, 0.12), 0 18px 42px rgba(0, 0, 0, 0.34)',
            overflow: 'hidden',
            '&:hover': onClick ? { bgcolor: '#000000', borderColor: 'rgba(245, 158, 11, 0.16)' } : undefined,
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Avatar
                src={avatarSrc || undefined}
                sx={{
                    width: 42,
                    height: 42,
                    bgcolor: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    borderRadius: '14px',
                    flexShrink: 0,
                }}
            >
                {avatarLabel}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 800, color: 'text.primary', fontSize: '0.95rem', lineHeight: 1.2 }}>
                        {name}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.93rem', lineHeight: 1.2 }}>
                        {handle}
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.93rem', lineHeight: 1.2 }}>
                        ·
                    </Typography>
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.93rem', lineHeight: 1.2 }}>
                        {timeLabel}
                    </Typography>
                </Box>
            </Box>
        </Box>

        {caption && caption.trim() !== '' && (
            <FormattedText
                text={caption}
                variant="body1"
                sx={{
                    color: 'text.primary',
                    fontSize: '0.94rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                }}
                />
        )}

        {!!attachments?.length && (
            <Box sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: attachments.filter((a) => a.type === 'image').length === 1 ? '1fr' : '1fr 1fr',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(0,0,0,0.2)',
            }}>
                {attachments.filter((a) => a.type === 'image').map((att, i) => (
                    <Box
                        key={`${att.id}-${i}`}
                        component="img"
                        src={SocialService.getMediaPreview(att.id, 800, 600)}
                        sx={{
                            width: '100%',
                            height: attachments.filter((a) => a.type === 'image').length === 1 ? 300 : 180,
                            objectFit: 'cover',
                        }}
                    />
                ))}
            </Box>
        )}

        <Paper
            sx={{
                p: 1.5,
                borderRadius: '16px',
                bgcolor: '#000000',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.05), 0 0 24px rgba(245, 158, 11, 0.08)',
            }}
        >
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
                <Avatar src={quotedAvatarSrc || undefined} sx={{ width: 20, height: 20, borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }} />
                <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)' }}>{quotedName}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.3, fontFamily: 'var(--font-mono)', fontSize: '0.68rem' }}>{quotedHandle}</Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.45, fontSize: '0.84rem' }}>
                {quotedCaption}
            </Typography>
        </Paper>

        {!!attachments?.length && (
            <Box sx={{
                display: 'grid',
                gap: 1,
                gridTemplateColumns: attachments.filter((a) => a.type === 'image').length === 1 ? '1fr' : '1fr 1fr',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                bgcolor: 'rgba(0,0,0,0.2)',
            }}>
                {attachments.filter((a) => a.type === 'image').map((att, i) => (
                    <Box
                        key={`${att.id}-${i}`}
                        component="img"
                        src={SocialService.getMediaPreview(att.id, 800, 600)}
                        sx={{
                            width: '100%',
                            height: attachments.filter((a) => a.type === 'image').length === 1 ? 300 : 180,
                            objectFit: 'cover',
                        }}
                    />
                ))}
            </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', maxWidth: 425, color: 'text.secondary', fontSize: '0.8rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <IconButton size="small" sx={{ p: 0.35, color: '#536471' }}>
                    <MessageCircle size={16} strokeWidth={1.8} />
                </IconButton>
                <Typography sx={{ fontSize: '0.8rem', color: '#536471' }}>{stats.replies || 0}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <IconButton size="small" onClick={onPulse} sx={{ p: 0.35, color: '#10B981' }}>
                    <Repeat2 size={16} strokeWidth={1.8} />
                </IconButton>
                <Typography sx={{ fontSize: '0.8rem', color: '#10B981' }}>{stats.pulses || 0}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <IconButton size="small" onClick={onLike} sx={{ p: 0.35, color: liked ? '#F59E0B' : '#536471' }}>
                    <Heart size={16} fill={liked ? '#F59E0B' : 'none'} strokeWidth={1.8} />
                </IconButton>
                <Typography sx={{ fontSize: '0.8rem', color: liked ? '#F59E0B' : '#536471' }}>{stats.likes || 0}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <IconButton size="small" sx={{ p: 0.35, color: '#536471' }}>
                    <BarChart3 size={16} strokeWidth={1.8} />
                </IconButton>
                <Typography sx={{ fontSize: '0.8rem', color: '#536471' }}>{stats.views || 0}</Typography>
            </Box>
        </Box>
    </Box>
);

const estimateCardHeight = (ctx: CanvasRenderingContext2D, moment: any, width: number) => {
    const textWidth = width - 72;
    const caption = wrapLines(ctx, String(moment?.caption || ''), textWidth);
    const attachmentCount = (moment?.metadata?.attachments || []).filter((att: any) => att.type === 'image' || att.type === 'video').length;
    let height = 236;
    height += Math.min(8, caption.length) * 26;
    if (attachmentCount > 0) height += 270;
    if (moment?.attachedNote) height += 118;
    if (moment?.attachedEvent) height += 132;
    return height;
};

const renderMomentCard = async (
    ctx: CanvasRenderingContext2D,
    moment: any,
    x: number,
    y: number,
    width: number,
    isReplyParent = false,
): Promise<number> => {
    const creator = moment?.creator || {};
    const identityName = resolveIdentity(creator, moment?.userId || moment?.creatorId);
    const avatarLabel = String(identityName.displayName || identityName.handle || 'User').slice(0, 1);
    const cardHeight = estimateCardHeight(ctx, moment, width);
    const radius = 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = EXPORT_CARD;
    drawRoundedRect(ctx, x, y, width, cardHeight, radius);
    ctx.fill();
    ctx.restore();

    const innerX = x + 20;
    let cursorY = y + 18;

    if (isReplyParent) {
        ctx.fillStyle = '#6366F1';
        ctx.font = '700 12px sans-serif';
        ctx.fillText('In reply to', innerX, cursorY + 12);
        cursorY += 18;
    }

    const avatarSource = await resolveExportAvatarSource(creator);
    await drawAvatar(ctx, innerX, cursorY, 38, avatarSource, avatarLabel);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 17px sans-serif';
    ctx.fillText(clampText(identityName.displayName || 'Unknown', 24), innerX + 50, cursorY + 16);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '700 11px monospace';
    ctx.fillText(clampText(identityName.handle || '', 28), innerX + 50, cursorY + 32);
    ctx.fillText(getMomentTimeLabel(moment), x + width - 20 - ctx.measureText(getMomentTimeLabel(moment)).width, cursorY + 32);

    cursorY += 54;

    const captionLines = wrapLines(ctx, String(moment?.caption || ''), width - 40);
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.font = '500 15px sans-serif';
    captionLines.slice(0, 10).forEach((line, index) => {
        ctx.fillText(line, innerX, cursorY + index * 38);
    });
    cursorY += Math.min(10, captionLines.length) * 22 + 14;

    const attachments = (moment?.metadata?.attachments || []).filter((att: any) => att.type === 'image' || att.type === 'video');
    if (attachments.length) {
        const first = attachments[0];
        const previewSrc = first.type === 'image' ? SocialService.getMediaPreview(first.id, 1200, 800) : SocialService.getMediaPreview(first.id, 1200, 800);
        const media = await loadImage(previewSrc);
        const mediaHeight = 280;
        ctx.save();
        drawRoundedRect(ctx, innerX, cursorY, width - 40, mediaHeight, 18);
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(innerX, cursorY, width - 40, mediaHeight);
        if (media) {
            const scale = Math.max((width - 40) / media.width, mediaHeight / media.height);
            const drawWidth = media.width * scale;
            const drawHeight = media.height * scale;
            ctx.drawImage(media, innerX + ((width - 40) - drawWidth) / 2, cursorY + (mediaHeight - drawHeight) / 2, drawWidth, drawHeight);
        }
        ctx.restore();
        cursorY += mediaHeight + 14;
    }

    if (moment?.attachedNote) {
        ctx.fillStyle = 'rgba(99,102,241,0.12)';
        drawRoundedRect(ctx, innerX, cursorY, width - 40, 92, 16);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 13px sans-serif';
        ctx.fillText('Attached Note', innerX + 14, cursorY + 24);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = '500 12px sans-serif';
        wrapLines(ctx, clampText(moment.attachedNote.content || '', 150), width - 68).slice(0, 3).forEach((line, idx) => {
            ctx.fillText(line, innerX + 14, cursorY + 48 + idx * 18);
        });
        cursorY += 108;
    }

    if (moment?.attachedEvent) {
        ctx.fillStyle = 'rgba(168,85,247,0.12)';
        drawRoundedRect(ctx, innerX, cursorY, width - 40, 108, 16);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 13px sans-serif';
        ctx.fillText('Attached Event', innerX + 14, cursorY + 24);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.font = '500 12px sans-serif';
        ctx.fillText(clampText(moment.attachedEvent.title || 'Untitled Event', 42), innerX + 14, cursorY + 52);
        ctx.fillText(clampText(moment.attachedEvent.location || 'No location', 42), innerX + 14, cursorY + 74);
        cursorY += 126;
    }

    const metricsY = y + cardHeight - 48;
    drawMetricBlock(ctx, innerX, metricsY, moment?.stats?.replies || 0, 'replies', '#6366F1');
    drawMetricBlock(ctx, innerX + 124, metricsY, moment?.stats?.pulses || 0, 'pulses', '#10B981');
    drawMetricBlock(ctx, innerX + 236, metricsY, moment?.stats?.likes || 0, 'likes', '#F59E0B');

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath();
    ctx.moveTo(innerX, y + cardHeight - 34);
    ctx.lineTo(x + width - 20, y + cardHeight - 34);
    ctx.stroke();

    const actionsY = y + cardHeight - 26;
    const iconSize = 18;
    const actionSlots = [
        { x: innerX + 4, draw: (ix: number, iy: number) => drawCommentIcon(ctx, ix, iy, iconSize, 'rgba(255,255,255,0.55)') },
        { x: innerX + 82, draw: (ix: number, iy: number) => drawRepeatIcon(ctx, ix, iy, iconSize, 'rgba(255,255,255,0.55)') },
        { x: innerX + 160, draw: (ix: number, iy: number) => drawHeartIcon(ctx, ix, iy, iconSize, 'rgba(255,255,255,0.55)', false) },
        { x: innerX + 238, draw: (ix: number, iy: number) => drawLinkIcon(ctx, ix, iy, iconSize, 'rgba(255,255,255,0.55)') },
        { x: innerX + 316, draw: (ix: number, iy: number) => drawSendIcon(ctx, ix, iy, iconSize, 'rgba(255,255,255,0.55)') },
    ];
    actionSlots.forEach((slot) => slot.draw(slot.x, actionsY));

    return cardHeight;
};

const exportMomentAsImage = async (rootMoment: any) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    const parentMoment = rootMoment?.sourceMoment && rootMoment?.metadata?.sourceId ? rootMoment.sourceMoment : null;
    const exportWidth = Math.min(EXPORT_MAX_WIDTH, Math.max(EXPORT_MIN_WIDTH, Math.floor((window.innerWidth || EXPORT_MAX_WIDTH) - (EXPORT_PAD * 2))));
    const margin = 14;
    const bodyWidth = exportWidth - (EXPORT_PAD * 2);
    const bodyX = EXPORT_PAD;

    canvas.width = exportWidth;
    ctx.font = '500 18px sans-serif';

    const headerHeight = 8;
    const parentHeight = parentMoment ? estimateCardHeight(ctx, parentMoment, bodyWidth) + 20 : 0;
    const mainHeight = estimateCardHeight(ctx, rootMoment, bodyWidth);
    const totalHeight = margin + headerHeight + parentHeight + mainHeight + 32 + (parentMoment ? 20 : 0);
    canvas.height = totalHeight;

    const gradient = ctx.createLinearGradient(0, 0, 0, totalHeight);
    gradient.addColorStop(0, '#0E0D0B');
    gradient.addColorStop(1, '#090807');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let i = 0; i < 36; i += 1) {
        ctx.beginPath();
        ctx.arc((i * 97) % canvas.width, 60 + (i * 53) % Math.max(1, (canvas.height - 120)), 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    let cursorY = margin + headerHeight;
    if (parentMoment) {
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillRect(bodyX + 8, cursorY - 8, 2, 20);
        cursorY += 2;
        const parentCardHeight = await renderMomentCard(ctx, parentMoment, bodyX, cursorY, bodyWidth, true);
        cursorY += parentCardHeight + 14;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.arc(bodyX + 9, cursorY - 10, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    await renderMomentCard(ctx, rootMoment, bodyX, cursorY, bodyWidth, false);

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '700 11px monospace';
    const footer = `@${resolveIdentity(rootMoment.creator, rootMoment.userId || rootMoment.creatorId).handle?.replace(/^@/, '') || 'connect'} • ${window.location.hostname}`;
    ctx.fillText(footer, bodyX, canvas.height - 14);

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) reject(new Error('Failed to encode image'));
            else resolve(blob);
        }, 'image/png', 1);
    });
};

export function PostViewClient() {
    const params = useParams();
    const momentId = Array.isArray(params.id) ? params.id[0] : params.id;
    const router = useRouter();
    const { user } = useAuth();
    const { profile: myProfile } = useProfile();
    const hasPreviewRef = React.useRef(Boolean(getCachedMomentPreview(momentId)));
    const [moment, setMoment] = useState<any>(() => getCachedMomentPreview(momentId) || null);
    const [replies, setReplies] = useState<any[]>([]);
    const [loading, setLoading] = useState(() => !getCachedMomentPreview(momentId));
    const [replying, setReplying] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [pulseMenuAnchorEl, setPulseMenuAnchorEl] = useState<null | HTMLElement>(null);
    const [shareDrawerOpen, setShareDrawerOpen] = useState(false);
    const [replyDrawerOpen, setReplyDrawerOpen] = useState(false);
    const [exportingImage, setExportingImage] = useState(false);
    const [threadAncestors, setThreadAncestors] = useState<any[]>([]);
    const [showAncestors, setShowAncestors] = useState(false);
    const [ancestorLoading, setAncestorLoading] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [actorsDrawerOpen, setActorsDrawerOpen] = useState(false);
    const [actorsList, setActorsList] = useState<any[]>([]);
    const [actorsTitle, setActorsTitle] = useState('');
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
    const pullStartYRef = React.useRef<number | null>(null);
    const touchStartYRef = React.useRef<number | null>(null);
    const pullActiveRef = React.useRef(false);
    const userAvatarUrl = useCachedProfilePreview(myProfile?.avatar || ((user?.prefs as any)?.profilePicId as string | undefined) || null, 64, 64);

    const fetchActorsForPulses = async (targetMomentId: string) => {
        try {
            const pulses = await SocialService._listPulsesFor(targetMomentId);
            const actors = await Promise.all(pulses.map(async (p: any) => {
                try {
                    const prof = getCachedIdentityById(p.userId) || await UsersService.getProfileById(p.userId);
                    let avatar = null;
                    if (prof?.avatar) {
                        try { avatar = String(prof.avatar).startsWith('http') ? prof.avatar : await fetchProfilePreview(prof.avatar, 64, 64) as unknown as string; } catch (_e) {}
                    }
                    return { $id: p.userId, username: prof?.username, displayName: prof?.displayName, avatar };
                } catch (_e) { return { $id: p.userId }; }
            }));
            return actors;
        } catch (e) {
            console.error('Failed to fetch pulse actors', e);
            return [];
        }
    };

    const hydrateMoment = useCallback(async (data: any): Promise<any> => {
        seedMomentPreview(data);

        const creatorId = data.userId || data.creatorId;
        const creator = getCachedIdentityById(creatorId) || await UsersService.getProfileById(creatorId);

        let avatar = null;
        if (creator?.avatar) {
            try {
                avatar = String(creator.avatar).startsWith('http')
                    ? creator.avatar
                    : await fetchProfilePreview(creator.avatar, 64, 64) as unknown as string;
            } catch (_e) {}
        }

        return { ...data, creator: { ...creator, avatar } };
    }, []);

    const fetchAncestorThread = useCallback(async (sourceMomentId: string): Promise<any[]> => {
        const ancestors: any[] = [];
        let currentSourceId = sourceMomentId;

        for (let depth = 0; currentSourceId && depth < 8; depth += 1) {
            const sourceMoment = await SocialService.getMomentById(currentSourceId, user?.$id);
            const hydratedSource = await hydrateMoment(sourceMoment);
            ancestors.unshift(hydratedSource);
            currentSourceId = hydratedSource.metadata?.sourceId || '';
        }

        return ancestors;
    }, [hydrateMoment, user?.$id]);

    const isQuoteMoment = moment?.metadata?.type === 'quote' && Boolean(moment?.sourceMoment);

    const revealAncestorThread = useCallback(async () => {
        if (!moment?.metadata?.sourceId || isQuoteMoment || ancestorLoading || showAncestors) return;
        setAncestorLoading(true);
        try {
            const ancestors = await fetchAncestorThread(moment.metadata.sourceId);
            setThreadAncestors(ancestors);
            setMoment((prev: any) => prev ? ({ ...prev, sourceMoment: ancestors[ancestors.length - 1] || null }) : prev);
            setShowAncestors(true);
            seedMomentThread(momentId, {
                moment: { ...moment, sourceMoment: ancestors[ancestors.length - 1] || null },
                replies,
                ancestors,
            });
        } catch (error) {
            console.error('Failed to reveal ancestor thread', error);
            toast.error('Failed to load thread');
        } finally {
            setAncestorLoading(false);
            setPullDistance(0);
            pullStartYRef.current = null;
            pullActiveRef.current = false;
        }
    }, [ancestorLoading, fetchAncestorThread, isQuoteMoment, moment, momentId, replies, showAncestors]);

    const onPullPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!moment?.metadata?.sourceId || isQuoteMoment || showAncestors) return;
        pullStartYRef.current = event.clientY;
        pullActiveRef.current = true;
        (event.currentTarget as HTMLDivElement).setPointerCapture?.(event.pointerId);
    }, [isQuoteMoment, moment?.metadata?.sourceId, showAncestors]);

    const onPullPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (!pullActiveRef.current || pullStartYRef.current === null || !moment?.metadata?.sourceId || isQuoteMoment || showAncestors) return;
        const distance = Math.max(0, event.clientY - pullStartYRef.current);
        setPullDistance(Math.min(distance, 120));
    }, [isQuoteMoment, moment?.metadata?.sourceId, showAncestors]);

    const onPullPointerUp = useCallback(() => {
        if (!pullActiveRef.current) return;
        pullActiveRef.current = false;
        if (pullDistance >= 72) {
            void revealAncestorThread();
            return;
        }
        setPullDistance(0);
        pullStartYRef.current = null;
    }, [pullDistance, revealAncestorThread]);

    const triggerScrollReveal = useCallback(() => {
        if (!moment?.metadata?.sourceId || isQuoteMoment || ancestorLoading || showAncestors) return;
        void revealAncestorThread();
    }, [ancestorLoading, isQuoteMoment, moment?.metadata?.sourceId, revealAncestorThread, showAncestors]);

    const onWheelCapture = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
        if (event.deltaY > 12) triggerScrollReveal();
    }, [triggerScrollReveal]);

    const onTouchStartCapture = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        touchStartYRef.current = event.touches[0]?.clientY ?? null;
    }, []);

    const onTouchMoveCapture = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
        if (touchStartYRef.current === null) return;
        const currentY = event.touches[0]?.clientY;
        if (currentY === undefined) return;
        if (currentY - touchStartYRef.current > 16) triggerScrollReveal();
    }, [triggerScrollReveal]);

    const onTouchEndCapture = useCallback(() => {
        touchStartYRef.current = null;
    }, []);

    const openActorsList = async (title: string, fetcher: () => Promise<any[]>) => {
        setActorsTitle(title);
        setActorsDrawerOpen(true);
        setActorsList([]);
        const data = await fetcher();
        setActorsList(data);
    };

    const loadMoment = useCallback(async () => {
        if (!momentId) return;
        if (!hasPreviewRef.current) setLoading(true);
        setThreadAncestors([]);
        setShowAncestors(false);
        setPullDistance(0);
        pullStartYRef.current = null;
        pullActiveRef.current = false;
        const cachedThread = getCachedMomentThread(momentId);
        const threadFresh = isFreshMomentThread(momentId, THREAD_CACHE_STALE_AFTER_MS);
        try {
            const enrichedMoment = cachedThread?.moment
                ? cachedThread.moment
                : await hydrateMoment(await SocialService.getMomentById(momentId, user?.$id));
            setMoment(enrichedMoment);
            seedMomentPreview(enrichedMoment);
            seedIdentityCache(enrichedMoment.creator);
            if (cachedThread?.replies?.length) {
                setReplies(cachedThread.replies);
            }
            if (cachedThread?.ancestors?.length) {
                setThreadAncestors(cachedThread.ancestors);
                setShowAncestors(true);
            }

            if (cachedThread?.moment && threadFresh && cachedThread?.replies) {
                setLoading(false);
                return;
            }

            // Fetch replies
            const replyData = await SocialService.getReplies(momentId, user?.$id);
            const enrichedReplies = await Promise.all(replyData.map(async (reply) => {
                const enrichedReply = await hydrateMoment(reply);
                seedMomentPreview(enrichedReply);
                seedIdentityCache(enrichedReply.creator);
                return enrichedReply;
            }));
            setReplies(enrichedReplies);
            seedMomentThread(momentId, {
                moment: enrichedMoment,
                replies: enrichedReplies,
                ancestors: cachedThread?.ancestors || [],
            });

        } catch (_e: unknown) {
            console.error('Failed to load moment:', _e);
            toast.error('Moment not found');
            setThreadAncestors([]);
        } finally {
            setLoading(false);
        }
        }, [momentId, user, hydrateMoment]);

    useEffect(() => {
        loadMoment();
    }, [loadMoment]);

    useEffect(() => {
        if (!momentId || !moment) return;
        if (!replies.length && !showAncestors && !threadAncestors.length) return;
        seedMomentThread(momentId, {
            moment,
            replies,
            ancestors: showAncestors ? threadAncestors : [],
        });
    }, [momentId, moment, replies, showAncestors, threadAncestors]);

    const handleToggleLike = async (targetMoment?: any) => {
        if (!user) {
            toast.error('Please login to like this post');
            return;
        }
        const target = targetMoment || moment;
        if (!target) return;

        try {
            const creatorId = target.userId || target.creatorId;
            const contentSnippet = target.caption?.substring(0, 30);
            const { liked } = await SocialService.toggleLike(user.$id, target.$id, creatorId, contentSnippet);
            
            if (target.$id === moment?.$id) {
                setMoment((prev: any) => ({ 
                    ...prev, 
                    isLiked: liked,
                    stats: { ...prev.stats, likes: Math.max(0, (prev.stats?.likes || 0) + (liked ? 1 : -1)) }
                }));
            } else {
                setReplies((prev: any[]) => prev.map(r => r.$id === target.$id ? {
                    ...r,
                    isLiked: liked,
                    stats: { ...r.stats, likes: Math.max(0, (r.stats?.likes || 0) + (liked ? 1 : -1)) }
                } : r));
            }
        } catch (_e) {
            toast.error('Failed to update like');
        }
    };

    const handlePulse = async () => {
        if (!user) {
            toast.error('Please login to pulse this post');
            return;
        }
        if (!moment) return;
        try {
            await SocialService.createMoment(user.$id, '', 'pulse', [], 'public', undefined, undefined, moment.$id);
            toast.success('Pulsed to your feed');
            // optimistically mark pulsed on the current moment
            setMoment((prev: any) => {
                if (!prev) return prev;
                const next = { ...prev, isPulsed: true, stats: { ...prev.stats, pulses: (prev.stats?.pulses || 0) + 1 } };
                seedMomentThread(momentId, {
                    moment: next,
                    replies,
                    ancestors: showAncestors ? threadAncestors : [],
                });
                return next;
            });
            setPulseMenuAnchorEl(null);
        } catch (_e) {
            toast.error('Failed to pulse');
        }
    };

    const handleQuote = () => {
        if (!user || !moment) return;
        setPulseMenuAnchorEl(null);
        // UI logic to switch to quote mode
        // For now, we scroll to the reply box and could potentially change its label/behavior
        const replyBox = document.getElementById('reply-box');
        if (replyBox) {
            replyBox.scrollIntoView({ behavior: 'smooth' });
            setReplyContent(`Quoting ${resolveIdentity(moment.creator, creatorId).handle}: `);
        }
    };

    const handleReply = async () => {
        if (!user || !moment || !replyContent.trim()) return;
        setReplying(true);
        try {
            const createdReply = await SocialService.createMoment(
                user.$id, 
                replyContent, 
                'reply', 
                [], 
                'public', 
                undefined, 
                undefined, 
                moment.$id
            );
            const enrichedReply = await hydrateMoment(createdReply);
            seedMomentPreview(enrichedReply);
            seedIdentityCache(enrichedReply.creator);
            const nextReplies = [enrichedReply, ...replies];
            setMoment((prev: any) => {
                if (!prev) return prev;
                const next = { ...prev, stats: { ...prev.stats, replies: (prev.stats?.replies || 0) + 1 } };
                seedMomentThread(momentId, {
                    moment: next,
                    replies: nextReplies,
                    ancestors: showAncestors ? threadAncestors : [],
                });
                return next;
            });
            setReplies(nextReplies);
            setReplyContent('');
            toast.success('Reply posted!');
            setReplyDrawerOpen(false);
        } catch (e) {
            console.error('Failed to post reply:', e);
            toast.error('Failed to post reply');
        } finally {
            setReplying(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard');
    };

    const handleExportScreenshot = async () => {
        if (!moment) return;
        setExportingImage(true);
        try {
            const blob = await exportMomentAsImage(moment);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `kylrix-connect-${moment.$id}.png`;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 2000);
            toast.success('Screenshot saved');
            setShareDrawerOpen(false);
        } catch (error) {
            console.error('Failed to export screenshot:', error);
            toast.error('Failed to export screenshot');
        } finally {
            setExportingImage(false);
        }
    };

    if (loading && !moment) return (
        <AppShell>
            <Box sx={{ maxWidth: 'sm', mx: 'auto', py: 4, px: 2 }}>
                <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.05)' }} />
                        <Box sx={{ flex: 1 }}>
                            <Skeleton width="30%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                            <Skeleton width="20%" sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
                        </Box>
                    </Box>
                    <Skeleton variant="rounded" height={240} sx={{ borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.05)' }} />
                    <Skeleton variant="rounded" height={120} sx={{ borderRadius: '24px', bgcolor: 'rgba(255,255,255,0.05)' }} />
                </Stack>
            </Box>
        </AppShell>
    );

    if (!moment) return (
        <AppShell>
            <Box sx={{ textAlign: 'center', py: 10 }}>
                <Typography variant="h5" color="text.secondary">Moment not found</Typography>
                <Button sx={{ mt: 2 }} onClick={() => router.back()}>Go Back</Button>
            </Box>
        </AppShell>
    );

    const isOwnPost = user?.$id === (moment.userId || moment.creatorId);
    const creatorId = moment.userId || moment.creatorId;
    const cachedCreator = getCachedIdentityById(creatorId);
    const resolvedCreator = resolveIdentity(moment.creator || cachedCreator, creatorId);
    const creatorName = isOwnPost ? (user?.name || 'You') : resolvedCreator.displayName;
    const creatorAvatar = isOwnPost ? userAvatarUrl : (moment.creator?.avatar || cachedCreator?.avatar);
    const quotedIdentity = isQuoteMoment
        ? resolveIdentity(moment.sourceMoment.creator, moment.sourceMoment.userId || moment.sourceMoment.creatorId)
        : null;
    const currentHasPrev = showAncestors || (Boolean(moment.metadata?.sourceId) && !isQuoteMoment);
    const currentThreadLineMode: ThreadPostViewProps['threadLineMode'] = currentHasPrev ? 'up' : 'none';
    const handleBackToFeed = () => {
        router.push('/');
    };

    return (
        <AppShell>
            <Box
                onWheelCapture={onWheelCapture}
                onTouchStartCapture={onTouchStartCapture}
                onTouchMoveCapture={onTouchMoveCapture}
                onTouchEndCapture={onTouchEndCapture}
                onTouchCancelCapture={onTouchEndCapture}
                sx={{
                    width: '100%',
                    maxWidth: 600,
                    mx: 'auto',
                    pt: { xs: 1.5, sm: 2.5 },
                    pb: { xs: 3, sm: 4 },
                    px: 0,
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    borderRight: '1px solid rgba(255,255,255,0.08)',
                }}
            >
                <Box sx={{ px: 2, mb: 1.5 }}>
                    <Button
                        onClick={handleBackToFeed}
                        startIcon={<ArrowLeft size={18} />}
                        sx={{
                            px: 1.5,
                            py: 1,
                            borderRadius: '14px',
                            textTransform: 'none',
                            fontWeight: 800,
                            color: 'text.primary',
                            bgcolor: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                        }}
                    >
                        Back to feed
                    </Button>
                </Box>

                {/* Public Access Banner */}
                {!user && (
                    <Alert 
                        severity="info" 
                        icon={<LogIn size={20} />}
                        action={
                            <Button color="inherit" size="small" onClick={() => {
                                const loginUrl = `${getEcosystemUrl('accounts')}/login?source=${encodeURIComponent(window.location.href)}`;
                                window.location.href = loginUrl;
                            }} sx={{ fontWeight: 800 }}>
                                LOGIN
                            </Button>
                        }
                        sx={{ 
                            mb: 2, 
                            borderRadius: '16px', 
                            bgcolor: 'rgba(99, 102, 241, 0.1)', 
                            color: '#6366F1',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            '& .MuiAlert-icon': { color: '#6366F1' }
                        }}
                    >
                        You are viewing this post as a guest. Login to like or reply.
                    </Alert>
                )}

                {moment.metadata?.sourceId && !isQuoteMoment && !showAncestors && ancestorLoading && (
                    <Box
                        onPointerDown={onPullPointerDown}
                        onPointerMove={onPullPointerMove}
                        onPointerUp={onPullPointerUp}
                        onPointerCancel={onPullPointerUp}
                        sx={{
                            borderRadius: 0,
                            border: 'none',
                            bgcolor: 'transparent',
                            minHeight: `${72 + pullDistance}px`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexDirection: 'column',
                            gap: 0,
                            userSelect: 'none',
                            touchAction: 'none',
                            overflow: 'hidden',
                            transition: pullActiveRef.current ? 'none' : 'min-height 180ms ease, background-color 180ms ease'
                        }}
                    >
                        <Stack spacing={1.25} sx={{ width: '100%', px: 2, py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                <Box sx={{ flex: 1 }}>
                                    <Skeleton variant="rounded" width={96} height={12} sx={{ bgcolor: 'rgba(255,255,255,0.08)', mb: 0.75 }} />
                                    <Skeleton variant="rounded" width="70%" height={10} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                    <Skeleton variant="rounded" width="42%" height={12} sx={{ bgcolor: 'rgba(255,255,255,0.08)' }} />
                                    <Skeleton variant="rounded" width="88%" height={12} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                                    <Skeleton variant="rounded" width="76%" height={12} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                                    <Stack direction="row" spacing={1.2} sx={{ pt: 0.5 }}>
                                        <Skeleton variant="rounded" width={42} height={18} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                                        <Skeleton variant="rounded" width={42} height={18} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                                        <Skeleton variant="rounded" width={42} height={18} sx={{ bgcolor: 'rgba(255,255,255,0.06)' }} />
                                    </Stack>
                                </Box>
                            </Box>
                        </Stack>
                    </Box>
                )}

                {(!isQuoteMoment && showAncestors && threadAncestors.length > 0) || moment ? (
                    <Box
                        sx={{
                            bgcolor: '#000000',
                            border: '1px solid rgba(255,255,255,0.05)',
                            boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.06), 0 0 28px rgba(245, 158, 11, 0.1)',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            maxHeight: { xs: '58dvh', md: '60dvh' },
                            overflowY: 'auto',
                            overscrollBehavior: 'contain',
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
                        {showAncestors && threadAncestors.length > 0 && threadAncestors.map((ancestor, index) => {
                            const ancestorId = ancestor.userId || ancestor.creatorId;
                            const resolvedAncestor = resolveIdentity(ancestor.creator, ancestorId);
                            return (
                                <ThreadPostView
                                    key={ancestor.$id}
                                    name={resolvedAncestor.displayName}
                                    handle={resolvedAncestor.handle}
                                    timeLabel={formatPostTimestamp(ancestor.$createdAt, ancestor.$updatedAt)}
                                    caption={ancestor.caption}
                                    attachments={ancestor.metadata?.attachments}
                                    avatarSrc={ancestor.creator?.avatar}
                                    avatarLabel={resolvedAncestor.displayName?.charAt(0).toUpperCase()}
                                    stats={{
                                        replies: ancestor.stats?.replies || 0,
                                        pulses: ancestor.stats?.pulses || 0,
                                        likes: ancestor.stats?.likes || 0,
                                        views: ancestor.stats?.views || 0,
                                    }}
                                    threadLineMode={index === 0 ? 'down' : 'both'}
                                    variant="thread"
                                    onClick={() => router.push(`/post/${ancestor.$id}`)}
                                    onLike={(e) => { e.stopPropagation(); handleToggleLike(ancestor); }}
                                    onPulse={(e) => {
                                        e.stopPropagation();
                                        openActorsList('Pulsed by', async () => await fetchActorsForPulses(ancestor.$id));
                                    }}
                                    liked={ancestor.isLiked}
                                />
                            );
                        })}

                        {isQuoteMoment && quotedIdentity ? (
                                <QuoteMomentView
                                    name={creatorName}
                                    handle={resolvedCreator.handle}
                                    timeLabel={formatPostTimestamp(moment.$createdAt, moment.$updatedAt)}
                                    caption={moment.caption}
                                    attachments={moment.metadata?.attachments}
                                    avatarSrc={creatorAvatar}
                                    avatarLabel={creatorName.replace(/^@/, '').charAt(0).toUpperCase()}
                                quotedAvatarSrc={moment.sourceMoment.creator?.avatar}
                                quotedCaption={moment.sourceMoment.caption}
                                quotedName={quotedIdentity.displayName}
                                quotedHandle={quotedIdentity.handle}
                                stats={{
                                    replies: moment.stats?.replies || 0,
                                    pulses: moment.stats?.pulses || 0,
                                    likes: moment.stats?.likes || 0,
                                    views: moment.stats?.views || 0,
                                }}
                                onLike={(e) => { e.stopPropagation(); handleToggleLike(); }}
                                onPulse={(e) => {
                                    e.stopPropagation();
                                    setPulseMenuAnchorEl(e.currentTarget as HTMLElement);
                                }}
                                liked={moment.isLiked}
                            />
                        ) : (
                            <ThreadPostView
                                name={creatorName}
                                handle={resolvedCreator.handle}
                                timeLabel={formatPostTimestamp(moment.$createdAt, moment.$updatedAt)}
                                caption={moment.caption}
                                attachments={moment.metadata?.attachments}
                                avatarSrc={creatorAvatar}
                                avatarLabel={creatorName.replace(/^@/, '').charAt(0).toUpperCase()}
                                replyingTo={moment.metadata?.sourceId && moment.sourceMoment
                                    ? `@${resolveIdentity(moment.sourceMoment.creator, moment.sourceMoment.userId || moment.sourceMoment.creatorId).handle?.replace(/^@/, '') || ''}`
                                    : null}
                                stats={{
                                    replies: moment.stats?.replies || 0,
                                    pulses: moment.stats?.pulses || 0,
                                    likes: moment.stats?.likes || 0,
                                    views: moment.stats?.views || 0,
                                }}
                                threadLineMode={currentThreadLineMode}
                                variant="thread"
                                onLike={(e) => { e.stopPropagation(); handleToggleLike(); }}
                                onPulse={(e) => {
                                    e.stopPropagation();
                                    setPulseMenuAnchorEl(e.currentTarget as HTMLElement);
                                }}
                                liked={moment.isLiked}
                            />
                        )}
                    </Box>
                ) : null}

                <Box
                    id="comments-section"
                    sx={{
                        pt: 2,
                        maxHeight: { xs: '36dvh', md: '30dvh' },
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        WebkitOverflowScrolling: 'touch',
                        pr: 0.5,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, mb: 1 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: '0.9rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'text.secondary' }}>
                            Comments
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" sx={{ color: 'text.secondary' }}>
                                <ArrowDownWideNarrow size={17} />
                            </IconButton>
                            <IconButton size="small" sx={{ color: 'text.secondary' }}>
                                <SlidersHorizontal size={17} />
                            </IconButton>
                        </Stack>
                    </Box>
                    {replies.length === 0 ? (
                        <Box sx={{ py: 4, px: 2, textAlign: 'center' }}>
                            <Box
                                sx={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: '18px',
                                    display: 'grid',
                                    placeItems: 'center',
                                    mx: 'auto',
                                    mb: 1.5,
                                    bgcolor: 'rgba(255,255,255,0.04)',
                                    color: 'rgba(255,255,255,0.8)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                <MessageCircle size={22} />
                            </Box>
                            <Typography sx={{ fontWeight: 800, color: 'text.primary' }}>
                                No comments yet
                            </Typography>
                            <Typography sx={{ color: 'text.secondary', fontSize: '0.92rem', mt: 0.5 }}>
                                Be the first to comment.
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ mt: 0.5 }}>
                            {replies.map((reply, index) => {
                                const rCreatorId = reply.userId || reply.creatorId;
                                const rResolvedCreator = resolveIdentity(reply.creator, rCreatorId);
                                const rCreatorName = rResolvedCreator.displayName;
                                return (
                                    <ThreadPostView
                                        key={reply.$id}
                                        name={rCreatorName}
                                        handle={rResolvedCreator.handle}
                                        timeLabel={formatPostTimestamp(reply.$createdAt, reply.$updatedAt)}
                                        caption={reply.caption}
                                        avatarSrc={reply.creator?.avatar}
                                        avatarLabel={rCreatorName.replace(/^@/, '').charAt(0).toUpperCase()}
                                        replyingTo={reply.metadata?.sourceId ? `@${creatorName.replace(/^@/, '')}` : null}
                                        stats={{
                                            replies: reply.stats?.replies || 0,
                                            pulses: reply.stats?.pulses || 0,
                                            likes: reply.stats?.likes || 0,
                                            views: reply.stats?.views || 0,
                                        }}
                                        threadLineMode={index < replies.length - 1 ? 'both' : 'up'}
                                        variant="thread"
                                        onClick={() => router.push(`/post/${reply.$id}`)}
                                        onLike={(e) => {
                                            e.stopPropagation();
                                            handleToggleLike(reply);
                                        }}
                                        onPulse={(e) => {
                                            e.stopPropagation();
                                            setPulseMenuAnchorEl(e.currentTarget as HTMLElement);
                                        }}
                                        liked={reply.isLiked}
                                    />
                                );
                            })}
                        </Box>
                    )}
                </Box>

                <Menu
                    anchorEl={pulseMenuAnchorEl}
                    open={Boolean(pulseMenuAnchorEl)}
                    onClose={() => setPulseMenuAnchorEl(null)}
                    PaperProps={{
                        sx: {
                            mt: 1,
                            borderRadius: '16px',
                            bgcolor: '#1F1D1B',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            minWidth: 180
                        }
                    }}
                >
                    <MenuItem 
                        onClick={handlePulse}
                        sx={{ gap: 1.5, py: 1.2, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10B981' }}
                    >
                        <Repeat2 size={18} strokeWidth={2} /> Pulse Now
                    </MenuItem>
                    <MenuItem 
                        onClick={handleQuote}
                        sx={{ gap: 1.5, py: 1.2, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                        <Edit size={18} strokeWidth={2} style={{ opacity: 0.7 }} /> Quote Moment
                    </MenuItem>
                </Menu>

                {user && !isMobile && (
                    <Box id="reply-box" sx={{ mt: 2, p: 1.5, bgcolor: '#161514', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.06), 0 0 24px rgba(245, 158, 11, 0.08)' }}>
                        <Stack direction="row" spacing={2}>
                            <Avatar src={userAvatarUrl || undefined} sx={{ width: 30, height: 30, borderRadius: '8px' }}>
                                {user.name?.charAt(0)}
                            </Avatar>
                            <TextField
                                fullWidth
                                placeholder="Post your reply"
                                variant="standard"
                                multiline
                                maxRows={10}
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                InputProps={{
                                    disableUnderline: true,
                                    sx: { color: 'white', py: 0.5, fontSize: '0.92rem' },
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton 
                                                onClick={handleReply}
                                                disabled={!replyContent.trim() || replying}
                                                sx={{ 
                                                    p: 0.8,
                                                    bgcolor: '#F59E0B', 
                                                    color: 'black',
                                                    '&:hover': { bgcolor: alpha('#F59E0B', 0.8) },
                                                    '&.Mui-disabled': { bgcolor: 'rgba(245, 158, 11, 0.2)', color: 'rgba(0,0,0,0.3)' }
                                                }}
                                            >
                                                {replying ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                            />
                        </Stack>
                    </Box>
                )}

                {user && isMobile && !replyDrawerOpen && (
                    <Fab
                        color="primary"
                        aria-label="comment"
                        onClick={() => setReplyDrawerOpen(true)}
                        sx={{
                            position: 'fixed',
                            right: 20,
                            bottom: 'calc(20px + env(safe-area-inset-bottom))',
                            zIndex: 1400,
                            bgcolor: '#F59E0B',
                            color: '#161514',
                            '&:hover': { bgcolor: alpha('#F59E0B', 0.9) },
                        }}
                    >
                        <MessageCircle size={20} />
                    </Fab>
                )}

                {user && isMobile && (
                    <Drawer
                        anchor="bottom"
                        open={replyDrawerOpen}
                        onClose={() => setReplyDrawerOpen(false)}
                        PaperProps={{
                            sx: {
                                bgcolor: 'rgba(22, 20, 18, 0.98)',
                                borderTopLeftRadius: '24px',
                                borderTopRightRadius: '24px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                backgroundImage: 'none',
                                maxWidth: 720,
                                mx: 'auto',
                                width: '100%',
                                boxShadow: '0 -20px 50px rgba(0,0,0,0.55)',
                                pb: 'env(safe-area-inset-bottom)',
                            }
                        }}
                    >
                        <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
                            <Box sx={{ width: 42, height: 4, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.12)', mx: 'auto', mb: 2 }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', mb: 0.5 }}>
                                Comment
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                Add your reply below.
                            </Typography>

                            <Stack direction="row" spacing={2} sx={{ bgcolor: '#161514', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '20px', p: 1.5, boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.06), 0 0 24px rgba(245, 158, 11, 0.08)' }}>
                                <Avatar src={userAvatarUrl || undefined} sx={{ width: 30, height: 30, borderRadius: '8px' }}>
                                    {user.name?.charAt(0)}
                                </Avatar>
                                <TextField
                                    fullWidth
                                    placeholder="Write a comment"
                                    variant="standard"
                                    multiline
                                    maxRows={10}
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    InputProps={{
                                        disableUnderline: true,
                                        sx: { color: 'white', py: 0.5, fontSize: '0.92rem' },
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={handleReply}
                                                    disabled={!replyContent.trim() || replying}
                                                    sx={{
                                                        p: 0.8,
                                                        bgcolor: '#F59E0B',
                                                        color: 'black',
                                                        '&:hover': { bgcolor: alpha('#F59E0B', 0.8) },
                                                        '&.Mui-disabled': { bgcolor: 'rgba(245, 158, 11, 0.2)', color: 'rgba(0,0,0,0.3)' }
                                                    }}
                                                >
                                                    {replying ? <CircularProgress size={16} color="inherit" /> : <Send size={16} />}
                                                </IconButton>
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            </Stack>
                        </Box>
                    </Drawer>
                )}

                <Drawer
                    anchor="bottom"
                    open={shareDrawerOpen}
                    onClose={() => setShareDrawerOpen(false)}
                    PaperProps={{
                        sx: {
                            bgcolor: '#000000',
                            borderTopLeftRadius: '28px',
                            borderTopRightRadius: '28px',
                            border: '1px solid rgba(255,255,255,0.07)',
                            backgroundImage: 'none',
                            maxWidth: 720,
                            mx: 'auto',
                            width: '100%',
                            pb: 'env(safe-area-inset-bottom)',
                        }
                    }}
                >
                    <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
                        <Box sx={{ width: 44, height: 4, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.14)', mx: 'auto', mb: 2 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', mb: 0.5 }}>
                            Share post
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                            Export this post as a branded PNG image.
                        </Typography>

                        <ListItemButton
                            onClick={handleExportScreenshot}
                            disabled={exportingImage}
                            sx={{
                                mb: 1,
                                borderRadius: '16px',
                                bgcolor: '#000000',
                                border: '1px solid rgba(245, 158, 11, 0.14)',
                                boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.06), 0 0 24px rgba(245, 158, 11, 0.08)',
                            }}
                        >
                            <ListItemIcon sx={{ color: '#F59E0B', minWidth: 40 }}>
                                {exportingImage ? <CircularProgress size={18} color="inherit" /> : <ImageIcon size={18} />}
                            </ListItemIcon>
                            <ListItemText
                                primary="Screenshot"
                                secondary="Download an image of this post thread"
                                primaryTypographyProps={{ fontWeight: 800 }}
                                secondaryTypographyProps={{ color: 'text.secondary' }}
                            />
                            <Download size={18} />
                        </ListItemButton>

                        <ListItemButton
                            onClick={() => { handleCopyLink(); setShareDrawerOpen(false); }}
                            sx={{
                                borderRadius: '16px',
                                bgcolor: '#000000',
                                border: '1px solid rgba(255,255,255,0.07)',
                                boxShadow: '0 0 0 1px rgba(245, 158, 11, 0.04), 0 0 20px rgba(245, 158, 11, 0.06)',
                            }}
                        >
                            <ListItemIcon sx={{ color: '#6366F1', minWidth: 40 }}>
                                <Link2 size={18} />
                            </ListItemIcon>
                            <ListItemText
                                primary="Copy link"
                                secondary="Share the direct URL instead"
                                primaryTypographyProps={{ fontWeight: 800 }}
                                secondaryTypographyProps={{ color: 'text.secondary' }}
                            />
                        </ListItemButton>
                    </Box>
                </Drawer>

                {user && !isMobile && <Box sx={{ mt: 0.5 }} />}
                <ActorsListDrawer
                    open={actorsDrawerOpen}
                    onClose={() => setActorsDrawerOpen(false)}
                    title={actorsTitle}
                    actors={actorsList}
                    mobile={isMobile}
                    onSelect={(actor) => { setActorsDrawerOpen(false); router.push(`/@${actor.username || actor.$id}`); }}
                />
            </Box>
        </AppShell>
    );
}
