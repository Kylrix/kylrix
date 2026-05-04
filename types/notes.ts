export interface AIMetadata {
  summary?: string;
  topics?: string[];
  readingTime?: number;
  keyPoints?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral' | string;
  suggestions?: string[];
}

export interface Analytics {
  $id?: string;
  user_id?: string;
  resource_id?: string;
  view_count?: number;
  edit_count?: number;
  share_count?: number;
  last_accessed?: string;
  created_at?: string;
}

export interface Note {
  $id?: string;
  owner_id: string;
  title: string;
  content: string;
  format?: 'text' | 'doodle';
  is_deleted?: boolean;
  is_archived?: boolean;
  is_pinned?: boolean;
  tags?: string[];
  notebook_id?: string | null;
  created_at?: string;
  updated_at?: string;
  ai_metadata?: AIMetadata;
  // Ephemeral / expiration fields
  ephemeral?: boolean;
  expiresAt?: string | null;
  hardDestroy?: boolean;
  oneView?: boolean;
  expired?: boolean;
  analytics?: Analytics;
}

export interface DoodleStroke {
  points: [number, number][];
  color: string;
  size: number;
  opacity?: number;
}

export interface Notebook {
  $id?: string;
  owner_id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface ToDo {
  $id?: string;
  owner_id: string;
  title: string;
  completed?: boolean;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Sharing {
  $id?: string;
  resource_id: string;
  resource_type: string;
  owner_id: string;
  shared_with: string[];
  created_at?: string;
}

export interface ShareRequest {
  resourceId: string;
  resourceType: string;
  email: string;
}
