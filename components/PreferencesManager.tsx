'use client';

import { useState, useEffect } from 'react';
import { account, AppwriteService } from '@/lib/appwrite';
import { useTheme } from '@/lib/theme-context';
import {
  Box,
  Typography,
  Select,
  MenuItem,
  Switch,
  Alert,
  AlertTitle,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material';

interface PrefsData {
  language?: string;
  timezone?: string;
  theme?: 'light' | 'dark' | 'system';
  emailNotifications?: boolean;
  sessionReminders?: boolean;
  dataCollection?: boolean;
  marketingEmails?: boolean;
  publicProfile?: boolean;
}

interface PreferencesManagerProps {
  onSave?: () => void;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'US/Eastern', label: 'Eastern Time' },
  { value: 'US/Central', label: 'Central Time' },
  { value: 'US/Mountain', label: 'Mountain Time' },
  { value: 'US/Pacific', label: 'Pacific Time' },
  { value: 'Europe/London', label: 'London' },
  { value: 'Europe/Paris', label: 'Paris' },
  { value: 'Europe/Berlin', label: 'Berlin' },
  { value: 'Asia/Tokyo', label: 'Tokyo' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Asia/Dubai', label: 'Dubai' },
  { value: 'Australia/Sydney', label: 'Sydney' },
];

export default function PreferencesManager({ onSave }: PreferencesManagerProps) {
  const { setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allPrefs, setAllPrefs] = useState<Record<string, any>>({});
  const [prefs, setPrefs] = useState<PrefsData>({
    language: 'en',
    timezone: 'UTC',
    theme: 'system',
    emailNotifications: true,
    sessionReminders: true,
    dataCollection: false,
    marketingEmails: false,
    publicProfile: true,
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError(null);
      const appPrefs = await account.getPrefs();
      setAllPrefs(appPrefs || {});
      setPrefs({
        language: appPrefs?.language || 'en',
        timezone: appPrefs?.timezone || 'UTC',
        theme: appPrefs?.theme || 'system',
        emailNotifications: appPrefs?.emailNotifications !== false,
        sessionReminders: appPrefs?.sessionReminders !== false,
        dataCollection: appPrefs?.dataCollection === true,
        marketingEmails: appPrefs?.marketingEmails === true,
        publicProfile: appPrefs?.publicProfile !== false,
      });
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof PrefsData, value: any) => {
    try {
      setError(null);
      const updatedUIPrefs = { ...prefs, [key]: value };
      setPrefs(updatedUIPrefs);
      
      // Merge with ALL existing prefs
      const updatedAllPrefs = { ...allPrefs, [key]: value };
      setAllPrefs(updatedAllPrefs);
      
      await account.updatePrefs(updatedAllPrefs);

      // Sync to global directory if discoverability changed
      if (key === 'publicProfile' || key === 'language') {
        const user = await account.get();
        await AppwriteService.syncGlobalProfile(user, updatedAllPrefs);
      }

      onSave?.();
    } catch (_err: unknown) {
      const err = _err as Error;
      setError(err.message);
      // Reload from server on error
      loadPreferences();
    }
  };

  const _handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    try {
      setError(null);
      const updatedUIPrefs = { ...prefs, theme: newTheme };
      setPrefs(updatedUIPrefs);
      
      // Merge with ALL existing prefs
      const updatedAllPrefs = { ...allPrefs, theme: newTheme };
      setAllPrefs(updatedAllPrefs);
      
      await account.updatePrefs(updatedAllPrefs);
      await setTheme(newTheme);
      onSave?.();
    } catch (_err: unknown) {
      const err = _err as Error;
      setError(err.message);
      // Reload from server on error
      loadPreferences();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={40} sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3, 
            borderRadius: '12px',
            bgcolor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#FCA5A5',
          }}
        >
          <AlertTitle sx={{ fontWeight: 700 }}>Error</AlertTitle>
          {error}
        </Alert>
      )}

      <Stack spacing={3}>
        {/* Localization Settings */}
        <Box>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, mb: 2, color: 'white' }}>
            Language & Timezone
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', mb: 1, fontWeight: 500 }}>
                Language
              </Typography>
              <Select
                value={prefs.language || 'en'}
                onChange={(event) => updatePreference('language', event.target.value)}
                sx={{
                  backgroundColor: '#161514',
                  color: 'white',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#6366F1',
                  },
                  '& .MuiSvgIcon-root': {
                    color: '#6366F1',
                  },
                }}
              >
                {LANGUAGES.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.label}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Box>
              <Typography sx={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)', mb: 1, fontWeight: 500 }}>
                Timezone
              </Typography>
              <Select
                value={prefs.timezone || 'UTC'}
                onChange={(event) => updatePreference('timezone', event.target.value)}
                sx={{
                  backgroundColor: '#161514',
                  color: 'white',
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#6366F1',
                  },
                  '& .MuiSvgIcon-root': {
                    color: '#6366F1',
                  },
                }}
              >
                {TIMEZONES.map((tz) => (
                  <MenuItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

        {/* Discoverability Settings */}
        <Box>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, mb: 2, color: 'white' }}>
            Discoverability
          </Typography>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 3,
                backgroundColor: '#161514',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: '#1F1D1B',
                }
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>
                  Public Profile
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                  Allow other users to find you by name or username
                </Typography>
              </Box>
              <Switch
                checked={prefs.publicProfile !== false}
                onChange={(event) => updatePreference('publicProfile', event.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366F1' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366F1',
                  },
                }}
              />
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

        {/* Notification Settings */}
        <Box>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, mb: 2, color: 'white' }}>
            Notifications
          </Typography>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 3,
                backgroundColor: '#161514',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: '#1F1D1B',
                }
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>
                  Email Notifications
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                  Receive emails about account activity
                </Typography>
              </Box>
              <Switch
                checked={prefs.emailNotifications !== false}
                onChange={(event) => updatePreference('emailNotifications', event.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366F1' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366F1',
                  },
                }}
              />
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 3,
                backgroundColor: '#161514',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: '#1F1D1B',
                }
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>
                  Session Reminders
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                  Get reminded about active sessions
                </Typography>
              </Box>
              <Switch
                checked={prefs.sessionReminders !== false}
                onChange={(event) => updatePreference('sessionReminders', event.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366F1' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366F1',
                  },
                }}
              />
            </Box>
          </Stack>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.05)' }} />

        {/* Privacy Settings */}
        <Box>
          <Typography sx={{ fontSize: '1.125rem', fontWeight: 600, mb: 2, color: 'white' }}>
            Privacy & Data
          </Typography>
          <Stack spacing={2}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 3,
                backgroundColor: '#161514',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: '#1F1D1B',
                }
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>
                  Data Collection
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                  Allow collection of usage analytics
                </Typography>
              </Box>
              <Switch
                checked={prefs.dataCollection === true}
                onChange={(event) => updatePreference('dataCollection', event.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366F1' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366F1',
                  },
                }}
              />
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 3,
                backgroundColor: '#161514',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                transition: 'all 0.2s ease-out',
                '&:hover': {
                  backgroundColor: '#1F1D1B',
                }
              }}
            >
              <Box>
                <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: 'white' }}>
                  Marketing Emails
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', mt: 0.5 }}>
                  Receive promotional and marketing emails
                </Typography>
              </Box>
              <Switch
                checked={prefs.marketingEmails === true}
                onChange={(event) => updatePreference('marketingEmails', event.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#6366F1' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366F1',
                  },
                }}
              />
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}
