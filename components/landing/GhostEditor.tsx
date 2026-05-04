"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Box, 
    TextField, 
    Typography, 
    Stack, 
    Paper, 
    IconButton, 
    Tooltip,
    Alert,
    alpha,
    useTheme,
    CircularProgress,
    Container,
    Grid,
    Card,
    CardContent,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Dialog,
    DialogTitle,
    DialogContent,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio
} from '@mui/material';
import { 
    Copy as CopyIcon, 
    Check as CheckIcon,
    History as HistoryIcon,
    Zap,
    ExternalLink,
    Clock,
    Shield,
    Share2, 
    Trash2, 
    MoreVertical, 
    X, 
    Eye as EyeIcon, 
    RefreshCcw 
} from 'lucide-react';
import { AppwriteService } from '@/lib/appwrite';
import { encryptGhostData, decryptGhostData } from '@/lib/encryption/ghost-crypto';
import toast from 'react-hot-toast';
import { useAuth } from '@/components/ui/AuthContext';
import { Button } from '@/components/ui/Button';
import { buildAutoTitleFromContent } from '@/constants/noteTitle';
import { useDynamicSidebar } from '@/components/ui/DynamicSidebar';
import { useToast } from '@/components/ui/Toast';

const GHOST_STORAGE_KEY = 'kylrix_ghost_notes_v2';
const GHOST_SECRET_KEY = 'kylrix_ghost_secret_v2';
const GHOST_PREF_LIFESPAN = 'kylrix_ghost_pref_lifespan_v2';
const MAX_LIFESPAN_DAYS = 7;
const MAX_LIFESPAN_MS = MAX_LIFESPAN_DAYS * 24 * 60 * 60 * 1000;
const MAX_CONTENT_LENGTH = 65000;

interface GhostNoteRef {
    id: string;
    title: string;
    createdAt: string;
    expiresAt: string;
    decryptionKey?: string;
}

const LIFESPAN_OPTIONS = [
    { label: '10 Minutes', value: 10 * 60 * 1000 },
    { label: '1 Hour', value: 60 * 60 * 1000 },
    { label: '12 Hours', value: 12 * 60 * 60 * 1000 },
    { label: '1 Day', value: 24 * 60 * 60 * 1000 },
    { label: '3 Days', value: 3 * 24 * 60 * 60 * 1000 },
    { label: '7 Days', value: 7 * 24 * 60 * 60 * 1000 },
];

/**
 * A small circular countdown timer for ghost notes.
 * Uses a dotted stroke to represent the time remaining.
 */
const GhostClock = ({ createdAt, expiresAt }: { createdAt: string, expiresAt: string }) => {
    const theme = useTheme();
    const [progress, setProgress] = useState(100);
    const [isExpired, setIsExpired] = useState(false);
    
    useEffect(() => {
        const calculateProgress = () => {
            const created = new Date(createdAt).getTime();
            const expires = new Date(expiresAt).getTime();
            const now = Date.now();
            
            const totalLife = expires - created;
            const remaining = Math.max(0, expires - now);
            
            setIsExpired(remaining <= 0);
            setProgress(totalLife > 0 ? (remaining / totalLife) * 100 : 0);
        };

        calculateProgress();
        const interval = setInterval(calculateProgress, 10000); // Update every 10s
        return () => clearInterval(interval);
    }, [createdAt, expiresAt]);

    const size = 20;
    const strokeWidth = 2;
    const center = size / 2;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <Tooltip title={isExpired ? "Expired" : `${Math.round(progress)}% life remaining`}>
            <Box sx={{ position: 'relative', display: 'inline-flex', ml: 1 }}>
                <svg width={size} height={size}>
                    <circle
                        stroke="rgba(255, 255, 255, 0.1)"
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        r={radius}
                        cx={center}
                        cy={center}
                    />
                    <circle
                        stroke={isExpired ? theme.palette.error.main : theme.palette.primary.main}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${circumference} ${circumference}`}
                        style={{ 
                            strokeDashoffset: offset,
                            strokeDasharray: '2, 2', // Dotted effect
                            transition: 'stroke-dashoffset 0.5s ease'
                        }}
                        strokeLinecap="round"
                        fill="transparent"
                        r={radius}
                        cx={center}
                        cy={center}
                        transform={`rotate(-90 ${center} ${center})`}
                    />
                </svg>
            </Box>
        </Tooltip>
    );
};

interface GhostSparkShelfProps {
    activeSparks: GhostNoteRef[];
    staleSparks: GhostNoteRef[];
    contextMenu: {
        mouseX: number;
        mouseY: number;
        noteId: string;
    } | null;
    onContextMenu: (event: React.MouseEvent, noteId: string) => void;
    onCloseContextMenu: () => void;
    onViewNote: (note: GhostNoteRef) => void;
    onDeleteNote: (noteId: string | null) => void;
    onOpenIDMWindow: () => void;
}

const GhostSparkShelf = React.memo(({
    activeSparks,
    staleSparks,
    contextMenu,
    onContextMenu,
    onCloseContextMenu,
    onViewNote,
    onDeleteNote,
    onOpenIDMWindow
}: GhostSparkShelfProps) => {
    const theme = useTheme();

    return (
        <Stack spacing={3}>
            {activeSparks.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: theme.palette.secondary.main, mb: 1.5, display: 'block', letterSpacing: '0.1em' }}>
                        ACTIVE
                    </Typography>
                    <Stack spacing={1.5}>
                        {activeSparks.map((note) => (
                            <Card
                                key={note.id}
                                onContextMenu={(e) => onContextMenu(e, note.id)}
                                sx={{
                                    bgcolor: '#1C1A18',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                                    position: 'relative',
                                    backgroundImage: 'none',
                                    '&:hover': {
                                        transform: 'translateX(4px)',
                                        bgcolor: '#1C1A18',
                                        borderColor: alpha(theme.palette.secondary.main, 0.4),
                                        boxShadow: `0 20px 40px -10px rgba(0,0,0,0.5), 0 0 10px ${alpha(theme.palette.secondary.main, 0.1)}`
                                    }
                                }}
                            >
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, mb: 0.5, flex: 1, pr: 1 }}>
                                            {note.title}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <GhostClock createdAt={note.createdAt} expiresAt={note.expiresAt} />
                                            <IconButton size="small" onClick={(e) => onContextMenu(e, note.id)} sx={{ color: 'rgba(255,255,255,0.2)' }}>
                                                <MoreVertical size={14} />
                                            </IconButton>
                                        </Stack>
                                    </Stack>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" sx={{ opacity: 0.4 }}>
                                            Created {new Date(note.createdAt).toLocaleDateString()}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            onClick={() => onViewNote(note)}
                                            sx={{ color: theme.palette.secondary.main }}
                                        >
                                            <EyeIcon size={14} />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => window.open(`/shared/${note.id}${note.decryptionKey ? `/${note.decryptionKey}` : ''}`, '_blank')}
                                            sx={{ color: theme.palette.secondary.main }}
                                        >
                                            <ExternalLink size={14} />
                                        </IconButton>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                </Box>
            )}

            {staleSparks.length > 0 && (
                <Box>
                    <Typography variant="caption" sx={{ fontWeight: 900, color: 'error.main', mb: 1.5, display: 'block', letterSpacing: '0.1em' }}>
                        STALE (EXPIRED)
                    </Typography>
                    <Stack spacing={1.5}>
                        {staleSparks.map((note) => (
                            <Card
                                key={note.id}
                                onContextMenu={(e) => onContextMenu(e, note.id)}
                                sx={{
                                    bgcolor: '#0F0D0C',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(255, 255, 255, 0.03)',
                                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                                    backgroundImage: 'none',
                                    opacity: 0.6,
                                    '&:hover': {
                                        opacity: 1,
                                        bgcolor: '#161412',
                                        borderColor: alpha(theme.palette.error.main, 0.3)
                                    }
                                }}
                            >
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 800, mb: 0.5, flex: 1, pr: 1 }}>
                                            {note.title}
                                        </Typography>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <GhostClock createdAt={note.createdAt} expiresAt={note.expiresAt} />
                                            <IconButton size="small" onClick={(e) => onContextMenu(e, note.id)} sx={{ color: 'rgba(255,255,255,0.2)' }}>
                                                <MoreVertical size={14} />
                                            </IconButton>
                                        </Stack>
                                    </Stack>
                                    <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'error.main', fontWeight: 700 }}>
                                        Link expired. Recoverable for 7 days.
                                    </Typography>
                                    <Button
                                        fullWidth
                                        size="small"
                                        variant="text"
                                        onClick={() => onViewNote(note)}
                                        sx={{ fontSize: '0.7rem', fontWeight: 900, height: 'auto', py: 0.5, mb: 0.5 }}
                                    >
                                        VIEW STALE NOTE
                                    </Button>
                                    <Button
                                        fullWidth
                                        size="small"
                                        variant="text"
                                        onClick={() => onOpenIDMWindow()}
                                        sx={{ fontSize: '0.7rem', fontWeight: 900, height: 'auto', py: 0.5 }}
                                    >
                                        CLAIM TO RESTORE
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                </Box>
            )}

            <Menu
                open={contextMenu !== null}
                onClose={onCloseContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
                slotProps={{
                    paper: {
                        sx: {
                            minWidth: 180,
                            bgcolor: '#1C1A18',
                            backdropFilter: 'none',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            backgroundImage: 'none',
                            py: 0.5,
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.05)',
                        }
                    }
                }}
            >
                <MenuItem
                    onClick={() => onDeleteNote(contextMenu?.noteId || null)}
                    sx={{
                        px: 2,
                        py: 1,
                        gap: 1.5,
                        color: '#FF453A',
                        '&:hover': { bgcolor: 'rgba(255, 69, 58, 0.1)' }
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
                        <Trash2 size={16} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Remove from Stash"
                        slotProps={{ primary: { sx: { fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-satoshi)' } } }}
                    />
                </MenuItem>
            </Menu>

            <Box sx={{ mt: 4, p: 3, borderRadius: '24px', bgcolor: '#1C1A18', border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1, color: theme.palette.secondary.main }}>
                    Don&apos;t Lose Your Spark!
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', mb: 2, opacity: 0.8 }}>
                    Sparks vanish from stash 7 days after creation. Claim them now to secure them.
                </Typography>
                <Button
                    fullWidth
                    size="small"
                    onClick={() => onOpenIDMWindow()}
                    variant="contained"
                    color="secondary"
                    sx={{
                        fontWeight: 900
                    }}
                >
                    CLAIM NOTES NOW
                </Button>
            </Box>
        </Stack>
    );
});

GhostSparkShelf.displayName = 'GhostSparkShelf';

interface GhostSparkDetailPanelProps {
    note: GhostNoteRef;
    onRecreate: (title: string, content: string) => void;
    onOpenPublicLink: (note: GhostNoteRef) => void;
}

function parseSparkMeta(note: any): Record<string, any> {
    try {
        return JSON.parse(note?.metadata || '{}');
    } catch {
        return {};
    }
}

const GhostSparkDetailPanel = ({ note, onRecreate, onOpenPublicLink }: GhostSparkDetailPanelProps) => {
    const theme = useTheme();
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [loadedNote, setLoadedNote] = useState<any | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryToken, setRetryToken] = useState(0);

    useEffect(() => {
        let cancelled = false;

        const resolveNote = async () => {
            setStatus('loading');
            setError(null);
            setLoadedNote(null);

            try {
                const res = await fetch(`/api/shared/${note.id}`, { cache: 'no-store' });
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}));
                    throw new Error(payload.error || 'Failed to load shared note.');
                }

                const data = await res.json();
                const meta = parseSparkMeta(data);
                const needsKey = Boolean((meta.isEncrypted && meta.encryptionVersion === 'T4') || meta.isGhost);

                if (needsKey && !note.decryptionKey) {
                    throw new Error('This note is encrypted and requires a decryption key. Ask the sender to resend the full shared link.');
                }

                let title = data.title || note.title;
                let content = data.content || '';

                if (note.decryptionKey) {
                    try {
                        title = await decryptGhostData(title, note.decryptionKey);
                        content = await decryptGhostData(content, note.decryptionKey);
                    } catch {
                        throw new Error('This note could not be decrypted because the key is invalid. Ask the sender to resend the full shared link.');
                    }
                }

                if (cancelled) return;
                setLoadedNote({ ...data, title, content });
                setStatus('ready');
            } catch (err) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load shared note.');
                setStatus('error');
            }
        };

        resolveNote();

        return () => {
            cancelled = true;
        };
    }, [note.id, note.title, note.decryptionKey, retryToken]);

    const displayTitle = loadedNote?.title || note.title;
    const displayContent = loadedNote?.content || '';
    const canRecreate = status === 'ready' && Boolean(displayContent);

    if (status === 'error') {
        return (
            <Box sx={{ p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Stack spacing={1}>
                    <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white' }}>
                        {note.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700 }}>
                        GHOST SPARK • {new Date(note.createdAt).toLocaleDateString()}
                    </Typography>
                </Stack>
                <Box sx={{ p: 3, borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 900, color: 'white', mb: 1 }}>
                        Unable to open shared note
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)' }}>
                        {error}
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => setRetryToken((value) => value + 1)}
                    sx={{ borderRadius: '12px', fontWeight: 800 }}
                >
                    Retry
                </Button>
            </Box>
        );
    }

    if (status === 'loading') {
        return (
            <Box sx={{ p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Stack spacing={1}>
                    <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white' }}>
                        {note.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700 }}>
                        GHOST SPARK • {new Date(note.createdAt).toLocaleDateString()}
                    </Typography>
                </Stack>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress color="secondary" />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Stack spacing={1}>
                <Typography variant="h5" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white' }}>
                    {displayTitle}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 700 }}>
                    GHOST SPARK • {new Date(note.createdAt).toLocaleDateString()}
                </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                        navigator.clipboard.writeText(displayContent);
                        toast.success("Content copied");
                    }}
                    startIcon={<CopyIcon size={16} />}
                    sx={{
                        flex: 1,
                        borderRadius: '12px',
                        fontWeight: 800,
                        borderColor: alpha(theme.palette.secondary.main, 0.4),
                        color: theme.palette.secondary.main,
                        '&:hover': {
                            borderColor: theme.palette.secondary.main,
                            bgcolor: alpha(theme.palette.secondary.main, 0.05)
                        }
                    }}
                >
                    COPY
                </Button>
                <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    disabled={!canRecreate}
                    onClick={() => onRecreate(displayTitle, displayContent)}
                    startIcon={<RefreshCcw size={16} />}
                    sx={{ flex: 1, borderRadius: '12px', fontWeight: 800 }}
                >
                    RECREATE
                </Button>
            </Stack>

            <Typography
                variant="body1"
                sx={{
                    whiteSpace: 'pre-wrap',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontFamily: 'var(--font-satoshi)',
                    lineHeight: 1.8,
                    fontSize: '0.95rem',
                    bgcolor: 'rgba(255, 255, 255, 0.02)',
                    p: 3,
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
            >
                {displayContent}
            </Typography>

            <Button
                fullWidth
                variant="text"
                onClick={() => onOpenPublicLink(note)}
                startIcon={<ExternalLink size={16} />}
                sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'white' } }}
            >
                OPEN PUBLIC LINK
            </Button>
        </Box>
    );
};

export const GhostEditor = () => {
    const theme = useTheme();
    const { openIDMWindow } = useAuth();
    const { showSuccess } = useToast();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [prevNotes, setPrevNotes] = useState<GhostNoteRef[]>([]);
    const hasHistory = prevNotes.length > 0;
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isLinkCopied, setIsLinkCopied] = useState(false);
    const [isTitleManuallyEdited, setIsTitleManuallyEdited] = useState(false);
    
    const { openSidebar, closeSidebar } = useDynamicSidebar();
    
    // Lifespan Settings
    const [lifespanMs, setLifespanMs] = useState(7 * 24 * 60 * 60 * 1000); // Default 7 days
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const handleViewNote = useCallback((note: GhostNoteRef) => {
        openSidebar(
            <GhostSparkDetailPanel
                note={note}
                onRecreate={(displayTitle, displayContent) => {
                    setTitle(displayTitle);
                    setContent(displayContent);
                    closeSidebar();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onOpenPublicLink={(currentNote) => {
                    window.open(`/shared/${currentNote.id}${currentNote.decryptionKey ? `/${currentNote.decryptionKey}` : ''}`, '_blank');
                }}
            />,
            note.id
        );
    }, [closeSidebar, openSidebar]);

    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
        noteId: string;
    } | null>(null);

    // Load history and secret
    useEffect(() => {
        const loadHistory = () => {
            try {
                // Migration logic from v1 to v2
                const oldHistory = localStorage.getItem('kylrix_ghost_notes');
                
                if (oldHistory) {
                    const oldSecret = localStorage.getItem('kylrix_ghost_secret');
                    const currentHistory = localStorage.getItem(GHOST_STORAGE_KEY);
                    
                    try {
                        const parsedOld = JSON.parse(oldHistory);
                        const parsedCurrent = currentHistory ? JSON.parse(currentHistory) : [];
                        
                        if (Array.isArray(parsedOld)) {
                            const sevenDaysAgo = Date.now() - MAX_LIFESPAN_MS;
                            
                            // Map old notes to v2 schema
                            const migrated = parsedOld
                                .filter((n: any) => new Date(n.createdAt).getTime() > sevenDaysAgo)
                                .map((n: any) => ({
                                    id: n.id,
                                    title: n.title,
                                    createdAt: n.createdAt,
                                    expiresAt: n.expiresAt || new Date(new Date(n.createdAt).getTime() + MAX_LIFESPAN_MS).toISOString()
                                }));
                            
                            // Merge and deduplicate by ID (preserving v2 order where possible)
                            const mergedMap = new Map();
                            [...parsedCurrent, ...migrated].forEach(note => mergedMap.set(note.id, note));
                            const finalHistory = Array.from(mergedMap.values())
                                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                            localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(finalHistory));
                            
                            // Priority: Keep the old secret if it exists to ensure "Claim" works for old notes
                            if (oldSecret) {
                                localStorage.setItem(GHOST_SECRET_KEY, oldSecret);
                            }
                        }
                    } catch (e) {
                        console.error('Migration failed', e);
                    } finally {
                        // Clean up v1 keys immediately so this block never runs again
                        localStorage.removeItem('kylrix_ghost_notes');
                        localStorage.removeItem('kylrix_ghost_secret');
                    }
                }

                const history = localStorage.getItem(GHOST_STORAGE_KEY);
                if (history) {
                    const parsed = JSON.parse(history);
                    if (Array.isArray(parsed)) {
                        // Filter out notes created > 7 days ago
                        const sevenDaysAgo = Date.now() - MAX_LIFESPAN_MS;
                        const valid = parsed.filter((n: GhostNoteRef) => new Date(n.createdAt).getTime() > sevenDaysAgo);
                        setPrevNotes(valid);
                    }
                }

                // Load preferred lifespan
                const prefLifespan = localStorage.getItem(GHOST_PREF_LIFESPAN);
                if (prefLifespan) {
                    setLifespanMs(Number(prefLifespan));
                }
            } catch (e) {
                console.error('Failed to parse ghost history', e);
            }
        };

        loadHistory();
        
        // Listen for storage changes (Safari/Other tabs)
        window.addEventListener('storage', loadHistory);

        if (!localStorage.getItem(GHOST_SECRET_KEY)) {
            localStorage.setItem(GHOST_SECRET_KEY, crypto.randomUUID());
        }

        return () => window.removeEventListener('storage', loadHistory);
    }, []);

    const saveLifespanPref = useCallback((ms: number) => {
        setLifespanMs(ms);
        localStorage.setItem(GHOST_PREF_LIFESPAN, ms.toString());
    }, []);

    const saveHistory = useCallback((history: GhostNoteRef[]) => {
        try {
            localStorage.setItem(GHOST_STORAGE_KEY, JSON.stringify(history));
            setPrevNotes(history);
            // Dispatch storage event manually for Safari/same-window consistency
            window.dispatchEvent(new Event('storage'));
        } catch (e) {
            console.error('Failed to save ghost history', e);
        }
    }, []);

    // Seamless auto-title logic
    useEffect(() => {
        if (isTitleManuallyEdited) return;

        const generatedTitle = buildAutoTitleFromContent(content);
        if (content.trim()) {
            if (generatedTitle !== title) {
                setTitle(generatedTitle);
            }
        } else {
            setTitle('');
        }
    }, [content, isTitleManuallyEdited, title]);

    const copyToClipboard = async (text: string) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for Safari/Non-secure contexts
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                return successful;
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
            return false;
        }
    };

    const handleCreateAndCopyLink = async () => {
        if (!title.trim() || !content.trim()) {
            toast.error("Complete your note first!");
            return;
        }

        setIsCreating(true);
        try {
            const secret = localStorage.getItem(GHOST_SECRET_KEY) || crypto.randomUUID();
            const finalTitle = title.trim();
            const expiresAt = new Date(Date.now() + lifespanMs).toISOString();
            
            // ENCRYPT GHOST NOTE
            const { encrypted: encTitle, key: noteKey } = await encryptGhostData(finalTitle);
            const { encrypted: encContent } = await encryptGhostData(content.trim(), noteKey);
            
            const note = await AppwriteService.createGhostNote({
                title: encTitle,
                content: encContent,
                ghostSecret: secret,
                expiresAt: expiresAt,
                isEncrypted: true
            });

            if (note) {
                // URI format: /shared/[id]/[key]
                const url = `${window.location.origin}/shared/${note.$id}/${noteKey}`;
                const copied = await copyToClipboard(url);
                
                if (copied) {
                    setCopiedId(note.$id);
                    showSuccess('Link Copied', 'Live share link copied to clipboard.');
                } else {
                    toast.error("Note created, but failed to copy link. Check your history.");
                }

                // Update history
                const newRef: GhostNoteRef = { 
                    id: note.$id, 
                    title: finalTitle, // Plain title for history
                    createdAt: new Date().toISOString(),
                    expiresAt: expiresAt,
                    decryptionKey: noteKey
                };
                const updatedHistory = [newRef, ...prevNotes].slice(0, 10);
                saveHistory(updatedHistory);

                // Clear editor
                setTitle('');
                setContent('');
                setIsTitleManuallyEdited(false);

                setTimeout(() => setCopiedId(null), 3000);
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Creation failed. System degraded.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleCopyContent = async () => {
        if (!content.trim()) return;
        const copied = await copyToClipboard(content);
        if (copied) {
            setIsLinkCopied(true);
            toast.success("Content copied");
            setTimeout(() => setIsLinkCopied(false), 2000);
        }
    };

    const handleContextMenu = useCallback((event: React.MouseEvent, noteId: string) => {
        event.preventDefault();
        setContextMenu(
            contextMenu === null
                ? {
                      mouseX: event.clientX + 2,
                      mouseY: event.clientY - 6,
                      noteId
                  }
                : null,
        );
    }, [contextMenu]);

    const handleCloseContextMenu = useCallback(() => setContextMenu(null), []);

    const handleDeleteNote = useCallback((noteId: string | null) => {
        if (!noteId) {
            return;
        }

        const updatedHistory = prevNotes.filter((note) => note.id !== noteId);
        saveHistory(updatedHistory);
        setContextMenu(null);
    }, [prevNotes, saveHistory]);

    const handleDeleteAll = useCallback(() => {
        setPrevNotes([]);
        saveHistory([]);
    }, [saveHistory]);

    const handleOpenIDMWindow = useCallback(() => openIDMWindow(), [openIDMWindow]);

    const activeSparks = useMemo(() => prevNotes.filter(n => new Date(n.expiresAt).getTime() > Date.now()), [prevNotes]);
    const staleSparks = useMemo(() => prevNotes.filter(n => new Date(n.expiresAt).getTime() <= Date.now()), [prevNotes]);

    return (
        <Container maxWidth="lg" sx={{ py: 2, position: 'relative' }}>
            {/* Top CTA */}
            <Alert 
                severity="info" 
                icon={<Clock size={20} />}
                sx={{ 
                    mb: 3, 
                    borderRadius: '16px', 
                    bgcolor: '#161412',
                    color: theme.palette.info.main,
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                    '& .MuiAlert-message': { width: '100%' }
                }}
            >
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
                    <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Ghost Mode active. Notes last up to 7 days.
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                            Login to Edit, Delete, or Secure your sparks permanently.
                        </Typography>
                    </Box>
                    <Button 
                        size="small" 
                        variant="text"
                        onClick={() => openIDMWindow()}
                        sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                    >
                        Create Permanent Vault →
                    </Button>
                </Stack>
            </Alert>

            <Grid container spacing={4}>
                {/* Main Editor */}
                <Grid size={{ xs: 12, lg: hasHistory ? 8 : 12 }}>
                    <Paper sx={{ 
                        p: 0, 
                        borderRadius: '32px', 
                        overflow: 'hidden',
                        bgcolor: '#161412',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
                        backdropFilter: 'none',
                        position: 'relative',
                        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                        '&:focus-within': {
                            borderColor: alpha(theme.palette.secondary.main, 0.4),
                            boxShadow: `0 40px 80px -20px rgba(0,0,0,0.9), 0 0 20px ${alpha(theme.palette.secondary.main, 0.1)}, inset 0 1px 1px ${alpha('#FFFFFF', 0.1)}`,
                        }
                    }}>
                        {/* Action Header Area */}
                        <Box sx={{ 
                            px: 4, 
                            pt: 3, 
                            pb: 2, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                        }}>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1, 
                                    px: 1.5, 
                                    py: 0.5, 
                                    borderRadius: '8px', 
                                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color: content.length >= MAX_CONTENT_LENGTH ? theme.palette.error.main : 'rgba(255, 255, 255, 0.4)',
                                            fontWeight: 700,
                                            fontFamily: 'var(--font-jetbrains-mono)',
                                            letterSpacing: '0.05em'
                                        }}
                                    >
                                        {content.length.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}
                                    </Typography>
                                </Box>

                                <Tooltip title={`Lifespan: ${LIFESPAN_OPTIONS.find(o => o.value === lifespanMs)?.label || '7 Days'}`}>
                                    <Box 
                                        onClick={() => setIsSettingsOpen(true)}
                                        sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 1, 
                                            px: 1.5, 
                                            py: 0.5, 
                                            borderRadius: '8px', 
                                            cursor: 'pointer',
                                            bgcolor: alpha(theme.palette.secondary.main, 0.05),
                                            border: `1px solid ${alpha(theme.palette.secondary.main, 0.1)}`,
                                            color: theme.palette.secondary.main,
                                            transition: 'all 0.2s',
                                            '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.1) }
                                        }}
                                    >
                                        <Clock size={12} />
                                        <Typography variant="caption" sx={{ fontWeight: 800, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                            {LIFESPAN_OPTIONS.find(o => o.value === lifespanMs)?.label.split(' ')[0] || '7d'}
                                        </Typography>
                                    </Box>
                                </Tooltip>
                            </Stack>

                            <Stack direction="row" spacing={1}>
                                <Tooltip title="Copy Content" placement="top">
                                    <IconButton
                                        onClick={handleCopyContent}
                                        disabled={!content.trim()}
                                        size="small"
                                        sx={{ 
                                            bgcolor: alpha(theme.palette.background.paper, 0.4),
                                            color: isLinkCopied ? theme.palette.secondary.main : 'rgba(255, 255, 255, 0.4)',
                                            border: '1px solid rgba(255, 255, 255, 0.05)',
                                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'white' }
                                        }}
                                    >
                                        {isLinkCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                                    </IconButton>
                                </Tooltip>

                                <Tooltip title="Copy Share Link" placement="top">
                                    <IconButton
                                        onClick={handleCreateAndCopyLink}
                                        disabled={isCreating || !title.trim() || !content.trim()}
                                        size="small"
                                        sx={{ 
                                            bgcolor: copiedId ? alpha(theme.palette.secondary.main, 0.1) : alpha(theme.palette.background.paper, 0.4),
                                            color: copiedId ? theme.palette.secondary.main : 'white',
                                            border: '1px solid',
                                            borderColor: copiedId ? theme.palette.secondary.main : 'rgba(255, 255, 255, 0.05)',
                                            '&:hover': {
                                                bgcolor: alpha(theme.palette.secondary.main, 0.05),
                                                borderColor: theme.palette.secondary.main
                                            }
                                        }}
                                    >
                                        {isCreating ? <CircularProgress size={16} color="inherit" /> : (copiedId ? <CheckIcon size={16} /> : <Share2 size={16} />)}
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>

                        <Box sx={{ p: 4, pt: 3, pb: 2 }}>
                            {(content.trim().length >= 5 || isTitleManuallyEdited) && (
                                <TextField
                                    fullWidth
                                    placeholder="Note Title"
                                    value={title}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        setIsTitleManuallyEdited(true);
                                    }}
                                    variant="standard"
                                    InputProps={{
                                        disableUnderline: true,
                                        sx: { 
                                            fontSize: '2.5rem', 
                                            fontWeight: 900, 
                                            fontFamily: 'var(--font-clash)',
                                            color: 'white', 
                                            mb: 1,
                                            animation: 'fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                            '@keyframes fadeIn': {
                                                '0%': { opacity: 0, transform: 'translateY(-10px)' },
                                                '100%': { opacity: 1, transform: 'translateY(0)' }
                                            },
                                            '&::placeholder': { opacity: 0.1 }
                                        }
                                    }}
                                />
                            )}
                            <TextField
                                fullWidth
                                multiline
                                minRows={12}
                                maxRows={20}
                                placeholder="Start typing your brilliance..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                variant="standard"
                                InputProps={{
                                    disableUnderline: true,
                                    sx: { 
                                        fontSize: '1.1rem', 
                                        lineHeight: 1.6,
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        fontFamily: 'var(--font-satoshi)',
                                        '&::placeholder': { opacity: 0.1 }
                                    }
                                }}
                                inputProps={{
                                    maxLength: MAX_CONTENT_LENGTH
                                }}
                            />
                        </Box>

                        <Box sx={{ 
                            p: 3, 
                            bgcolor: '#1C1A18', 
                            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Box sx={{ display: 'flex', color: 'rgba(255, 255, 255, 0.3)' }}>
                                    <Shield size={16} />
                                    <Typography variant="caption" sx={{ ml: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Public & Anonymous
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', color: 'var(--color-secondary)', alignItems: 'center' }}>
                                    <Clock size={16} />
                                    <Typography variant="caption" sx={{ ml: 1, fontWeight: 800 }}>
                                        Expires in {LIFESPAN_OPTIONS.find(o => o.value === lifespanMs)?.label || 'Custom'}
                                    </Typography>
                                </Box>
                            </Stack>

                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" sx={{ display: 'block', mb: 1, opacity: 0.4, fontWeight: 700 }}>
                                    ONCE SHARED, THIS NOTE IS LOCKED.
                                </Typography>
                                    <Button
                                        onClick={handleCreateAndCopyLink}
                                        disabled={isCreating || !title.trim() || !content.trim()}
                                        variant="contained"
                                        color="secondary"
                                        sx={{ 
                                            borderRadius: '100px',
                                            px: 4,
                                            py: 1.5,
                                            fontWeight: 900,
                                            bgcolor: 'var(--color-secondary)',
                                            boxShadow: `0 10px 30px ${alpha('#EC4899', 0.3)}`,
                                            '&:hover': {
                                                transform: 'translateY(-2px)',
                                                bgcolor: '#D946EF',
                                                boxShadow: `0 15px 40px ${alpha('#EC4899', 0.5)}`,
                                            }
                                        }}
                                    >
                                        {isCreating ? (
                                            <CircularProgress size={20} color="inherit" />
                                        ) : (
                                            <>
                                                {copiedId ? <CheckIcon size={18} /> : <Share2 size={18} />}
                                                <Box component="span" sx={{ ml: 1 }}>{copiedId ? 'LINK COPIED' : 'COPY LINK'}</Box>
                                            </>
                                        )}
                                    </Button>
                            </Box>
                        </Box>
                    </Paper>

                    {/* Bottom CTA */}
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', display: 'block', mb: 2, fontWeight: 700, letterSpacing: '0.1em' }}>
                            WANT TO KEEP YOUR NOTES FOREVER?
                        </Typography>
                        <Button 
                            variant="outlined"
                            onClick={() => openIDMWindow()}
                            sx={{ 
                                borderRadius: '100px', 
                                px: 6,
                                py: 2,
                                border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
                                color: theme.palette.secondary.main,
                                fontWeight: 900,
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.secondary.main, 0.05),
                                    borderColor: theme.palette.secondary.main
                                }
                            }}
                        >
                            <Zap size={18} style={{ marginRight: 8 }} />
                            UPGRADE TO SOVEREIGN ACCOUNT
                        </Button>
                    </Box>
                </Grid>

                {/* Sidebar History */}
                {hasHistory && (
                    <Grid size={{ xs: 12, lg: 4 }}>
                        <Paper sx={{ 
                            p: 3, 
                            borderRadius: '32px', 
                            bgcolor: '#161412',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
                            height: 'fit-content'
                        }}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 3, justifyContent: 'space-between' }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <HistoryIcon size={20} color={theme.palette.secondary.main} />
                                    <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)' }}>
                                        Your Sparks
                                    </Typography>
                                </Stack>
                                <Tooltip title="Clear Stash">
                                    <IconButton size="small" onClick={handleDeleteAll} sx={{ color: 'rgba(255,255,255,0.2)', '&:hover': { color: '#FF453A' } }}>
                                        <Trash2 size={16} />
                                    </IconButton>
                                </Tooltip>
                            </Stack>

                            <GhostSparkShelf
                                activeSparks={activeSparks}
                                staleSparks={staleSparks}
                                contextMenu={contextMenu}
                                onContextMenu={handleContextMenu}
                                onCloseContextMenu={handleCloseContextMenu}
                                onViewNote={handleViewNote}
                                onDeleteNote={handleDeleteNote}
                                onOpenIDMWindow={handleOpenIDMWindow}
                            />
                        </Paper>
                    </Grid>
                )}
            </Grid>

            {/* Lifespan Settings Modal */}
            <Dialog 
                open={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)}
                PaperProps={{
                    sx: {
                        bgcolor: '#161412',
                        backdropFilter: 'none',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 40px 80px -20px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.05)',
                        borderRadius: '24px',
                        backgroundImage: 'none',
                        maxWidth: '400px',
                        width: '100%'
                    }
                }}
            >
                <DialogTitle sx={{ p: 3, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white' }}>
                        Spark Settings
                    </Typography>
                    <IconButton onClick={() => setIsSettingsOpen(false)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
                        <X size={20} />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 3, pt: 0 }}>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <FormLabel sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, mb: 2, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Lifespan Duration
                        </FormLabel>
                        <RadioGroup
                            value={lifespanMs}
                            onChange={(e) => saveLifespanPref(Number(e.target.value))}
                        >
                            <Grid container spacing={1}>
                                {LIFESPAN_OPTIONS.map((option) => (
                                             <Grid size={{ xs: 6 }} key={option.value}>
                                        <FormControlLabel
                                            value={option.value}
                                            control={<Radio sx={{ color: alpha(theme.palette.text.primary, 0.1), '&.Mui-checked': { color: theme.palette.secondary.main } }} />}
                                            label={
                                                <Typography variant="body2" sx={{ fontWeight: 700, color: lifespanMs === option.value ? theme.palette.text.primary : theme.palette.text.secondary }}>
                                                    {option.label}
                                                </Typography>
                                            }
                                            sx={{
                                                m: 0,
                                                width: '100%',
                                                p: 1,
                                                borderRadius: '12px',
                                                bgcolor: lifespanMs === option.value ? alpha(theme.palette.secondary.main, 0.1) : 'transparent',
                                                border: '1px solid',
                                                borderColor: lifespanMs === option.value ? theme.palette.secondary.main : theme.palette.divider,
                                                transition: 'all 0.2s',
                                                '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.05) }
                                            }}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                        </RadioGroup>
                    </FormControl>
                </DialogContent>
            </Dialog>
        </Container>
    );
};
