"use client";

import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardMedia, 
  CardContent, 
  IconButton, 
  Grid, 
  alpha, 
  Tooltip,
  CircularProgress
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Download as DownloadIcon, 
  InsertDriveFile as FileIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { getNoteAttachment, deleteNoteAttachment, storage, APPWRITE_BUCKET_NOTES_ATTACHMENTS } from '@/lib/appwrite';
import type { Models } from 'appwrite';

interface AttachmentViewerProps {
  attachmentIds: string[];
  onAttachmentDeleted: (attachmentId: string) => void;
}

export default function AttachmentViewer({ attachmentIds, onAttachmentDeleted }: AttachmentViewerProps) {
  const [attachments, setAttachments] = useState<Models.File[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAttachments = async () => {
      setLoading(true);
      try {
        const fetchedAttachments = await Promise.all(
          attachmentIds.map(id => getNoteAttachment(id))
        );
        setAttachments(fetchedAttachments);
      } catch (error: any) {
        console.error('Failed to fetch attachments:', error);
      } finally {
        setLoading(false);
      }
    };
    if (attachmentIds.length > 0) {
      fetchAttachments();
    } else {
      setAttachments([]);
      setLoading(false);
    }
  }, [attachmentIds]);

  const handleDelete = async (fileId: string) => {
    try {
      await deleteNoteAttachment(fileId);
      onAttachmentDeleted(fileId);
      setAttachments(prev => prev.filter(a => a.$id !== fileId));
    } catch (error: any) {
      console.error('Failed to delete attachment:', error);
    }
  };

  const getImageUrl = (fileId: string): string => {
    const url = storage.getFileView(APPWRITE_BUCKET_NOTES_ATTACHMENTS, fileId);
    return typeof url === 'string' ? url : String(url);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: '#6366F1' }} />
      </Box>
    );
  }

  if (attachments.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
        <Typography variant="h6" fontStyle="italic">
          No attachments found.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        {attachments.map((attachment) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={attachment.$id}>
            <Card
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  bgcolor: 'rgba(255, 255, 255, 0.05)',
                  borderColor: alpha('#6366F1', 0.3),
                  boxShadow: `0 8px 32px ${alpha('#000', 0.4)}`
                }
              }}
            >
              {attachment.mimeType.startsWith('image/') ? (
                <CardMedia
                  component="img"
                  height="160"
                  image={getImageUrl(attachment.$id)}
                  alt={attachment.name}
                  sx={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}
                />
              ) : (
                <Box 
                  sx={{ 
                    height: 160, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    bgcolor: 'rgba(0, 0, 0, 0.2)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <FileIcon sx={{ fontSize: 64, color: 'rgba(255, 255, 255, 0.2)' }} />
                </Box>
              )}
              <CardContent sx={{ flexGrow: 1, p: 2 }}>
                <Typography 
                  variant="subtitle1" 
                  noWrap 
                  sx={{ 
                    fontWeight: 700, 
                    color: 'white',
                    fontFamily: 'var(--font-satoshi)'
                  }}
                >
                  {attachment.name}
                </Typography>
                <Typography 
                  variant="caption" 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.5)',
                    display: 'block',
                    mt: 0.5
                  }}
                >
                  {attachment.mimeType} • {formatSize(attachment.sizeOriginal)}
                </Typography>
              </CardContent>
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Tooltip title="View">
                  <IconButton 
                    size="small" 
                    component="a" 
                    href={getImageUrl(attachment.$id)} 
                    target="_blank"
                    sx={{ color: 'rgba(255, 255, 255, 0.7)', '&:hover': { color: '#6366F1' } }}
                  >
                    <ViewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download">
                  <IconButton 
                    size="small" 
                    component="a" 
                    href={getImageUrl(attachment.$id)} 
                    download={attachment.name}
                    sx={{ color: 'rgba(255, 255, 255, 0.7)', '&:hover': { color: '#6366F1' } }}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton 
                    size="small" 
                    onClick={() => handleDelete(attachment.$id)}
                    sx={{ color: 'rgba(255, 255, 255, 0.7)', '&:hover': { color: '#ff4d4d' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
