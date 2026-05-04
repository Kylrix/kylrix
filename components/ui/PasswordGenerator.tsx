"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Slider,
  TextField,
  IconButton,
  Stack,
  Switch,
  FormControlLabel,
  Paper,
  alpha,
  List,
  ListItem,
  Tooltip,
} from "@mui/material";
import {
  ContentCopy as ContentCopyIcon,
  Refresh as RefreshIcon,
  History as HistoryIcon,
} from "@mui/icons-material";
import { generateRandomPassword } from "@/utils/password";
import toast from "react-hot-toast";

export default function PasswordGenerator() {
  const [length, setLength] = useState(16);
  const [password, setPassword] = useState(() => generateRandomPassword(16));
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ value: string; ts: number }[]>([]);
  
  useEffect(() => {
    const newPassword = generateRandomPassword(length);
    setPassword(newPassword);
  }, [length]);

  const handleGenerate = () => {
    const newPassword = generateRandomPassword(length);
    setPassword(newPassword);
    setCopied(false);
    setHistory((prev) => {
      const next = [{ value: newPassword, ts: Date.now() }, ...prev];
      return next.slice(0, 20);
    });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
    toast.success("Copied to clipboard", {
      style: {
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(25px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        color: 'white'
      }
    });
  };

  const handleLengthChange = (_: any, val: number | number[]) => {
    setLength(val as number);
  };

  return (
    <Paper sx={{ 
      p: 4, 
      width: '100%', 
      maxWidth: 420, 
      bgcolor: '#161412', 
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '32px',
      backgroundImage: 'none',
      boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
    }}>
      <Stack spacing={3.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, fontFamily: 'var(--font-clash)', letterSpacing: '-0.02em', textTransform: 'uppercase', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)' }}>
            Password Generator
          </Typography>
          <FormControlLabel
            control={
              <Switch 
                size="small" 
                checked={showHistory} 
                onChange={(e) => setShowHistory(e.target.checked)}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#10B981' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#10B981' }
                }}
              />
            }
            label={<Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)', letterSpacing: '0.05em' }}>HISTORY</Typography>}
            labelPlacement="start"
          />
        </Box>

        <Box sx={{ position: 'relative' }}>
          <TextField
            fullWidth
            value={password}
            variant="outlined"
            InputProps={{
              readOnly: true,
              sx: {
                fontFamily: 'var(--font-mono)',
                fontSize: '1.15rem',
                bgcolor: '#1C1A18',
                borderRadius: '20px',
                color: '#10B981',
                fontWeight: 600,
                '& fieldset': { border: '1px solid rgba(255, 255, 255, 0.05)' },
                '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                '&.Mui-focused fieldset': { borderColor: '#10B981' },
                pr: 10
              }
            }}
          />
          <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <Tooltip title="Copy">
              <IconButton onClick={handleCopy} size="small" sx={{ color: copied ? '#10B981' : 'rgba(255, 255, 255, 0.3)' }}>
                <ContentCopyIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Regenerate">
              <IconButton onClick={handleGenerate} size="small" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Box sx={{ px: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'rgba(255, 255, 255, 0.3)', letterSpacing: '0.1em' }}>LENGTH</Typography>
            <Typography variant="caption" sx={{ fontWeight: 900, color: '#10B981', fontFamily: 'var(--font-mono)' }}>{length} CHR</Typography>
          </Box>
          <Slider
            value={length}
            min={8}
            max={64}
            onChange={handleLengthChange}
            sx={{
              color: '#10B981',
              height: 6,
              '& .MuiSlider-thumb': {
                width: 20,
                height: 20,
                bgcolor: '#10B981',
                border: '4px solid #161412',
                '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 8px rgba(16, 185, 129, 0.16)' }
              },
              '& .MuiSlider-track': { border: 'none' },
              '& .MuiSlider-rail': { opacity: 0.1, bgcolor: 'white' }
            }}
          />
        </Box>

        <Stack spacing={1.5}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleGenerate}
            sx={{
              bgcolor: '#10B981',
              color: '#000',
              fontWeight: 900,
              borderRadius: '18px',
              py: 2,
              fontFamily: 'var(--font-clash)',
              fontSize: '0.9rem',
              letterSpacing: '0.02em',
              '&:hover': { bgcolor: '#059669', transform: 'translateY(-1px)' },
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            Generate Password
          </Button>
        </Stack>

        {showHistory && (
          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <HistoryIcon sx={{ fontSize: 14, color: "rgba(255, 255, 255, 0.4)" }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'rgba(255, 255, 255, 0.4)' }}>RECENT PASSWORDS</Typography>
            </Stack>
            {history.length === 0 ? (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontStyle: 'italic' }}>No history yet.</Typography>
            ) : (
              <List sx={{ p: 0, maxHeight: 160, overflowY: 'auto' }}>
                {history.map((item, i) => (
                  <ListItem
                    key={i}
                    sx={{
                      px: 1.5,
                      py: 1,
                      borderRadius: '10px',
                      mb: 0.5,
                      bgcolor: 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' }
                    }}
                  >
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography variant="body2" sx={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.value}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '0.65rem' }}>
                        {new Date(item.ts).toLocaleTimeString()}
                      </Typography>
                    </Box>
                    <IconButton 
                      size="small" 
                      onClick={() => {
                        navigator.clipboard.writeText(item.value);
                        toast.success("Copied from history");
                      }}
                      sx={{ color: 'rgba(255, 255, 255, 0.3)' }}
                    >
                      <ContentCopyIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
