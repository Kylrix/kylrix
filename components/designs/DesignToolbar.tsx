'use client';

import { Box, Button, FormControl, MenuItem, Select, Stack, Typography, alpha } from '@mui/material';
import { Download, ChevronDown } from 'lucide-react';
import type { DesignExportFormat } from './types';

interface DesignToolbarProps {
  title: string;
  subtitle: string;
  selectedFormat: DesignExportFormat;
  onFormatChange: (format: DesignExportFormat) => void;
  onExport: () => void;
}

export default function DesignToolbar({
  title,
  subtitle,
  selectedFormat,
  onFormatChange,
  onExport,
}: DesignToolbarProps) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 2,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        bgcolor: 'rgba(10,9,8,0.84)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>
          {title}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.46)', letterSpacing: '0.16em' }}>
          {subtitle}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1.5} alignItems="center">
        <FormControl size="small">
          <Select
            value={selectedFormat}
            onChange={(event) => onFormatChange(event.target.value as DesignExportFormat)}
            sx={{
              minWidth: 120,
              color: 'white',
              bgcolor: alpha('#fff', 0.04),
              borderRadius: 2.5,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.08)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.16)' },
            }}
            IconComponent={ChevronDown}
          >
            <MenuItem value="png">PNG</MenuItem>
            <MenuItem value="svg">SVG</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          onClick={onExport}
          startIcon={<Download size={16} />}
          sx={{
            borderRadius: 2.5,
            px: 2.2,
            py: 1.2,
            fontWeight: 800,
            bgcolor: '#EC4899',
            color: 'white',
            boxShadow: 'none',
            '&:hover': {
              bgcolor: '#db2777',
              boxShadow: 'none',
            },
          }}
        >
          Export flyer
        </Button>
      </Stack>
    </Box>
  );
}
