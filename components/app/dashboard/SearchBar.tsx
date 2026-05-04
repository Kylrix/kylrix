import { useEffect, useRef, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useAI } from '@/context/AIContext";
import { 
  Box, 
  TextField, 
  InputAdornment, 
  IconButton, 
  Button,
  alpha,
  useTheme
} from "@mui/material";

export default function SearchBar({
  onSearch,
  delay = 150,
  onSmartOrganize,
}: {
  onSearch: (term: string) => void;
  delay?: number;
  onSmartOrganize?: () => void;
}) {
  const theme = useTheme();
  const [value, setValue] = useState("");
  const timer = useRef<number | null>(null);
  const { isLoading } = useAI();

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const handleChange = (v: string) => {
    setValue(v);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onSearch(v), delay);
  };

  const handleClear = () => {
    setValue("");
    onSearch("");
  };

  return (
    <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
      <TextField
        fullWidth
        placeholder="Search passwords, usernames..."
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        variant="filled"
        InputProps={{
          disableUnderline: true,
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
            </InputAdornment>
          ),
          endAdornment: value && (
            <InputAdornment position="end">
              <IconButton onClick={handleClear} size="small">
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </InputAdornment>
          ),
          sx: {
            height: 48,
            borderRadius: '24px',
            bgcolor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            px: 1,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.15)'
            },
            '&.Mui-focused': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'primary.main',
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
            }
          }
        }}
      />
      
      {onSmartOrganize && (
        <Button
          variant="outlined"
          onClick={onSmartOrganize}
          disabled={isLoading}
          startIcon={<AutoAwesomeIcon sx={{ fontSize: 18 }} />}
          sx={{
            height: 48,
            borderRadius: '24px',
            px: 3,
            display: { xs: 'none', md: 'flex' },
            whiteSpace: 'nowrap',
            fontWeight: 700,
            borderColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: alpha(theme.palette.primary.main, 0.05)
            }
          }}
        >
          Organize
        </Button>
      )}
    </Box>
  );
}
