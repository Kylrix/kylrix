import React from 'react';
import { Card, CardHeader, Avatar } from '@/lib/mui-tailwind/material';
import { Pin, Edit, Trash2 } from 'lucide-react';
import { useResourcePins } from '@/context/ResourcePinContext';
import { useContextMenu } from '@/components/ui/ContextMenuContext';
import { useAccessControlMenuItems } from '@/components/share/AccessControlMenuItems';

export function MomentItem({ moment, isOwnPost, creatorId, creatorAvatar, momentCardSx, handleEditMoment, handleDeletePost }: any) {
  const { isPinned: isResourcePinned, togglePin } = useResourcePins();
  const pinned = isResourcePinned('moment', moment.$id, creatorId, moment.isPinned);
  const { openMenu } = useContextMenu();

  const handlePinToggle = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      await togglePin({
        resourceType: 'moment',
        resourceId: moment.$id,
        ownerId: creatorId,
        rowIsPinned: moment.isPinned,
        setOwnerRowPin: async (nextPinned) => {},
      });
    } catch (err: any) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const accessControlItems = useAccessControlMenuItems({
    resourceType: 'moment',
    resourceId: moment.$id,
    isPublic: !!moment.isPublic,
    isGuest: !!moment.isGuest,
    resourceTitle: moment.caption,
    onUpdate: () => {}
  });

  const contextMenuItems = [
    { label: pinned ? 'Unpin' : 'Pin', icon: <Pin size={16} className={pinned ? 'rotate-45 text-[#F59E0B]' : ''} />, onClick: handlePinToggle },
    ...accessControlItems,
    ...(isOwnPost ? [
      { label: 'Edit Moment', icon: <Edit size={16} />, onClick: () => handleEditMoment(moment) },
      { label: 'Delete', icon: <Trash2 size={16} />, variant: 'destructive' as const, onClick: () => handleDeletePost(moment.$id) }
    ] : [])
  ];

  const handleRightClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu({
          x: e.clientX,
          y: e.clientY,
          items: contextMenuItems,
          appType: 'connect'
      });
  };

  return (
    <Card key={moment.$id} onContextMenu={handleRightClick} sx={{ ...momentCardSx, mb: { xs: 2.5, md: 3 } }} elevation={0}>
        {/* Card content... */}
    </Card>
  );
}
