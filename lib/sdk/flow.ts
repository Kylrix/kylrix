import { Kylrix } from './index';

/**
 * Kylrix.Flow: The Action Engine Module.
 * Domain: flow.kylrix.space
 */
export class KylrixFlow {
  constructor(private sdk: Kylrix) {}

  /**
   * Creates a new task in the Flow engine.
   */
  async createTask(databaseId: string, tableId: string, data: {
    title: string;
    userId: string;
    description?: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    tags?: string[];
  }) {
    return await this.sdk.createRow(databaseId, tableId, {
      ...data,
      status: data.status || 'pending',
      priority: data.priority || 'medium',
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * Starts a focus session Pulse signal.
   */
  async startFocusSession(databaseId: string, tableId: string, userId: string, taskId?: string) {
    return await this.sdk.createRow(databaseId, tableId, {
      userId,
      taskId,
      startTime: new Date().toISOString(),
      status: 'active',
    });
  }

  /**
   * Subscribes to task updates for a user.
   * Note: Disabled because Realtime/Pulse is not available in appwrite 20.1.0
   */
  // onTaskUpdate(databaseId: string, pulseTableId: string, callback: (data: any) => void) {
  //   return this.sdk.pulse.on('task.update', databaseId, pulseTableId, callback);
  // }
}
