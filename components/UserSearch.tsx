'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  Paper,
  alpha,
  IconButton,
  Chip
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { UsersService } from '@/lib/services/users';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar, computeIdentityFlags } from './common/IdentityBadge';

interface User {
  id: string;
  title: string;
  subtitle: string;
  avatar?: string | null;
  profilePicId?: string | null;
}

interface UserSearchProps {
  label?: string;
  placeholder?: string;
  selectedUsers: User[];
  onSelect: (user: User) => void;
  onRemove: (userId: string) => void;
  excludeIds?: string[];
  multiple?: boolean;
}

export default function UserSearch({
  label = 'ASSIGN TO',
  placeholder = 'Search by name or @username',
  selectedUsers,
  onSelect,
  onRemove,
  excludeIds = [],
  multiple: _multiple = true
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});

  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const users = await UsersService.searchUsers(searchQuery);
      const filtered = users.filter(u => 
        !selectedUsers.some(s => s.id === u.id) && 
        !excludeIds.includes(u.id)
      );
      setResults(filtered as User[]);
    } catch (err) {
      console.error('User search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedUsers, excludeIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, debouncedSearch]);

  useEffect(() => {
    let mounted = true;
    const loadPreviews = async () => {
      for (const user of results) {
        const fileId = user.profilePicId || user.avatar || null;
        if (!fileId || previews[user.id] !== undefined) continue;
        
        const url = await fetchProfilePreview(fileId);
        if (mounted) {
          setPreviews(prev => ({ ...prev, [user.id]: url }));
        }
      }
    };
    if (results.length > 0) loadPreviews();
    return () => { mounted = false; };
  }, [results, previews]);

  const handleSelect = (user: User) => {
    onSelect(user);
    setQuery('');
    setResults([]);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {label && (
        <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', color: 'text.secondary' }}>
          {label}
        </Typography>
      )}

      {/* Selected Users Chips */}
      {selectedUsers.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          {selectedUsers.map((user) => (
            <Chip
              key={user.id}
              avatar={
                <IdentityAvatar 
                  src={previews[user.id] || undefined}
                  alt={user.title}
                  fallback={user.title.charAt(0).toUpperCase()}
                  verified={computeIdentityFlags({
                    createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                    lastUsernameEdit: (user as any).last_username_edit || null,
                    profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                    username: (user as any).username || null,
                    bio: (user as any).bio || null,
                    tier: (user as any).tier || null,
                    publicKey: (user as any).publicKey || null,
                  }).verified}
                  pro={computeIdentityFlags({
                    createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                    lastUsernameEdit: (user as any).last_username_edit || null,
                    profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                    username: (user as any).username || null,
                    bio: (user as any).bio || null,
                    tier: (user as any).tier || null,
                    publicKey: (user as any).publicKey || null,
                  }).pro}
                  size={24}
                />
              }
              label={user.title}
              onDelete={() => onRemove(user.id)}
              deleteIcon={<CloseIcon sx={{ fontSize: '14px !important' }} />}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#F2F2F2',
                fontWeight: 600,
                fontSize: '0.8rem',
                borderRadius: '8px',
                '& .MuiChip-deleteIcon': {
                  color: 'rgba(255, 255, 255, 0.3)',
                  '&:hover': { color: '#FF4D4D' }
                }
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ position: 'relative' }}>
        <TextField
          fullWidth
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          variant="standard"
          autoComplete="off"
          InputProps={{
            disableUnderline: true,
            startAdornment: (
              <Box sx={{ mr: 1, color: 'rgba(255, 255, 255, 0.2)', display: 'flex' }}>
                <SearchIcon fontSize="small" />
              </Box>
            ),
            endAdornment: isSearching ? (
              <CircularProgress size={16} sx={{ color: '#6366F1' }} />
            ) : query ? (
              <IconButton size="small" onClick={() => setQuery('')} sx={{ color: 'rgba(255, 255, 255, 0.2)' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : null,
            sx: {
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              px: 2,
              py: 1,
              fontSize: '0.9rem',
              color: '#F2F2F2',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
              },
              '&.Mui-focused': {
                bgcolor: 'rgba(255, 255, 255, 0.05)',
                borderColor: alpha('#6366F1', 0.5),
                boxShadow: `0 0 0 2px ${alpha('#6366F1', 0.1)}`,
              }
            }
          }}
        />

        {query.length >= 2 && results.length > 0 && (
          <Paper
            elevation={0}
            sx={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              zIndex: 100,
              bgcolor: 'rgba(10, 10, 10, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              maxHeight: 280,
              overflow: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
            }}
          >
            <List disablePadding>
              {results.map((user) => (
                <ListItem
                  key={user.id}
                  component="button"
                  onClick={() => handleSelect(user)}
                  sx={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    bgcolor: 'transparent',
                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}
                >
                  <ListItemAvatar sx={{ minWidth: 0 }}>
                    <IdentityAvatar
                      src={previews[user.id] || undefined}
                      alt={user.title}
                      fallback={user.title.charAt(0).toUpperCase()}
                      verified={computeIdentityFlags({
                        createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                        lastUsernameEdit: (user as any).last_username_edit || null,
                        profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                        username: (user as any).username || null,
                        bio: (user as any).bio || null,
                        tier: (user as any).tier || null,
                        publicKey: (user as any).publicKey || null,
                      }).verified}
                      pro={computeIdentityFlags({
                        createdAt: (user as any).$createdAt || (user as any).createdAt || null,
                        lastUsernameEdit: (user as any).last_username_edit || null,
                        profilePicId: (user as any).profilePicId || (user as any).avatar || null,
                        username: (user as any).username || null,
                        bio: (user as any).bio || null,
                        tier: (user as any).tier || null,
                        publicKey: (user as any).publicKey || null,
                      }).pro}
                      size={36}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.title}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 700, color: '#F2F2F2' }}
                    secondary={user.subtitle}
                    secondaryTypographyProps={{ variant: 'caption', color: 'rgba(255, 255, 255, 0.4)' }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        {query.length >= 2 && results.length === 0 && !isSearching && (
          <Paper
            elevation={0}
            sx={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              zIndex: 100,
              bgcolor: 'rgba(10, 10, 10, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              p: 3,
              textAlign: 'center'
            }}
          >
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>
              No entities matching &quot;{query}&quot; found
            </Typography>
          </Paper>
        )}
      </Box>
    </Box>
  );
}
