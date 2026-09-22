/**
 * Sovereign Kylrix HTTP API Client.
 * Zero-dependency, isomorphic TypeScript SDK for interacting with Kylrix REST API and MCP endpoints.
 */

import type {
  GoalRecord,
  GoalCreateInput,
  GoalUpdateInput,
  NoteRecord,
  NoteCreateInput,
  NoteUpdateInput,
  WorkspaceRecord,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
  EventRecord,
  EventCreateInput,
  EventUpdateInput,
  FormRecord,
  FormCreateInput,
  FlowRecord,
  FlowCreateInput,
  ChatRecord,
  ChatMessageRecord,
  ThreadRecord,
  ThreadMessageRecord,
  TagRecord,
  TagCreateInput,
  TrashRecord,
  ProfileRecord,
  TokenInfoRecord,
  ScopeCatalogRecord,
} from '@/sdk/contracts';
import { PairingClient } from '@/sdk/pairing-client';

export interface KylrixClientOptions {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  workspaceId?: string;
}

export interface ApiRequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  body?: any;
}

export class KylrixApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public data?: any,
  ) {
    super(message);
    this.name = 'KylrixApiError';
  }
}

export class KylrixClient {
  private baseUrl: string;
  private token?: string;
  private customFetch: typeof fetch;
  private defaultHeaders: Record<string, string>;
  public activeWorkspaceId?: string;
  public pairing: PairingClient;

  constructor(options: KylrixClientOptions = {}) {
    let base = options.baseUrl || process.env.KYLRIX_API_URL || 'https://www.kylrix.space';
    base = base.replace(/\/+$/, '');
    if (!base.endsWith('/api/v1')) {
      base = `${base}/api/v1`;
    }
    this.baseUrl = base;
    this.token = options.token || process.env.KYLRIX_API_KEY || process.env.KYLRIX_PAT;
    this.customFetch = options.fetch || globalThis.fetch;
    this.defaultHeaders = options.headers || {};
    this.activeWorkspaceId = options.workspaceId || process.env.KYLRIX_WORKSPACE_ID;
    this.pairing = new PairingClient(this.baseUrl);
  }

  public setToken(token: string) {
    this.token = token;
  }

  public setBaseUrl(baseUrl: string) {
    let base = baseUrl.replace(/\/+$/, '');
    if (!base.endsWith('/api/v1')) {
      base = `${base}/api/v1`;
    }
    this.baseUrl = base;
    this.pairing = new PairingClient(this.baseUrl);
  }

  public setWorkspaceId(workspaceId?: string) {
    this.activeWorkspaceId = workspaceId;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: ApiRequestOptions = {},
  ): Promise<T> {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);

    if (options.query) {
      for (const [key, val] of Object.entries(options.query)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, String(val));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let body: string | undefined = undefined;
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    const res = await this.customFetch(url.toString(), {
      method,
      headers,
      body,
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      const errMsg =
        data?.error?.message ||
        data?.error ||
        data?.message ||
        `Kylrix API error HTTP ${res.status}: ${res.statusText}`;
      const errCode = data?.error?.code || data?.code || (res.status === 401 ? 'unauthorized' : 'api_error');
      throw new KylrixApiError(errMsg, res.status, errCode, data);
    }

    if (data && typeof data === 'object' && 'ok' in data && 'data' in data) {
      return data.data as T;
    }

    return data as T;
  }

  // ── 1. Authentication & Profile ──
  public auth = {
    me: (): Promise<ProfileRecord> => this.request<ProfileRecord>('GET', '/me'),
    tokenInfo: (): Promise<TokenInfoRecord> => this.request<TokenInfoRecord>('GET', '/token'),
    scopes: (): Promise<ScopeCatalogRecord> => this.request<ScopeCatalogRecord>('GET', '/token/scopes'),
    updateScopes: (scopes: string[], mode: 'grant' | 'replace' = 'grant') =>
      this.request('POST', '/token/scopes', { body: { scopes, mode } }),
    listPats: () => this.request<any[]>('GET', '/pats'),
    createPat: (data: { name: string; scopes?: string[]; expiresInDays?: number }) =>
      this.request('POST', '/pats', { body: data }),
    revokePat: (patId: string) => this.request('DELETE', `/pats/${patId}`),
    signin: (credentials: { email?: string; password?: string; identifier?: string }) =>
      this.request<{ token: string; user: any }>('POST', '/auth/signin', { body: credentials }),
    signup: (data: { email: string; password?: string; name?: string }) =>
      this.request<{ token: string; user: any }>('POST', '/auth/signup', { body: data }),
    status: () => this.request<{ authenticated: boolean; user?: any }>('GET', '/auth/status'),
  };

  // ── 2. Workspaces ──
  public workspaces = {
    list: (limit = 25): Promise<{ items: WorkspaceRecord[]; count: number }> =>
      this.request('GET', '/workspaces', { query: { limit } }),
    get: (id: string): Promise<WorkspaceRecord> => this.request('GET', `/workspaces/${id}`),
    create: (data: WorkspaceCreateInput): Promise<WorkspaceRecord> =>
      this.request('POST', '/workspaces', { body: data }),
    update: (id: string, data: WorkspaceUpdateInput): Promise<WorkspaceRecord> =>
      this.request('PATCH', `/workspaces/${id}`, { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/workspaces/${id}`),
    listCollaborators: (workspaceId: string) =>
      this.request('GET', `/workspaces/${workspaceId}/collaborators`),
    addCollaborator: (workspaceId: string, data: { email: string; role?: string }) =>
      this.request('POST', `/workspaces/${workspaceId}/collaborators`, { body: data }),
  };

  // ── 3. Notes ──
  public notes = {
    list: (opts: { limit?: number; workspaceId?: string | null } = {}): Promise<{ items: NoteRecord[]; count: number }> =>
      this.request('GET', '/notes', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
        },
      }),
    get: (id: string): Promise<NoteRecord> => this.request('GET', `/notes/${id}`),
    create: (data: NoteCreateInput): Promise<NoteRecord> =>
      this.request('POST', '/notes', {
        body: {
          ...data,
          workspaceId: data.workspaceId || this.activeWorkspaceId,
        },
      }),
    update: (id: string, data: NoteUpdateInput): Promise<NoteRecord> =>
      this.request('PATCH', `/notes/${id}`, { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/notes/${id}`),
  };

  // ── 4. Goals ──
  public goals = {
    list: (opts: { limit?: number; workspaceId?: string | null; status?: string | null } = {}): Promise<{ items: GoalRecord[]; count: number }> =>
      this.request('GET', '/goals', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
          status: opts.status || undefined,
        },
      }),
    get: (id: string): Promise<GoalRecord> => this.request('GET', `/goals/${id}`),
    create: (data: GoalCreateInput): Promise<GoalRecord> =>
      this.request('POST', '/goals', {
        body: {
          ...data,
          workspaceId: data.workspaceId || this.activeWorkspaceId,
        },
      }),
    update: (id: string, data: GoalUpdateInput): Promise<GoalRecord> =>
      this.request('PATCH', `/goals/${id}`, { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/goals/${id}`),
  };

  // ── 5. Events / Calendar ──
  public events = {
    list: (opts: { limit?: number; workspaceId?: string | null } = {}): Promise<{ items: EventRecord[]; count: number }> =>
      this.request('GET', '/events', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
        },
      }),
    get: (id: string): Promise<EventRecord> => this.request('GET', `/events/${id}`),
    create: (data: EventCreateInput): Promise<EventRecord> =>
      this.request('POST', '/events', {
        body: {
          ...data,
          workspaceId: data.workspaceId || this.activeWorkspaceId,
        },
      }),
    update: (id: string, data: EventUpdateInput): Promise<EventRecord> =>
      this.request('PATCH', `/events/${id}`, { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/events/${id}`),
  };

  // ── 6. Forms ──
  public forms = {
    list: (opts: { limit?: number; workspaceId?: string | null } = {}): Promise<{ items: FormRecord[]; count: number }> =>
      this.request('GET', '/forms', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
        },
      }),
    get: (id: string): Promise<FormRecord> => this.request('GET', `/forms/${id}`),
    create: (data: FormCreateInput): Promise<FormRecord> =>
      this.request('POST', '/forms', {
        body: {
          ...data,
          workspaceId: data.workspaceId || this.activeWorkspaceId,
        },
      }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/forms/${id}`),
  };

  // ── 7. Flows ──
  public flows = {
    list: (limit = 25): Promise<{ items: FlowRecord[]; count: number }> =>
      this.request('GET', '/flows', { query: { limit } }),
    get: (id: string): Promise<FlowRecord> => this.request('GET', `/flows/${id}`),
    create: (data: FlowCreateInput): Promise<FlowRecord> =>
      this.request('POST', '/flows', { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/flows/${id}`),
  };

  // ── 8. Chats ──
  public chats = {
    list: (limit = 25): Promise<{ items: ChatRecord[]; count: number }> =>
      this.request('GET', '/chats', { query: { limit } }),
    get: (id: string): Promise<ChatRecord> => this.request('GET', `/chats/${id}`),
    messages: (conversationId: string, limit = 50): Promise<{ items: ChatMessageRecord[]; count: number }> =>
      this.request('GET', `/chats/${conversationId}/messages`, { query: { limit } }),
    sendMessage: (data: { conversationId?: string; participantId?: string; content: string }) =>
      this.request('POST', '/chats', { body: data }),
  };

  // ── 9. Threads ──
  public threads = {
    list: (opts: { limit?: number; parentKind?: string; parentId?: string } = {}): Promise<{ items: ThreadRecord[]; count: number }> =>
      this.request('GET', '/threads', { query: opts as any }),
    get: (id: string): Promise<ThreadRecord> => this.request('GET', `/threads/${id}`),
    messages: (threadId: string, limit = 50): Promise<{ items: ThreadMessageRecord[]; count: number }> =>
      this.request('GET', `/threads/${threadId}/messages`, { query: { limit } }),
    sendMessage: (threadId: string, content: string): Promise<ThreadMessageRecord> =>
      this.request('POST', `/threads/${threadId}/messages`, { body: { content } }),
  };

  // ── 10. Tags ──
  public tags = {
    list: (): Promise<{ items: TagRecord[]; count: number }> =>
      this.request('GET', '/tags'),
    create: (data: TagCreateInput): Promise<TagRecord> =>
      this.request('POST', '/tags', { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/tags/${id}`),
  };

  // ── 11. Trash ──
  public trash = {
    list: (limit = 25): Promise<{ items: TrashRecord[]; count: number }> =>
      this.request('GET', '/trash', { query: { limit } }),
    restore: (kind: string, id: string): Promise<{ restored: boolean }> =>
      this.request('POST', '/trash/restore', { body: { kind, id } }),
    purge: (kind: string, id: string): Promise<{ purged: boolean }> =>
      this.request('POST', '/trash/purge', { body: { kind, id } }),
  };

  // ── 12. Vault ──
  public vault = {
    list: (opts: { limit?: number; kind?: string } = {}) =>
      this.request('GET', '/vault', { query: opts as any }),
    get: (id: string) => this.request('GET', `/vault/${id}`),
    create: (data: any) => this.request('POST', '/vault', { body: data }),
    resolvePublic: (id: string, shareKey?: string) =>
      this.request('GET', `/vault/public/${id}`, { query: { shareKey } }),
  };

  // ── 13. Model Context Protocol (MCP) Dispatch ──
  public mcp = {
    callTool: (name: string, args: Record<string, any> = {}) =>
      this.request('POST', '/mcp/messages', {
        body: {
          jsonrpc: '2.0',
          id: String(Date.now()),
          method: 'tools/call',
          params: { name, arguments: args },
        },
      }),
  };
}

export function createKylrixClient(options?: KylrixClientOptions): KylrixClient {
  return new KylrixClient(options);
}
