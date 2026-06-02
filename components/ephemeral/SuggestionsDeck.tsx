'use client';

import React from 'react';
import { Box, Typography, Button, IconButton, Paper } from '@/lib/mui-tailwind/material';
import { Close as CloseIcon, LightbulbOutlined as IdeaIcon } from '@/lib/mui-tailwind/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useLocalContext } from '@/lib/context-engine';

export function SuggestionsDeck() {
  const router = useRouter();
  const { suggestions, dismissSuggestion } = useLocalContext();

  if (suggestions.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 100, md: 40 },
        right: { xs: 16, md: 40 },
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        maxWidth: 360,
        width: 'calc(100vw - 32px)',
        pointerEvents: 'none'
      }}
    >
      <AnimatePresence>
        {suggestions.map((suggestion) => (
          <motion.div
            key={suggestion.id}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
            style={{ pointerEvents: 'auto' }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                bgcolor: '#141312',
                border: '1px solid #232220',
                borderRadius: '16px',
                position: 'relative',
                boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                backgroundImage: 'none',
                overflow: 'hidden'
              }}
            >
              {/* Opaque side indicator block */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  bottom: 0,
                  width: 4,
                  bgcolor: suggestion.niche === 'connect' 
                    ? '#10B981' // Green for Connect
                    : suggestion.niche === 'intelligence' 
                    ? '#6366F1' // Purple for Intelligence/Assistants
                    : '#F59E0B' // Orange for Productivity
                }}
              />

              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, pl: 0.5 }}>
                <IdeaIcon 
                  sx={{ 
                    color: suggestion.niche === 'connect' 
                      ? '#10B981' 
                      : suggestion.niche === 'intelligence' 
                      ? '#6366F1' 
                      : '#F59E0B',
                    fontSize: 20,
                    mt: 0.2
                  }} 
                />
                
                <Box sx={{ flex: 1, pr: 2 }}>
                  <Typography 
                    variant="body2" 
                    fontWeight={800} 
                    sx={{ color: '#FFFFFF', mb: 0.5, fontFamily: 'Satoshi, sans-serif' }}
                  >
                    {suggestion.title}
                  </Typography>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: '#A2A09B', 
                      display: 'block', 
                      lineHeight: 1.4,
                      fontFamily: 'Satoshi, sans-serif',
                      mb: 2 
                    }}
                  >
                    {suggestion.description}
                  </Typography>

                  {suggestion.actionLabel && suggestion.actionHref && (
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        dismissSuggestion(suggestion.id);
                        router.push(suggestion.actionHref!);
                      }}
                      sx={{
                        bgcolor: '#272624',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        fontSize: '11px',
                        textTransform: 'none',
                        borderRadius: '8px',
                        px: 2,
                        py: 0.5,
                        border: '1px solid #363532',
                        '&:hover': {
                          bgcolor: '#32312E',
                          borderColor: '#4A4844'
                        }
                      }}
                    >
                      {suggestion.actionLabel}
                    </Button>
                  )}
                </Box>
              </Box>

              <IconButton
                size="small"
                onClick={() => dismissSuggestion(suggestion.id)}
                sx={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  color: 'rgba(255, 255, 255, 0.3)',
                  '&:hover': {
                    color: 'rgba(255, 255, 255, 0.8)',
                    bgcolor: 'rgba(255, 255, 255, 0.05)'
                  }
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Paper>
          </motion.div>
        ))}
      </AnimatePresence>
    </Box>
  );
}
