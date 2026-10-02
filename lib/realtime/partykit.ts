'use client';

import PartySocket from 'partysocket';

export interface RealtimeResponse<T = any> {
  events: string[];
  channels: string[];
  timestamp: string;
  payload: T;
}

export type RealtimeCallback<T = any> = (response: RealtimeResponse<T>) => void;

class PartyKitRealtimeEngine {
  private socket: PartySocket | null = null;
  private listeners: Map<string, Set<RealtimeCallback>> = new Map();
  private isConnecting = false;

  private getHost(): string {
    return (
      process.env.NEXT_PUBLIC_PARTYKIT_HOST ||
      (typeof window !== 'undefined' ? (window as any).__PARTYKIT_HOST__ : null) ||
      'localhost:1999'
    );
  }

  private initSocket(): PartySocket | null {
    if (typeof window === 'undefined') return null;
    if (this.socket) return this.socket;

    const host = this.getHost();
    try {
      this.socket = new PartySocket({
        host,
        room: 'kylrix-main',
      });

      this.socket.addEventListener('message', (event) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          this.dispatch(data);
        } catch (_err) {
          // Non-JSON message, ignore
        }
      });

      this.socket.addEventListener('open', () => {
        // Resubscribe active channels on reconnect
        const activeChannels = Array.from(this.listeners.keys());
        if (activeChannels.length > 0 && this.socket) {
          this.socket.send(JSON.stringify({ type: 'subscribe', channels: activeChannels }));
        }
      });
    } catch (err) {
      console.warn('[PartyKit Realtime] Connection failed:', err);
      return null;
    }

    return this.socket;
  }

  private dispatch(data: any): void {
    if (!data || !data.channels) return;
    const channels: string[] = Array.isArray(data.channels) ? data.channels : [data.channels];

    for (const ch of channels) {
      const callbacks = this.listeners.get(ch);
      if (callbacks) {
        callbacks.forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.error('[PartyKit Realtime] Callback error:', e);
          }
        });
      }
    }
  }

  /**
   * Subscribes to one or more real-time channels using PartyKit / Cloudflare WebSockets.
   * Returns an unsubscribe function. Drop-in compatible with Appwrite Realtime.
   */
  public subscribe(channels: string | string[], callback: RealtimeCallback): () => void {
    const list = Array.isArray(channels) ? channels : [channels];
    const sock = this.initSocket();

    for (const ch of list) {
      if (!this.listeners.has(ch)) {
        this.listeners.set(ch, new Set());
      }
      this.listeners.get(ch)!.add(callback);
    }

    if (sock && sock.readyState === WebSocket.OPEN) {
      sock.send(JSON.stringify({ type: 'subscribe', channels: list }));
    }

    const unsub = () => {
      for (const ch of list) {
        const set = this.listeners.get(ch);
        if (set) {
          set.delete(callback);
          if (set.size === 0) {
            this.listeners.delete(ch);
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
              this.socket.send(JSON.stringify({ type: 'unsubscribe', channels: [ch] }));
            }
          }
        }
      }
    };

    const { createThenableUnsubscribe } = require('@/lib/appwrite/client');
    return createThenableUnsubscribe(unsub);
  }

  /**
   * Broadcasts a real-time event through PartyKit.
   */
  public broadcast(channel: string, event: string, payload: any): void {
    const sock = this.initSocket();
    if (sock && sock.readyState === WebSocket.OPEN) {
      sock.send(
        JSON.stringify({
          type: 'publish',
          channel,
          events: [event],
          channels: [channel],
          payload,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }
}

export const partyRealtime = new PartyKitRealtimeEngine();
