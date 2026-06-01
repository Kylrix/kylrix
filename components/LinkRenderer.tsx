import React, { useState, useEffect, useRef } from 'react';
import { Link, Box, IconButton, Typography, alpha } from '@mui/material';
import { Play, Pause } from 'lucide-react';
import { StorageService } from '@/lib/services/storage';

export function VoiceNotePlayer({ fileId }: { fileId: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const audioUrl = StorageService.getFileView(fileId, 'voice').toString();

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioUrl]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error("Playback failed:", err));
      setIsPlaying(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progress = duration > 0 ? (currentTime / duration) : 0;
  
  // Generating a static pseudo-waveform heights array for visual delight
  const waveHeights = [8, 14, 18, 12, 16, 20, 14, 10, 16, 12];

  return (
    <Box
      onClick={togglePlay}
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.75,
        py: 0.75,
        mx: 0.5,
        bgcolor: '#161412',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '24px',
        verticalAlign: 'middle',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          bgcolor: '#1F1D1B',
          borderColor: 'rgba(255, 255, 255, 0.16)',
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
        },
        '&:active': {
          transform: 'translateY(0)',
        }
      }}
    >
      <IconButton
        size="small"
        onClick={togglePlay}
        sx={{
          p: 0.5,
          bgcolor: isPlaying ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
          color: isPlaying ? '#6366F1' : '#fff',
          border: `1px solid ${isPlaying ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
          '&:hover': {
            bgcolor: isPlaying ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.1)',
          }
        }}
      >
        {isPlaying ? <Pause size={14} fill={isPlaying ? '#6366F1' : 'none'} /> : <Play size={14} fill="#fff" />}
      </IconButton>

      {/* Pseudo-Waveform Display */}
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: '3px', height: 20 }}>
        {waveHeights.map((height, idx) => {
          const threshold = (idx / waveHeights.length);
          const active = progress >= threshold;
          return (
            <Box
              key={idx}
              component="span"
              sx={{
                width: '3px',
                height: `${height}px`,
                borderRadius: '1px',
                bgcolor: active ? '#6366F1' : 'rgba(255, 255, 255, 0.15)',
                boxShadow: active ? '0 0 8px rgba(99, 102, 241, 0.5)' : 'none',
                transition: 'all 0.15s ease-in-out',
                // Wave micro-animation if playing
                animation: isPlaying && active ? `wavePulse 1.2s ease-in-out infinite alternate` : 'none',
                animationDelay: `${idx * 0.1}s`,
              }}
            />
          );
        })}
      </Box>

      <Typography
        variant="caption"
        component="span"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.72rem',
          fontWeight: 700,
          color: isPlaying ? '#6366F1' : 'rgba(255, 255, 255, 0.65)',
          minWidth: 60,
          textAlign: 'right',
          display: 'inline-block'
        }}
      >
        {formatTime(currentTime)} / {formatTime(duration)}
      </Typography>

      <style>{`
        @keyframes wavePulse {
          0% { transform: scaleY(1); }
          100% { transform: scaleY(1.4); }
        }
      `}</style>
    </Box>
  );
}

/**
 * Custom link component for ReactMarkdown that styles links in Electric Teal
 * Intercepts voice: schema to render high-fidelity audio voice note players inline.
 */
export function LinkComponent({ href, children }: { href?: string; children?: React.ReactNode }) {
  if (!href) return <span>{children}</span>;

  if (href.startsWith('voice:')) {
    const fileId = href.replace('voice:', '');
    return <VoiceNotePlayer fileId={fileId} />;
  }
  
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        color: '#6366F1',
        textDecoration: 'none',
        fontWeight: 700,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderBottom: '1px solid transparent',
        '&:hover': {
          color: alpha('#6366F1', 0.8),
          borderBottomColor: alpha('#6366F1', 0.4),
          bgcolor: alpha('#6366F1', 0.05),
          borderRadius: '4px',
          px: 0.5,
          mx: -0.5
        }
      }}
    >
      {children}
    </Link>
  );
}
