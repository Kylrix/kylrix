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

export type ListResult<T> = { items: T[]; count: number } & T[];

export function toListResult<T>(raw: any): ListResult<T> {
  const items: T[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
        ? raw.data
        : [];
  const result = [...items] as any;
  result.items = items;
  result.count = items.length;
  return result;
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
    logout: () => this.request<{ success: boolean }>('DELETE', '/token'),
  };

  // ── 2. Workspaces ──
  public workspaces = {
    list: async (limit = 25): Promise<ListResult<WorkspaceRecord>> => {
      const raw = await this.request('GET', '/workspaces', { query: { limit } });
      return toListResult<WorkspaceRecord>(raw);
    },
    get: (id: string): Promise<WorkspaceRecord> => this.request('GET', `/workspaces/${id}`),
    create: (data: WorkspaceCreateInput): Promise<WorkspaceRecord> =>
      this.request('POST', '/workspaces', { body: data }),
    update: (id: string, data: WorkspaceUpdateInput): Promise<WorkspaceRecord> =>
      this.request('PATCH', `/workspaces/${id}`, { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/workspaces/${id}`),
    listCollaborators: async (workspaceId: string): Promise<ListResult<any>> => {
      const raw = await this.request('GET', `/workspaces/${workspaceId}/collaborators`);
      return toListResult<any>(raw);
    },
    addCollaborator: (workspaceId: string, data: { email: string; role?: string }) =>
      this.request('POST', `/workspaces/${workspaceId}/collaborators`, { body: data }),
  };

  // ── 3. Ideas (aliased to notes) ──
  public ideas = {
    list: async (opts: { limit?: number; workspaceId?: string | null } = {}): Promise<ListResult<NoteRecord>> => {
      const raw = await this.request('GET', '/notes', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
        },
      });
      return toListResult<NoteRecord>(raw);
    },
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
    articles: async (opts: { limit?: number; workspaceId?: string | null } = {}): Promise<ListResult<NoteRecord>> => {
      const res = await this.ideas.list(opts);
      const articles = (res.items || []).filter((item: any) => item.category === 'article');
      return toListResult<NoteRecord>(articles);
    },
  };
  public notes = this.ideas;

  // ── 4. Goals ──
  public goals = {
    list: async (opts: { limit?: number; workspaceId?: string | null; status?: string | null } = {}): Promise<ListResult<GoalRecord>> => {
      const raw = await this.request('GET', '/goals', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
          status: opts.status || undefined,
        },
      });
      return toListResult<GoalRecord>(raw);
    },
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
    list: async (opts: { limit?: number; workspaceId?: string | null } = {}): Promise<ListResult<EventRecord>> => {
      const raw = await this.request('GET', '/events', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
        },
      });
      return toListResult<EventRecord>(raw);
    },
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
    list: async (opts: { limit?: number; workspaceId?: string | null } = {}): Promise<ListResult<FormRecord>> => {
      const raw = await this.request('GET', '/forms', {
        query: {
          limit: opts.limit ?? 25,
          workspaceId: opts.workspaceId !== undefined ? opts.workspaceId : this.activeWorkspaceId,
        },
      });
      return toListResult<FormRecord>(raw);
    },
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
    list: async (limit = 25): Promise<ListResult<FlowRecord>> => {
      const raw = await this.request('GET', '/flows', { query: { limit } });
      return toListResult<FlowRecord>(raw);
    },
    get: (id: string): Promise<FlowRecord> => this.request('GET', `/flows/${id}`),
    create: (data: FlowCreateInput): Promise<FlowRecord> =>
      this.request('POST', '/flows', { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/flows/${id}`),
  };

  // ── 8. Chats & Hangouts ──
  public chats = {
    list: async (limit = 25): Promise<ListResult<ChatRecord>> => {
      const raw = await this.request('GET', '/chats', { query: { limit } });
      return toListResult<ChatRecord>(raw);
    },
    get: (id: string): Promise<ChatRecord> => this.request('GET', `/chats/${id}`),
    messages: async (conversationId: string, limit = 50): Promise<ListResult<ChatMessageRecord>> => {
      const raw = await this.request('GET', `/chats/${conversationId}/messages`, { query: { limit } });
      return toListResult<ChatMessageRecord>(raw);
    },
    sendMessage: (data: { conversationId?: string; participantId?: string; content: string }) =>
      this.request('POST', '/chats', { body: data }),
  };
  public hangouts = this.chats;

  // ── 9. Threads ──
  public threads = {
    list: async (opts: { limit?: number; parentKind?: string; parentId?: string } = {}): Promise<ListResult<ThreadRecord>> => {
      const raw = await this.request('GET', '/threads', { query: opts as any });
      return toListResult<ThreadRecord>(raw);
    },
    get: (id: string): Promise<ThreadRecord> => this.request('GET', `/threads/${id}`),
    messages: async (threadId: string, limit = 50): Promise<ListResult<ThreadMessageRecord>> => {
      const raw = await this.request('GET', `/threads/${threadId}/messages`, { query: { limit } });
      return toListResult<ThreadMessageRecord>(raw);
    },
    sendMessage: (threadId: string, content: string): Promise<ThreadMessageRecord> =>
      this.request('POST', `/threads/${threadId}/messages`, { body: { content } }),
  };

  // ── 10. Tags ──
  public tags = {
    list: async (): Promise<ListResult<TagRecord>> => {
      const raw = await this.request('GET', '/tags');
      return toListResult<TagRecord>(raw);
    },
    create: (data: TagCreateInput): Promise<TagRecord> =>
      this.request('POST', '/tags', { body: data }),
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request('DELETE', `/tags/${id}`),
  };

  // ── 11. Trash ──
  public trash = {
    list: async (limit = 25): Promise<ListResult<TrashRecord>> => {
      const raw = await this.request('GET', '/trash', { query: { limit } });
      return toListResult<TrashRecord>(raw);
    },
    restore: (kind: string, id: string): Promise<{ restored: boolean }> =>
      this.request('POST', '/trash/restore', { body: { kind, id } }),
    purge: (kind: string, id: string): Promise<{ purged: boolean }> =>
      this.request('POST', '/trash/purge', { body: { kind, id } }),
  };

  // ── 12. Vault & Secrets ──
  public vault = {
    list: async (opts: { limit?: number; workspaceId?: string; mek?: string } = {}): Promise<ListResult<any>> => {
      const raw = await this.request<any[]>('GET', '/vault', {
        query: {
          limit: opts.limit ?? 50,
          workspaceId: opts.workspaceId || this.activeWorkspaceId,
        },
        headers: opts.mek ? { 'x-mek': opts.mek } : undefined,
      });
      return toListResult<any>(raw);
    },
    get: (id: string, opts: { mek?: string; masterPassword?: string; shareKey?: string; format?: string; pure?: boolean } = {}) =>
      this.request<any>('GET', `/vault/${id}`, {
        query: {
          format: opts.format,
          pure: opts.pure,
        },
        headers: {
          ...(opts.mek ? { 'x-mek': opts.mek } : {}),
          ...(opts.masterPassword ? { 'x-master-password': opts.masterPassword } : {}),
          ...(opts.shareKey ? { 'x-share-key': opts.shareKey } : {}),
        },
      }),
    create: (data: any, opts: { mek?: string; workspaceId?: string } = {}) =>
      this.request<any>('POST', '/vault', {
        body: {
          ...data,
          workspaceId: data.workspaceId || opts.workspaceId || this.activeWorkspaceId,
        },
        headers: opts.mek ? { 'x-mek': opts.mek } : undefined,
      }),
    update: (id: string, data: any, opts: { mek?: string } = {}) =>
      this.request<any>('PATCH', `/vault/${id}`, {
        body: data,
        headers: opts.mek ? { 'x-mek': opts.mek } : undefined,
      }),
    delete: (id: string) => this.request('DELETE', `/vault/${id}`),
    unlockUserMek: (masterPassword?: string) =>
      this.request<{ mek: string; rawBlob?: string }>('POST', '/vault/unlock', {
        body: { masterPassword },
      }),
    resolvePublic: (id: string, opts: { shareKey?: string; format?: string; pure?: boolean } = {}) =>
      this.request<any>('GET', `/vault/public/${id}`, {
        query: {
          shareKey: opts.shareKey,
          format: opts.format,
          pure: opts.pure,
        },
      }),
  };

  // ── 13. TOTP 2FA Secrets ──
  public totp = {
    list: async (opts: { limit?: number; workspaceId?: string; mek?: string } = {}): Promise<ListResult<any>> => {
      const raw = await this.request<any[]>('GET', '/totp', {
        query: {
          limit: opts.limit ?? 50,
          workspaceId: opts.workspaceId || this.activeWorkspaceId,
        },
        headers: opts.mek ? { 'x-mek': opts.mek } : undefined,
      });
      return toListResult<any>(raw);
    },
    get: (id: string, opts: { mek?: string; masterPassword?: string } = {}) =>
      this.request<any>('GET', `/totp/${id}`, {
        headers: {
          ...(opts.mek ? { 'x-mek': opts.mek } : {}),
          ...(opts.masterPassword ? { 'x-master-password': opts.masterPassword } : {}),
        },
      }),
    create: (data: any, opts: { mek?: string; workspaceId?: string } = {}) =>
      this.request<any>('POST', '/totp', {
        body: {
          ...data,
          workspaceId: data.workspaceId || opts.workspaceId || this.activeWorkspaceId,
        },
        headers: opts.mek ? { 'x-mek': opts.mek } : undefined,
      }),
    update: (id: string, data: any, opts: { mek?: string } = {}) =>
      this.request<any>('PATCH', `/totp/${id}`, {
        body: data,
        headers: opts.mek ? { 'x-mek': opts.mek } : undefined,
      }),
    delete: (id: string) => this.request('DELETE', `/totp/${id}`),
  };

  // ── 14. Autonomous Agents & Sessions ──
  public agents = {
    listSessions: async (opts: { limit?: number; harness?: string; workspaceId?: string } = {}): Promise<ListResult<any>> => {
      const raw = await this.request<any[]>('GET', '/agents/sessions', {
        query: {
          limit: opts.limit ?? 25,
          harness: opts.harness,
          workspaceId: opts.workspaceId || this.activeWorkspaceId,
        },
      });
      return toListResult<any>(raw);
    },
    getSession: (id: string) => this.request<any>('GET', `/agents/sessions/${id}`),
    createHarnessSession: (data: { title: string; prompt?: string; harness?: string; workspaceId?: string }) =>
      this.request<any>('POST', '/agents/harness', {
        body: {
          ...data,
          workspaceId: data.workspaceId || this.activeWorkspaceId,
        },
      }),
    appendHarnessMirror: (sessionId: string, data: { transcript?: any; log?: string }) =>
      this.request<any>('POST', `/agents/sessions/${sessionId}/mirror`, { body: data }),
    deleteSession: (id: string) => this.request('DELETE', `/agents/sessions/${id}`),
    createKey: (data: { agentId: string; workspaceId?: string; scopes?: string[] }) =>
      this.request<any>('POST', '/agents/keys', { body: data }),
    provision: (data: any) => this.request<any>('POST', '/agents/provision', { body: data }),
  };

  // ── 15. Billing & Subscription ──
  public billing = {
    status: () => this.request<any>('GET', '/billing/status'),
    checkout: (data: { planId: string; months?: number; ticker?: string; couponId?: string }) =>
      this.request<any>('POST', '/billing/checkout', { body: data }),
    coins: () => this.request<any[]>('GET', '/billing/coins'),
    claimCoupon: (couponId: string) =>
      this.request<any>('POST', '/billing/coupon', { body: { couponId } }),
  };

  // ── 16. Global Search ──
  public search = {
    query: async (searchTerm: string, opts: { workspaceId?: string; limit?: number } = {}) => {
      const q = searchTerm.toLowerCase().trim();
      const wsId = opts.workspaceId || this.activeWorkspaceId;
      const limit = opts.limit || 20;

      const [ideasRes, goalsRes, eventsRes, formsRes, flowsRes] = await Promise.allSettled([
        this.ideas.list({ workspaceId: wsId, limit }),
        this.goals.list({ workspaceId: wsId, limit }),
        this.events.list({ workspaceId: wsId, limit }),
        this.forms.list({ workspaceId: wsId, limit }),
        this.flows.list(limit),
      ]);

      const results: { kind: string; id: string; title: string; snippet?: string }[] = [];

      if (ideasRes.status === 'fulfilled' && ideasRes.value?.items) {
        for (const i of ideasRes.value.items) {
          if (i.title?.toLowerCase().includes(q) || i.content?.toLowerCase().includes(q)) {
            results.push({ kind: 'idea', id: i.id, title: i.title || '(Untitled Idea)', snippet: i.content?.substring(0, 100) });
          }
        }
      }

      if (goalsRes.status === 'fulfilled' && goalsRes.value?.items) {
        for (const g of goalsRes.value.items) {
          if (g.title?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)) {
            results.push({ kind: 'goal', id: g.id, title: g.title || '(Untitled Goal)', snippet: g.description?.substring(0, 100) });
          }
        }
      }

      if (eventsRes.status === 'fulfilled' && eventsRes.value?.items) {
        for (const e of eventsRes.value.items) {
          if (e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)) {
            results.push({ kind: 'event', id: e.id, title: e.title, snippet: e.description?.substring(0, 100) });
          }
        }
      }

      if (formsRes.status === 'fulfilled' && formsRes.value?.items) {
        for (const f of formsRes.value.items) {
          if (f.title?.toLowerCase().includes(q)) {
            results.push({ kind: 'form', id: f.id, title: f.title || '(Untitled Form)' });
          }
        }
      }

      if (flowsRes.status === 'fulfilled' && flowsRes.value?.items) {
        for (const fl of flowsRes.value.items) {
          if (fl.title?.toLowerCase().includes(q) || fl.description?.toLowerCase().includes(q)) {
            results.push({ kind: 'flow', id: fl.id, title: fl.title || '(Untitled Flow)', snippet: fl.description?.substring(0, 100) });
          }
        }
      }

      return results;
    },
  };

  // ── 17. Model Context Protocol (MCP) Dispatch ──
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
