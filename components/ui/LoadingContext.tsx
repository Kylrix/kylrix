'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Backdrop, CircularProgress, Typography, Box } from '@mui/material';

interface LoadingContextType {
  isLoading: boolean;
  message: string;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider = ({ children }: { children: ReactNode }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('Loading...');

  const showLoading = (msg: string = 'Loading...') => {
    setMessage(msg);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  return (
    <LoadingContext.Provider value={{ isLoading, message, showLoading, hideLoading }}>
      {children}
      <Backdrop
        sx={{ 
          color: '#6366F1', 
          zIndex: (theme) => theme.zIndex.drawer + 2000,
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          flexDirection: 'column',
          gap: 3
        }}
        open={isLoading}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress 
            size={64} 
            thickness={2}
            sx={{ 
              color: '#6366F1',
              filter: 'drop-shadow(0 0 10px rgba(99, 102, 241, 0.5))'
            }} 
          />
          <CircularProgress 
            size={48} 
            thickness={2}
            sx={{ 
              color: 'rgba(99, 102, 241, 0.3)',
              position: 'absolute',
              animationDuration: '1.5s',
              animationDirection: 'reverse'
            }} 
          />
        </Box>
        <Typography 
          variant="h6" 
          sx={{ 
            color: 'white', 
            fontWeight: 800,
            fontFamily: 'var(--font-space-grotesk)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase'
          }}
        >
          {message}
        </Typography>
      </Backdrop>
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};
