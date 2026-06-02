'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  CircularProgress,
  alpha,
  IconButton,
  Chip
} from '@/lib/mui-tailwind/material';
import {
  Search as SearchIcon,
  Close as CloseIcon
} from '@/lib/mui-tailwind/icons';
import { UsersService } from '@/lib/services/users';
import { fetchProfilePreview } from '@/lib/profile-preview';
import { IdentityAvatar, computeIdentityFlags } from './common/IdentityBadge';
import { seedIdentityCache } from '@/lib/identity-cache';

interface User {
  id: string;
  title: string;
  subtitle: string;
  avatar?: string | null;
  profilePicId?: string | null;
  displayName?: string;
  username?: string;
  publicKey?: string | null;
}

interface UserSearchProps {
  label?: string;
  placeholder?: string;
  selectedUsers: User[];
  onSelect: (user: User) => void;
  onRemove: (userId: string) => void;
  excludeIds?: string[];
  multiple?: boolean;
  inlineResults?: boolean;
}

export default function UserSearch({
  label = 'ASSIGN TO',
  placeholder = 'Search by name or @username',
  selectedUsers,
  onSelect,
  onRemove,
  excludeIds = [],
  multiple: _multiple = true,
  inlineResults = false
}: UserSearchProps) {
  const [query, setQuery] = useState('');
  const [rawResults, setRawResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const results = useMemo(() => {
    return rawResults.filter((u: any) => 
      !selectedUsers.some(s => s.id === u.id) && 
      !excludeIds.includes(u.id)
    );
  }, [rawResults, selectedUsers, excludeIds]);

  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setRawResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { searchGlobalUsers } = await import('@/lib/ecosystem/identity');
      const res = await searchGlobalUsers(searchQuery);
      const nextRows = Array.isArray(res) ? res : (res as any)?.rows || [];
      
      // Seed identity cache
      nextRows.forEach((u: any) => seedIdentityCache(u));

      const normalized = nextRows.map((u: any) => ({
        id: u.id || u.userId || u.$id,
        title: u.displayName || u.username || u.title || 'Kylrix User',
        subtitle: u.username ? `@${u.username}` : u.userId || u.$id || u.subtitle || '',
        avatar: u.avatar || null,
        profilePicId: u.avatar || null,
        ...u // Preserve original for identity flags
      }));
      setRawResults(normalized as User[]);
    } catch (err) {
      console.error('User search failed:', err);
      setRawResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      debouncedSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, debouncedSearch]);

  const handleSelect = (user: User) => {
    onSelect(user);
    setQuery('');
    setRawResults([]);
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
                  fileId={user.profilePicId || user.avatar || null}
                  alt={user.title}
                  fallback={(user.title || user.subtitle || 'U').charAt(0).toUpperCase()}
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
                  userId={user.id}
                  isAvatar={(user as any).isAvatar}
                  isPublic={(user as any).isPublic}
                  isGuest={(user as any).isGuest}
                  displayName={user.displayName || (user as any).displayName}
                  username={user.username || (user as any).username}
                  accountName={(user as any).name || (user as any).displayName}
                  email={(user as any).email}
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
              <CircularProgress size={16} sx={{ color: '#F59E0B' }} />
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
                borderColor: alpha('#F59E0B', 0.5),
                boxShadow: `0 0 0 2px ${alpha('#F59E0B', 0.1)}`,
              }
            }
          }}
        />

        {query.length >= 2 && results.length > 0 && (
          <Box
            sx={inlineResults ? {
              mt: 1,
              bgcolor: 'rgba(22, 20, 18, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              maxHeight: 240,
              overflow: 'auto'
            } : {
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
                      fileId={user.profilePicId || user.avatar || null}
                      alt={user.title}
                      fallback={(user.displayName || user.username || user.title || 'U').charAt(0).toUpperCase()}
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
                      userId={user.id}
                      isAvatar={(user as any).isAvatar}
                      isPublic={(user as any).isPublic}
                      isGuest={(user as any).isGuest}
                      displayName={user.displayName || (user as any).displayName}
                      username={user.username || (user as any).username}
                      accountName={(user as any).name || (user as any).displayName}
                      email={(user as any).email}
                    />
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.displayName || user.username || user.title}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 700, color: '#F2F2F2' }}
                    secondary={user.username ? `@${user.username}` : user.subtitle}
                    secondaryTypographyProps={{ variant: 'caption', color: 'rgba(255, 255, 255, 0.4)' }}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {query.length >= 2 && results.length === 0 && !isSearching && (
          <Box
            sx={inlineResults ? {
              mt: 1,
              bgcolor: 'rgba(22, 20, 18, 0.98)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '16px',
              p: 3,
              textAlign: 'center'
            } : {
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
          </Box>
        )}
      </Box>
    </Box>
  );
}
