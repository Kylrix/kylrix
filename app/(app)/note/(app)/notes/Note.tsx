"use client";

import React, { useState } from 'react';
import {
  Card, CardContent, Typography, CardActions, IconButton, Stack, Chip, Box,
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Button
} from '@mui/material';
import { Delete, Share, Lock, LockOpen, MoreVert, Analytics } from '@mui/icons-material';
import type { Notes } from "@/types/appwrite";
import { formatNoteUpdatedDate } from '@/lib/date-utils';
import { isNotePublic } from '@/lib/appwrite';
import { motion } from "framer-motion";
const MotionCard = motion(Card);

interface NoteComponentProps {
  note: Notes;
  onDelete?: (noteId: string) => void;
  onShare?: (noteId: string) => void;
  onTogglePublic?: (noteId: string, isPublic: boolean) => void;
}

export default function NoteComponent({
  note,
  onDelete,
  onShare,
  onTogglePublic
}: NoteComponentProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  // const [showDeleteDialog, setShowDeleteDialog] = useState(false); // reserved for future use
  const [showAnalytics, setShowAnalytics] = useState(false);
  const parentEncrypted = !!note.parentNoteId;

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const handleShare = () => {
    setShareDialogOpen(true);
    handleMenuClose();
    onShare?.(note.$id);
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this note?')) {
      onDelete?.(note.$id);
    }
    handleMenuClose();
  };

  const isPublic = isNotePublic(note);

  const handleTogglePublic = () => {
    onTogglePublic?.(note.$id, !isPublic);
    handleMenuClose();
  };

  // Use only valid properties from Notes type
  const isEncrypted = parentEncrypted;

  return (
    <>
      <MotionCard
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          backgroundColor: 'background.paper',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '24px',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderColor: 'rgba(245, 158, 11, 0.4)',
            transform: 'translateY(-4px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" component="span" sx={{ fontSize: '1.2rem' }}>
              📝
            </Typography>
            {isPublic ? <LockOpen color="action" fontSize="small" /> : <Lock sx={{ color: '#F59E0B' }} fontSize="small" />}
          </Box>
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{ ml: 'auto' }}
          >
            <MoreVert />
          </IconButton>
        </Box>
        <CardContent sx={{ flexGrow: 1, pt: 0 }}>
          <Typography
            variant="h6"
            component="h3"
            sx={{
              mb: 1,
              fontWeight: 600,
              lineHeight: 1.3,
            }}
          >
            {note.title}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.4
            }}
          >
            {note.content?.replace(/<[^>]*>/g, '').substring(0, 150)}
            {note.content && note.content.length > 150 && '...'}
          </Typography>
          {/* Attachments indicator */}
          {note.attachments && note.attachments.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                📎 {note.attachments.length} attachment{note.attachments.length > 1 ? 's' : ''}
              </Typography>
            </Box>
          )}
          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.5 }}>
              {note.tags.slice(0, 3).map((tag: string) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant="outlined"
                />
              ))}
              {note.tags.length > 3 && (
                <Chip
                  label={`+${note.tags.length - 3}`}
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
          )}
          {/* Remove analytics section as it doesn't exist in Notes type */}
        </CardContent>

        {/* Footer with dates and actions */}
        <CardActions sx={{ justifyContent: 'space-between', px: 2, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {/* Use correct property name from Notes type */}
            {formatNoteUpdatedDate(note)}
          </Typography>
          
          <Stack direction="row" spacing={0.5}>
            <IconButton 
              size="small" 
              onClick={handleShare}
              disabled={isEncrypted === false}
            >
              <Share fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setShowAnalytics(true)}>
              <Analytics fontSize="small" />
            </IconButton>
          </Stack>
        </CardActions>
      </MotionCard>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 180 }
        }}
      >
        <MenuItem onClick={handleTogglePublic}>
          <LockOpen fontSize="small" sx={{ mr: 1 }} />
          {isPublic ? 'Make Private' : 'Make Public'}
        </MenuItem>
        <MenuItem onClick={handleShare} disabled={isEncrypted === false}>
          <Share fontSize="small" sx={{ mr: 1 }} />
          Share
        </MenuItem>
        <MenuItem onClick={() => setShowAnalytics(true)}>
          <Analytics fontSize="small" sx={{ mr: 1 }} />
          Analytics
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Share Dialog */}
      <Dialog 
        open={shareDialogOpen} 
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Share Note</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Share &quot;{note.title}&quot; with other users or generate a public link.
          </Typography>
          {/* TODO: Implement sharing UI */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShareDialogOpen(false)}>Cancel</Button>
          <Button variant="contained">Share</Button>
        </DialogActions>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog 
        open={showAnalytics} 
        onClose={() => setShowAnalytics(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Note Analytics</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {/* Simple analytics without backend data */}
            <Box>
              <Typography variant="h6">0</Typography>
              <Typography variant="caption" color="text.secondary">Views</Typography>
            </Box>
            <Box>
              <Typography variant="h6">0</Typography>
              <Typography variant="caption" color="text.secondary">Edits</Typography>
            </Box>
            <Box>
              <Typography variant="h6">0</Typography>
              <Typography variant="caption" color="text.secondary">Shares</Typography>
            </Box>
            <Box>
              <Typography variant="h6">0m</Typography>
              <Typography variant="caption" color="text.secondary">Reading Time</Typography>
            </Box>
          </Box>
          
          {/* AI metadata would come from metadata field if needed */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalytics(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}