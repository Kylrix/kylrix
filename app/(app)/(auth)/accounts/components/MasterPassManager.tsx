'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Stack, 
  Alert, 
  CircularProgress,
} from '@mui/material';
import { Lock, Shield, CheckCircle } from '@mui/icons-material';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { AppwriteService } from '@/lib/appwrite';
import { useTheme } from '@/lib/theme-context';

export default function MasterPassManager({ userId }: { userId: string }) {
  const { isDark: _isDark } = useTheme();
  const [hasPass, setHasPass] = useState<boolean | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = React.useCallback(async () => {
    const status = await AppwriteService.hasMasterpass(userId);
    setHasPass(status);
    setIsUnlocked(ecosystemSecurity.status.isUnlocked);
  }, [userId]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(() => {
      setIsUnlocked(ecosystemSecurity.status.isUnlocked);
    }, 1000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await AppwriteService.listKeychainEntries(userId);
      const passwordEntry = entries.find(e => e.type === 'password');
      
      if (!passwordEntry) {
        setError("No Master Pass discovered. Please set it up first.");
        setLoading(false);
        return;
      }

      const success = await ecosystemSecurity.unlock(password, passwordEntry);
      if (success) {
        setPassword('');
        setIsUnlocked(true);
      } else {
        setError("Invalid Master Pass. Please try again.");
      }
    } catch (_e: unknown) {
      setError("An error occurred during unlock.");
    } finally {
      setLoading(false);
    }
    };

    if (hasPass === null) return <CircularProgress size={20} />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          backgroundColor: '#161514',
          borderRadius: '12px',
          p: 3,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 2,
          transition: 'all 0.2s ease-out',
          '&:hover': {
            backgroundColor: '#1F1D1B',
          },
        }}
      >
        <Box sx={{ 
          p: 1.5, 
          borderRadius: '10px', 
          bgcolor: isUnlocked ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.08)',
          color: isUnlocked ? '#6366F1' : 'rgba(255,255,255,0.5)',
          border: `1px solid ${isUnlocked ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Shield fontSize="medium" />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF' }}>
            Ecosystem Master Pass
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>
            {isUnlocked 
                ? "Your session is secured. Vault-dependent features are active." 
                : "Unlock your global vault to access encrypted data."}
          </Typography>
        </Box>
      </Box>

      {isUnlocked ? (
          <Alert 
              icon={<CheckCircle fontSize="inherit" />} 
              severity="success"
              sx={{ 
                  bgcolor: 'rgba(34, 197, 94, 0.1)', 
                  color: '#22c55e',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '12px',
                  '& .MuiAlert-icon': { color: '#22c55e' }
              }}
          >
              Vault is currently unlocked for this session.
          </Alert>
      ) : (
          <Stack spacing={2}>
              <TextField
                fullWidth
                type="password"
                placeholder="Enter your Master Pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: '#161514',
                    borderRadius: '8px',
                    '& fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#6366F1',
                    },
                  },
                  '& .MuiOutlinedInput-input::placeholder': {
                    color: 'rgba(255, 255, 255, 0.4)',
                    opacity: 1,
                  },
                }}
              />
              {error && <Typography sx={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</Typography>}
              <Button
                fullWidth
                variant="contained"
                onClick={handleUnlock}
                disabled={loading || !password}
                startIcon={loading ? <CircularProgress size={16} /> : <Lock />}
                sx={{
                  bgcolor: '#6366F1',
                  color: 'white',
                  fontWeight: 600,
                  borderRadius: '8px',
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  '&:hover': { bgcolor: '#4F46E5' },
                  '&:disabled': { opacity: 0.5 },
                }}
              >
                {loading ? 'Unlocking...' : 'Unlock Ecosystem Vault'}
              </Button>
          </Stack>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>
              Session State Management
          </Typography>
          <Button 
              size="small" 
              disabled={!isUnlocked}
              onClick={() => ecosystemSecurity.lock()}
              sx={{ 
                  fontWeight: 600,
                  color: '#ef4444',
                  textTransform: 'none',
                  fontSize: '0.875rem',
              }}
          >
              Lock Session Now
          </Button>
      </Box>
    </Box>
  );
}
