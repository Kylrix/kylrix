"use client";

import { useState, useEffect } from 'react';
import { Box, Typography, Chip, TextField, Button, Autocomplete } from '@mui/material';
import { listTags, createTag } from '@/lib/appwrite';
import type { Tags } from '@/types/appwrite';

interface TagManagerProps {
  selectedTags: string[];
  onChangeAction: (tags: string[]) => void;
}

export default function TagManager({ selectedTags, onChangeAction }: TagManagerProps) {
  const [tags, setTags] = useState<Tags[]>([]);
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await listTags();
        setTags(res.documents as Tags[]);
      } catch (error: any) {
        console.error('Failed to fetch tags:', error);
      }
    };
    fetchTags();
  }, []);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    try {
      const tag = await createTag({ name: newTagName });
      setTags(prev => [tag, ...prev]);
      setNewTagName('');
    } catch (error: any) {
      console.error('Failed to create tag:', error);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Tags
      </Typography>
      <Autocomplete
        multiple
        options={tags}
        getOptionLabel={(option) => option.name || ''}
        value={tags.filter(tag => selectedTags.includes(tag.$id))}
        onChange={(event, newValue) => {
          onChangeAction(newValue.map(tag => tag.$id));
        }}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => {
             const tagProps = getTagProps({ index });
             const { key: _unusedKey, ...restProps } = tagProps; // key handled by MUI
            return (
              <Chip
                key={option.$id}
                variant="outlined"
                label={option.name}
                style={{ backgroundColor: option.color || undefined }}
                {...restProps}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="standard"
            placeholder="Select tags"
          />
        )}
      />
      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        <TextField
          size="small"
          placeholder="Create new tag"
          value={newTagName}
          onChange={ (e) => setNewTagName(e.target.value)}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleCreateTag}
        >
          Create Tag
        </Button>
      </Box>
    </Box>
  );
}
