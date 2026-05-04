'use client';

import {
  Box,
  Typography,
  IconButton,
  Toolbar,
  AppBar,
  Tabs,
  Tab,
  alpha,
  Container
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { Notes } from '@/types/appwrite';
import { useState } from 'react';
import Comments from './Comments';
import Collaborators from './Collaborators';
import AttachmentViewer from './AttachmentViewer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeSanitize from 'rehype-sanitize';
import NoteContentDisplay from '@/components/NoteContentDisplay';

interface NoteViewerProps {
  note: Notes | null;
  onClose: () => void;
}

function TabPanel(props: { children?: React.ReactNode; value: number; index: number }) {
  const { children, value, index, ...other } = props;
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`note-viewer-tabpanel-${index}`}
      aria-labelledby={`note-viewer-tab-${index}`}
      sx={{ height: '100%', overflowY: 'auto' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: { xs: 2, md: 4 } }}>
          {children}
        </Box>
      )}
    </Box>
  );
}

export default function NoteViewer({ note, onClose }: NoteViewerProps) {
  const [tabIndex, setTabIndex] = useState(0);

  if (!note) {
    return null;
  }

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  return (
    <Box 
      sx={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: 'rgba(15, 13, 12, 0.95)',
        backdropFilter: 'blur(25px) saturate(180%)',
        color: 'white'
      }}
    >
      <AppBar 
        position="static" 
        sx={{ 
          bgcolor: 'transparent', 
          boxShadow: 'none', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)' 
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <Typography 
            variant="h5" 
            sx={{ 
              flexGrow: 1, 
              fontWeight: 900, 
              fontFamily: 'var(--font-space-grotesk)',
              background: 'linear-gradient(90deg, #fff, #6366F1)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            {note.title}
          </Typography>
          <IconButton 
            edge="end" 
            onClick={onClose} 
            sx={{ 
              color: 'white',
              bgcolor: 'rgba(255, 255, 255, 0.05)',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Toolbar>
        <Tabs 
          value={tabIndex} 
          onChange={handleTabChange} 
          variant="fullWidth"
            sx={{
              '& .MuiTabs-indicator': { bgcolor: '#F59E0B', height: 3 },
              '& .MuiTab-root': { 
                color: 'rgba(255, 255, 255, 0.5)', 
                fontWeight: 800,
                fontSize: '0.85rem',
                textTransform: 'none',
                '&.Mui-selected': { color: '#F59E0B' }
              }
            }}
        >
          <Tab label="Content" />
          <Tab label="Comments" />
          <Tab label="Attachments" />
          <Tab label="Collaborators" />
        </Tabs>
      </AppBar>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <TabPanel value={tabIndex} index={0}>
          <Container maxWidth="md">
            {note.format === 'doodle' ? (
              <NoteContentDisplay
                content={note.content || ''}
                format="doodle"
              />
            ) : note.content ? (
              <Box 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.9)',
                  '& h1': { 
                    fontFamily: 'var(--font-space-grotesk)', 
                    fontWeight: 900, 
                    fontSize: '2.5rem', 
                    mb: 4, 
                    mt: 4,
                    color: 'white'
                  },
                  '& h2': { 
                    fontFamily: 'var(--font-space-grotesk)', 
                    fontWeight: 800, 
                    fontSize: '2rem', 
                    mb: 3, 
                    mt: 4,
                    color: 'white'
                  },
                  '& h3': { 
                    fontFamily: 'var(--font-space-grotesk)', 
                    fontWeight: 700, 
                    fontSize: '1.5rem', 
                    mb: 2, 
                    mt: 3,
                    color: 'white'
                  },
                  '& p': { 
                    fontSize: '1.1rem', 
                    lineHeight: 1.8, 
                    mb: 3,
                    opacity: 0.8
                  },
                  '& ul, & ol': { 
                    mb: 3, 
                    pl: 4,
                    '& li': { mb: 1, opacity: 0.8 }
                  },
                  '& blockquote': {
                    borderLeft: '4px solid #F59E0B',
                    bgcolor: alpha('#F59E0B', 0.05),
                    p: 3,
                    borderRadius: '0 12px 12px 0',
                    mb: 3,
                    fontStyle: 'italic'
                  },
                  '& pre': {
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    p: 3,
                    borderRadius: '12px',
                    overflowX: 'auto',
                    mb: 3,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    '& code': { fontFamily: 'monospace', fontSize: '0.9rem' }
                  },
                  '& a': {
                    color: '#F59E0B',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  rehypePlugins={[rehypeSanitize]}
                >
                  {note.content}
                </ReactMarkdown>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
                <Typography variant="h6" fontStyle="italic">
                  This note is empty.
                </Typography>
              </Box>
            )}
          </Container>
        </TabPanel>

        <TabPanel value={tabIndex} index={1}>
          <Comments noteId={note.$id} />
        </TabPanel>

        <TabPanel value={tabIndex} index={2}>
          <AttachmentViewer 
            attachmentIds={note.attachments || []} 
            onAttachmentDeleted={(id) => {
              // Handle deletion if needed, though AttachmentViewer handles its own state
              console.log('Attachment deleted:', id);
            }}
          />
        </TabPanel>

        <TabPanel value={tabIndex} index={3}>
          <Collaborators noteId={note.$id} collaborators={note.collaborators || []} />
        </TabPanel>
      </Box>
    </Box>
  );
}
