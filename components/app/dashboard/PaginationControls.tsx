import { Box, Typography, Select, MenuItem, Pagination } from "@mui/material";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  loading?: boolean;
  showPageSize?: boolean;
}

export default function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading = false,
  showPageSize = true,
}: PaginationControlsProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) {
    return null;
  }

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: { xs: 'column', sm: 'row' }, 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      gap: 2, 
      py: 3,
      borderTop: '1px solid',
      borderColor: 'rgba(255, 255, 255, 0.05)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
          Showing {startItem}-{endItem} of {totalItems} credentials
        </Typography>
        
        {showPageSize && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Per page:
            </Typography>
            <Select
              size="small"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={loading}
              sx={{ 
                height: 32, 
                fontSize: '0.75rem',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' }
              }}
            >
              <MenuItem value={10}>10</MenuItem>
              <MenuItem value={20}>20</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </Box>
        )}
      </Box>

      <Pagination 
        count={totalPages} 
        page={currentPage} 
        onChange={(_, page) => onPageChange(page)}
        disabled={loading}
        size="small"
        sx={{
          '& .MuiPaginationItem-root': {
            color: 'text.secondary',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              borderColor: 'rgba(255, 255, 255, 0.2)'
            },
            '&.Mui-selected': {
              bgcolor: 'rgba(0, 240, 255, 0.1)',
              color: '#00F0FF',
              borderColor: 'rgba(0, 240, 255, 0.3)',
              fontWeight: 700,
              '&:hover': {
                bgcolor: 'rgba(0, 240, 255, 0.15)'
              }
            }
          }
        }}
      />
    </Box>
  );
}
