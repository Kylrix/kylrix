'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  Button, 
  TextField, 
  Grid, 
  CircularProgress, 
  Container,
  Card,
  CardContent,
  Chip,
  alpha,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Label as LabelIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';
import { Tags } from '@/types/appwrite';
import { listTags, createTag, updateTag, deleteTag, updateNote } from '@/lib/appwrite';
import { useAuth } from '@/components/ui/AuthContext';
import { formatDateWithFallback } from '@/lib/date-utils';
import { TagNotesListSidebar } from '@/components/ui/TagNotesListSidebar';
import { ID } from 'appwrite';

export default function TagsPage() {
  const { user, isAuthenticated, openIDMWindow } = useAuth();
  const hasFetched = useRef(false);
  const [tags, setTags] = useState<Tags[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingTag, setEditingTag] = useState<Tags | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tags | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1', // Default to accent color
  });

  const predefinedColors = [
    '#6366F1', // Electric Teal
    '#A855F7', // Purple
    '#EC4899', // Pink
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#6366F1', // Indigo
    '#8B5CF6', // Violet
    '#F43F5E', // Rose
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];

  const fetchTags = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      const response = await listTags();
      setTags(response.documents as unknown as Tags[]);
    } catch (err: any) {
       setError(err instanceof Error ? err.message : 'Failed to fetch tags');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isAuthenticated) {
      openIDMWindow();
      return;
    }
    
    if (user && !hasFetched.current) {
      hasFetched.current = true;
      fetchTags();
    }
  }, [isAuthenticated, user, fetchTags, openIDMWindow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsCreating(true);

    if (!user) {
      setError('User not authenticated');
      setIsCreating(false);
      return;
    }

    try {
      if (editingTag) {
        await updateTag(editingTag.$id, {
          name: formData.name,
          description: formData.description,
          color: formData.color,
        });
      } else {
        await createTag({
          id: ID.unique(),
          userId: user.$id,
          name: formData.name,
          description: formData.description,
          color: formData.color,
          notes: [],
          usageCount: 0,
          createdAt: new Date().toISOString(),
        });
      }
      
      setFormData({ name: '', description: '', color: '#6366F1' });
      setShowCreateForm(false);
      setEditingTag(null);
      await fetchTags();
    } catch (err: any) {
       setError((err as Error)?.message || 'Failed to save tag');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (tag: Tags) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name || '',
      description: tag.description || '',
      color: tag.color || '#6366F1',
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (tag: Tags) => {
    if (!confirm(`Are you sure you want to delete the tag "${tag.name}"?`)) {
      return;
    }

    try {
      await deleteTag(tag.$id);
      await fetchTags();
    } catch (err: any) {
       setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', color: '#6366F1' });
    setShowCreateForm(false);
    setEditingTag(null);
    setError(null);
  };

  if (!isAuthenticated) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress sx={{ color: '#6366F1' }} />
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>Please log in to manage your tags</Typography>
        </Stack>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress sx={{ color: '#6366F1' }} />
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>Loading tags...</Typography>
        </Stack>
      </Box>
    );
  }

  if (selectedTag) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908' }}>
        <Grid container sx={{ height: '100vh' }}>
          <Grid size={{ xs: 12, lg: 6 }} sx={{ display: { xs: 'none', lg: 'block' }, borderRight: '1px solid rgba(255, 255, 255, 0.05)', p: 4, overflowY: 'auto' }}>
            <Box sx={{ mb: 4 }}>
              <Typography variant="h3" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', color: 'white', mb: 1, letterSpacing: '-0.02em' }}>
                Tags Management
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'var(--font-satoshi)', fontWeight: 500 }}>Organize your notes with custom tags and colors</Typography>
            </Box>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {tags.length} tag{tags.length !== 1 ? 's' : ''} total
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateForm(true)}
                sx={{
                  bgcolor: '#6366F1',
                  color: 'black',
                  fontWeight: 900,
                  borderRadius: '12px',
                  boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)',
                  '&:hover': { bgcolor: alpha('#6366F1', 0.8), transform: 'translateY(-2px)' }
                }}
              >
                Create New Tag
              </Button>
            </Stack>

            <Stack spacing={2}>
              {tags.map((tag) => (
                <Card
                  key={tag.$id}
                  onClick={() => setSelectedTag(tag)}
                  sx={{
                    bgcolor: selectedTag?.$id === tag.$id ? '#1C1A18' : '#161412',
                    border: '1px solid',
                    borderColor: selectedTag?.$id === tag.$id ? alpha('#6366F1', 0.4) : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    backgroundImage: 'none',
                    boxShadow: selectedTag?.$id === tag.$id ? '0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': { borderColor: alpha('#6366F1', 0.4), bgcolor: '#1C1A18', transform: 'translateX(4px)' }
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: tag.color || '#6366F1', boxShadow: `0 0 10px ${alpha(tag.color || '#6366F1', 0.4)}` }} />
                        <Typography sx={{ fontWeight: 800, color: 'white', fontFamily: 'var(--font-satoshi)' }}>{tag.name}</Typography>
                      </Stack>
                      <Chip 
                        label={`${tag.usageCount || 0} notes`} 
                        size="small" 
                        sx={{ bgcolor: 'rgba(255, 255, 255, 0.03)', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, fontSize: '0.65rem', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }} 
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }} sx={{ height: '100vh', overflow: 'hidden' }}>
            <TagNotesListSidebar
              tag={selectedTag}
              onBack={() => setSelectedTag(null)}
              onNoteUpdate={async (updatedNote) => {
                try {
                  await updateNote(updatedNote.$id || '', updatedNote);
                } catch (err: any) {
                  console.error('Failed to update note:', err);
                }
              }}
              onNoteDelete={(noteId) => {
                console.log('Note deleted:', noteId);
              }}
            />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0A0908', color: 'white', p: { xs: 2, md: 6 } }}>
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 6 }}>
          <Typography 
            variant="h1" 
            sx={{ 
              fontWeight: 900, 
              fontFamily: 'var(--font-clash)',
              background: 'linear-gradient(to bottom, #FFF 0%, rgba(255,255,255,0.7) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: { xs: '2.5rem', md: '4rem' },
              letterSpacing: '-0.02em',
              mb: 1
            }}
          >
            Tags Management
          </Typography>
          <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500, fontFamily: 'var(--font-satoshi)' }}>
            Organize your notes with custom tags and colors
          </Typography>
        </Box>

        {error && (
          <Box sx={{ mb: 4, p: 2, bgcolor: alpha('#ff4444', 0.05), border: '1px solid rgba(255, 68, 68, 0.2)', borderRadius: '12px' }}>
            <Typography color="#ff4444" sx={{ fontWeight: 600, fontFamily: 'var(--font-satoshi)' }}>{error}</Typography>
          </Box>
        )}

        {/* Action Bar */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 6 }}>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            {tags.length} tag{tags.length !== 1 ? 's' : ''} total
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateForm(true)}
            sx={{
              bgcolor: '#6366F1',
              color: 'black',
              fontWeight: 900,
              px: 4,
              py: 1.5,
              borderRadius: '12px',
              boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)',
              '&:hover': { bgcolor: alpha('#6366F1', 0.8), transform: 'translateY(-2px)' }
            }}
          >
            Create New Tag
          </Button>
        </Stack>

        {/* Tags Grid */}
        {tags.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 12 }}>
            <Box 
              sx={{ 
                width: 140, 
                height: 140, 
                bgcolor: '#161412', 
                borderRadius: '48px', 
                mx: 'auto', 
                mb: 4, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '4rem',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
              }}
            >
              🏷️
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, fontFamily: 'var(--font-clash)', letterSpacing: '-0.01em' }}>No tags yet</Typography>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.4)', mb: 4, fontFamily: 'var(--font-satoshi)', fontWeight: 500 }}>Create your first tag to start organizing your notes</Typography>
            <Button
              variant="contained"
              onClick={() => setShowCreateForm(true)}
              sx={{
                bgcolor: '#6366F1',
                color: 'black',
                fontWeight: 900,
                px: 6,
                py: 2,
                borderRadius: '16px',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
                '&:hover': { bgcolor: alpha('#6366F1', 0.8), transform: 'translateY(-2px)' }
              }}
            >
              Create First Tag
            </Button>
          </Box>
        ) : (
          <Grid container spacing={4}>
            {tags.map((tag) => (
              <Grid size={{ xs: 12, md: 6, lg: 4 }} key={tag.$id}>
                <Card
                  onClick={() => setSelectedTag(tag)}
                  sx={{
                    bgcolor: '#161412',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '32px',
                    cursor: 'pointer',
                    backgroundImage: 'none',
                    boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.5)',
                    transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': { 
                      transform: 'translateY(-8px) scale(1.01)', 
                      borderColor: alpha(tag.color || '#6366F1', 0.4),
                      boxShadow: `0 40px 80px -20px rgba(0,0,0,0.9), 0 0 20px ${alpha(tag.color || '#6366F1', 0.15)}, inset 0 1px 1px ${alpha('#FFFFFF', 0.1)}`
                    }
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box 
                          sx={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: '16px', 
                            bgcolor: alpha(tag.color || '#6366F1', 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: tag.color || '#6366F1',
                            border: `1px solid ${alpha(tag.color || '#6366F1', 0.2)}`
                          }}
                        >
                          <LabelIcon />
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '0.01em' }}>
                            {tag.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
                            {tag.usageCount || 0} notes
                          </Typography>
                        </Box>
                      </Stack>
                    </Stack>

                    {tag.description && (
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'rgba(255, 255, 255, 0.5)', 
                          fontFamily: 'var(--font-satoshi)',
                          lineHeight: 1.6,
                          mb: 3, 
                          minHeight: 44,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {tag.description}
                      </Typography>
                    )}

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 4, color: 'rgba(255, 255, 255, 0.2)' }}>
                      <AccessTimeIcon sx={{ fontSize: 14 }} />
                      <Typography variant="caption" sx={{ fontWeight: 700, fontFamily: 'var(--font-satoshi)' }}>
                        Created {formatDateWithFallback(tag.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </Typography>
                    </Stack>

                    <Stack direction="row" spacing={2}>
                      <Button
                        fullWidth
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={ (e) => {
                          e.stopPropagation();
                          handleEdit(tag);
                        }}
                        sx={{
                          bgcolor: '#1C1A18',
                          color: 'white',
                          fontWeight: 800,
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          '&:hover': { bgcolor: '#252220', borderColor: 'rgba(255, 255, 255, 0.1)' }
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={ (e) => {
                          e.stopPropagation();
                          handleDelete(tag);
                        }}
                        sx={{
                          bgcolor: alpha('#ff4444', 0.05),
                          color: '#ff4444',
                          fontWeight: 800,
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 68, 68, 0.1)',
                          '&:hover': { bgcolor: alpha('#ff4444', 0.1), borderColor: alpha('#ff4444', 0.3) }
                        }}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Create/Edit Dialog */}
        <Dialog 
          open={showCreateForm} 
          onClose={resetForm}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              backgroundImage: 'none',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 40px 80px -20px rgba(0,0,0,0.9), inset 0 1px 1px rgba(255,255,255,0.05)',
              borderRadius: '32px',
              color: 'white',
              p: 1
            }
          }}
        >
          <DialogTitle sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', fontSize: '1.75rem', letterSpacing: '-0.02em', pt: 3 }}>
            {editingTag ? 'Edit Tag' : 'Create New Tag'}
          </DialogTitle>
          <DialogContent sx={{ pb: 0 }}>
            <Stack spacing={4} sx={{ mt: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
                  Tag Name *
                </Typography>
                <TextField
                  fullWidth
                  required
                  value={formData.name}
                  onChange={ (e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter tag name..."
                  variant="standard"
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      bgcolor: '#1C1A18',
                      borderRadius: '16px',
                      color: 'white',
                      p: 2,
                      fontFamily: 'var(--font-satoshi)',
                      fontWeight: 600,
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                      '&.Mui-focused': { borderColor: '#6366F1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)' }
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', mb: 1.5, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
                  Description
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={ (e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe this tag..."
                  variant="standard"
                  InputProps={{
                    disableUnderline: true,
                    sx: {
                      bgcolor: '#1C1A18',
                      borderRadius: '16px',
                      color: 'white',
                      p: 2,
                      fontFamily: 'var(--font-satoshi)',
                      fontWeight: 500,
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      '&:hover': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                      '&.Mui-focused': { borderColor: '#6366F1', boxShadow: '0 0 10px rgba(99, 102, 241, 0.1)' }
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', mb: 2, display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
                  Tag Color
                </Typography>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  {predefinedColors.map((color) => (
                    <Grid size="auto" key={color}>
                      <Tooltip title={color} arrow>
                        <Box
                          onClick={() => setFormData({ ...formData, color })}
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: '12px',
                            bgcolor: color,
                            cursor: 'pointer',
                            border: '3px solid',
                            borderColor: formData.color === color ? 'white' : 'transparent',
                            boxShadow: formData.color === color ? `0 0 15px ${alpha(color, 0.5)}` : 'none',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            '&:hover': { transform: 'scale(1.15)', boxShadow: `0 0 10px ${alpha(color, 0.3)}` }
                          }}
                        />
                      </Tooltip>
                    </Grid>
                  ))}
                </Grid>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, p: 1, bgcolor: '#0A0908', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                   <input 
                    type="color"
                    value={formData.color}
                    onChange={ (e) => setFormData({ ...formData, color: e.target.value })}
                    style={{ 
                      width: 40, 
                      height: 40, 
                      border: 'none', 
                      borderRadius: '8px', 
                      background: 'none', 
                      cursor: 'pointer' 
                    }}
                   />
                   <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono)' }}>
                     {formData.color.toUpperCase()}
                   </Typography>
                </Box>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 4, pt: 2 }}>
            <Button 
              onClick={resetForm} 
              sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', mr: 2 }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              variant="contained"
              disabled={isCreating || !formData.name.trim()}
              sx={{
                bgcolor: '#6366F1',
                color: 'black',
                fontWeight: 900,
                px: 5,
                py: 1.5,
                borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
                '&:hover': { bgcolor: alpha('#6366F1', 0.8), transform: 'translateY(-2px)' },
                '&.Mui-disabled': { bgcolor: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.2)' }
              }}
            >
              {isCreating ? 'Saving...' : editingTag ? 'Update Tag' : 'Create Tag'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

