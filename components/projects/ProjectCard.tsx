'use client';

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  IconButton,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  MoreVertical,
  ExternalLink,
  Trash2,
  Calendar,
  Lock,
  Globe,
  Users,
} from 'lucide-react';
import { Projects } from '@/types/appwrite';
import { formatNoteCreatedDate } from '@/lib/date-utils';

interface ProjectCardProps {
  project: Projects;
  onClick: (projectId: string) => void;
  onDelete: (projectId: string) => void;
}

export default function ProjectCard({ project, onClick, onDelete }: ProjectCardProps) {
  const theme = useTheme();

  const getVisibilityIcon = () => {
    switch (project.visibility) {
      case 'public': return <Globe size={14} />;
      case 'shared': return <Users size={14} />;
      default: return <Lock size={14} />;
    }
  };

  return (
    <Paper
      elevation={0}
      onClick={() => onClick(project.$id)}
      sx={{
        bgcolor: '#161412',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '24px',
        p: 3,
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundImage: 'none',
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'rgba(99, 102, 241, 0.3)',
          bgcolor: '#1C1A18',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        }
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#6366F1', 0.1),
                color: '#6366F1',
                border: '1px solid rgba(99, 102, 241, 0.2)'
              }}
            >
              <Typography sx={{ fontWeight: 900 }}>{project.title.charAt(0).toUpperCase()}</Typography>
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
                {project.title}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                {getVisibilityIcon()}
                <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                  {project.visibility}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); onDelete(project.$id); }}
            sx={{ color: 'rgba(255,255,255,0.3)', '&:hover': { color: '#FF453A' } }}
          >
            <Trash2 size={18} />
          </IconButton>
        </Box>

        <Typography 
          sx={{ 
            color: 'rgba(255,255,255,0.6)', 
            fontSize: '0.9rem',
            lineHeight: 1.6,
            minHeight: 44,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {project.summary || 'No description provided.'}
        </Typography>

        <Box sx={{ pt: 1, borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'rgba(255,255,255,0.3)' }}>
            <Calendar size={14} />
            <Typography variant="caption">
              {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Just now'}
            </Typography>
          </Stack>
          <Chip 
            label={project.status} 
            size="small" 
            sx={{ 
              bgcolor: alpha(project.status === 'active' ? '#10B981' : '#F59E0B', 0.1),
              color: project.status === 'active' ? '#10B981' : '#F59E0B',
              fontWeight: 800,
              fontSize: '0.7rem',
              borderRadius: '8px'
            }} 
          />
        </Box>
      </Stack>
    </Paper>
  );
}
