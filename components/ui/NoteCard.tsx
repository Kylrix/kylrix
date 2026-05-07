"use client";

import React, { useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  Typography, 
  Box, 
  IconButton, 
  Chip, 
  alpha,
} from '@mui/material';
import { useContextMenu } from './ContextMenuContext';
import { useDynamicSidebar } from './DynamicSidebar';
import { NoteDetailSidebar } from './NoteDetailSidebar';
import { useNotes } from '@/context/NotesContext';
import type { Notes } from '@/types/appwrite';
import { DoodleStroke } from '@/types/notes';
import {
  Delete as TrashIcon,
  AttachFile as AttachFileIcon,
  PushPin as PinIcon,
  PushPinOutlined as PinOutlinedIcon,
  ContentCopy as DuplicateIcon,
  Share as ShareIcon,
  Lock as PrivateIcon,
  LockOpen as PublicIcon,
  Link as LinkIcon,
  Refresh as RefreshIcon,
  LocalOffer as LocalOfferIcon,
} from '@mui/icons-material';
import { sidebarIgnoreProps } from '@/constants/sidebar';
import { ShareNoteModal } from '../ShareNoteModal';
import PaywallDrawer from '../NoteContextMenu';
import { updateNote, createNote, toggleNoteVisibility, rotatePublicNoteLink, createTaskFromNote, getShareableUrl, getCurrentPublicNoteShareUrl, getNotePublicState } from '@/lib/appwrite';
import { useToast } from './Toast';
import { useSudo } from '@/context/SudoContext';
import { useAuth } from './AuthContext';
import { generateAIAction } from '@/lib/ai-actions';
import {
  PlaylistAdd as TodoIcon,
  Summarize as SummarizeIcon,
  Spellcheck as GrammarIcon,
} from '@mui/icons-material';

interface NoteCardProps {
  note: Notes;
  onUpdate?: (updatedNote: Notes) => void;
  onDelete?: (noteId: string) => void;
  onNoteSelect?: (note: Notes) => void;
}

const NoteCard: React.FC<NoteCardProps> = React.memo(({ note, onUpdate, onDelete, onNoteSelect }) => {
  const router = useRouter();
  const { openMenu } = useContextMenu();
  const { openSidebar } = useDynamicSidebar();
  const { isPinned, pinNote, unpinNote, upsertNote } = useNotes();
  
  // Gracefully degrade if useAuth is not available
  let user = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch {
    // useAuth not available in this context, continue without it
  }
  
  const { promptSudo } = useSudo();
  const { showSuccess, showError, showInfo } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isShareModalOpen, setIsShareModalOpen] = React.useState(false);
  const [isPaywallDialogOpen, setIsPaywallDialogOpen] = React.useState(false);
  const [isAIProcessing, setIsAIProcessing] = React.useState(false);
  const isPublic = getNotePublicState(note);

  const isPro = user?.prefs?.subscriptionTier === 'PRO' || 
                user?.prefs?.subscriptionTier === 'ORG' || 
                user?.prefs?.subscriptionTier === 'LIFETIME';
  const noteMeta = (() => {
    try {
      return JSON.parse(note.metadata || '{}');
    } catch {
      return {};
    }
  })();
  const isEncryptedNote = !!noteMeta?.isEncrypted && noteMeta?.encryptionVersion === 'T4' && !noteMeta?.clientDecrypted;

  const handleAIAction = async (action: 'summarize' | 'grammar' | 'expand') => {
    if (isAIProcessing) return;
    setIsAIProcessing(true);
    showInfo(`AI is ${action === 'grammar' ? 'fixing' : action + 'ing'} your note...`);
    
    try {
      const result = await generateAIAction(note, action);
      const updated = await updateNote(note.$id, {
        content: result,
        updatedAt: new Date().toISOString()
      });
      upsertNote(updated);
      showSuccess(`Note ${action}d successfully`);
    } catch (err: any) {
      showError(err.message || `Failed to ${action} note`);
    } finally {
      setIsAIProcessing(false);
    }
  };

  const handleCreateTodo = async () => {
    if (isAIProcessing) return;
    setIsAIProcessing(true);
    showInfo('Converting note to task in Kylrix Flow...');

    try {
      await createTaskFromNote(note);
      showSuccess('Linked task created in Kylrix Flow');
    } catch (err: any) {
      showError(err.message || 'Failed to create task');
    } finally {
      setIsAIProcessing(false);
    }
  };

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number, y: number } | null>(null);
  const isLongPressActive = useRef(false);

  const pinned = isPinned(note.$id);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handlePinToggle = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      if (pinned) {
        await unpinNote(note.$id);
        showSuccess('Note unpinned');
      } else {
        await pinNote(note.$id);
        showSuccess('Note pinned');
      }
    } catch (err: any) {
      const isLimitError = err.message?.includes('limit reached');
      showError(err.message || 'Failed to update pin status', undefined, isLimitError);
    }
  };

  const handleDuplicate = async () => {
    try {
      const { $id: _id, $createdAt: _ca, $updatedAt: _ua, $permissions: _p, $databaseId: _db, $collectionId: _coll, ...rest } = note as any;
      const duplicatedNote = await createNote({
        ...rest,
        title: `${note.title} (Copy)`,
      });
      upsertNote(duplicatedNote as Notes);
      showSuccess('Note duplicated');
    } catch (err: any) {
      showError(err.message || 'Failed to duplicate note');
    }
  };

  const handleTogglePublic = async () => {
    const handleToggle = async () => {
      try {
        const updated = await toggleNoteVisibility(note.$id);
        if (updated) {
          upsertNote(updated);
          showSuccess(updated.isPublic ? 'Note made public' : 'Note made private');
          if (updated.isPublic && updated.decryptionKey) {
            const shareUrl = getShareableUrl(note.$id, updated.decryptionKey);
            navigator.clipboard.writeText(shareUrl);
            showSuccess('Link Copied', 'Encrypted public link is on your clipboard.');
          }
        } else {
          throw new Error('Failed to update visibility');
        }
      } catch (err: any) {
        if (err.message === 'VAULT_LOCKED') {
          showError('Vault Locked', "Unlock vault to update this note's public state.");
          const unlocked = await promptSudo();
          if (unlocked) handleToggle();
        } else {
          showError(err.message || 'Failed to update visibility');
        }
      }
    };
    handleToggle();
  };

  const handleCopyShareLink = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const shareUrl = isPublic ? await getCurrentPublicNoteShareUrl(note.$id) : null;
    if (isPublic && !shareUrl) {
      showError('Vault Locked', 'Unlock vault to copy the current public link.');
      return;
    }
    const finalUrl = shareUrl || getShareableUrl(note.$id);
    navigator.clipboard.writeText(finalUrl);
    showSuccess('Share link copied to clipboard');
  };

  const handleRotatePublicLink = async () => {
    const handleRotate = async () => {
      try {
        const updated = await rotatePublicNoteLink(note.$id);
        if (updated) {
          upsertNote(updated);
          if (updated.decryptionKey) {
            const shareUrl = getShareableUrl(note.$id, updated.decryptionKey);
            navigator.clipboard.writeText(shareUrl);
            showSuccess('Public link rotated', 'New public link copied to clipboard.');
          } else {
            showSuccess('Public link rotated');
          }
        }
      } catch (err: any) {
        if (err.message === 'VAULT_LOCKED') {
          showError('Vault Locked', 'Unlock vault to rotate the public link.');
          const unlocked = await promptSudo();
          if (unlocked) handleRotate();
        } else {
          showError(err.message || 'Failed to rotate public link');
        }
      }
    };

    handleRotate();
  };

  // Render doodle preview on canvas
  useEffect(() => {
    if (note.format !== 'doodle' || !note.content || !canvasRef.current) return;

    try {
      const strokes: DoodleStroke[] = JSON.parse(note.content);
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      strokes.forEach((stroke) => {
        if (stroke.points.length < 2) return;
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = stroke.opacity ?? 1;
        ctx.beginPath();
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    } catch {
      console.error('Failed to render doodle preview');
    }
  }, [note.format, note.content]);

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isLongPressActive.current) return;
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: contextMenuItems
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressActive.current = false;

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      if (window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
      openMenu({
        x: touch.clientX,
        y: touch.clientY,
        items: contextMenuItems
      });
    }, 600); // 600ms for long press
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
    
    // If moved more than 10px, cancel long press (prevents trigger during scroll)
    if (dx > 10 || dy > 10) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = () => {
    // If it was a long press, don't trigger the click
    if (isLongPressActive.current) {
      isLongPressActive.current = false;
      return;
    }
    if (onNoteSelect) {
      onNoteSelect(note);
      return;
    }
    // Navigate to note detail page
    router.push(`/note/notes/${note.$id}`);
  };

  const handleDelete = () => {
    if (onDelete && note.$id) {
      onDelete(note.$id);
    }
  };

  const handlePaywallUpdate = (updatedNote: any) => {
    // Update the note in the local context without triggering profile fetches
    upsertNote(updatedNote as Notes);
  };

  const contextMenuItems = [
    {
      label: pinned ? 'Unpin' : 'Pin',
      icon: pinned ? <PinIcon sx={{ fontSize: 18 }} /> : <PinOutlinedIcon sx={{ fontSize: 18 }} />,
      onClick: () => { handlePinToggle(); }
    },
    ...(isPublic ? [{
      label: 'Copy Share Link',
      icon: <LinkIcon sx={{ fontSize: 18 }} />,
      onClick: () => { handleCopyShareLink(); }
    }, {
      label: 'Change Public Link',
      icon: <RefreshIcon sx={{ fontSize: 18 }} />,
      onClick: () => { handleRotatePublicLink(); }
    }] : []),
    {
      label: isPublic ? 'Make Private' : 'Make Public',
      icon: isPublic ? <PrivateIcon sx={{ fontSize: 18 }} /> : <PublicIcon sx={{ fontSize: 18 }} />,
      onClick: () => { handleTogglePublic(); }
    },
    {
      label: 'Duplicate',
      icon: <DuplicateIcon sx={{ fontSize: 18 }} />,
      onClick: () => { handleDuplicate(); }
    },
    {
      label: 'Add Paywall',
      icon: <LocalOfferIcon sx={{ fontSize: 18, color: '#EC4899' }} />,
      onClick: () => { setIsPaywallDialogOpen(true); }
    },
    ...(isPro ? [
      {
        label: 'AI Summarize',
        icon: <SummarizeIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
        onClick: () => { handleAIAction('summarize'); }
      },
      {
        label: 'AI Fix Grammar',
        icon: <GrammarIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
        onClick: () => { handleAIAction('grammar'); }
      },
      {
        label: 'Convert To Todo',
        icon: <TodoIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
        onClick: () => { handleCreateTodo(); }
      }
    ] : []),
    {
      label: 'Share with...',
      icon: <ShareIcon sx={{ fontSize: 18 }} />,
      onClick: () => setIsShareModalOpen(true)
    },
    {
      label: 'Delete',
      icon: <TrashIcon sx={{ fontSize: 18 }} />,
      onClick: handleDelete,
      variant: 'destructive' as const
    }
  ];

  return (
    <>
      <ShareNoteModal 
        isOpen={isShareModalOpen} 
        onOpenChange={setIsShareModalOpen} 
        noteId={note.$id} 
        noteTitle={note.title || 'Untitled note'} 
      />
      <PaywallDrawer
        open={isPaywallDialogOpen}
        onClose={() => setIsPaywallDialogOpen(false)}
        note={note}
        onUpdate={handlePaywallUpdate}
      />
      <Card
        {...sidebarIgnoreProps}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        sx={{
          height: { xs: 160, sm: 180, md: 200, lg: 220 },
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(28, 26, 24, 0.98)' : 'rgba(255, 255, 255, 0.8)',
          border: '1px solid',
          borderColor: (theme) => theme.palette.mode === 'dark' ? alpha('#FFFFFF', 0.08) : 'divider',
          borderRadius: '28px',
          // Hybrid 3D design: Deep stage shadows + rim lighting
          boxShadow: (theme) => theme.palette.mode === 'dark' 
            ? `0 12px 24px -10px rgba(0, 0, 0, 0.8), 
               0 2px 4px rgba(0,0,0,0.5), 
               inset 0 1px 0 rgba(255, 255, 255, 0.05),
               inset 0 -1px 0 rgba(0, 0, 0, 0.4)`
            : `0 10px 30px rgba(15, 23, 42, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.9)`,
          transform: 'perspective(1200px) translateY(0px)',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          // Brand gradient overlay (Pink to Indigo) - Subtle base depth
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(165deg, rgba(236, 72, 153, 0.03) 0%, rgba(99, 102, 241, 0.03) 100%)'
              : 'linear-gradient(135deg, rgba(236, 72, 153, 0.02) 0%, rgba(99, 102, 241, 0.02) 100%)',
            opacity: 1,
            zIndex: 0,
          },
          '&:hover': {
            transform: 'perspective(1200px) translateY(-12px) scale(1.02)',
            borderColor: (theme) => alpha(theme.palette.secondary.main, 0.5), 
            bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 1)',
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? `0 40px 80px -20px rgba(0, 0, 0, 0.9), 
                 0 0 20px ${alpha(theme.palette.primary.main, 0.1)}, 
                 inset 0 1px 0 rgba(255, 255, 255, 0.1)`
              : `0 30px 60px -15px rgba(15, 23, 42, 0.15), 0 0 25px rgba(99, 102, 241, 0.1), inset 0 1px 1px rgba(255, 255, 255, 1)`,
            '&::after': {
              opacity: 1,
              transform: 'scaleX(1)',
            }
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: 0,
            left: '10%',
            right: '10%',
            height: '1px',
            background: (theme) => `linear-gradient(90deg, transparent, ${theme.palette.primary.main}, transparent)`,
            opacity: 0,
            transform: 'scaleX(0.5)',
            transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
            zIndex: 1,
          }
        }}
      >
        <CardHeader
          sx={{ pb: 0.5, p: 2.5 }}
          title={
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Typography 
                variant="h4" 
                sx={{ 
                  fontSize: { xs: '0.875rem', sm: '1rem' }, 
                  fontWeight: 900,
                  fontFamily: 'var(--font-clash-display)',
                  color: 'secondary.main', // App Secondary
                  letterSpacing: '-0.02em',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  flex: 1,
                  lineHeight: 1.2
                }}
              >
            {isEncryptedNote ? '🔒 Encrypted note' : note.title}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {isPublic && (
                  <IconButton
                    size="small"
                    onClick={handleCopyShareLink}
                    sx={{
                      p: 0.5,
                      color: 'text.secondary',
                      opacity: 0.6,
                      borderRadius: '8px',
                      '&:hover': {
                        color: 'primary.main',
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                        opacity: 1
                      }
                    }}
                  >
                    <LinkIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  onClick={handlePinToggle}
                  sx={{ 
                    p: 0.5,
                    color: pinned ? 'primary.main' : 'text.secondary',
                    opacity: pinned ? 1 : 0.4,
                    borderRadius: '8px',
                    '&:hover': {
                      color: 'primary.main',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
                      opacity: 1
                    }
                  }}
                >
                  {pinned ? <PinIcon sx={{ fontSize: 16 }} /> : <PinOutlinedIcon sx={{ fontSize: 16 }} />}
                </IconButton>

                {note.attachments && note.attachments.length > 0 && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 0.3, 
                    px: 1, 
                    py: 0.4, 
                    borderRadius: '8px', 
                    bgcolor: 'rgba(99, 102, 241, 0.05)',
                    color: 'primary.main',
                    fontSize: '10px',
                    fontWeight: 800,
                    border: '1px solid rgba(99, 102, 241, 0.1)',
                    fontFamily: 'var(--font-jetbrains-mono)'
                  }}>
                    <AttachFileIcon sx={{ fontSize: 10 }} />
                    {note.attachments.length}
                  </Box>
                )}
              </Box>
            </Box>
          }
        />

        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0, position: 'relative', p: 2.5, pt: 0 }}>
          {note.format === 'doodle' ? (
            <Box sx={{ 
              flex: 1, 
              borderRadius: '16px', 
              border: '1.5px solid',
              borderColor: 'divider',
              overflow: 'hidden', 
              bgcolor: (theme) => alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.3 : 0.6),
              position: 'relative'
            }}>
              <canvas
                ref={canvasRef}
                width={300}
                height={200}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </Box>
          ) : (
            isEncryptedNote ? (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontFamily: 'var(--font-satoshi)',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  fontStyle: 'italic',
                  opacity: 0.75,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  '@media (min-width: 600px)': {
                    WebkitLineClamp: 4,
                  },
                  '@media (min-width: 900px)': {
                    WebkitLineClamp: 5,
                  },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap'
                }}
              >
                🔒 Encrypted note
              </Typography>
            ) : (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary',
                  fontFamily: 'var(--font-satoshi)',
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  fontWeight: 500,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  '@media (min-width: 600px)': {
                    WebkitLineClamp: 4,
                  },
                  '@media (min-width: 900px)': {
                    WebkitLineClamp: 5,
                  },
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {note.content}
              </Typography>
            )
          )}
          
          <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.8, overflow: 'hidden' }}>
            {note.tags && note.tags.slice(0, 2).map((tag: string, index: number) => (
              <Chip
                key={index}
                label={tag}
                size="small"
                sx={{ 
                  height: 22, 
                  fontSize: '10px', 
                  fontWeight: 800,
                  fontFamily: 'var(--font-jetbrains-mono)',
                  textTransform: 'uppercase',
                  bgcolor: (theme) => alpha(theme.palette.text.primary, 0.03),
                  color: 'text.secondary',
                  border: '1.5px solid',
                  borderColor: 'divider',
                  borderRadius: '8px',
                  '& .MuiChip-label': { px: 1 }
                }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>
    </>
  );
});


NoteCard.displayName = 'NoteCard';

export default NoteCard;