'use client';

import React from 'react';
import { Box, Typography, TextField, alpha } from '@/lib/mui-tailwind/material';

interface NoteContentProps {
  content: string;
  onChange: (content: string) => void;
  disabled?: boolean;
}

export default function NoteContent({
  content,
  onChange,
  disabled = false,
}: NoteContentProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        placeholder="Write your note content here..."
        value={content}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        disabled={disabled}
        multiline
        minRows={12}
        fullWidth
        inputProps={{ maxLength: 65000 }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '24px',
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            p: 3,
            fontSize: '1.1rem',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.9)',
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.05)',
              transition: 'border-color 0.3s',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.15)',
            },
            '&.Mui-focused fieldset': {
              borderColor: alpha('#6366F1', 0.3),
              borderWidth: '1px',
            },
          },
          '& .MuiInputBase-input::placeholder': {
            color: 'rgba(255, 255, 255, 0.2)',
            opacity: 1,
          },
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, letterSpacing: '0.05em' }}>
          {content.length.toLocaleString()} / 65,000
        </Typography>
      </Box>
    </Box>
  );
}
