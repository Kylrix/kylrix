"use client";

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  IconButton, 
  Typography, 
  Button, 
  Grid, 
  useTheme,
  InputAdornment
} from '@mui/material';
import { AutoAwesome as SparklesIcon } from '@mui/icons-material';

interface AIHeroInputProps {
  onPromptSelectAction: (prompt: string) => void;
}

const PROMPT_SUGGESTIONS = [
  "Brainstorm creative marketing ideas for a web3 startup",
  "Summarize key insights from my research notes"
];

export function AIHeroInput({ onPromptSelectAction }: AIHeroInputProps) {
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [isActive, setIsActive] = useState(false);
  const _theme = useTheme();

  // Auto-typing animation effect
  useEffect(() => {
    if (isActive) return;

    const typeText = async () => {
      const targetText = PROMPT_SUGGESTIONS[currentSuggestionIndex];
      
      // Typing effect
      for (let i = 0; i <= targetText.length; i++) {
        setDisplayText(targetText.slice(0, i));
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Pause at full text
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Deleting effect
      for (let i = targetText.length; i >= 0; i--) {
        setDisplayText(targetText.slice(0, i));
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      setCurrentSuggestionIndex((prev) => (prev + 1) % PROMPT_SUGGESTIONS.length);
    };

    typeText();
  }, [currentSuggestionIndex, isActive]);

  const handleInputFocus = () => {
    setIsActive(true);
  };

  const handleInputBlur = () => {
    if (!inputValue) {
      setIsActive(false);
      setDisplayText('');
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    setIsActive(true);
    onPromptSelectAction(suggestion);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onPromptSelectAction(inputValue.trim());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: '896px', mx: 'auto' }}>
      {/* Main Input */}
      <Box component="form" onSubmit={handleSubmit} sx={{ position: 'relative', mb: 4 }}>
        <TextField
          fullWidth
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={isActive || inputValue ? '' : displayText}
          variant="outlined"
          InputProps={{
            sx: {
              borderRadius: '32px',
              bgcolor: 'rgba(10, 10, 10, 0.95)',
              backdropFilter: 'blur(25px) saturate(180%)',
              fontSize: '1.25rem',
              py: 1.5,
              px: 3,
              color: 'white',
              fontFamily: 'var(--font-satoshi), sans-serif',
              '& fieldset': {
                borderColor: inputValue ? 'rgba(99, 102, 241, 0.5)' : 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(255, 255, 255, 0.2)',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#6366F1',
                boxShadow: '0 0 30px rgba(99, 102, 241, 0.2)',
              },
              '& input::placeholder': {
                color: 'rgba(255, 255, 255, 0.3)',
                opacity: 1,
                fontStyle: 'italic'
              }
            },
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="submit"
                  disabled={!inputValue.trim()}
                  sx={{
                    bgcolor: inputValue.trim() ? '#6366F1' : 'rgba(255, 255, 255, 0.05)',
                    color: inputValue.trim() ? '#000' : 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '20px',
                    p: 2,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                      bgcolor: inputValue.trim() ? '#00D1DA' : 'rgba(255, 255, 255, 0.1)',
                      transform: 'scale(1.05)',
                    },
                    '&.Mui-disabled': {
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      color: 'rgba(255, 255, 255, 0.1)',
                    }
                  }}
                >
                  <SparklesIcon />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
        
        {/* Typing Cursor */}
        {!isActive && !inputValue && (
          <Box sx={{ 
            position: 'absolute', 
            right: 80, 
            top: '50%', 
            transform: 'translateY(-50%)', 
            width: 2, 
            height: 24, 
            bgcolor: '#6366F1',
            animation: 'pulse 1.5s infinite',
            '@keyframes pulse': {
              '0%': { opacity: 1 },
              '50%': { opacity: 0 },
              '100%': { opacity: 1 }
            }
          }} />
        )}
      </Box>

      {/* Quick Suggestions */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography 
          variant="body2" 
          sx={{ 
            mb: 2.5, 
            fontWeight: 900, 
            color: 'rgba(255, 255, 255, 0.3)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.1em',
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: '0.7rem'
          }}
        >
          Instant create with AI!
        </Typography>
        <Grid container spacing={2}>
          {PROMPT_SUGGESTIONS.map((suggestion, index) => (
            <Grid size={{ xs: 12, md: 6 }} key={index}>
              <Button
                fullWidth
                onClick={() => handleSuggestionClick(suggestion)}
                sx={{
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  p: 2.5,
                  borderRadius: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  bgcolor: 'rgba(255, 255, 255, 0.02)',
                  backdropFilter: 'blur(10px)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  textTransform: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    borderColor: 'rgba(99, 102, 241, 0.5)',
                    bgcolor: 'rgba(99, 102, 241, 0.05)',
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
                    color: '#6366F1'
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Box sx={{ 
                    p: 1, 
                    borderRadius: '12px', 
                    bgcolor: 'rgba(99, 102, 241, 0.1)',
                    color: '#6366F1',
                    display: 'flex',
                    border: '1px solid rgba(99, 102, 241, 0.2)'
                  }}>
                    <SparklesIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Typography 
                    variant="body2" 
                    noWrap 
                    sx={{ 
                      fontWeight: 700, 
                      fontFamily: 'var(--font-satoshi), sans-serif',
                      fontSize: '0.9rem'
                    }}
                  >
                    {suggestion}
                  </Typography>
                </Box>
              </Button>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

