"use client";

import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent, type ReactNode, type MouseEvent as ReactMouseEvent } from 'react';
import { Box, Typography, TextField, Button, List, ListItem, ListItemText, Divider, IconButton, Collapse, Avatar, Link, Popover, Tooltip, ListItemAvatar, ListItemButton, CircularProgress, alpha } from '@mui/material';
import { Reply as ReplyIcon, ExpandMore, ExpandLess, Edit as EditIcon, Delete as DeleteIcon, MoreVert as MoreIcon, Block as BlockIcon, EmojiEmotionsOutlined } from '@mui/icons-material';
import { listComments, createComment, getUsersByIds, updateComment, deleteComment, deleteReactionsForTarget } from '@/lib/appwrite';
import type { Comments, Users } from '@/types/appwrite';
import { getEffectiveDisplayName, getEffectiveUsername, getUserProfilePicId } from '@/lib/utils';
import { useAuth } from '@/components/ui/AuthContext';
import { useDataNexus } from '@/context/DataNexusContext';
import { getEcosystemUrl } from '@/constants/ecosystem';
import { Menu, MenuItem, ListItemIcon } from '@mui/material';
import NoteReactions from './NoteReactions';
import { TargetType } from '@/types/appwrite';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profilePreview';
import { getCachedCommentIdentity, getCachedCommentIdentities, upsertCommentIdentity, upsertCommentIdentities } from '@/lib/commentIdentityCache';
import { searchGlobalUsers } from '@/lib/ecosystem/identity';

interface CommentsProps {
  noteId: string;
}

interface CommentWithChildren extends Comments {
  children: CommentWithChildren[];
}

function buildCommentTree(flatComments: Comments[]): CommentWithChildren[] {
  const commentMap: { [key: string]: CommentWithChildren } = {};
  const rootComments: CommentWithChildren[] = [];

  flatComments.forEach(comment => {
    commentMap[comment.$id] = { ...comment, children: [] };
  });

  flatComments.forEach(comment => {
    if (comment.parentCommentId && commentMap[comment.parentCommentId]) {
      commentMap[comment.parentCommentId].children.push(commentMap[comment.$id]);
    } else {
      rootComments.push(commentMap[comment.$id]);
    }
  });

  return rootComments;
}

const MENTION_COLOR = '#6366F1';
const MENTION_REGEX = /(^|[\s(])@([a-zA-Z0-9_]+)/g;

interface MentionResult {
  id: string;
  title: string;
  subtitle?: string | null;
  username?: string | null;
  avatar: string | null;
  profilePicId?: string | null;
}

function toDisplayUsername(value?: string | null) {
  return String(value || '').replace(/^@+/, '').trim().toLowerCase() || null;
}

function isRenderableImageSrc(value?: string | null): value is string {
  if (!value) return false;
  return /^(https?:)?\/\//.test(value) || value.startsWith('data:') || value.startsWith('blob:');
}

function getActiveMentionToken(value: string, caret: number | null | undefined) {
  const cursor = typeof caret === 'number' ? caret : value.length;
  const before = value.slice(0, cursor);
  const match = before.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);
  if (!match) return null;

  const start = before.lastIndexOf('@');
  if (start < 0) return null;

  const prefix = before.slice(0, start);
  if (prefix.length > 0) {
    const prev = prefix[prefix.length - 1];
    if (!/[\s(]/.test(prev)) return null;
  }

  return {
    query: match[1] || '',
    start,
    end: cursor,
  };
}

function renderCommentText(text: string): ReactNode {
  const pieces: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    const [full, prefix, username] = match;
    const start = match.index;
    const end = start + full.length;

    if (start > lastIndex) {
      pieces.push(text.slice(lastIndex, start));
    }

    if (prefix) {
      pieces.push(prefix);
    }

    pieces.push(
      <Box
        component="span"
        key={`${start}-${username}`}
        sx={{
          color: MENTION_COLOR,
          fontWeight: 800,
          bgcolor: 'rgba(99, 102, 241, 0.08)',
          px: 0.4,
          py: 0.1,
          borderRadius: 0.8,
        }}
      >
        @{username}
      </Box>
    );

    lastIndex = end;
  }

  if (lastIndex < text.length) {
    pieces.push(text.slice(lastIndex));
  }

  return <Box component="span" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{pieces}</Box>;
}

function toMentionResult(user: any): MentionResult | null {
  const id = user?.$id || user?.id;
  if (!id) return null;

  const username = toDisplayUsername(user?.username || user?.prefs?.username || user?.displayName || user?.name);
  return {
    id,
    title: user?.displayName || user?.name || username || 'Profile',
    subtitle: user?.username ? `@${toDisplayUsername(user.username)}` : user?.email || null,
    username,
    avatar: user?.avatar || user?.profilePicId || user?.prefs?.profilePicId || null,
    profilePicId: user?.profilePicId || user?.prefs?.profilePicId || null,
  };
}

function MentionComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  submitLabel,
  disabled,
  minRows = 3,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  submitLabel: string;
  disabled?: boolean;
  minRows?: number;
  autoFocus?: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MentionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeRange, setActiveRange] = useState<{ start: number; end: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeSuggestions = useCallback(() => {
    setAnchorEl(null);
    setResults([]);
    setQuery('');
    setActiveRange(null);
    setLoading(false);
  }, []);

  const replaceActiveMention = useCallback(
    (item: MentionResult) => {
      if (!activeRange) return;
      const mention = `@${item.username || item.title.replace(/\s+/g, '').toLowerCase()}`;
      const nextValue = `${value.slice(0, activeRange.start)}${mention} ${value.slice(activeRange.end)}`;
      onChange(nextValue);
      closeSuggestions();

      requestAnimationFrame(() => {
        const caret = activeRange.start + mention.length + 1;
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(caret, caret);
      });
    },
    [activeRange, closeSuggestions, onChange, value],
  );

  useEffect(() => {
    if (!query.trim() || query.trim().length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }

    let alive = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const docs = await searchGlobalUsers(query.trim(), 6);
        if (!alive) return;
        const mapped = await Promise.all(
          docs.map(async (doc: any) => {
            const item = toMentionResult(doc);
            if (!item) return null;

            let avatar = item.avatar || null;
            if (avatar) {
              const cachedPreview = getCachedProfilePreview(avatar);
              if (cachedPreview !== undefined) {
                avatar = cachedPreview;
              } else {
                try {
                  avatar = await fetchProfilePreview(avatar, 40, 40);
                } catch {
                  avatar = null;
                }
              }
            }

            return {
              ...item,
              avatar,
            };
          }),
        );
        const filtered = mapped.filter((item): item is MentionResult => Boolean(item));
        setResults(filtered);
        upsertCommentIdentities(
          filtered.map((item) => ({
            $id: item.id,
            id: item.id,
            username: item.username,
            displayName: item.title,
            name: item.title,
            avatar: item.avatar,
            profilePicId: item.profilePicId,
          })),
        );
      } catch {
        if (alive) setResults([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 240);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const nextValue = event.target.value;
    onChange(nextValue);

    const caret = event.target.selectionStart ?? nextValue.length;
    const active = getActiveMentionToken(nextValue, caret);
    if (active) {
      setQuery(active.query);
      setActiveRange({ start: active.start, end: active.end });
      setAnchorEl(containerRef.current);
    } else {
      closeSuggestions();
    }
  };

  const handleBlur = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => closeSuggestions(), 120);
  };

  return (
    <Box ref={containerRef} sx={{ position: 'relative' }}>
      <TextField
        fullWidth
        multiline
        minRows={minRows}
        size="small"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={(event) => {
          const caret = event.currentTarget.selectionStart ?? value.length;
          const active = getActiveMentionToken(value, caret);
          if (active) {
            setQuery(active.query);
            setActiveRange({ start: active.start, end: active.end });
            setAnchorEl(containerRef.current);
          }
        }}
        autoFocus={autoFocus}
        inputRef={inputRef}
      />

      <Popover
        open={Boolean(anchorEl && (query || results.length))}
        anchorEl={anchorEl}
        onClose={closeSuggestions}
        disableAutoFocus
        disableEnforceFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            mt: 1,
            width: { xs: 'calc(100vw - 32px)', sm: 420 },
            maxWidth: 'calc(100vw - 32px)',
            bgcolor: 'rgba(16, 14, 12, 0.98)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
            borderRadius: 4,
            overflow: 'hidden',
          },
          onMouseDown: (event: ReactMouseEvent) => event.preventDefault(),
        }}
      >
        <Box sx={{ p: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', fontWeight: 800 }}>
            Mention profiles
          </Typography>
          {loading ? <CircularProgress size={12} sx={{ color: MENTION_COLOR }} /> : null}
        </Box>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)' }} />
        <List dense sx={{ p: 0 }}>
          {results.length === 0 && !loading ? (
            <Box sx={{ px: 1.5, py: 1.25 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.55)' }}>
                No matches yet.
              </Typography>
            </Box>
          ) : (
            results.map((item) => (
              <ListItemButton
                key={item.id}
                onClick={() => replaceActiveMention(item)}
                sx={{
                  py: 1,
                  px: 1.25,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                }}
              >
                <ListItemAvatar sx={{ minWidth: 42 }}>
                  <Avatar
                    src={item.avatar || undefined}
                    sx={{
                      width: 30,
                      height: 30,
                      bgcolor: alpha(MENTION_COLOR, 0.14),
                      color: MENTION_COLOR,
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {item.title.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff' }}>
                      {item.title}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.58)' }}>
                      {item.subtitle || `@${item.username || item.title.toLowerCase()}`}
                    </Typography>
                  }
                />
              </ListItemButton>
            ))
          )}
        </List>
      </Popover>

      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={onSubmit} disabled={disabled || !value.trim()}>
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
}

interface CommentItemProps {
  comment: CommentWithChildren;
  onReply: (parentId: string, content: string) => Promise<void>;
  onUpdate: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  depth?: number;
  userMap: Record<string, Users>;
  noteId: string;
}

function CommentItem({ comment, onReply, onUpdate, onDelete, depth = 0, userMap, noteId }: CommentItemProps) {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [editContent, setEditContent] = useState(comment.content);
  const [showChildren, setShowChildren] = useState(true);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [reactionAnchorEl, setReactionAnchorEl] = useState<null | HTMLElement>(null);
  const [isReactionsHover, setIsReactionsHover] = useState(false);
  const closeReactionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commentUser = userMap[comment.userId] || getCachedCommentIdentity(comment.userId) || undefined;
  const isOwner = user?.$id === comment.userId;
  const isDeleted = comment.content === '[Deleted]';
  const profilePicId = getUserProfilePicId(commentUser);
  const avatarSrc = isDeleted
    ? undefined
    : isRenderableImageSrc(commentUser?.avatar)
      ? commentUser.avatar
      : profilePicId
        ? (getCachedProfilePreview(profilePicId) || undefined)
        : undefined;

  // Efficient identity fallback using canonized helpers
  const displayName = isDeleted ? 'Deleted' : getEffectiveDisplayName(commentUser);
  const username = isDeleted ? null : getEffectiveUsername(commentUser);
  const profileLink = username ? `${getEcosystemUrl('connect')}/u/${username}` : '#';

  const handleReplySubmit = async () => {
    if (!replyContent.trim()) return;
    await onReply(comment.$id, replyContent);
    setReplyContent('');
    setIsReplying(false);
    setShowChildren(true);
  };

  const handleEditSubmit = async () => {
    if (!editContent.trim()) return;
    await onUpdate(comment.$id, editContent);
    setIsEditing(false);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const isReactionsOpen = Boolean(reactionAnchorEl);

  const openReactions = (event: React.MouseEvent<HTMLElement>) => {
    if (closeReactionsTimer.current) {
      clearTimeout(closeReactionsTimer.current);
      closeReactionsTimer.current = null;
    }
    setReactionAnchorEl(event.currentTarget);
  };

  const closeReactions = () => {
    setReactionAnchorEl(null);
  };

  const scheduleCloseReactions = () => {
    if (closeReactionsTimer.current) {
      clearTimeout(closeReactionsTimer.current);
    }
    closeReactionsTimer.current = setTimeout(() => {
      if (!isReactionsHover) closeReactions();
    }, 140);
  };

  return (
    <Box sx={{
      ml: depth * 3,
      mt: 1,
      borderLeft: depth > 0 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
      pl: depth > 0 ? 2 : 0,
    }}>
      <ListItem
        alignItems="flex-start"
        sx={{
          borderRadius: 2,
          ...(isDeleted && {
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s ease',
            py: 0.5,
            my: 1
          })
        }}
        secondaryAction={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {!isDeleted && (
              <IconButton size="small" onClick={() => setIsReplying(!isReplying)}>
                <ReplyIcon fontSize="small" />
              </IconButton>
            )}

            {isOwner && !isDeleted && (
              <>
                <IconButton size="small" onClick={handleMenuOpen}>
                  <MoreIcon fontSize="small" />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={() => { setIsEditing(true); handleMenuClose(); }}>
                    <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                    Edit
                  </MenuItem>
                  <MenuItem onClick={() => { onDelete(comment.$id); handleMenuClose(); }} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                    Delete
                  </MenuItem>
                </Menu>
              </>
            )}

            {comment.children.length > 0 && (
              <IconButton size="small" onClick={() => setShowChildren(!showChildren)}>
                {showChildren ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
              </IconButton>
            )}
          </Box>
        }
      >
        <Avatar
          src={avatarSrc}
          sx={{
            width: 32,
            height: 32,
            mr: 2,
            mt: 0.5,
            bgcolor: isDeleted ? 'grey.500' : 'primary.main',
            fontSize: 14,
            opacity: isDeleted ? 0.6 : 1
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </Avatar>
        <ListItemText
          primaryTypographyProps={{ component: 'div' }}
          secondaryTypographyProps={{ component: 'div' }}
          primary={
            isEditing ? (
              <Box sx={{ mt: 1 }}>
                <TextField
                  fullWidth
                  multiline
                  size="small"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  autoFocus
                />
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Button size="small" variant="contained" onClick={handleEditSubmit}>Save</Button>
                  <Button size="small" onClick={() => setIsEditing(false)}>Cancel</Button>
                </Box>
              </Box>
            ) : isDeleted ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <BlockIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography variant="body2" sx={{
                  color: 'text.disabled',
                  fontStyle: 'italic',
                  fontSize: '0.85rem',
                  letterSpacing: '0.01em'
                }}>
                  This comment was deleted by the author but replies remain.
                </Typography>
              </Box>
            ) : (
              renderCommentText(comment.content)
            )
          }
          secondary={
            <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                by <Link
                  href={profileLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    fontWeight: 600,
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  {username ? `@${username}` : displayName}
                </Link> • {new Date(comment.$createdAt).toLocaleString()}
              </Typography>
              {!isDeleted && (
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Tooltip title="Reactions">
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        if (isReactionsOpen) {
                          closeReactions();
                        } else {
                          openReactions(event);
                        }
                      }}
                      onMouseEnter={openReactions}
                      onMouseLeave={scheduleCloseReactions}
                    >
                      <EmojiEmotionsOutlined fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Popover
                    open={isReactionsOpen}
                    anchorEl={reactionAnchorEl}
                    onClose={closeReactions}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{
                      sx: {
                        p: 1,
                        bgcolor: 'rgba(10, 10, 10, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
                        backdropFilter: 'blur(12px)'
                      },
                      onMouseEnter: () => setIsReactionsHover(true),
                      onMouseLeave: () => {
                        setIsReactionsHover(false);
                        closeReactions();
                      }
                    }}
                  >
                    <NoteReactions targetId={comment.$id} targetType={TargetType.COMMENT} size="small" noteId={noteId} />
                  </Popover>
                </Box>
              )}
            </Box>
          }
        />
      </ListItem>

      {isReplying && (
        <Box sx={{ ml: 7, mr: 2, mb: 2 }}>
          <MentionComposer
            value={replyContent}
            onChange={setReplyContent}
            onSubmit={handleReplySubmit}
            placeholder={`Reply to ${displayName}...`}
            submitLabel="Reply"
            minRows={2}
            autoFocus
          />
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Button size="small" onClick={() => setIsReplying(false)}>Cancel</Button>
          </Box>
        </Box>
      )}

      <Collapse in={showChildren}>
        <Box>
          {comment.children.map((child) => (
            <CommentItem
              key={child.$id}
              comment={child}
              onReply={onReply}
              onUpdate={onUpdate}
              onDelete={onDelete}
              depth={depth + 1}
              userMap={userMap}
              noteId={noteId}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

export default function CommentsSection({ noteId }: CommentsProps) {
  const { user } = useAuth();
  const { fetchOptimized } = useDataNexus();
  const [comments, setComments] = useState<Comments[]>([]);
  const [newComment, setNewComment] = useState('');
  const [userMap, setUserMap] = useState<Record<string, Users>>({});
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const normalizeUsersForComments = useCallback(async (users: Users[]) => {
    const normalized = await Promise.all(
      users.map(async (u) => {
        const userId = u.$id || u.id;
        if (!userId) return null;

        const profilePicId = getUserProfilePicId(u);
        let avatar = u.avatar || null;

        if (profilePicId) {
          const cachedPreview = getCachedProfilePreview(profilePicId);
          if (cachedPreview !== undefined) {
            avatar = cachedPreview;
          } else {
            try {
              avatar = await fetchProfilePreview(profilePicId, 64, 64);
            } catch {
              avatar = null;
            }
          }
        }

        return {
          ...u,
          $id: userId,
          id: u.id || userId,
          profilePicId,
          avatar,
        } as Users;
      })
    );

    return normalized.filter((item): item is Users => Boolean(item && item.$id));
  }, []);

  const normalizeAndStoreUsers = useCallback(async (users: Users[]) => {
    const normalized = await normalizeUsersForComments(users);
    if (!normalized.length) return;

    const map: Record<string, Users> = {};
    normalized.forEach((u) => {
      if (u.$id) map[u.$id] = u;
    });

    if (Object.keys(map).length > 0) {
      setUserMap((prev) => ({ ...prev, ...map }));
      upsertCommentIdentities(normalized);
    }
  }, [normalizeUsersForComments]);

  const fetchComments = useCallback(async () => {
    setCommentsError(null);
    try {
      const docs = await fetchOptimized<Comments[]>(
        `note_comments_${noteId}`,
        async () => {
          try {
            const res = await listComments(noteId);
            return res.documents as unknown as Comments[];
          } catch (sdkError) {
            console.warn('Comments fetch: SDK path failed, trying shared API fallback');
            const res = await fetch(`/api/shared/${noteId}/comments`);
            if (!res.ok) throw sdkError;
            const payload = await res.json();
            return (payload?.documents || []) as Comments[];
          }
        },
        1000 * 60 * 10
      );

      // Sort by date ascending
      const sorted = [...docs].sort(
        (a, b) => new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime()
      );
      setComments(sorted);

      // Fetch user profiles for all unique userIds
      const uniqueUserIds = Array.from(new Set(docs.map(c => c.userId)));
      if (uniqueUserIds.length > 0) {
        const cachedUsers = getCachedCommentIdentities(uniqueUserIds);
        const cachedUserList = Object.values(cachedUsers);
        if (cachedUserList.length > 0) {
          await normalizeAndStoreUsers(cachedUserList);
        }

        let users: Users[] = [];
        try {
          users = await getUsersByIds(uniqueUserIds);
        } catch (_sdkError) {
          console.warn('Comments fetch: SDK profile resolution failed, trying shared API fallback');
          const profilesRes = await fetch('/api/shared/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIds: uniqueUserIds }),
          });
          if (profilesRes.ok) {
            const profilesPayload = await profilesRes.json();
            users = profilesPayload.documents || [];
          }
        }

        await normalizeAndStoreUsers(users);
      }
    } catch (error: any) {
      console.error('Failed to fetch comments:', error);
      setCommentsError('Comments are unavailable right now.');
    }
  }, [noteId, normalizeAndStoreUsers, fetchOptimized]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async (parentId: string | null = null, content: string = newComment) => {
    const text = parentId ? content : newComment;
    if (!text.trim()) return;

    try {
      const comment = await createComment(noteId, text, parentId);
      const newCommentDoc = comment as unknown as Comments;
      setComments(prev => [...prev, newCommentDoc]);

      // If the user who commented isn't in userMap, we might want to refresh or add them
      // For now, we refresh to be safe or just wait for the user to be there
      if (user?.$id) {
        upsertCommentIdentity(user as Users);
        setUserMap((prev) => ({
          ...prev,
          [user.$id]: {
            ...(prev[user.$id] || {}),
            ...(user as Users),
          },
        }));
      }
      if (!userMap[newCommentDoc.userId]) {
        fetchComments();
      }

      if (!parentId) setNewComment('');
    } catch (error: any) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    try {
      await updateComment(commentId, { content });
      setComments(prev =>
        prev.map(c => c.$id === commentId ? { ...c, content } as Comments : c)
      );
    } catch (error: any) {
      console.error('Failed to update comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const hasChildren = comments.some(c => c.parentCommentId === commentId);

      if (hasChildren) {
        // Soft delete: preservation of tree structure for Reddit-like behavior
        // We redact the content to [Deleted] instead of hard-deleting the document
        await updateComment(commentId, { content: '[Deleted]' });
        await deleteReactionsForTarget(TargetType.COMMENT, commentId);
        setComments(prev =>
          prev.map(c => c.$id === commentId ? { ...c, content: '[Deleted]' } as Comments : c)
        );
      } else {
        // Hard delete: No children, safe to remove completely
        await deleteReactionsForTarget(TargetType.COMMENT, commentId);
        await deleteComment(commentId);
        setComments(prev => prev.filter(c => c.$id !== commentId));
      }
    } catch (error: any) {
      console.error('Failed to delete comment:', error);
    }
  };

  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Comments ({comments.length})</Typography>
      <Box sx={{ mb: 3 }}>
        <MentionComposer
          value={newComment}
          onChange={setNewComment}
          onSubmit={() => handleAddComment(null)}
          placeholder="Share your thoughts..."
          submitLabel="Post Comment"
          minRows={3}
        />
      </Box>
      <Divider />
      {commentsError && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {commentsError}
        </Typography>
      )}
      <List>
        {commentTree.map((comment) => (
          <div key={comment.$id}>
            <CommentItem
              comment={comment}
              onReply={(parentId, content) => handleAddComment(parentId, content)}
              onUpdate={handleUpdateComment}
              onDelete={handleDeleteComment}
              userMap={userMap}
              noteId={noteId}
            />
            <Divider variant="fullWidth" sx={{ my: 1 }} />
          </div>
        ))}
      </List>
    </Box>
  );
}
