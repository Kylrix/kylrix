'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, IconButton, Slider } from '@mui/material';
import { Play, Pause } from 'lucide-react';

interface VoiceMessageProps {
  url: string;
}

export const VoiceMessage: React.FC<VoiceMessageProps> = ({ url }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      // Some browsers might not provide duration immediately
      if (isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSliderChange = (event: Event, newValue: number | number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newValue as number;
      setCurrentTime(newValue as number);
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <Box 
      onClick={(e) => e.stopPropagation()}
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        p: 1.25, 
        bgcolor: '#1C1A18', // Lifted surface
        borderRadius: '16px',
        border: '1px solid #34322F', // Opaque edge
        minWidth: { xs: 220, sm: 260 },
        maxWidth: 300,
        userSelect: 'none'
      }}
    >
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />
      
      <IconButton 
        onClick={togglePlay}
        size="small"
        sx={{ 
          bgcolor: '#6366F1', // Ecosystem primary
          color: '#fff',
          '&:hover': { 
            bgcolor: '#575CF0',
            transform: 'scale(1.05)'
          },
          transition: 'all 0.2s ease',
          width: 38,
          height: 38,
          flexShrink: 0
        }}
      >
        {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
      </IconButton>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Slider
          size="small"
          value={currentTime}
          max={duration || 100}
          onChange={handleSliderChange}
          sx={{
            color: '#6366F1',
            height: 4,
            padding: '10px 0',
            '& .MuiSlider-thumb': {
              width: 8,
              height: 8,
              transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
              '&:before': {
                boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
              },
              '&:hover, &.Mui-focusVisible': {
                boxShadow: '0px 0px 0px 6px rgba(99, 102, 241, 0.16)',
              },
              '&.Mui-active': {
                width: 12,
                height: 12,
              },
            },
            '& .MuiSlider-rail': {
              opacity: 0.2,
              bgcolor: '#9B9691'
            },
            '& .MuiSlider-track': {
              border: 'none',
            },
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: -1 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366F1', fontFamily: 'var(--font-mono)' }}>
            {formatTime(currentTime)}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 500, color: '#9B9691', fontFamily: 'var(--font-mono)' }}>
            {formatTime(duration)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
