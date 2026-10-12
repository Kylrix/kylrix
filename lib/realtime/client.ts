'use client';

/**
 * Kylrix Realtime Client
 * Connects to the Cloudflare Durable Objects WebSocket relay at realtime.kylrix.space.
 * Provides resilient, auto-reconnecting room channels per user & workspace.
 */

const REALTIME_WS_BASE =
  typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname === 'localhost'
    ? 'wss://realtime.kylrix.space'
    : 'wss://realtime.kylrix.space';

const REALTIME_HTTP_BASE = 'https://realtime.kylrix.space';

export interface RealtimeMessage {
  type: 'mutation' | 'invalidate' | 'ping' | string;
  channel?: string;
  kind?: string;
  id?: string;
  data?: any;
  userId?: string;
  projectId?: string;
  timestamp?: number;
}

type MessageHandler = (msg: RealtimeMessage) => void;

class KylrixRealtimeClient {
  private sockets = new Map<string, WebSocket>();
  private handlers = new Map<string, Set<MessageHandler>>();
  private reconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeUserId: string | null = null;

  init(userId: string) {
    if (typeof window === 'undefined' || !userId || userId === 'guest') return;
    if (this.activeUserId === userId) return;
    this.activeUserId = userId;
    this.connectRoom(`user-${userId}`);
  }

  connectRoom(roomId: string): () => void {
    if (typeof window === 'undefined' || !roomId) return () => {};

    if (!this.handlers.has(roomId)) {
      this.handlers.set(roomId, new Set());
    }

    if (!this.sockets.has(roomId)) {
      this.openSocket(roomId);
    }

    return () => {
      // Keep socket alive for app session, but allow cleaning up handlers
    };
  }

  subscribe(roomId: string, handler: MessageHandler): () => void {
    if (typeof window === 'undefined') return () => {};

    if (!this.handlers.has(roomId)) {
      this.handlers.set(roomId, new Set());
    }
    this.handlers.get(roomId)!.add(handler);

    if (!this.sockets.has(roomId)) {
      this.openSocket(roomId);
    }

    return () => {
      this.handlers.get(roomId)?.delete(handler);
    };
  }

  private openSocket(roomId: string) {
    if (typeof window === 'undefined') return;

    try {
      const url = `${REALTIME_WS_BASE}/room/${encodeURIComponent(roomId)}`;
      const ws = new WebSocket(url);

      ws.onopen = () => {
        // Connected to Cloudflare DO room
      };

      ws.onmessage = (event) => {
        try {
          const parsed: RealtimeMessage = JSON.parse(event.data);
          const roomHandlers = this.handlers.get(roomId);
          if (roomHandlers) {
            for (const h of roomHandlers) {
              try {
                h(parsed);
              } catch {}
            }
          }
          // Also dispatch a global window event for components
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kylrix:realtime:message', { detail: { roomId, message: parsed } })
            );
          }
        } catch {}
      };

      ws.onclose = () => {
        this.sockets.delete(roomId);
        // Exponential backoff reconnect
        if (!this.reconnectTimers.has(roomId)) {
          const timer = setTimeout(() => {
            this.reconnectTimers.delete(roomId);
            this.openSocket(roomId);
          }, 3000);
          this.reconnectTimers.set(roomId, timer);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };

      this.sockets.set(roomId, ws);
    } catch {}
  }

  send(roomId: string, message: RealtimeMessage) {
    const ws = this.sockets.get(roomId);
    const payload = JSON.stringify({ ...message, timestamp: Date.now() });

    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(payload);
        return;
      } catch {}
    }

    // HTTP POST fallback if socket is reconnecting
    try {
      fetch(`${REALTIME_HTTP_BASE}/room/${encodeURIComponent(roomId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        mode: 'cors',
      }).catch(() => {});
    } catch {}
  }

  broadcastToUser(userId: string, message: RealtimeMessage) {
    if (!userId || userId === 'guest') return;
    this.send(`user-${userId}`, { ...message, userId });
  }
}

export const realtimeRelay = new KylrixRealtimeClient();
