'use client';

import React, { useState, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Stack, 
  LinearProgress, 
  IconButton,
  alpha
} from '@mui/material';
import { CloudUpload as UploadIcon, Close as CloseIcon } from '@mui/icons-material';
import { addAttachmentToNote } from '@/lib/appwrite';

interface AttachmentsManagerProps {
  noteId: string;
  onAttachmentAdded?: (attachment: any) => void;
}

export default function AttachmentsManager({ noteId, onAttachmentAdded }: AttachmentsManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setError(null);

    try {
      // For now, just handle one file at a time or loop through them
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await addAttachmentToNote(noteId, file);
        onAttachmentAdded?.(result);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err?.message || 'Failed to upload attachment');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: 1, fontFamily: 'var(--font-clash)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <UploadIcon sx={{ fontSize: 18, color: '#EC4899' }} /> Attachments
        </Typography>
        
        <input
          type="file"
          multiple
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        
        <Button
          size="small"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          sx={{
            color: '#EC4899',
            fontWeight: 800,
            textTransform: 'none',
            fontFamily: 'var(--font-satoshi)',
            '&:hover': { bgcolor: alpha('#EC4899', 0.1) }
          }}
        >
          {isUploading ? 'Uploading...' : 'Add Files'}
        </Button>
      </Stack>

      {isUploading && (
        <Box sx={{ mt: 1, mb: 2 }}>
          <LinearProgress sx={{ 
            height: 4, 
            borderRadius: 2, 
            bgcolor: '#0A0908',
            '& .MuiLinearProgress-bar': { bgcolor: '#EC4899' }
          }} />
        </Box>
      )}

      {error && (
        <Box sx={{ 
          mt: 1, 
          p: 1.5, 
          bgcolor: alpha('#ff4d4d', 0.05), 
          borderRadius: '12px',
          border: '1px solid',
          borderColor: alpha('#ff4d4d', 0.1),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Typography variant="caption" sx={{ color: '#ff4d4d', fontFamily: 'var(--font-satoshi)', fontWeight: 600 }}>{error}</Typography>
          <IconButton size="small" onClick={() => setError(null)} sx={{ color: '#ff4d4d', '&:hover': { bgcolor: alpha('#ff4d4d', 0.1) } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
