'use client';

import React, { useRef, useEffect } from 'react';
import { DoodleStroke } from '@/types/notes';
import { Box, Typography, Button, Paper, alpha } from '@mui/material';
import { Edit as EditIcon, Brush as BrushIcon } from '@mui/icons-material';

interface DoodleViewerProps {
  data: string;
  onEdit?: () => void;
  title?: string;
}

export default function DoodleViewer({ data, onEdit, title }: DoodleViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try {
      const strokes: DoodleStroke[] = JSON.parse(data);
      redrawCanvas(strokes);
    } catch {
      console.error('Failed to parse doodle data');
    }
  }, [data]);

  const redrawCanvas = (strokes: DoodleStroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use black background for consistency with editor
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = stroke.opacity ?? 1;

      ctx.beginPath();
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);

      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
      }
      ctx.stroke();

      ctx.globalAlpha = 1;
    });
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {title && (
        <Typography variant="caption" sx={{ fontWeight: 900, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {title}
        </Typography>
      )}
      <Paper 
        sx={{ 
          position: 'relative', 
          borderRadius: '24px', 
          border: '1px solid rgba(255, 255, 255, 0.1)', 
          overflow: 'hidden', 
          bgcolor: '#000',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'scale(1.01)',
            borderColor: alpha('#6366F1', 0.3)
          }
        }}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
        
        <Box sx={{ 
          position: 'absolute', 
          top: 16, 
          right: 16, 
          display: 'flex', 
          gap: 1,
          opacity: 0,
          transition: 'opacity 0.2s',
          '.MuiPaper-root:hover &': { opacity: 1 }
        }}>
          {onEdit && (
            <Button
              variant="contained"
              size="small"
              startIcon={<EditIcon />}
              onClick={onEdit}
              sx={{ 
                bgcolor: 'rgba(10, 10, 10, 0.8)', 
                backdropFilter: 'blur(10px)',
                color: 'white',
                fontWeight: 700,
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                '&:hover': { bgcolor: '#6366F1', color: '#000' }
              }}
            >
              Edit
            </Button>
          )}
        </Box>

        <Box sx={{ 
          position: 'absolute', 
          bottom: 16, 
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          bgcolor: 'rgba(10, 10, 10, 0.6)',
          backdropFilter: 'blur(8px)',
          px: 1.5,
          py: 0.5,
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <BrushIcon sx={{ fontSize: 14, color: '#6366F1' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 700 }}>
            DOODLE
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}


