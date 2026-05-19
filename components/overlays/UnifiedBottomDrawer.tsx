'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

// Import all dynamic drawer components
const LoginDrawer = dynamic(() => import('./LoginDrawer').then(mod => mod.LoginDrawer), { ssr: false });
const AgenticDrawer = dynamic(() => import('./AgenticDrawer').then(mod => mod.AgenticDrawer), { ssr: false });
const NoteDrawer = dynamic(() => import('./NoteDrawer').then(mod => mod.NoteDrawer), { ssr: false });
const ShareNoteDrawer = dynamic(() => import('./ShareNoteDrawer').then(mod => mod.ShareNoteDrawer), { ssr: false });
const AssignGoalDrawer = dynamic(() => import('./AssignGoalDrawer').then(mod => mod.AssignGoalDrawer), { ssr: false });
const DeleteNoteDrawer = dynamic(() => import('./DeleteNoteDrawer').then(mod => mod.DeleteNoteDrawer), { ssr: false });

export function UnifiedBottomDrawer() {
  const { activeContent, drawerData, close } = useUnifiedDrawer();

  // The child components already contain their own <Drawer> 
  // wrappers. We just render the active one here.
  switch (activeContent) {
    case 'login': return <LoginDrawer />;
    case 'agentic': return <AgenticDrawer />;
    case 'note': return <NoteDrawer />;
    case 'share-note': 
        return <ShareNoteDrawer 
            isOpen={true} 
            onClose={close} 
            noteId={drawerData?.noteId} 
            noteTitle={drawerData?.noteTitle} 
        />;
    case 'assign-goal':
        return <AssignGoalDrawer 
            isOpen={true} 
            onClose={close} 
            taskId={drawerData?.taskId} 
            taskTitle={drawerData?.taskTitle} 
        />;
    case 'delete-note':
        return <DeleteNoteDrawer 
            isOpen={true} 
            onClose={close} 
            onConfirm={drawerData?.onConfirm} 
            noteTitle={drawerData?.noteTitle} 
        />;
    default: return null;
  }
}
