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
} from '@/lib/mui-tailwind/material';
import {
  MoreVertical,
  ExternalLink,
  Trash2,
  Calendar,
  Lock,
  Globe,
  Users,
  LayoutGrid,
  Pin,
} from 'lucide-react';
import { Projects } from '@/types/appwrite';

interface ProjectCardProps {
  project: Projects;
  onClick: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onTogglePin?: (projectId: string) => void;
}

export default function ProjectCard({ project, onClick, onDelete, onTogglePin }: ProjectCardProps) {
  const theme = useTheme();

  const getVisibilityIcon = () => {
    switch (project.visibility) {
      case 'public': return <Globe size={14} />;
      case 'shared': return <Users size={14} />;
      default: return <Lock size={14} />;
    }
  };

  const getStatusColor = () => {
      switch (project.status) {
          case 'active': return '#10B981';
          case 'paused': return '#F59E0B';
          case 'archived': return '#EF4444';
          default: return '#6366F1';
      }
  };

  return (
    <Paper
      elevation={0}
      onClick={() => onClick(project.$id)}
      sx={{
        bgcolor: '#161412',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '28px',
        p: 3.5,
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        backgroundImage: 'none',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-6px)',
          borderColor: alpha('#6366F1', 0.4),
          bgcolor: '#1C1A18',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          '& .project-icon': { transform: 'scale(1.1) rotate(5deg)', color: '#6366F1' }
        }
      }}
    >
      {/* Decorative gradient overlay */}
      <Box sx={{ 
          position: 'absolute', 
          top: 0, 
          right: 0, 
          width: 120, 
          height: 120, 
          background: `radial-gradient(circle at top right, ${alpha('#6366F1', 0.05)}, transparent 70%)`,
          pointerEvents: 'none'
      }} />

      <Stack spacing={2.5}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              className="project-icon"
              sx={{
                width: 48,
                height: 48,
                borderRadius: '16px',
                display: 'grid',
                placeItems: 'center',
                bgcolor: alpha('#fff', 0.03),
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                transition: 'all 0.3s ease'
              }}
            >
              <LayoutGrid size={22} strokeWidth={1.5} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ color: '#fff', fontWeight: 900, fontSize: '1.15rem', fontFamily: 'var(--font-clash)', display: 'flex', alignItems: 'center', gap: 1 }}>
                {(project as any).isPinned && <Pin size={14} fill="#F59E0B" color="#F59E0B" style={{ transform: 'rotate(45deg)', flexShrink: 0 }} />}
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.title}</Box>
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                {getVisibilityIcon()}
                <Typography variant="caption" sx={{ textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>
                  {project.visibility}
                </Typography>
              </Stack>
            </Box>
          </Stack>
          {!(project as any).isPending ? (
            <Stack direction="row" spacing={0.5} sx={{ mt: -0.5, mr: -0.5 }}>
              <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.(project.$id); }}
                  sx={{ 
                      color: (project as any).isPinned ? '#F59E0B' : 'rgba(255,255,255,0.2)', 
                      '&:hover': { color: '#F59E0B', bgcolor: alpha('#F59E0B', 0.05) },
                  }}
              >
                  <Pin size={18} fill={(project as any).isPinned ? '#F59E0B' : 'none'} />
              </IconButton>
              <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); onDelete(project.$id); }}
                  sx={{ 
                      color: 'rgba(255,255,255,0.2)', 
                      '&:hover': { color: '#FF453A', bgcolor: alpha('#FF453A', 0.05) },
                  }}
              >
                  <Trash2 size={18} />
              </IconButton>
            </Stack>
          ) : (
            <Chip 
              label="INVITED" 
              size="small" 
              sx={{ 
                bgcolor: alpha('#6366F1', 0.1), 
                color: '#818CF8', 
                fontWeight: 900, 
                fontSize: '0.65rem', 
                fontFamily: 'var(--font-mono)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                height: 20
              }} 
            />
          )}
        </Box>

        <Typography 
          sx={{ 
            color: 'rgba(255,255,255,0.5)', 
            fontSize: '0.92rem',
            lineHeight: 1.6,
            fontWeight: 500,
            minHeight: 44,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {project.summary || 'Unified ecosystem project for coordinating cross-app resources and workflows.'}
        </Typography>

        <Box sx={{ pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'rgba(255,255,255,0.3)' }}>
            <Calendar size={14} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Active'}
            </Typography>
          </Stack>
          <Chip 
            label={(project as any).isPending ? 'invite pending' : project.status} 
            size="small" 
            sx={{ 
              bgcolor: alpha((project as any).isPending ? '#F59E0B' : getStatusColor(), 0.1),
              color: (project as any).isPending ? '#F59E0B' : getStatusColor(),
              fontWeight: 900,
              fontSize: '0.62rem',
              borderRadius: '8px',
              textTransform: 'uppercase',
              height: 20,
              border: `1px solid ${alpha((project as any).isPending ? '#F59E0B' : getStatusColor(), 0.2)}`
            }} 
          />
        </Box>
      </Stack>
    </Paper>
  );
}
