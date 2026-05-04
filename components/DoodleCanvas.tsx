'use client';

import React, { useRef, useState, useEffect } from 'react';
import { DoodleStroke } from '@/types/notes';
import { 
  Box, 
  Typography, 
  Button, 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Stack, 
  Slider, 
  Paper,
  alpha,
  Tooltip
} from '@mui/material';
import { 
  Close as CloseIcon, 
  Fullscreen as FullscreenIcon, 
  FullscreenExit as FullscreenExitIcon, 
  Undo as UndoIcon, 
  Delete as DeleteIcon, 
  Save as SaveIcon,
  PictureInPictureAlt as PipIcon
} from '@mui/icons-material';

interface DoodleCanvasProps {
  initialData?: string;
  onSave: (data: string) => void;
  onClose: () => void;
}

type ModalMode = 'modal' | 'pip' | 'fullscreen';

export default function DoodleCanvas({ initialData, onSave, onClose }: DoodleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<DoodleStroke[]>([]);
  const [color, setColor] = useState('#6366F1');
  const [size, setSize] = useState(3);
  const [mode, setMode] = useState<ModalMode>('modal');
  const [pipPosition, setPipPosition] = useState({ x: 20, y: 20 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const redrawCanvas = (strokesData: DoodleStroke[] = strokes) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    strokesData.forEach((stroke) => {
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

  // Initialize canvas with existing data
  useEffect(() => {
    if (initialData) {
      try {
        const data = JSON.parse(initialData);
        setStrokes(data);
        redrawCanvas(data);
      } catch {
        console.error('Failed to parse doodle data');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData]);

  useEffect(() => {
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setStrokes((prev) => [
      ...prev,
      { points: [[x, y]], color, size, opacity: 1 },
    ]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStrokes((prev) => {
      const updated = [...prev];
      const lastStroke = updated[updated.length - 1];
      if (lastStroke) {
        lastStroke.points.push([x, y]);
      }
      return updated;
    });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleSave = () => {
    onSave(JSON.stringify(strokes));
    onClose();
  };

  const handleClear = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleUndo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handlePipDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-pip-drag]')) {
      setIsDraggingPip(true);
      dragOffset.current = {
        x: e.clientX - pipPosition.x,
        y: e.clientY - pipPosition.y,
      };
    }
  };

  const handlePipDrag = (e: React.MouseEvent) => {
    if (!isDraggingPip) return;

    const newX = Math.max(0, e.clientX - dragOffset.current.x);
    const newY = Math.max(0, e.clientY - dragOffset.current.y);

    setPipPosition({ x: newX, y: newY });
  };

  const handlePipDragEnd = () => {
    setIsDraggingPip(false);
  };

  const Controls = ({ isPip = false }: { isPip?: boolean }) => (
    <Stack 
      direction={isPip ? "column" : "row"} 
      spacing={3} 
      alignItems="center" 
      sx={{ width: '100%', flexWrap: 'wrap' }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="caption" sx={{ fontWeight: 900, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>COLOR</Typography>
        <Box 
          component="input"
          type="color"
          value={color}
          onChange={(e: any) => setColor(e.target.value)}
          sx={{ 
            width: 36, 
            height: 36, 
            border: '2px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '10px', 
            cursor: 'pointer',
            bgcolor: 'transparent',
            p: 0.5,
            '&::-webkit-color-swatch-wrapper': { p: 0 },
            '&::-webkit-color-swatch': { border: 'none', borderRadius: '6px' }
          }}
        />
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 200 }}>
        <Typography variant="caption" sx={{ fontWeight: 900, color: '#6366F1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>SIZE</Typography>
        <Slider
          value={size}
          min={1}
          max={20}
          onChange={(_: any, val: any) => setSize(val)}
          sx={{ 
            color: '#6366F1',
            '& .MuiSlider-thumb': { 
              width: 16, 
              height: 16,
              '&:hover, &.Mui-focusVisible': {
                boxShadow: `0 0 0 8px ${alpha('#6366F1', 0.16)}`
              }
            },
            '& .MuiSlider-rail': { bgcolor: 'rgba(255, 255, 255, 0.1)', opacity: 1 },
            '& .MuiSlider-track': { border: 'none' }
          }}
        />
        <Typography variant="caption" sx={{ color: 'white', fontWeight: 800, minWidth: 32, textAlign: 'right' }}>{size}px</Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} sx={{ ml: 'auto' }}>
        <Tooltip title="Undo">
          <IconButton 
            onClick={handleUndo} 
            size="small" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.4)', 
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.08)' } 
            }}
          >
            <UndoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear">
          <IconButton 
            onClick={handleClear} 
            size="small" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.4)', 
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              '&:hover': { color: '#FF3B30', bgcolor: alpha('#FF3B30', 0.1) } 
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Stack>
  );

  if (mode === 'pip') {
    return (
      <Paper
        sx={{
          position: 'fixed',
          left: pipPosition.x,
          top: pipPosition.y,
          zIndex: 2000,
          width: 360,
          bgcolor: 'rgba(15, 13, 12, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          backgroundImage: 'none'
        }}
        onMouseMove={handlePipDrag}
        onMouseUp={handlePipDragEnd}
        onMouseLeave={handlePipDragEnd}
      >
        <Box 
          data-pip-drag
          onMouseDown={handlePipDragStart}
          sx={{ 
            p: 2, 
            bgcolor: 'rgba(255, 255, 255, 0.03)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            cursor: 'move',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 900, color: '#6366F1', letterSpacing: '0.1em' }}>DOODLE PIP</Typography>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" onClick={() => setMode('modal')} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: 'white' } }}>
              <FullscreenIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255, 255, 255, 0.4)', '&:hover': { color: '#FF3B30' } }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
        <Box sx={{ bgcolor: '#000', aspectRatio: '16/9', position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={360}
            height={202}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
          />
        </Box>
        <Box sx={{ p: 2.5 }}>
          <Controls isPip />
          <Button 
            fullWidth 
            variant="contained" 
            onClick={handleSave}
            sx={{ 
              mt: 2.5, 
              bgcolor: '#6366F1', 
              color: '#000', 
              fontWeight: 900, 
              borderRadius: '12px',
              py: 1,
              '&:hover': { bgcolor: alpha('#6366F1', 0.8) }
            }}
          >
            Save Doodle
          </Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth={mode === 'fullscreen' ? false : 'lg'}
      fullScreen={mode === 'fullscreen'}
      PaperProps={{
        sx: {
          bgcolor: 'rgba(15, 13, 12, 0.95)',
          backdropFilter: 'blur(25px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: mode === 'fullscreen' ? 0 : '32px',
          backgroundImage: 'none',
          color: 'white',
          maxHeight: '95vh',
          boxShadow: '0 48px 96px rgba(0,0,0,0.8)'
        }
      }}
    >
      <DialogTitle sx={{ 
        p: 3, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#6366F1', boxShadow: '0 0 12px #6366F1' }} />
          <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.03em' }}>
            Doodle Canvas {mode === 'fullscreen' && <Box component="span" sx={{ color: 'rgba(255, 255, 255, 0.3)', ml: 1 }}>/ Fullscreen</Box>}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Tooltip title={mode === 'fullscreen' ? "Exit Fullscreen" : "Fullscreen"}>
            <IconButton 
              onClick={() => setMode(mode === 'fullscreen' ? 'modal' : 'fullscreen')}
              sx={{ color: 'rgba(255, 255, 255, 0.4)', bgcolor: 'rgba(255, 255, 255, 0.03)', '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.08)' } }}
            >
              {mode === 'fullscreen' ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Minimize to PIP">
            <IconButton 
              onClick={() => setMode('pip')}
              sx={{ color: 'rgba(255, 255, 255, 0.4)', bgcolor: 'rgba(255, 255, 255, 0.03)', '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.08)' } }}
            >
              <PipIcon />
            </IconButton>
          </Tooltip>
          <IconButton 
            onClick={onClose}
            sx={{ color: 'rgba(255, 255, 255, 0.4)', bgcolor: 'rgba(255, 255, 255, 0.03)', '&:hover': { color: '#FF3B30', bgcolor: alpha('#FF3B30', 0.1) } }}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: 4, bgcolor: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ 
          width: '100%', 
          height: mode === 'fullscreen' ? 'calc(100vh - 240px)' : 600,
          bgcolor: '#000',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)'
        }}>
          <canvas
            ref={canvasRef}
            width={mode === 'fullscreen' ? 1920 : 1200}
            height={mode === 'fullscreen' ? 1080 : 800}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            style={{ 
              width: '100%', 
              height: '100%', 
              cursor: 'crosshair',
              display: 'block'
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ 
        p: 4, 
        flexDirection: 'column', 
        gap: 4,
        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <Controls />
        <Stack direction="row" spacing={2} sx={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button 
            onClick={onClose}
            sx={{ 
              color: 'rgba(255, 255, 255, 0.5)', 
              fontWeight: 800,
              px: 3,
              '&:hover': { color: 'white', bgcolor: 'rgba(255, 255, 255, 0.05)' }
            }}
          >
            Discard Changes
          </Button>
          <Button 
            variant="contained"
            onClick={handleSave}
            startIcon={<SaveIcon />}
            sx={{ 
              bgcolor: '#6366F1', 
              color: '#000', 
              fontWeight: 900, 
              borderRadius: '16px',
              px: 5,
              py: 1.5,
              fontSize: '1rem',
              '&:hover': { 
                bgcolor: alpha('#6366F1', 0.8),
                transform: 'translateY(-2px)',
                boxShadow: `0 8px 24px ${alpha('#6366F1', 0.4)}`
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            Save Doodle
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}


