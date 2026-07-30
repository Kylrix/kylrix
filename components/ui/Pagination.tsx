'use client';

import React from 'react';
import { sidebarIgnoreProps } from '@/constants/sidebar';
import { Box, Typography, Button } from '@/lib/openbricks/primitives';
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from '@/lib/openbricks/icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (page: number) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  totalCount: number;
  pageSize: number;
  className?: string;
  compact?: boolean; // For mobile/smaller displays
}

export function Pagination({
  currentPage,
  totalPages,
  onNextPage,
  onPreviousPage,
  hasNextPage,
  hasPreviousPage,
  totalCount,
  pageSize,
  compact = false
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        width: '100%',
        mt: 2,
        px: 1
      }} 
      {...sidebarIgnoreProps}
    >
      {/* Results info */}
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.45)', fontWeight: 600, fontSize: '0.75rem', fontFamily: 'var(--font-satoshi)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {compact ? (
          `${currentPage} / ${totalPages}`
        ) : (
          <>
            Showing <span className="text-white font-black">{startItem}-{endItem}</span> of <span className="text-white font-black">{totalCount}</span> results
          </>
        )}
      </Typography>

      {/* Pagination controls: Smart Prev/Next Only */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {hasPreviousPage && (
          <Button
            size="small"
            onClick={onPreviousPage}
            startIcon={<ChevronLeftIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '12px',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              color: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontFamily: 'var(--font-satoshi)',
              fontWeight: 800,
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              px: 2,
              py: 1,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                color: 'white'
              }
            }}
          >
            Prev
          </Button>
        )}

        {/* Adaptive Page Indicator in between if needed, but keeping it minimalist as requested */}
        <Typography sx={{ color: 'white', fontWeight: 900, fontSize: '0.75rem', fontFamily: 'var(--font-mono)', minWidth: 40, textAlign: 'center' }}>
          {currentPage} <span className="opacity-30">/</span> {totalPages}
        </Typography>

        {hasNextPage && (
          <Button
            size="small"
            onClick={onNextPage}
            endIcon={<ChevronRightIcon sx={{ fontSize: 16 }} />}
            sx={{
              borderRadius: '12px',
              bgcolor: 'rgba(255, 255, 255, 0.03)',
              color: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontFamily: 'var(--font-satoshi)',
              fontWeight: 800,
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              px: 2,
              py: 1,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.06)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
                color: 'white'
              }
            }}
          >
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
}
