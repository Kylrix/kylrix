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
  alpha
} from '@mui/material';
import { Apps, CheckCircle, FiberPin } from '@mui/icons-material';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useTheme } from '@/lib/theme-context';
import toast from 'react-hot-toast';

export default function PinManager() {
  const { isDark } = useTheme();
  const [hasPin, setHasPin] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);

  const textColor = isDark ? 'white' : '#333';

  useEffect(() => {
    setHasPin(ecosystemSecurity.isPinSet());
    setIsUnlocked(ecosystemSecurity.status.isUnlocked);
    
    const interval = setInterval(() => {
      setIsUnlocked(ecosystemSecurity.status.isUnlocked);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSetup = async () => {
    if (pin.length !== 4) {
      toast.error("PIN must be 4 digits");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    setLoading(true);
    try {
      await ecosystemSecurity.setupPinVerifier(pin);
      
      // If unlocked, piggyback now
      if (ecosystemSecurity.status.isUnlocked) {
        await ecosystemSecurity.piggybackSession(pin);
      }
      
      setHasPin(true);
      setShowSetup(false);
      setPin('');
      setConfirmPin('');
      toast.success("PIN setup successfully on this device");
    } catch (_e: unknown) {
      toast.error("Failed to setup PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    if (window.confirm("Are you sure you want to remove your PIN from this device?")) {
      localStorage.removeItem("kylrix_pin_verifier");
      sessionStorage.removeItem("kylrix_ephemeral_session");
      setHasPin(false);
      toast.success("PIN removed");
    }
  };

  return (
    <Box sx={{ p: 1 }}>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ 
            p: 1.5, 
            borderRadius: '12px', 
            bgcolor: hasPin ? alpha('#00F0FF', 0.1) : 'rgba(255,255,255,0.05)',
            color: hasPin ? '#00F0FF' : 'rgba(255,255,255,0.4)',
            border: `1px solid ${hasPin ? alpha('#00F0FF', 0.2) : 'rgba(255,255,255,0.1)'}`
          }}>
            <Apps fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: textColor }}>
                Device Quick PIN
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block' }}>
                Low-friction unlock for this device only.
            </Typography>
          </Box>
        </Box>

        {!showSetup ? (
          <Box>
            {hasPin ? (
              <Stack spacing={2}>
                <Alert 
                  icon={<CheckCircle fontSize="inherit" />} 
                  severity="success"
                  sx={{ 
                    bgcolor: 'rgba(0, 240, 255, 0.05)', 
                    color: '#00F0FF',
                    border: '1px solid rgba(0, 240, 255, 0.1)',
                    '& .MuiAlert-icon': { color: '#00F0FF' }
                  }}
                >
                  Quick PIN is active on this browser.
                </Alert>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowSetup(true)}
                    sx={{ flex: 1, borderRadius: '8px', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    Change PIN
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={handleRemove}
                    sx={{ flex: 1, borderRadius: '8px' }}
                  >
                    Remove
                  </Button>
                </Box>
              </Stack>
            ) : (
              <Button
                fullWidth
                variant="contained"
                startIcon={<FiberPin />}
                onClick={() => setShowSetup(true)}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: 'white',
                  fontWeight: 700,
                  borderRadius: '10px',
                  py: 1.5,
                  border: '1px solid rgba(255,255,255,0.1)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' }
                }}
              >
                Setup Quick PIN
              </Button>
            )}
          </Box>
        ) : (
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 1, display: 'block' }}>
                NEW 4-DIGIT PIN
              </Typography>
              <TextField
                fullWidth
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputProps={{ maxLength: 4, inputMode: 'numeric', style: { textAlign: 'center', letterSpacing: '0.5em' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px'
                  }
                }}
              />
            </Box>
            <Box>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', mb: 1, display: 'block' }}>
                CONFIRM PIN
              </Typography>
              <TextField
                fullWidth
                type="password"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputProps={{ maxLength: 4, inputMode: 'numeric', style: { textAlign: 'center', letterSpacing: '0.5em' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.03)',
                    borderRadius: '10px'
                  }
                }}
              />
            </Box>
            
            {!isUnlocked && (
              <Typography variant="caption" color="warning.main">
                ⚠️ You must unlock your Master Pass to activate the PIN session.
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="text"
                onClick={() => setShowSetup(false)}
                sx={{ flex: 1, color: 'text.secondary' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSetup}
                disabled={loading || pin.length !== 4 || pin !== confirmPin}
                sx={{
                  flex: 2,
                  bgcolor: '#00F0FF',
                  color: '#000',
                  fontWeight: 900,
                  borderRadius: '10px',
                  '&:hover': { bgcolor: '#00d8e6' }
                }}
              >
                {loading ? <CircularProgress size={20} /> : 'Save PIN'}
              </Button>
            </Box>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
