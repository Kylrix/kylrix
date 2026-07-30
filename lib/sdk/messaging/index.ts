interface MessageEnvelope {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  sentAt?: string;
  readAt?: string | null;
}


export {};
