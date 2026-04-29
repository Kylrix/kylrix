export interface MessageEnvelope {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  sentAt?: string;
  readAt?: string | null;
}

export function createMessageEnvelope(envelope: MessageEnvelope) {
  return envelope;
}
