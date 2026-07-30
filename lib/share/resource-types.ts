export type PublicResourceType = 
  | 'note' 
  | 'credential' 
  | 'totp' 
  | 'task' 
  | 'goal' 
  | 'form' 
  | 'event' 
  | 'project' 
  | 'huddle' 
  | 'call' 
  | 'moment'
  | 'agent_session'
  | 'agent_conversation';

export interface PublicUrlOptions {
  projectId?: string;
  isGuest?: boolean;
}
