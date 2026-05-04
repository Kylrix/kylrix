"use client";

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  InputAdornment,
  Chip,
  IconButton,
  alpha,
  Avatar
} from '@mui/material';
import { Search as SearchIcon, NoteOutlined as NoteIcon, FolderOutlined as FolderIcon, LocalOfferOutlined as TagIcon, Close as CloseIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { debounce } from 'lodash';

type SearchResult = {
  id: string;
  type: 'note' | 'collection' | 'tag' | 'user';
  title: string;
  excerpt?: string;
  date?: string;
  tags?: string[];
  avatar?: string;
  profilePicId?: string;
};

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
          fontFamily: 'inherit'
        }}
      >
        {result.title.charAt(0).toUpperCase()}
      </Avatar>
    );
  }

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'note':
        return <NoteIcon sx={{ color: '#6366F1' }} />;
      case 'collection':
        return <FolderIcon sx={{ color: '#6366F1' }} />;
      case 'tag':
        return <TagIcon sx={{ color: '#6366F1' }} />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {getIcon(result.type)}
    </Box>
  );
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [_loading, setLoading] = useState(false);

  const handleSearch = debounce(async (term: string) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      // Local/Note Mock Results
      const noteResults: SearchResult[] = [
        {
          id: '1',
          type: 'note' as const,
          title: 'Project Meeting Notes',
          excerpt: 'Discussion about the new feature implementation...',
          date: '2 days ago',
          tags: ['work', 'meeting']
        }
      ].filter(r => r.title.toLowerCase().includes(term.toLowerCase()));

      // Real Global User Search
      const { searchGlobalUsers } = await import('@/lib/ecosystem/identity');
      const globalUsers = await searchGlobalUsers(term);
      const peopleResults = globalUsers.map(u => ({
        id: u.id,
        type: 'user' as const,
        title: u.title,
        excerpt: u.subtitle,
        avatar: u.avatar,
        profilePicId: u.profilePicId
      }));

      setResults([...noteResults, ...peopleResults]);
    } catch (err: any) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, 300);

  const clearSearch = () => {
    setSearchTerm('');
    setResults([]);
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', maxWidth: 600, mx: 'auto' }}>
      <TextField
        fullWidth
        placeholder="Search notes, collections, and tags..."
        value={searchTerm}
        onChange={ (e) => {
          setSearchTerm(e.target.value);
          handleSearch(e.target.value);
        }}
        onFocus={() => setIsOpen(true)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.4)' }} />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={clearSearch} sx={{ color: 'rgba(255, 255, 255, 0.4)' }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '16px',
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '& fieldset': { border: 'none' },
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            },
            '&.Mui-focused': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.1)',
            }
          },
          '& .MuiInputBase-input': {
            color: 'white',
            fontWeight: 500,
            '&::placeholder': {
              color: 'rgba(255, 255, 255, 0.3)',
              opacity: 1
            }
          }
        }}
      />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1000,
              marginTop: '12px'
            }}
          >
            <Paper
              elevation={0}
              sx={{
                maxHeight: 400,
                overflow: 'auto',
                borderRadius: '20px',
                bgcolor: 'rgba(10, 10, 10, 0.98)',
                backdropFilter: 'blur(25px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                backgroundImage: 'none'
              }}
            >
              {results.length > 0 ? (
                <List sx={{ p: 1 }}>
                  {results.map((result) => (
                    <ListItem
                      key={result.id}
                      sx={{
                        py: 1.5,
                        px: 2,
                        cursor: 'pointer',
                        borderRadius: '12px',
                        mb: 0.5,
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                          transform: 'translateX(4px)'
                        }
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 48 }}>
                        <SearchResultAvatar result={result} />
                      </ListItemIcon>
                      <ListItemText
                        primary={result.title}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: 800,
                          color: 'white'
                        }}
                        secondary={
                          result.excerpt && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgba(255, 255, 255, 0.4)',
                                display: '-webkit-box',
                                WebkitLineClamp: 1,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                mt: 0.5
                              }}
                            >
                              {result.excerpt}
                            </Typography>
                          )
                        }
                      />
                      <Box sx={{ ml: 2, textAlign: 'right' }}>
                        {result.date && (
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, textTransform: 'uppercase', fontSize: '9px' }}>
                            {result.date}
                          </Typography>
                        )}
                        {result.tags && (
                          <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            {result.tags.map(tag => (
                              <Chip
                                key={tag}
                                label={tag}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: '9px',
                                  fontWeight: 800,
                                  bgcolor: alpha('#6366F1', 0.1),
                                  color: '#6366F1',
                                  border: '1px solid',
                                  borderColor: alpha('#6366F1', 0.2),
                                  '& .MuiChip-label': { px: 1 }
                                }}
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              ) : searchTerm && (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, fontSize: '0.875rem' }}>
                    No results found for &quot;{searchTerm}&quot;
                  </Typography>
                </Box>
              )}
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
}
