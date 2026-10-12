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
  | 'agent_conversation'
  | 'flow';

export interface PublicUrlOptions {
  projectId?: string;
  isGuest?: boolean;
}

/** Map UnifiedFileAttachmentDrawer object sub-tab → public share resource type. */
export function attachBucketToPublicResourceType(
  bucketId: string | null | undefined,
): PublicResourceType | null {
  switch (String(bucketId || '').trim()) {
    case 'ideas':
      return 'note';
    case 'goals':
      return 'goal';
    case 'projects':
      return 'project';
    case 'forms':
      return 'form';
    case 'events':
      return 'event';
    case 'totps':
      return 'totp';
    case 'vault':
      return 'credential';
    case 'sessions':
      return 'agent_session';
    default:
      return null;
  }
}
