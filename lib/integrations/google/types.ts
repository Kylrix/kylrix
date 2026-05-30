export type KylrixApp = 'root' | 'accounts' | 'kylrix' | 'vault' | 'flow' | 'note' | 'connect';

export type GoogleServiceKey = 'keep' | 'tasks' | 'calendar' | 'drive' | 'gmail' | 'docs';

export interface GoogleService {
  key: GoogleServiceKey;
  name: string;
  googlename: string;
  description: string;
  connected: boolean;
  syncActive: boolean;
  destination: string;
  app: KylrixApp;
  lastSync: string | null;
  accent: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'warn' | 'error';
  service: string;
  message: string;
}

export interface KeepMapping {
  importMode: 'all' | 'filtered';
  markdownCategory: string; // Kylrix Note category
  autoTag: boolean;
}

export interface TasksMapping {
  flowBoard: string; // Kylrix Flow board/stream
  priorityThreshold: 'all' | 'high';
}

export interface CalendarMapping {
  flowAgenda: string; // Kylrix Flow agenda / schedule stream
  syncRangeDays: number; // e.g., 30, 90, 180
}

export interface DriveMapping {
  vaultDirectory: string; // Kylrix Vault location
  encryptOnImport: boolean;
}

export interface GmailMapping {
  connectChannel: string; // Kylrix Connect channel destination
  filterKeyword: string;
}

export interface DocsMapping {
  noteDirectory: string; // Kylrix Note location
  importAsMarkdown: boolean;
}

export interface GoogleDoc {
  id: string;
  title: string;
  bodyContent?: string;
  lastModified?: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  location?: string;
}
