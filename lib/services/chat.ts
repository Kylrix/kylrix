export * from './chat-shared';
import { chatServiceRef } from './chat-shared';
import { ChatServicePart1 } from './chat-part1';
import { ChatServicePart2 } from './chat-part2';
export const ChatService = {
  ...ChatServicePart1,
  ...ChatServicePart2
};

chatServiceRef.current = ChatService;
