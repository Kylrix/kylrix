import { useState } from 'react';
import { 
  Box, 
  Typography, 
  IconButton, 
  Paper, 
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Chip,
  useTheme,
  useMediaQuery,
  alpha
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import type { Credentials } from '@/lib/appwrite/types';
import { Shield, ExternalLink } from 'lucide-react';

export default function CredentialItem({
  credential,
  onCopy,
  _isDesktop,
  onEdit,
  onDelete,
  onClick,
}: {
  credential: Credentials;
  onCopy: (value: string) => void;
  _isDesktop?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClick?: () => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [copyAnchorEl, setCopyAnchorEl] = useState<null | HTMLElement>(null);

  const handleCopy = (value: string) => {
    onCopy(value);
    setCopyAnchorEl(null);
  };

  const getFaviconUrl = (url: string | null | undefined) => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
      return null;
    }
  };

  const faviconUrl = getFaviconUrl(credential.url);

  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: '24px',
        bgcolor: '#161412',
        border: '1px solid #1C1A18',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        alignItems: 'center',
        backgroundImage: 'none',
        '&:hover': {
          bgcolor: '#1C1A18',
          borderColor: alpha('#10B981', 0.3),
          transform: 'translateY(-2px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
          '& .fav-box': { borderColor: alpha('#10B981', 0.2), bgcolor: alpha('#10B981', 0.05) }
        }
      }}
    >
      {/* Icon */}
      <Box 
        className="fav-box"
        sx={{ 
            width: 52, 
            height: 52, 
            borderRadius: '16px', 
            bgcolor: 'rgba(255, 255, 255, 0.02)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid rgba(255, 255, 255, 0.05)',
            overflow: 'hidden',
            transition: 'all 0.3s ease'
        }}
      >
        {faviconUrl ? (
          <Box component="img" src={faviconUrl} sx={{ width: 32, height: 32 }} />
        ) : (
          <Typography sx={{ fontWeight: 900, color: '#10B981', fontSize: '1.3rem', fontFamily: 'var(--font-clash)' }}>
            {credential.name?.charAt(0)?.toUpperCase() || "?"}
          </Typography>
        )}
      </Box>

      {/* Info */}
      <Box sx={{ ml: 3, flexGrow: 1, minWidth: 0 }}>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 900, color: '#fff', lineHeight: 1.2, fontFamily: 'var(--font-clash)', fontSize: '1.05rem' }}>
          {credential.name}
        </Typography>
        <Typography variant="body2" noWrap sx={{ color: '#9B9691', mt: 0.5, fontWeight: 500, fontFamily: 'var(--font-satoshi)' }}>
          {credential.username}
        </Typography>
        {(credential as any).sharedFrom && (
          <Chip
            size="small"
            label={`Received from ${(credential as any).sharedFrom}`}
            sx={{
              mt: 1,
              height: 20,
              fontSize: '0.62rem',
              fontWeight: 900,
              bgcolor: alpha('#10B981', 0.08),
              color: '#10B981',
              borderRadius: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.02em'
            }}
          />
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0.5, ml: 2 }}>
        {!isMobile ? (
          <>
            <Tooltip title="Copy Email">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCopy(credential.username || ''); }} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <PersonIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy Password">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleCopy(credential.password || ''); }} sx={{ color: '#10B981', '&:hover': { bgcolor: alpha('#10B981', 0.1) } }}>
                <LockIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit Record">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(); }} sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' } }}>
                <EditIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Destroy">
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }} sx={{ color: 'rgba(255,255,255,0.15)', '&:hover': { color: '#FF453A', bgcolor: alpha('#FF453A', 0.05) } }}>
                <DeleteIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setCopyAnchorEl(e.currentTarget); }} sx={{ color: '#10B981' }}>
              <ContentCopyIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }} sx={{ color: 'text.secondary' }}>
              <MoreVertIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </>
        )}
      </Box>

      <Menu
        anchorEl={copyAnchorEl}
        open={Boolean(copyAnchorEl)}
        onClose={() => setCopyAnchorEl(null)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: '#161412',
            border: '1px solid #1C1A18',
            backgroundImage: 'none',
            minWidth: '200px'
          }
        }}
      >
        <MenuItem onClick={() => handleCopy(credential.username || '')} sx={{ py: 1.5, px: 2.5 }}>
          <ListItemIcon><PersonIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="Copy Username" primaryTypographyProps={{ fontWeight: 800, fontSize: '0.85rem' }} />
        </MenuItem>
        <MenuItem onClick={() => handleCopy(credential.password || '')} sx={{ py: 1.5, px: 2.5 }}>
          <ListItemIcon><LockIcon sx={{ fontSize: 18, color: '#10B981' }} /></ListItemIcon>
          <ListItemText primary="Copy Password" primaryTypographyProps={{ fontWeight: 800, fontSize: '0.85rem', color: '#10B981' }} />
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            borderRadius: '16px',
            bgcolor: '#161412',
            border: '1px solid #1C1A18',
            backgroundImage: 'none',
            minWidth: '180px'
          }
        }}
      >
        <MenuItem onClick={() => { onEdit(); setAnchorEl(null); }} sx={{ py: 1.5, px: 2.5 }}>
          <ListItemIcon><EditIcon sx={{ fontSize: 18 }} /></ListItemIcon>
          <ListItemText primary="Edit Record" primaryTypographyProps={{ fontWeight: 800, fontSize: '0.85rem' }} />
        </MenuItem>
        <MenuItem onClick={() => { onDelete(); setAnchorEl(null); }} sx={{ py: 1.5, px: 2.5, color: '#FF453A' }}>
          <ListItemIcon><DeleteIcon sx={{ fontSize: 18, color: '#FF453A' }} /></ListItemIcon>
          <ListItemText primary="Destroy" primaryTypographyProps={{ fontWeight: 900, fontSize: '0.85rem' }} />
        </MenuItem>
      </Menu>
    </Paper>
  );
}
