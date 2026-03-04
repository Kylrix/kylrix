'use client';

import React from 'react';
import { 
  Box, 
  Typography, 
  Stack, 
  Tooltip, 
  IconButton, 
  alpha, 
  useTheme,
  Button
} from '@mui/material';
import { useDocs, DocLanguage } from '@/context/DocsContext';
import { Terminal, Code, Cpu, Package } from 'lucide-react';

const LANGUAGE_CONFIG: Record<DocLanguage, { label: string; icon: any; color: string }> = {
  typescript: { label: 'TypeScript', icon: Code, color: '#3178C6' },
  go: { label: 'Go', icon: Cpu, color: '#00ADD8' },
  python: { label: 'Python', icon: Package, color: '#3776AB' },
  dart: { label: 'Dart', icon: Terminal, color: '#0175C2' }
};

export const LanguageSwitcher = () => {
  const { language, setLanguage } = useDocs();
  const theme = useTheme();

  return (
    <Stack 
      direction="row" 
      spacing={1} 
      sx={{ 
        p: 0.5, 
        bgcolor: alpha(theme.palette.text.primary, 0.03), 
        borderRadius: '12px',
        border: `1px solid ${alpha(theme.palette.text.primary, 0.05)}`,
        width: 'fit-content'
      }}
    >
      {(Object.entries(LANGUAGE_CONFIG) as [DocLanguage, typeof LANGUAGE_CONFIG.typescript][]).map(([key, config]) => (
        <Tooltip key={key} title={config.label}>
          <Button
            size="small"
            onClick={() => setLanguage(key)}
            sx={{
              minWidth: 40,
              height: 32,
              borderRadius: '8px',
              color: language === key ? 'white' : alpha(theme.palette.text.primary, 0.4),
              bgcolor: language === key ? config.color : 'transparent',
              '&:hover': {
                bgcolor: language === key ? config.color : alpha(theme.palette.text.primary, 0.05),
                opacity: 0.9
              },
              fontSize: '0.7rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {key === 'typescript' ? 'TS' : config.label}
          </Button>
        </Tooltip>
      ))}
    </Stack>
  );
};

interface CodeBlockProps {
  languages: Partial<Record<DocLanguage, string>>;
}

export const CodeBlock = ({ languages }: CodeBlockProps) => {
  const { language } = useDocs();
  const theme = useTheme();
  
  const currentCode = languages[language] || languages['typescript'] || 'Code not available for this language.';

  return (
    <Box 
      sx={{ 
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
        bgcolor: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <Box 
        sx={{ 
          px: 3, 
          py: 1.5, 
          bgcolor: 'rgba(255,255,255,0.02)', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant="caption" sx={{ fontFamily: 'JetBrains Mono', color: '#6366F1', fontWeight: 700, opacity: 0.8 }}>
          {LANGUAGE_CONFIG[language].label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FF5F56' }} />
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FFBD2E' }} />
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#27C93F' }} />
        </Box>
      </Box>
      <Box 
        component="pre" 
        sx={{ 
          m: 0, 
          p: 3, 
          overflowX: 'auto',
          fontSize: '0.85rem',
          lineHeight: 1.6,
          fontFamily: 'JetBrains Mono',
          color: '#A1A1AA',
          '& code': { fontFamily: 'inherit' }
        }}
      >
        <code>{currentCode}</code>
      </Box>
    </Box>
  );
};
