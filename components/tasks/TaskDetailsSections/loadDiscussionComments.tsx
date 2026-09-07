'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Priority, TaskStatus, TaskCollaborator, CollaboratorPermission } from '@/types';
import { Query } from 'appwrite';
import { notes as noteApi } from '@/lib/kylrixflow';
import { 

export function loadDiscussionComments(bag: any) {
  const {
  _isLoadingAssignees,
  _isSearchingNotes,
  _linkedNoteTitles,
  _noteResults,
  _setIsEditingDescription,
  _setNoteQuery,
  _setTaskCollaboratorRows,
  _taskCollaboratorRows,
  _taskParticipantProfiles,
  completedSubtasks,
  discussionNoteId,
  editDescription,
  editTitle,
  handleAddSubtask,
  handleClose,
  handleInitDiscussion,
  handlePriorityChange,
  handleSaveEditTitle,
  handleSendMessage,
  handleStartEditTitle,
  handleStatusChange,
  huddleLoading,
  huddleMessageEndRef,
  huddleMessages,
  huddleSending,
  isEditingDescription,
  isEditingTitle,
  isExportOpen,
  isPaid,
  isPriorityOpen,
  isStatusOpen,
  isTagSelectorOpen,
  loadDiscussionComments,
  matchedWorkspace,
  newComment,
  newSubtask,
  noteQuery,
  requirePaidMilestones,
  setEditDescription,
  setEditTitle,
  setHuddleLoading,
  setHuddleMessages,
  setHuddleSending,
  setIsEditingTitle,
  setIsExportOpen,
  setIsLoadingAssignees,
  setIsPriorityOpen,
  setIsSearchingNotes,
  setIsStatusOpen,
  setIsTagSelectorOpen,
  setLinkedNoteTitles,
  setNewComment,
  setNewSubtask,
  setNoteResults,
  setShowProjectLinker,
  setTaskParticipantProfiles,
  showProjectLinker,
  subtaskProgress,
  task,
  taskLabels
  } = bag as any;

      try {
        let threadId = (task as any)?.primaryThreadId as string | undefined;
        if (!threadId && task?.id) {
          const ensured = await getOrCreateThread({
            parentKind: 'goal',
            parentId: task.id,
            channel: 'discuss',
            title: `Goal discussion: ${task.title || task.id}`,
            legacyNoteId: task.discussionId || null,
          });
          threadId = (ensured as any)?.thread?.id;
        }
        if (!threadId || !active) return;
        const rows = await listThreadMessages(threadId, { limit: 200 });
        if (!active) return;
        const { UsersService } = await import('@/lib/services/users');
        const msgs = await Promise.all(
          rows.map(async (row: any) => {
            let senderName = 'Collaborator';
            let senderAvatar: string | null = null;
            if (user && row.userId === user.$id) {
              senderName = user.name || 'You';
            } else {
              try {
                const profile = await UsersService.getProfileById(row.userId);
                if (profile) {
                    senderName = profile.name || profile.displayName || 'Collaborator';
                    senderAvatar = profile.avatar || profile.profilePicId || null;
                }
              } catch {}
            }
            return {
              id: row.id,
              senderId: row.userId,
              senderName,
              senderAvatar,
              content: row.content,
              timestamp: new Date(row.createdAt || Date.now()).getTime()};
          })
        );

        msgs.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setHuddleMessages(msgs);
      } catch (err) {
        console.error('Failed to load discussion comments:', err);
      } finally {
        if (active) setHuddleLoading(false);
      }
}
