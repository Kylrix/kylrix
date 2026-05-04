'use client';

import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
  Note as NoteIcon,
  Person as PersonIcon,
  Label as TagIcon,
  History as HistoryIcon,
  AccountCircle as AccountIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { fetchProfilePreview, getCachedProfilePreview } from '@/lib/profilePreview';
import { getUserProfilePicId } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';

interface SearchResult {
  id: string;
  type: 'note' | 'user' | 'tag';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  profilePicId?: string;
  avatar?: string;
}

function SearchResultAvatar({ result }: { result: SearchResult }) {
  const [url, setUrl] = useState<string | null>(result.avatar || null);

  useEffect(() => {
    if (result.type !== 'user' || !result.profilePicId || result.avatar) return;

    let mounted = true;
    const load = async () => {
      try {
        const { fetchProfilePreview } = await import('@/lib/profilePreview');
        const previewUrl = await fetchProfilePreview(result.profilePicId, 48, 48);
        if (mounted) setUrl(previewUrl);
      } catch (err: any) {
        console.error('Failed to load search result avatar', err);
      }
    };
    load();
    return () => { mounted = false; };
  }, [result]);

  if (result.type === 'user') {
    return (
      <Avatar
        src={url || undefined}
        sx={{
          width: 32,
          height: 32,
          fontSize: '0.75rem',
          bgcolor: '#A855F7',
          color: '#fff',
          fontWeight: 800,
          fontFamily: 'var(--font-mono)'
        }}
      >
        {result.title.charAt(0).toUpperCase()}
      </Avatar>
    );
  }

  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: result.type === 'note' ? '#EC4899' : '#10B981'
      }}
    >
      {result.icon}
    </Box>
  );
}

interface GlobalSearchProps {
  onSearchResult?: (result: SearchResult) => void;
  placeholder?: string;
  showFilters?: boolean;
}

const mockRecentSearches = [
  'Project Alpha',
  'Meeting notes',
  'React components',
];

const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    type: 'note',
    title: 'Project Alpha Documentation',
    subtitle: 'Last updated 2 hours ago',
    icon: <NoteIcon />,
  },
  {
    id: '2',
    type: 'note',
    title: 'Meeting Notes - Q1 Planning',
    subtitle: 'Last updated yesterday',
    icon: <NoteIcon />,
  },
  {
    id: '3',
    type: 'user',
    title: 'John Doe',
    subtitle: '@johndoe',
    icon: <PersonIcon />,
  },
  {
    id: '4',
    type: 'tag',
    title: 'project-management',
    subtitle: '12 notes',
    icon: <TagIcon />,
  },
];

export default function GlobalSearch({
  onSearchResult,
  placeholder = "Search notes, people, and tags...",
  showFilters = true,
}: GlobalSearchProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [smallProfileUrl, setSmallProfileUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const profilePicId = getUserProfilePicId(user);
    const cached = getCachedProfilePreview(profilePicId || undefined);
    if (cached !== undefined) {
      setSmallProfileUrl(cached ?? null);
    }

    const load = async () => {
      if (!profilePicId) return;
      try {
        const url = await fetchProfilePreview(profilePicId, 24, 24);
        if (mounted) setSmallProfileUrl(url);
      } catch {
        if (mounted) setSmallProfileUrl(null);
      }
    };
    load();
    return () => { mounted = false; };
  }, [user?.$id, user]);

  useEffect(() => {
    let mounted = true;
    const conductSearch = async () => {
      if (query.trim().length === 0) {
        if (mounted) {
          setResults([]);
          setShowResults(false);
        }
        return;
      }

      // Notes and Tags still use mock/local logic for now
      const localResults = mockSearchResults.filter(result =>
        result.type !== 'user' && (
          result.title.toLowerCase().includes(query.toLowerCase()) ||
          result.subtitle?.toLowerCase().includes(query.toLowerCase())
        )
      );

      // People search uses Global Directory (Kylrix Connect)
      let globalPeople: SearchResult[] = [];
      try {
        const { searchGlobalUsers } = await import('@/lib/ecosystem/identity');
        const peopleDocs = await searchGlobalUsers(query);
        const peopleResults = peopleDocs.map(u => ({
          id: u.id,
          type: 'user' as const,
          title: u.title,
          subtitle: u.subtitle,
          icon: <PersonIcon />,
          avatar: u.avatar,
          profilePicId: u.profilePicId
        }));
        globalPeople = peopleResults as SearchResult[];
      } catch (err: any) {
        console.error('Global search failed', err);
      }

      if (mounted) {
        setResults([...localResults, ...globalPeople]);
        setShowResults(true);
      }
    };

    const timer = setTimeout(conductSearch, 300);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query]);

  const handleClear = () => {
    setQuery('');
    setShowResults(false);
  };

  const handleResultClick = (result: SearchResult) => {
    onSearchResult?.(result);
    setShowResults(false);
    setQuery('');
  };

  const handleFilterToggle = (filter: string) => {
    setActiveFilters(prev =>
      prev.includes(filter)
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleNavigateToNotes = () => {
    router.push('/notes');
    handleUserMenuClose();
  };

  const handleNavigateToTags = () => {
    router.push('/tags');
    handleUserMenuClose();
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error: any) {
      console.error('Logout failed:', error);
    }
    handleUserMenuClose();
  };

  const filters = [
    { id: 'notes', label: 'Notes', icon: <NoteIcon /> },
    { id: 'people', label: 'People', icon: <PersonIcon /> },
    { id: 'tags', label: 'Tags', icon: <TagIcon /> },
  ];

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: 600 }}>
      {/* Search Input */}
      <TextField
        fullWidth
        value={query}
        onChange={ (e) => setQuery(e.target.value)}
        placeholder={placeholder}
        variant="outlined"
        sx={{
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#161412',
            borderRadius: '16px',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            '& fieldset': {
              border: '1px solid rgba(255, 255, 255, 0.05)',
            },
            '&:hover fieldset': {
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            '&.Mui-focused fieldset': {
              border: '1px solid #EC4899',
            },
          },
          '& .MuiInputBase-input': {
            fontFamily: 'var(--font-satoshi)',
            color: 'rgba(255, 255, 255, 0.9)',
          }
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.4)' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {query && (
                  <IconButton size="small" onClick={handleClear} sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                    <ClearIcon />
                  </IconButton>
                )}
                {showFilters && (
                  <IconButton size="small" sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                    <FilterIcon />
                  </IconButton>
                )}
                {user && (
                  <IconButton
                    size="small"
                    onClick={handleUserMenuOpen}
                    sx={{
                      ml: 1,
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      p: 0.5
                    }}
                  >
                    {user.name ? (
                      <Avatar
                        sx={{
                          width: 24,
                          height: 24,
                          fontSize: '0.75rem',
                          backgroundColor: '#0A0908',
                          color: '#EC4899',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          fontWeight: 900,
                          fontFamily: 'var(--font-mono)'
                        }}
                        src={smallProfileUrl ?? undefined}
                      >
                        {user.name.charAt(0).toUpperCase()}
                      </Avatar>
                    ) : (
                      <AccountIcon sx={{ color: '#EC4899' }} />
                    )}
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }
        }}
      />

      {/* Active Filters */}
      {showFilters && activeFilters.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {activeFilters.map((filter) => {
            const filterData = filters.find(f => f.id === filter);
            return (
              <Chip
                key={filter}
                label={filterData?.label}
                icon={filterData?.icon}
                onDelete={() => handleFilterToggle(filter)}
                size="small"
                sx={{
                  backgroundColor: 'rgba(236, 72, 153, 0.1)',
                  color: '#EC4899',
                  border: '1px solid rgba(236, 72, 153, 0.2)',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  fontSize: '0.7rem',
                  '& .MuiChip-deleteIcon': {
                    color: '#EC4899',
                    '&:hover': { color: '#F472B6' }
                  },
                  '& .MuiChip-icon': { color: '#EC4899' }
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Search Results Dropdown */}
      {showResults && (
        <Paper
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            mt: 1.5,
            zIndex: 1000,
            maxHeight: 400,
            overflow: 'auto',
            bgcolor: '#161412',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '16px',
            backgroundImage: 'none',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 32px rgba(0, 0, 0, 0.5)',
          }}
        >
          {results.length > 0 ? (
            <List sx={{ py: 1 }}>
              {results.map((result, _index) => (
                <ListItem
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  sx={{
                    borderRadius: '12px',
                    mx: 1,
                    mb: 0.5,
                    width: 'calc(100% - 16px)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      backgroundColor: '#1C1A18',
                      boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                      '& .MuiListItemText-primary': { color: '#EC4899' }
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 48,
                    }}
                  >
                    <SearchResultAvatar result={result} />
                  </ListItemIcon>
                  <ListItemText
                    primary={result.title}
                    secondary={result.subtitle}
                    slotProps={{
                      primary: {
                        sx: {
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          fontFamily: 'var(--font-clash)',
                          color: 'rgba(255, 255, 255, 0.9)',
                          transition: 'color 0.2s ease'
                        }
                      },
                      secondary: {
                        sx: {
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-satoshi)',
                          color: 'rgba(255, 255, 255, 0.5)'
                        }
                      }
                    }}
                  />
                </ListItem>
              ))}
            </List>
          ) : query ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'var(--font-satoshi)' }}>
                No results found for &quot;{query}&quot;
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  px: 2,
                  pb: 1.5,
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontSize: '0.7rem'
                }}
              >
                Recent searches
              </Typography>
              <List sx={{ py: 0 }}>
                {mockRecentSearches.map((search, index) => (
                  <ListItem
                    key={index}
                    onClick={() => setQuery(search)}
                    sx={{
                      borderRadius: '12px',
                      mx: 1,
                      mb: 0.5,
                      width: 'calc(100% - 16px)',
                      cursor: 'pointer',
                      '&:hover': {
                        backgroundColor: '#1C1A18',
                        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)'
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: 'rgba(255, 255, 255, 0.3)' }}>
                      <HistoryIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={search}
                      slotProps={{
                        primary: {
                          sx: {
                            fontSize: '0.85rem',
                            fontFamily: 'var(--font-satoshi)',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }
                        }
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Paper>
      )}

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        slotProps={{
          paper: {
            sx: {
              borderRadius: '16px',
              minWidth: 200,
              bgcolor: '#161412',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              backgroundImage: 'none',
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 12px 32px rgba(0, 0, 0, 0.5)',
              mt: 1,
              py: 1
            }
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={handleNavigateToNotes}
          sx={{
            px: 2,
            py: 1.25,
            gap: 2,
            '&:hover': { bgcolor: '#1C1A18', color: '#EC4899', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)' }
          }}
        >
          <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
            <NoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Notes"
            slotProps={{
              primary: {
                sx: {
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  fontSize: '0.8rem',
                  letterSpacing: '0.05em'
                }
              }
            }}
          />
        </MenuItem>
        <MenuItem
          onClick={handleNavigateToTags}
          sx={{
            px: 2,
            py: 1.25,
            gap: 2,
            '&:hover': { bgcolor: '#1C1A18', color: '#EC4899', boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)' }
          }}
        >
          <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
            <TagIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Tags"
            slotProps={{
              primary: {
                sx: {
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  fontSize: '0.8rem',
                  letterSpacing: '0.05em'
                }
              }
            }}
          />
        </MenuItem>
        <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.05)' }} />
        <MenuItem
          onClick={handleLogout}
          sx={{
            px: 2,
            py: 1.25,
            gap: 2,
            color: '#FF4D4D',
            '&:hover': { bgcolor: 'rgba(255, 77, 77, 0.05)' }
          }}
        >
          <ListItemIcon sx={{ minWidth: 'auto', color: 'inherit' }}>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            slotProps={{
              primary: {
                sx: {
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase',
                  fontSize: '0.8rem',
                  letterSpacing: '0.05em'
                }
              }
            }}
          />
        </MenuItem>
      </Menu>
    </Box>
  );
}