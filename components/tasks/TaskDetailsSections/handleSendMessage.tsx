'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Priority, TaskStatus, TaskCollaborator, CollaboratorPermission } from '@/types';
import { Query } from 'appwrite';
import { notes as noteApi } from '@/lib/kylrixflow';
import { 

export function handleSendMessage(bag: any) {
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

    e.preventDefault();
    if (!newComment.trim() || huddleSending) return;
    if (!isPaid) {
      openProUpgrade('Discussions');
      return;
    }
    setHuddleSending(true);
    try {
      let threadId = (task as any)?.primaryThreadId || discussionNoteId;
      if (!threadId && task?.id) {
        const ensured = await getOrCreateThread({
          parentKind: 'goal',
          parentId: task.id,
          channel: 'discuss',
          title: `Goal discussion: ${task.title || task.id}`,
        });
        threadId = (ensured as any)?.thread?.id;
      }
      if (!threadId) throw new Error('No discussion thread');
      await postThreadMessage({ threadId, content: newComment.trim() });
      setNewComment('');
      const rows = await listThreadMessages(threadId, { limit: 200 });
      setHuddleMessages(
        rows.map((row: any) => ({
          id: row.id,
          senderId: row.userId,
          senderName: user?.name || 'You',
          senderAvatar: null,
          content: row.content,
          timestamp: new Date(row.createdAt || Date.now()).getTime(),
        })).sort((a: any, b: any) => a.timestamp - b.timestamp)
      );
    } catch (err) {
      console.error('Failed to send comment:', err);
      showError('Failed to send message.');
    } finally {
      setHuddleSending(false);
    }
}
