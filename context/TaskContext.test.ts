import { describe, it, expect } from 'vitest';
import { mapAppwriteTaskToTask } from './TaskContext';
import type { AppwriteTask } from '@/types/kylrixflow';

describe('mapAppwriteTaskToTask', () => {
  it('maps a basic Appwrite task document to Task model correctly', () => {
    const rawDoc: any = {
      $id: 'goal_123',
      $createdAt: '2025-02-23T12:00:00.000Z',
      $updatedAt: '2025-02-23T12:00:00.000Z',
      title: 'Build Feature',
      description: 'Feature details',
      status: 'todo',
      priority: 'high',
      userId: 'user_456',
      tags: ['work', 'frontend'],
    };

    const task = mapAppwriteTaskToTask(rawDoc as AppwriteTask);

    expect(task.id).toBe('goal_123');
    expect(task.title).toBe('Build Feature');
    expect(task.description).toBe('Feature details');
    expect(task.status).toBe('todo');
    expect(task.priority).toBe('high');
    expect(task.userId).toBe('user_456');
    expect(task.creatorId).toBe('user_456');
    expect(task.projectId).toBe('inbox');
    expect(task.isWorkspace).toBe(false);
    expect(task.labels).toEqual(['work', 'frontend']);
  });

  it('extracts workspace project ID from tags and sets isWorkspace to true', () => {
    const rawDoc: any = {
      $id: 'goal_789',
      $createdAt: '2025-02-23T12:00:00.000Z',
      $updatedAt: '2025-02-23T12:00:00.000Z',
      title: 'Workspace Goal',
      description: 'Custom workspace item',
      status: 'in-progress',
      priority: 'urgent',
      userId: 'user_456',
      tags: ['project:ws_custom', 'urgent'],
    };

    const task = mapAppwriteTaskToTask(rawDoc as AppwriteTask);

    expect(task.id).toBe('goal_789');
    expect(task.projectId).toBe('ws_custom');
    expect(task.isWorkspace).toBe(true);
    expect(task.labels).toEqual(['urgent']);
  });

  it('preserves raw projectId and labels when tags array is not provided', () => {
    const rawDoc: any = {
      $id: 'goal_321',
      id: 'goal_321',
      title: 'Local Merged Goal',
      description: 'Sync response without tags array',
      status: 'todo',
      priority: 'medium',
      userId: 'user_456',
      projectId: 'ws_direct',
      labels: ['feature'],
      subtasks: [{ id: 'sub_1', title: 'Subtask 1', completed: false }],
    };

    const task = mapAppwriteTaskToTask(rawDoc as AppwriteTask);

    expect(task.id).toBe('goal_321');
    expect(task.projectId).toBe('ws_direct');
    expect(task.isWorkspace).toBe(true);
    expect(task.labels).toEqual(['feature']);
    expect(task.subtasks).toEqual([{ id: 'sub_1', title: 'Subtask 1', completed: false }]);
  });

  it('maps tasks with default or personal projectId to isWorkspace false', () => {
    const defaultDoc: any = {
      $id: 'goal_def',
      title: 'Default Workspace Goal',
      userId: 'user_456',
      projectId: 'default',
    };
    const personalDoc: any = {
      $id: 'goal_pers',
      title: 'Personal Workspace Goal',
      userId: 'user_456',
      projectId: 'personal',
    };

    const defaultTask = mapAppwriteTaskToTask(defaultDoc as AppwriteTask);
    const personalTask = mapAppwriteTaskToTask(personalDoc as AppwriteTask);

    expect(defaultTask.projectId).toBe('default');
    expect(defaultTask.isWorkspace).toBe(false);
    expect(personalTask.projectId).toBe('personal');
    expect(personalTask.isWorkspace).toBe(false);
  });
});
