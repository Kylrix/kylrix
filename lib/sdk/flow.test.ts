import { describe, expect, it, vi } from 'vitest';
import { KylrixFlow } from './flow';

describe('KylrixFlow', () => {
  it('should successfully create a task with default parameters', async () => {
    const mockSdk = {
      createRow: vi.fn().mockImplementation(async (db, table, data) => ({
        $id: 'task-123',
        ...data})),
    };

    const flow = new KylrixFlow(mockSdk);
    const taskData = {
      title: 'Finish Unit Tests',
      userId: 'user-789',
    };

    const result = await flow.createTask('db-id', 'table-id', taskData);

    expect(mockSdk.createRow).toHaveBeenCalledTimes(1);
    expect(mockSdk.createRow).toHaveBeenCalledWith('db-id', 'table-id', expect.objectContaining({
      title: 'Finish Unit Tests',
      userId: 'user-789',
      status: 'pending',
      priority: 'medium'}));
    expect(result).toHaveProperty('$id', 'task-123');
    expect(result).toHaveProperty('createdAt');
  });

  it('should respect custom status and priority when provided', async () => {
    const mockSdk = {
      createRow: vi.fn().mockImplementation(async (db, table, data) => ({
        $id: 'task-123',
        ...data})),
    };

    const flow = new KylrixFlow(mockSdk);
    const taskData = {
      title: 'High Priority Goal',
      userId: 'user-789',
      status: 'completed',
      priority: 'high',
    };

    const result = await flow.createTask('db-id', 'table-id', taskData);

    expect(mockSdk.createRow).toHaveBeenCalledWith('db-id', 'table-id', expect.objectContaining({
      title: 'High Priority Goal',
      userId: 'user-789',
      status: 'completed',
      priority: 'high'}));
    expect(result.status).toBe('completed');
    expect(result.priority).toBe('high');
  });

  it('should successfully start a focus session', async () => {
    const mockSdk = {
      createRow: vi.fn().mockImplementation(async (db, table, data) => ({
        $id: 'session-123',
        ...data})),
    };

    const flow = new KylrixFlow(mockSdk);
    
    const result = await flow.startFocusSession('db-id', 'table-id', 'user-789', 'task-123');

    expect(mockSdk.createRow).toHaveBeenCalledTimes(1);
    expect(mockSdk.createRow).toHaveBeenCalledWith('db-id', 'table-id', expect.objectContaining({
      userId: 'user-789',
      taskId: 'task-123',
      status: 'active'}));
    expect(result).toHaveProperty('$id', 'session-123');
    expect(result).toHaveProperty('startTime');
  });
});
