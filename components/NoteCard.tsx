import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardActions, 
  Typography, 
  IconButton, 
  Box, 
  Chip, 
  Menu, 
  MenuItem,
  alpha,
  Tooltip
} from '@mui/material';
import { 
  Share as ShareIcon, 
  MoreVert as MoreVertIcon, 
  Lock as LockIcon, 
  LockOpen as LockOpenIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  AccessTime as AccessTimeIcon,
  People as PeopleIcon
} from '@mui/icons-material';
import Link from 'next/link';

interface NoteCardProps {
  id: string;
  title: string;
  updatedAt: Date;
  isEncrypted: boolean;
  sharedWith: string[];
  onDelete?: () => Promise<void>;
  onShare?: () => void;
}

export default function NoteCard({
  id,
  title,
  updatedAt,
  isEncrypted,
  sharedWith,
  onDelete,
  onShare
}: NoteCardProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = async () => {
    if (onDelete) {
      setIsDeleting(true);
      try {
        await onDelete();
      } finally {
        setIsDeleting(false);
        handleMenuClose();
      }
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
      handleMenuClose();
    }
  };

  return (
    <Card 
      elevation={0} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: '#161412',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '24px',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        backgroundImage: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.4)',
        position: 'relative',
        overflow: 'hidden',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, transparent 100%)',
          opacity: 0,
          transition: 'opacity 0.4s'
        },
        '&:hover': {
          transform: 'perspective(1200px) translateY(-6px) rotateX(2deg)',
          borderColor: 'rgba(236, 72, 153, 0.3)',
          boxShadow: `
            inset 0 1px 0 rgba(255, 255, 255, 0.08), 
            inset 0 -1px 0 rgba(0, 0, 0, 0.4),
            0 20px 40px rgba(0,0,0,0.4),
            0 0 20px rgba(236, 72, 153, 0.1)
          `,
          bgcolor: '#1C1A18',
          '&::after': {
            opacity: 1
          }
        }
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 900, 
              color: 'white',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {title}
          </Typography>
          <Tooltip title={isEncrypted ? "Encrypted" : "Public"}>
            <Box sx={{ 
              p: 1, 
              borderRadius: '12px', 
              bgcolor: isEncrypted ? alpha('#EC4899', 0.1) : 'rgba(255, 255, 255, 0.05)',
              color: isEncrypted ? '#EC4899' : 'rgba(255, 255, 255, 0.4)',
              display: 'flex'
            }}>
              {isEncrypted ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
            </Box>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AccessTimeIcon sx={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.3)' }} />
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {new Date(updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Typography>
        </Box>

        {sharedWith.length > 0 && (
          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PeopleIcon sx={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.3)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Shared
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {sharedWith.slice(0, 3).map((user) => (
                <Chip
                  key={user}
                  label={user}
                  size="small"
                  sx={{ 
                    height: 20,
                    fontSize: '10px',
                    fontWeight: 800,
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '& .MuiChip-label': { px: 1 }
                  }}
                />
              ))}
              {sharedWith.length > 3 && (
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 800, ml: 0.5 }}>
                  +{sharedWith.length - 3}
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Edit Note">
            <IconButton 
              component={Link} 
              href={`/notes/${id}`}
              sx={{ 
                color: '#EC4899',
                bgcolor: alpha('#EC4899', 0.05),
                borderRadius: '12px',
                '&:hover': { bgcolor: alpha('#EC4899', 0.15) }
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Share Note">
            <IconButton 
              onClick={handleShare}
              disabled={!isEncrypted}
              sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '12px',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.08)', color: 'white' },
                '&.Mui-disabled': { color: 'rgba(255, 255, 255, 0.1)' }
              }}
            >
              <ShareIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        <IconButton
          onClick={handleMenuOpen}
          sx={{ 
            color: 'rgba(255, 255, 255, 0.4)',
            '&:hover': { color: 'white' }
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          PaperProps={{
            sx: {
              bgcolor: '#161412',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              mt: 1,
              boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 10px 30px rgba(0,0,0,0.5)',
              '& .MuiMenuItem-root': {
                px: 2,
                py: 1.5,
                fontSize: '0.875rem',
                fontWeight: 800,
                color: 'rgba(255, 255, 255, 0.6)',
                '&:hover': {
                  bgcolor: '#1C1A18',
                  color: 'white'
                }
              }
            }
          }}
        >
          <MenuItem onClick={handleDelete} disabled={isDeleting} sx={{ color: '#FF4D4D !important' }}>
            <DeleteIcon sx={{ mr: 1.5, fontSize: 18 }} /> Delete Note
          </MenuItem>
        </Menu>
      </CardActions>
    </Card>
  );
}

