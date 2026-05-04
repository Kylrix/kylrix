'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { DoodleStroke } from '@/types/notes';
import { Box, Typography, alpha } from '@mui/material';
import { Brush as BrushIcon } from '@mui/icons-material';

interface NoteContentDisplayProps {
  content: string;
  format?: 'text' | 'doodle';
  preview?: boolean;
  onEditDoodle?: () => void;
}

export function NoteContentDisplay({
  content,
  format = 'text',
  preview = false,
  onEditDoodle,
}: NoteContentDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Parse and validate doodle data
  const doodleData = useMemo(() => {
    if (format !== 'doodle' || !content) return null;
    try {
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : null;
    } catch {
      console.error('Invalid doodle data');
      return null;
    }
  }, [content, format]);

  // Render doodle on canvas
  useEffect(() => {
    if (format !== 'doodle' || !doodleData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill black background for consistency
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all strokes
    doodleData.forEach((stroke: DoodleStroke) => {
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
  }, [doodleData, format]);

  // Render based on format
  if (format === 'doodle') {
    if (!doodleData) {
      return (
        <Box sx={{ textAlign: 'center', py: 4, color: 'rgba(255, 255, 255, 0.3)' }}>
          <Typography variant="body2">Invalid doodle data</Typography>
        </Box>
      );
    }

    return (
      <Box 
        sx={{ 
          position: 'relative', 
          borderRadius: '24px', 
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          bgcolor: '#000',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderColor: alpha('#6366F1', 0.3),
            transform: preview ? 'none' : 'scale(1.005)'
          }
        }}
      >
        <canvas
          ref={canvasRef}
          width={preview ? 400 : 1200}
          height={preview ? 300 : 800}
          style={{ 
            width: '100%', 
            height: 'auto', 
            display: 'block',
            cursor: !preview && onEditDoodle ? 'pointer' : 'default'
          }}
          onClick={!preview && onEditDoodle ? onEditDoodle : undefined}
        />
        
        {!preview && onEditDoodle && (
          <Box sx={{ 
            position: 'absolute', 
            inset: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            bgcolor: 'rgba(0, 0, 0, 0)',
            transition: 'background-color 0.3s',
            pointerEvents: 'none',
            '&:hover': {
              bgcolor: 'rgba(0, 0, 0, 0.2)'
            }
          }}>
            <Box sx={{ 
              bgcolor: '#6366F1', 
              color: '#000', 
              px: 2, 
              py: 1, 
              borderRadius: '10px', 
              fontSize: '0.875rem', 
              fontWeight: 800,
              opacity: 0,
              transition: 'opacity 0.3s',
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
              '.MuiBox-root:hover &': { opacity: 1 }
            }}>
              <BrushIcon sx={{ fontSize: 18 }} />
              Edit Doodle
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  // Text format - return raw content for parent to render
  return null;
}

export default NoteContentDisplay;

