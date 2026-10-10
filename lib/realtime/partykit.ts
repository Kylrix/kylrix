/**
 * Sovereign PartyKit Realtime Engine for Kylrix.
 * Connects browser clients directly to the Cloudflare Durable Object worker via WebSockets.
 * Dispatches and receives instant CRUD events across all connected browser tabs and devices.
 */

export type RealtimeResponse<T = any> = {
  events: string[];
  channels: string[];
  timestamp: string;
  payload: T;
};

export type RealtimeCallback<T = any> = (response: RealtimeResponse<T>) => void;

interface ChannelSubscription {
  channels: string[];
  callback: RealtimeCallback;
}

const DEFAULT_PARTY_HOST = 'kylrix-party.kylrix.workers.dev';

export function getPartyHost(): string {
  if (typeof process !== 'undefined') {
    const raw =
      process.env.NEXT_PUBLIC_PARTY_HOST ||
      process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
      DEFAULT_PARTY_HOST;
    return raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
  return DEFAULT_PARTY_HOST;
}

class PartyKitRealtimeClient {
  private socket: WebSocket | null = null;
  private subscriptions: Set<ChannelSubscription> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isConnecting: boolean = false;
  private currentRoom: string = 'global';

  private connect() {
    if (typeof window === 'undefined') return;
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const host = getPartyHost();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${host}/room/${this.currentRoom}`;

    try {
      this.isConnecting = true;
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
          if (!data || !data.events || !data.payload) return;
          this.dispatchToSubscribers(data);
        } catch {
          // Ignore non-json frames / heartbeats
        }
      };

      this.socket.onclose = () => {
        this.isConnecting = false;
        this.socket = null;
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnecting = false;
        if (this.socket) {
          try {
            this.socket.close();
          } catch {}
          this.socket = null;
        }
        this.scheduleReconnect();
      };
    } catch {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (typeof window === 'undefined') return;
    if (this.subscriptions.size === 0) return;
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  private dispatchToSubscribers(data: {
    events: string[];
    channels?: string[];
    timestamp: string;
    payload: any;
  }) {
    for (const sub of this.subscriptions) {
      const isMatch = sub.channels.some((subChan) => {
        if (subChan === 'all' || subChan === '*') return true;
        // Check exact match in channels
        if (data.channels && data.channels.includes(subChan)) return true;
        // Check exact match or prefix match against events
        return data.events.some((evt) => {
          if (evt === subChan) return true;
          if (subChan.endsWith('.documents') && evt.includes(subChan)) return true;
          if (subChan.endsWith('.rows') && evt.includes(subChan)) return true;
          // Channel can be databases.X.collections.Y.documents.Z
          if (evt.startsWith(subChan)) return true;
          const prefix = subChan.replace(/\.(documents|rows)$/, '');
          return evt.startsWith(prefix);
        });
      });

      if (isMatch) {
        try {
          sub.callback({
            events: data.events,
            channels: data.channels || sub.channels,
            timestamp: data.timestamp || new Date().toISOString(),
            payload: data.payload,
          });
        } catch (err) {
          console.error('[PartyKit Realtime] Error in subscriber callback:', err);
        }
      }
    }
  }

  subscribe(channels: string | string[], callback: RealtimeCallback): () => void {
    const list = Array.isArray(channels) ? channels : [channels];
    const sub: ChannelSubscription = { channels: list, callback };
    this.subscriptions.add(sub);

    this.connect();

    return () => {
      this.subscriptions.delete(sub);
      if (this.subscriptions.size === 0 && this.socket) {
        setTimeout(() => {
          if (this.subscriptions.size === 0 && this.socket) {
            try {
              this.socket.close();
            } catch {}
            this.socket = null;
          }
        }, 10_000);
      }
    };
  }

  /**
   * Broadcast an event from client-side over the open WebSocket.
   */
  broadcast(event: {
    events: string[];
    channels?: string[];
    payload: any;
    timestamp?: string;
  }) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(
          JSON.stringify({
            ...event,
            timestamp: event.timestamp || new Date().toISOString(),
          })
        );
      } catch {}
    }
  }
}

export const partyRealtime = new PartyKitRealtimeClient();

/**
 * Server-side broadcaster: sends HTTP POST to the Cloudflare PartyKit Durable Object worker,
 * which immediately fans out to all connected WebSockets in that room.
 */
export async function broadcastRealtimeEvent(params: {
  databaseId?: string;
  tableId: string;
  rowId: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
}): Promise<void> {
  const host = getPartyHost();
  const dbId = params.databaseId || 'passwordManagerDb';
  const tableId = params.tableId;
  const rowId = params.rowId;
  const action = params.action;

  const eventPayload = {
    events: [
      `databases.${dbId}.collections.${tableId}.documents.${rowId}.${action}`,
      `databases.${dbId}.tables.${tableId}.rows.${rowId}.${action}`,
      `databases.${dbId}.collections.${tableId}.documents.${action}`,
      `databases.${dbId}.tables.${tableId}.rows.${action}`,
      `${tableId}.${action}`,
    ],
    channels: [
      `databases.${dbId}.collections.${tableId}.documents`,
      `databases.${dbId}.tables.${tableId}.rows`,
      `databases.${dbId}.collections.${tableId}.documents.${rowId}`,
      `databases.${dbId}.tables.${tableId}.rows.${rowId}`,
      tableId,
    ],
    timestamp: new Date().toISOString(),
    payload: params.payload,
  };

  const body = JSON.stringify(eventPayload);

  // Broadcast to global room non-blockingly
  try {
    fetch(`https://${host}/room/global`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {});
  } catch {}
}
