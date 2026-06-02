'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, IconButton, Slider } from '@/lib/mui-tailwind/material';
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
      if (isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleSliderChange = (event: any, newValue: number | number[]) => {
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
        gap: 2, 
        py: 0.5,
        minWidth: { xs: 200, sm: 260 },
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
          bgcolor: '#6366F1', 
          color: '#fff',
          '&:hover': { 
            bgcolor: '#575CF0',
            transform: 'scale(1.05)'
          },
          transition: 'all 0.2s ease',
          width: 40,
          height: 40,
          flexShrink: 0
        }}
      >
        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
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
              width: 10,
              height: 10,
              transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
              '&:before': {
                boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
              },
              '&:hover, &.Mui-focusVisible': {
                boxShadow: '0px 0px 0px 6px rgba(99, 102, 241, 0.16)',
              },
            },
            '& .MuiSlider-rail': {
              opacity: 0.15,
              bgcolor: '#9B9691'
            },
            '& .MuiSlider-track': {
              border: 'none',
            },
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: -1.25 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, color: '#6366F1', fontFamily: 'var(--font-mono)' }}>
            {formatTime(currentTime)}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#9B9691', fontFamily: 'var(--font-mono)' }}>
            {formatTime(duration)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};
