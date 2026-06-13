'use client';

import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardHeader,
  CardContent,
  IconButton,
  Chip,
  alpha,
} from '@/lib/mui-tailwind/material';
import {
  Trash2,
  Calendar,
  Lock,
  Globe,
  Users,
  LayoutGrid,
  Pin,
  Link as LinkIcon,
  Edit2
} from 'lucide-react';
import { Projects } from '@/types/appwrite';
import { ShareLockButton } from '../share/ShareLockButton';
import { useAccessControlMenuItems } from '../share/AccessControlMenuItems';
import { useContextMenu } from '../ui/ContextMenuContext';
import { useResourcePins } from '@/context/ResourcePinContext';

const NAV_SURFACE = '#161412';

interface ProjectCardProps {
  project: Projects;
  onClick: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  onTogglePin?: (projectId: string) => void;
  onUpdate?: (updated: Projects) => void;
}

export default function ProjectCard({ project, onClick, onDelete, onTogglePin, onUpdate }: ProjectCardProps) {
  const { openMenu } = useContextMenu();
  const { isPinned: isResourcePinned } = useResourcePins();
  const pinned = (project as any).isPinned || isResourcePinned('project', project.$id, project.ownerId, (project as any).isPinned);

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'project',
    resourceId: project.$id,
    isPublic: project.visibility === 'public',
    isGuest: project.visibility === 'public', // Projects currently mirror public/guest
    resourceTitle: project.title,
    onUpdate: () => {
      const { ProjectsService } = require('@/lib/appwrite/projects');
      ProjectsService.getProject(project.$id).then((updated: Projects) => {
        if (updated && onUpdate) {
          onUpdate(updated);
        }
      }).catch(() => {});
    }
  });

  const contextMenuItems = React.useMemo(() => [
    { label: pinned ? 'Unpin Project' : 'Pin Project', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: () => onTogglePin?.(project.$id) },
    ...accessControlItems,
    { label: 'Delete', icon: <Trash2 size={16} />, variant: 'destructive' as const, onClick: () => onDelete(project.$id) }
  ], [pinned, accessControlItems, project, onTogglePin, onDelete]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu({
      x: e.clientX,
      y: e.clientY,
      items: contextMenuItems,
      appType: 'kylrix'
    });
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
    <Card
      onClick={() => onClick(project.$id)}
      onContextMenu={handleContextMenu}
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: NAV_SURFACE,
        backgroundImage: 'none',
        border: '1px solid',
        borderColor: '#34322F',
        borderRadius: '28px',
        boxShadow: 'none',
        transition: 'border-color 0.2s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        '&:hover': {
          transform: 'translateY(-6px)',
          borderColor: alpha('#6366F1', 0.4),
          bgcolor: '#1C1A18',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6)',
          '& .project-icon': { transform: 'scale(1.1) rotate(5deg)', color: '#6366F1' },
        },
      }}
    >
      <CardHeader
        sx={{ pb: 0.5, p: 2.5 }}
        title={
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
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
                transition: 'all 0.3s ease',
                flexShrink: 0,
              }}
            >
              <LayoutGrid size={22} strokeWidth={1.5} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography
                component="span"
                sx={{
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1.05rem',
                  fontFamily: 'var(--font-clash)',
                  lineHeight: 1.25,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {pinned && (
                  <Pin size={14} fill="#F59E0B" color="#F59E0B" style={{ transform: 'rotate(45deg)', flexShrink: 0 }} />
                )}
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {project.title}
                </Box>
              </Typography>
            </Box>
            {!(project as any).isPending ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); onTogglePin?.(project.$id); }}
                  sx={{
                    color: pinned ? '#F59E0B' : 'rgba(255,255,255,0.2)',
                    '&:hover': { color: '#F59E0B', bgcolor: alpha('#F59E0B', 0.05) },
                  }}
                >
                  <Pin size={18} fill={pinned ? '#F59E0B' : 'none'} />
                </IconButton>
                
                <ShareLockButton 
                  resourceType="project"
                  resourceId={project.$id}
                  isPublic={project.visibility === 'public'}
                  isGuest={project.visibility === 'public'}
                  accentColor="#6366F1"
                  onPublished={(res) => {
                    if (onUpdate) {
                      onUpdate({
                        ...project,
                        visibility: res.isPublic ? 'public' : 'private'
                      });
                    }
                  }}
                />
              </Box>
            ) : (
              <Chip
                label="INVITED"
                size="small"
                sx={{
                  flexShrink: 0,
                  bgcolor: alpha('#6366F1', 0.1),
                  color: '#818CF8',
                  fontWeight: 900,
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  height: 20,
                }}
              />
            )}
          </Box>
        }
      />

      <CardContent
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
          p: 2.5,
          pt: 0,
        }}
      >
        <Typography
          component="span"
          variant="body2"
          sx={{
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-satoshi)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
            fontWeight: 500,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {project.summary || 'Unified ecosystem project for coordinating cross-app resources and workflows.'}
        </Typography>

        <Box
          sx={{
            mt: 1.5,
            pt: 2,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'rgba(255,255,255,0.3)' }}>
            <Calendar size={14} />
            <Typography component="span" variant="caption" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {project.updatedAt
                ? new Date(project.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                : 'Active'}
            </Typography>
          </Box>
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
              border: `1px solid ${alpha((project as any).isPending ? '#F59E0B' : getStatusColor(), 0.2)}`,
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
