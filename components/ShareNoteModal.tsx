'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Avatar,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Select,
  MenuItem,
  FormControl,
  CircularProgress,
  Alert,
  alpha,
  Paper,
  Tooltip
} from '@mui/material';
import {
  Close as CloseIcon,
  Search as SearchIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { 
  account, 
  shareNoteWithUser, 
  shareNoteWithUserId,
  getSharedUsers,
  removeNoteSharing,
  toggleNoteVisibility,
  setAnyoneCanEdit,
  isNoteEditableByAnyone,
  getShareableUrl,
  getNote,
  getCurrentPublicNoteShareUrl
} from '@/lib/appwrite';
import { useSudo } from '@/context/SudoContext';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profilePreview';

interface ShareNoteModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: string;
  noteTitle: string;
}

interface SharedUser {
  id: string;
  name?: string;
  email: string;
  permission: 'read' | 'write' | 'admin';
  collaborationId?: string;
  profilePicId?: string | null;
}

interface FoundUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  profilePicId?: string | null;
  username?: string;
}

export function ShareNoteModal({ isOpen, onOpenChange, noteId, noteTitle }: ShareNoteModalProps) {
  const [query, setQuery] = useState('');
  const [permission, setPermission] = useState<'read' | 'write' | 'admin'>('read');
  const [isLoading, setIsLoading] = useState(false);
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [results, setResults] = useState<FoundUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [updatingCollab, setUpdatingCollab] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [allowAnyoneEdit, setAllowAnyoneEditState] = useState(false);
  const [isUpdatingAnyoneEdit, setIsUpdatingAnyoneEdit] = useState(false);
  const [decryptionKey, setDecryptionKey] = useState<string | null>(null);
  const [publicShareUrl, setPublicShareUrl] = useState<string | null>(null);
  const { promptSudo } = useSudo();
  const resolvedPublicLink = publicShareUrl || (decryptionKey && decryptionKey !== '********' ? getShareableUrl(noteId, decryptionKey) : null);

  useEffect(() => {
    if (isOpen && noteId) {
        getNote(noteId).then(note => {
          if (note) {
            setIsPublic(!!note.isPublic);
            setAllowAnyoneEditState(isNoteEditableByAnyone(note));
            try {
              const meta = JSON.parse(note.metadata || '{}');
              if (meta.isEncrypted) setDecryptionKey('********'); // Signal it's encrypted
            } catch(_e) {}
          if (note.isPublic) {
            getCurrentPublicNoteShareUrl(noteId).then(setPublicShareUrl).catch(() => setPublicShareUrl(null));
          } else {
            setPublicShareUrl(null);
          }
        }
      });
    }
  }, [isOpen, noteId]);

  // Preview maps (userId -> preview URL|null)
  const [resultPreviews, setResultPreviews] = useState<Record<string, string | null>>({});
  const [sharedPreviews, setSharedPreviews] = useState<Record<string, string | null>>({});

  const emailRegex = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/, []);
  const validEmail = useMemo(() => emailRegex.test(query.trim()), [query, emailRegex]);

  const fetchAndCachePreview = useCallback(async (fileId?: string | null) => {
    if (!fileId) return null;
    const cached = getCachedProfilePreview(fileId);
    if (cached !== undefined) return cached;
    try {
      const url = await fetchProfilePreview(fileId, 64, 64);
      return url;
    } catch (_err: any) {
      return null;
    }
  }, []);

  const loadSharedUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const users = await getSharedUsers(noteId);
      setSharedUsers(users as SharedUser[]);

      for (const u of users as SharedUser[]) {
        const fileId = u?.profilePicId ?? null;
        if (!fileId) continue;
        try {
          const url = await fetchAndCachePreview(fileId);
          setSharedPreviews(prev => (prev[u.id] === url ? prev : { ...prev, [u.id]: url }));
        } catch {
          // ignore preview errors
        }
      }
    } catch (err: any) {
      console.error('Failed to load shared users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [noteId, fetchAndCachePreview]);

  useEffect(() => {
    if (isOpen) {
      loadSharedUsers();
      (async () => {
        try {
          const u: any = await account.get();
          setCurrentUserId(u?.$id ?? null);
        } catch {
          setCurrentUserId(null);
        }
      })();
    } else {
      setResults([]);
      setSelectedUser(null);
      setQuery('');
      setErrorMsg(null);
      setSuccessMsg(null);
      setPublicShareUrl(null);
      setAllowAnyoneEditState(false);
      setIsUpdatingAnyoneEdit(false);
    }
  }, [isOpen, loadSharedUsers]);

  const debouncedSearch = useCallback(async () => {
    if (!query.trim() || query.length < 2 || selectedUser) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { searchGlobalUsers } = await import('@/lib/ecosystem/identity');
      const docs = await searchGlobalUsers(query);

      const filtered = docs
        .filter(u => {
          if (currentUserId && u.id === currentUserId) return false;
          if (sharedUsers.some(s => s.id === u.id)) return false;
          return true;
        })
        .map(u => ({
          id: u.id,
          name: u.title,
          email: u.subtitle.startsWith('@') ? undefined : u.subtitle,
          username: u.subtitle.replace(/^@/, ''),
          avatar: u.avatar,
          profilePicId: u.profilePicId
        }));

      setResults(filtered as FoundUser[]);
    } catch (err: any) {
      console.error('Global search failed in share modal:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, selectedUser, currentUserId, sharedUsers]);

  useEffect(() => {
    const t = setTimeout(() => {
      debouncedSearch();
    }, 300);
    return () => clearTimeout(t);
  }, [query, debouncedSearch]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      for (const user of results) {
        const fileId = user.profilePicId || user.avatar || null;
        if (!fileId) continue;
        if (resultPreviews[user.id] !== undefined) continue;
        try {
          const url = await fetchAndCachePreview(fileId);
          if (!mounted) return;
          setResultPreviews(prev => ({ ...prev, [user.id]: url }));
        } catch {
          // ignore
        }
      }
    };
    if (results.length) load();
    return () => { mounted = false; };
  }, [results, fetchAndCachePreview, resultPreviews]);

  const resetMessages = () => {
    setErrorMsg(null); setSuccessMsg(null);
  };

  const handleShare = async () => {
    resetMessages();
    if (!selectedUser && !validEmail) {
      setErrorMsg('Select a user or enter a valid email');
      return;
    }

    if (selectedUser && sharedUsers.some(u => u.id === selectedUser.id)) {
      setErrorMsg('Already shared with this user');
      return;
    }
    if (!selectedUser && validEmail && sharedUsers.some(u => u.email.toLowerCase() === query.trim().toLowerCase())) {
      setErrorMsg('Already shared with this email');
      return;
    }

    let optimistic: SharedUser | null = null;
    try {
      setIsLoading(true);
      if (selectedUser) {
        optimistic = {
          id: selectedUser.id,
          name: selectedUser.name,
          email: selectedUser.email || selectedUser.name,
          permission,
          collaborationId: 'pending'
        } as SharedUser;
      } else if (validEmail) {
        optimistic = {
          id: 'pending-' + Date.now(),
          email: query.trim(),
          permission,
          collaborationId: 'pending'
        } as SharedUser;
      }

      if (optimistic) {
        setSharedUsers(prev => [...prev, optimistic!]);
      }

      let response;
      if (selectedUser) {
        response = await shareNoteWithUserId(noteId, selectedUser.id, permission, selectedUser.email || undefined);
      } else {
        response = await shareNoteWithUser(noteId, query.trim(), permission);
      }

      setSuccessMsg(response.message || 'Shared successfully');
      setQuery('');
      setSelectedUser(null);
      setResults([]);
      await loadSharedUsers();
    } catch (err: any) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : String(err);
      setErrorMsg(msg || 'Failed to share note');
      if (optimistic) {
        setSharedUsers(prev => prev.filter(u => u !== optimistic));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePermission = async (collab: SharedUser, newPerm: 'read' | 'write' | 'admin') => {
    if (collab.permission === newPerm) return;
    const prevPerm = collab.permission;
    setUpdatingCollab(collab.collaborationId || collab.id);
    setSharedUsers(prev => prev.map(u => u.id === collab.id ? { ...u, permission: newPerm } : u));
    try {
      // Calling shareNoteWithUserId will upsert the permissions on the Note document
      await shareNoteWithUserId(noteId, collab.id, newPerm);
      setSuccessMsg('Permission updated');
    } catch (err: any) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : String(err);
      setErrorMsg(msg || 'Failed updating permission');
      setSharedUsers(prev => prev.map(u => u.id === collab.id ? { ...u, permission: prevPerm } : u));
    } finally {
      setUpdatingCollab(null);
    }
  };

  const handleToggleAnyoneEdit = async () => {
    resetMessages();
    try {
      setIsUpdatingAnyoneEdit(true);
      const next = !allowAnyoneEdit;
      await setAnyoneCanEdit(noteId, next);
      setAllowAnyoneEditState(next);
      setSuccessMsg(next ? 'Anyone can now edit this note' : 'Anyone edit disabled');
    } catch (err: any) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : String(err);
      setErrorMsg(msg || 'Failed to update edit access');
    } finally {
      setIsUpdatingAnyoneEdit(false);
    }
  };

  const handleRemoveSharing = async (sharedUserId: string, userEmail: string) => {
    resetMessages();
    const previous = sharedUsers;
    setSharedUsers(prev => prev.filter(u => u.id !== sharedUserId));
    try {
      await removeNoteSharing(noteId, sharedUserId);
      setSuccessMsg(`Removed sharing with ${userEmail}`);
    } catch (_err: any) {
      console.error('Failed to remove sharing:', _err);
      setSharedUsers(previous);
      const msg = _err && typeof _err === 'object' && 'message' in _err ? String((_err as any).message) : String(_err);
      setErrorMsg(msg || 'Failed to remove sharing');
    }
  };

  const shareDisabled = isLoading || (!selectedUser && !validEmail);

  return (
    <Dialog
      open={isOpen}
      onClose={() => onOpenChange(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#161412',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.4)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.02)',
          borderRight: '1px solid rgba(255, 255, 255, 0.02)',
          borderRadius: '24px',
          backgroundImage: 'none',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)'
        }
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: 'white', letterSpacing: '-0.02em', fontFamily: 'var(--font-clash)' }}>
            Share Note
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-satoshi)' }}>
            {noteTitle}
          </Typography>
        </Box>
        <IconButton onClick={() => onOpenChange(false)} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#EC4899', bgcolor: alpha('#EC4899', 0.1) } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {(errorMsg || successMsg) && (
          <Alert
            severity={errorMsg ? 'error' : 'success'}
            sx={{
              mb: 3,
              borderRadius: '12px',
              bgcolor: errorMsg ? alpha('#FF4D4D', 0.1) : alpha('#EC4899', 0.1),
              color: errorMsg ? '#FF4D4D' : '#EC4899',
              border: '1px solid',
              borderColor: errorMsg ? alpha('#FF4D4D', 0.2) : alpha('#EC4899', 0.2),
              '& .MuiAlert-icon': { color: 'inherit' },
              fontFamily: 'var(--font-satoshi)'
            }}
          >
            {errorMsg || successMsg}
          </Alert>
        )}

        <Box sx={{ mb: 4 }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5, fontFamily: 'var(--font-clash)' }}>
            Invite Collaborators
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <TextField
                fullWidth
                placeholder="Name or email address"
                value={query}
                onChange={ (e) => { setQuery(e.target.value); setSelectedUser(null); resetMessages(); }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <Box sx={{ mr: 1, color: 'rgba(255, 255, 255, 0.3)', display: 'flex' }}>
                        <SearchIcon fontSize="small" />
                      </Box>
                    ),
                    endAdornment: isSearching ? (
                      <CircularProgress size={16} sx={{ color: '#EC4899' }} />
                    ) : null
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '12px',
                    bgcolor: '#0A0908',
                    fontFamily: 'var(--font-satoshi)',
                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                    '&.Mui-focused fieldset': { borderColor: '#EC4899' }
                  },
                  '& .MuiInputBase-input': { color: 'white' }
                }}
              />

              {query && results.length > 0 && !selectedUser && (
                <Paper
                  elevation={0}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    mt: 1,
                    bgcolor: '#1C1A18',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    maxHeight: 200,
                    overflow: 'auto',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.4)'
                  }}
                >
                  <List disablePadding>
                    {results.map(user => (
                      <ListItem
                        key={user.id}
                        component="button"
                        onClick={() => { setSelectedUser(user); setQuery(user.name || user.email || ''); resetMessages(); }}
                        sx={{
                          width: '100%',
                          textAlign: 'left',
                          border: 'none',
                          bgcolor: 'transparent',
                          '&:hover': { bgcolor: alpha('#EC4899', 0.05) },
                          p: 1.5
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar
                            src={resultPreviews[user.id] || undefined}
                            sx={{ width: 32, height: 32, bgcolor: '#EC4899', color: '#000', fontWeight: 800, fontSize: '0.75rem', fontFamily: 'var(--font-jetbrains)' }}
                          >
                            {(user.name || user.email || '?').charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={user.name}
                          primaryTypographyProps={{ variant: 'body2', fontWeight: 700, color: 'white', fontFamily: 'var(--font-satoshi)' }}
                          secondary={user.username ? `@${user.username}` : user.email}
                          secondaryTypographyProps={{ variant: 'caption', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-jetbrains)' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}

              {query.trim().length >= 2 && results.length === 0 && !isSearching && !selectedUser && (
                <Paper
                  elevation={0}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    mt: 1,
                    bgcolor: '#1C1A18',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    p: 2,
                    textAlign: 'center',
                    boxShadow: '0 12px 24px rgba(0,0,0,0.4)'
                  }}
                >
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)' }}>
                    No users found matching &quot;@{query}&quot;
                  </Typography>
                </Paper>
              )}
            </Box>

            <FormControl sx={{ minWidth: 140 }}>
              <Select
                value={permission}
                onChange={ (e) => setPermission(e.target.value as 'read' | 'write' | 'admin')}
                sx={{
                  borderRadius: '12px',
                  bgcolor: '#0A0908',
                  color: 'white',
                  fontFamily: 'var(--font-satoshi)',
                  fontWeight: 700,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.05)' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#EC4899' }
                }}
              >
                <MenuItem value="read" sx={{ fontFamily: 'var(--font-satoshi)' }}>Read Only</MenuItem>
                <MenuItem value="write" sx={{ fontFamily: 'var(--font-satoshi)' }}>Read & Write</MenuItem>
                <MenuItem value="admin" sx={{ fontFamily: 'var(--font-satoshi)' }}>Admin</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              onClick={handleShare}
              disabled={shareDisabled}
              sx={{
                borderRadius: '12px',
                bgcolor: '#EC4899',
                color: '#000',
                fontWeight: 900,
                fontFamily: 'var(--font-clash)',
                px: 3,
                '&:hover': { bgcolor: '#F472B6' },
                '&.Mui-disabled': { bgcolor: '#1C1A18', color: 'rgba(255, 255, 255, 0.2)' }
              }}
            >
              {isLoading ? <CircularProgress size={20} color="inherit" /> : 'Invite'}
            </Button>
          </Box>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: '16px',
              bgcolor: '#0A0908',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 800, fontFamily: 'var(--font-satoshi)' }}>
                  Allow anyone edit
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'var(--font-satoshi)' }}>
                  Grants update access to anyone who can open the note.
                </Typography>
              </Box>
              <Button
                variant={allowAnyoneEdit ? 'contained' : 'outlined'}
                onClick={() => void handleToggleAnyoneEdit()}
                disabled={isUpdatingAnyoneEdit}
                sx={{
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 900,
                  fontFamily: 'var(--font-clash)',
                  bgcolor: allowAnyoneEdit ? '#10B981' : 'transparent',
                  color: allowAnyoneEdit ? '#000' : 'white',
                  borderColor: allowAnyoneEdit ? '#10B981' : 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    bgcolor: allowAnyoneEdit ? '#34D399' : 'rgba(255, 255, 255, 0.05)',
                    borderColor: allowAnyoneEdit ? '#34D399' : 'rgba(255, 255, 255, 0.2)',
                  }
                }}
              >
                {isUpdatingAnyoneEdit ? <CircularProgress size={16} color="inherit" /> : (allowAnyoneEdit ? 'Enabled' : 'Disabled')}
              </Button>
            </Box>
          </Paper>
        </Box>

        <Box>
          <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 2, fontFamily: 'var(--font-clash)' }}>
            Collaborators
          </Typography>

          {isLoadingUsers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} sx={{ color: '#EC4899' }} />
            </Box>
          ) : sharedUsers.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center', bgcolor: '#0A0908', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.05)' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>
                No collaborators yet
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {sharedUsers.map((user) => (
                <ListItem
                  key={user.id + (user.collaborationId || '')}
                  sx={{
                    bgcolor: '#1C1A18',
                    borderRadius: '16px',
                    mb: 1.5,
                    borderTop: '1px solid rgba(255, 255, 255, 0.03)',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.2)',
                    p: 1.5
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={sharedPreviews[user.id] || undefined}
                      sx={{ width: 40, height: 40, bgcolor: alpha('#EC4899', 0.1), color: '#EC4899', fontWeight: 800, fontFamily: 'var(--font-jetbrains)' }}
                    >
                      {user.name ? user.name.charAt(0).toUpperCase() : user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name || user.email}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}
                    secondary={user.name ? user.email : null}
                    secondaryTypographyProps={{ variant: 'caption', color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-jetbrains)' }}
                  />
                  <ListItemSecondaryAction sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Select
                      size="small"
                      value={user.permission}
                      onChange={ (e) => handleUpdatePermission(user, e.target.value as 'read' | 'write' | 'admin')}
                      disabled={updatingCollab === user.collaborationId || user.collaborationId === 'pending'}
                      sx={{
                        height: 32,
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        fontFamily: 'var(--font-clash)',
                        color: '#EC4899',
                        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        bgcolor: alpha('#EC4899', 0.05),
                        borderRadius: '8px',
                        '&:hover': { bgcolor: alpha('#EC4899', 0.1) }
                      }}
                    >
                      <MenuItem value="read" sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.75rem' }}>Read</MenuItem>
                      <MenuItem value="write" sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.75rem' }}>Write</MenuItem>
                      <MenuItem value="admin" sx={{ fontFamily: 'var(--font-satoshi)', fontSize: '0.75rem' }}>Admin</MenuItem>
                    </Select>

                    {updatingCollab === user.collaborationId ? (
                      <CircularProgress size={16} sx={{ color: '#EC4899' }} />
                    ) : (
                      <Tooltip title="Remove access">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveSharing(user.id, user.email)}
                          disabled={user.collaborationId === 'pending'}
                          sx={{ color: 'rgba(255, 255, 255, 0.3)', '&:hover': { color: '#FF4D4D', bgcolor: alpha('#FF4D4D', 0.1) } }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-clash)' }}>
                Public Access
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)' }}>
                Anyone with the link can view {decryptionKey ? 'the encrypted' : 'this'} note.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={async () => {
                const handleToggle = async () => {
                  try {
                    resetMessages();
                    const updated = await toggleNoteVisibility(noteId);
                    if (updated) {
                      setIsPublic(!!updated.isPublic);
                      setDecryptionKey(updated.decryptionKey || null);
                      setPublicShareUrl(updated.isPublic && updated.decryptionKey ? getShareableUrl(noteId, updated.decryptionKey) : null);
                      setSuccessMsg(updated.isPublic ? 'Note is now Public' : 'Note is now Private');
                    }
                  } catch (err: any) {
                    if (err.message === 'VAULT_LOCKED') {
                      setErrorMsg('Vault Locked: Sudo required to update note visibility.');
                      const unlocked = await promptSudo();
                      if (unlocked) handleToggle();
                    } else {
                      setErrorMsg(err.message || 'Failed to toggle visibility');
                    }
                  }
                };
                handleToggle();
              }}
              sx={{
                borderRadius: '8px',
                borderColor: isPublic ? '#EC4899' : 'rgba(255, 255, 255, 0.1)',
                color: isPublic ? '#EC4899' : 'rgba(255, 255, 255, 0.6)',
                fontWeight: 800,
                fontSize: '0.75rem',
                '&:hover': { borderColor: '#EC4899', bgcolor: alpha('#EC4899', 0.05) }
              }}
            >
              {isPublic ? 'PUBLIC' : 'PRIVATE'}
            </Button>
          </Box>

          {isPublic && (
            <Box sx={{ p: 1.5, bgcolor: '#0A0908', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Typography variant="caption" sx={{ flex: 1, color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-jetbrains)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {resolvedPublicLink || 'Unlock vault to reveal the current public link.'}
              </Typography>
              <Button
                size="small"
                disabled={!resolvedPublicLink}
                onClick={() => {
                  if (!resolvedPublicLink) return;
                  navigator.clipboard.writeText(resolvedPublicLink);
                  setSuccessMsg('Public link copied!');
                }}
                sx={{ 
                  minWidth: 'auto', 
                  color: '#EC4899', 
                  fontWeight: 900, 
                  fontSize: '0.7rem',
                  '&:hover': { bgcolor: alpha('#EC4899', 0.1) }
                }}
              >
                COPY LINK
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button
          onClick={() => onOpenChange(false)}
          sx={{
            color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: 800,
            fontFamily: 'var(--font-satoshi)',
            '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
