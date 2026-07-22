"use client";

import { useState, useEffect } from 'react';
import { Box, Typography, Chip, TextField, Button, Autocomplete } from '@/lib/openbricks/primitives';
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
        const { getCurrentUser } = await import('@/lib/appwrite/client');
        const user = await getCurrentUser().catch(() => null);
        const userId = user?.$id || 'guest';
        const cacheKey = `f_user_tags_${userId}`;

        try {
          const { getRxDB } = await import('@/lib/webrtc/RxDBManager');
          const db = await getRxDB().catch(() => null);
          if (db) {
            const cachedDoc = await db.cache.findOne(cacheKey).exec().catch(() => null);
            if (cachedDoc?.data && Array.isArray(cachedDoc.data)) {
              setTags(cachedDoc.data as Tags[]);
            }
          }
        } catch {}

        const res = await listTags();
        const rows = Array.isArray(res) ? res : (Array.isArray((res as any)?.rows) ? (res as any).rows : []);
        setTags((prev) => {
          const byId = new Map<string, Tags>();
          (prev || []).forEach((t) => t && t.$id && byId.set(t.$id, t));
          rows.forEach((t: any) => t && t.$id && byId.set(t.$id, t));
          return Array.from(byId.values());
        });
      } catch (error: any) {
        console.warn('[TagManager] Local tag fetch fallback:', error);
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
        getOptionLabel={(option: any) => option.name || ''}
        value={tags.filter(tag => selectedTags.includes(tag.$id))}
        onChange={(event: any, newValue: any) => {
          onChangeAction(newValue.map((tag: any) => tag.$id));
        }}
        renderTags={(value: any, getTagProps: any) =>
          value.map((option: any, index: number) => {
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
        renderInput={(params: any) => (
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
          onChange={ (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setNewTagName(e.target.value)}
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
