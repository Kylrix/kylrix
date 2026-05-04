'use client';

import React, { useState } from 'react';
import DoodleCanvas from '@/components/DoodleCanvas';
import DoodleViewer from '@/components/DoodleViewer';
import { Box, Typography, Button, TextField, Paper, alpha } from '@mui/material';
import { Edit as EditIcon, Brush as BrushIcon, TextFields as TextIcon } from '@mui/icons-material';

interface NoteContentProps {
  format?: 'text' | 'doodle';
  content: string;
  onChange: (content: string) => void;
  onFormatChange: (format: 'text' | 'doodle') => void;
  disabled?: boolean;
}

export default function NoteContent({
  format = 'text',
  content,
  onChange,
  onFormatChange,
  disabled = false,
}: NoteContentProps) {
  const [showDoodleEditor, setShowDoodleEditor] = useState(false);

  const handleDoodleSave = (doodleData: string) => {
    onChange(doodleData);
    onFormatChange('doodle');
    setShowDoodleEditor(false);
  };

  const handleEditDoodle = () => {
    setShowDoodleEditor(true);
  };

  const handleSwitchToText = () => {
    onFormatChange('text');
    onChange('');
  };

  const handleSwitchToDoodle = () => {
    setShowDoodleEditor(true);
  };

  if (format === 'doodle') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {content && (
          <DoodleViewer data={content} onEdit={handleEditDoodle} />
        )}

        {!content && (
          <Paper 
            variant="outlined" 
            sx={{ 
              textAlign: 'center', 
              py: 8, 
              borderRadius: '24px', 
              borderStyle: 'dashed',
              borderWidth: 2,
              borderColor: 'rgba(255, 255, 255, 0.1)',
              bgcolor: 'rgba(255, 255, 255, 0.02)',
              backdropFilter: 'blur(10px)'
            }}
          >
            <BrushIcon sx={{ fontSize: 48, color: 'rgba(255, 255, 255, 0.2)', mb: 2 }} />
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 3, fontWeight: 500 }}>
              No doodle yet
            </Typography>
            <Button 
              variant="contained" 
              onClick={handleSwitchToDoodle} 
              disabled={disabled}
              startIcon={<BrushIcon />}
              sx={{
                bgcolor: '#6366F1',
                color: '#000',
                fontWeight: 900,
                borderRadius: '12px',
                px: 3,
                '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
              }}
            >
              Create Doodle
            </Button>
          </Paper>
        )}

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {content && (
            <Button
              variant="outlined"
              onClick={handleEditDoodle}
              disabled={disabled}
              startIcon={<EditIcon />}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                borderRadius: '12px',
                fontWeight: 700,
                '&:hover': { borderColor: '#6366F1', color: '#6366F1', bgcolor: alpha('#6366F1', 0.05) }
              }}
            >
              Edit Doodle
            </Button>
          )}
          <Button
            variant="text"
            onClick={handleSwitchToText}
            disabled={disabled}
            startIcon={<TextIcon />}
            sx={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontWeight: 700,
              '&:hover': { color: 'white' }
            }}
          >
            Switch to Text
          </Button>
        </Box>

        {showDoodleEditor && (
          <DoodleCanvas
            initialData={content}
            onSave={handleDoodleSave}
            onClose={() => setShowDoodleEditor(false)}
          />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        placeholder="Write your note content here..."
        value={content}
        onChange={ (e) => onChange(e.target.value)}
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
              transition: 'border-color 0.3s'
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.15)',
            },
            '&.Mui-focused fieldset': {
              borderColor: alpha('#6366F1', 0.3),
              borderWidth: '1px'
            }
          },
          '& .MuiInputBase-input::placeholder': {
            color: 'rgba(255, 255, 255, 0.2)',
            opacity: 1
          }
        }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outlined"
          onClick={handleSwitchToDoodle}
          disabled={disabled}
          startIcon={<BrushIcon />}
          sx={{
            borderColor: 'rgba(255, 255, 255, 0.1)',
            color: 'white',
            borderRadius: '12px',
            fontWeight: 700,
            '&:hover': { borderColor: '#6366F1', color: '#6366F1', bgcolor: alpha('#6366F1', 0.05) }
          }}
        >
          Create Doodle
        </Button>

        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600, letterSpacing: '0.05em' }}>
          {content.length.toLocaleString()} / 65,000
        </Typography>
      </Box>

      {showDoodleEditor && (
        <DoodleCanvas
          initialData=""
          onSave={handleDoodleSave}
          onClose={() => setShowDoodleEditor(false)}
        />
      )}
    </Box>
  );
}


