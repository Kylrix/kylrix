import { Kylrix } from './index';

/**
 * Kylrix.Connect: The Communication Relay Module.
 * Domain: connect.kylrix.space
 */
export class KylrixConnect {
  constructor(private sdk: Kylrix) {}

  /**
   * Sends a message to a conversation.
   */
  async sendMessage(databaseId: string, tableId: string, data: {
    conversationId: string;
    senderId: string;
    type: 'text' | 'image' | 'video' | 'call_signal';
    content?: string;
    attachments?: string[];
  }) {
    return await this.sdk.createRow(databaseId, tableId, {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Marks a message as read by a specific user.
   */
  async markAsRead(databaseId: string, tableId: string, messageId: string, userId: string) {
    const message = await this.sdk.getRow<any>(databaseId, tableId, messageId);
    const readBy = new Set(message.readBy || []);
    readBy.add(userId);
    
    return await this.sdk.updateRow(databaseId, tableId, messageId, {
      readBy: Array.from(readBy),
    });
  }

  /**
   * Subscribes to incoming call signals for a user.
   * Note: Disabled because Realtime/Pulse is not available in appwrite 20.1.0
   */
  // onIncomingCall(databaseId: string, pulseTableId: string, callback: (data: any) => void) {
  //   return this.sdk.pulse.on('call.incoming', databaseId, pulseTableId, callback);
  // }
}
