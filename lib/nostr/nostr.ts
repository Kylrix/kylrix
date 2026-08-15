import * as secp256k1 from "@noble/secp256k1";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "./crypto";

// Configure secp256k1 with the sha256 hash function
secp256k1.hashes.sha256 = (message) => sha256(message);

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

function getEventHash(event: Omit<NostrEvent, "id" | "sig">): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
  return bytesToHex(sha256(new TextEncoder().encode(serialized)));
}

export function signEvent(event: Omit<NostrEvent, "id" | "sig">, privateKey: Uint8Array): NostrEvent {
  const id = getEventHash(event);
  const sigBytes = secp256k1.schnorr.sign(hexToBytes(id), privateKey);
  return {
    ...event,
    id,
    sig: bytesToHex(sigBytes)};
}

function verifyEvent(event: NostrEvent): boolean {
  try {
    const id = getEventHash(event);
    if (id !== event.id) return false;
    return secp256k1.schnorr.verify(hexToBytes(event.sig), hexToBytes(id), hexToBytes(event.pubkey));
  } catch {
    return false;
  }
}

export class NostrRelayPool {
  private urls: string[];
  private sockets: Map<string, WebSocket> = new Map();
  private listeners: Set<(event: NostrEvent) => void> = new Set();
  private subscriptions: Map<string, Record<string, unknown>[]> = new Map(); // subId -> filters

  constructor(urls: string[]) {
    this.urls = urls;
  }

  private reconnectCounts: Map<string, number> = new Map();
  private maxReconnectAttempts = 3;

  public connect() {
    if (typeof WebSocket === 'undefined') return;
    for (const url of this.urls) {
      if (this.sockets.has(url)) continue;
      try {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          this.reconnectCounts.set(url, 0);
          // Resubscribe on reconnect
          for (const [subId, filters] of this.subscriptions.entries()) {
            ws.send(JSON.stringify(["REQ", subId, ...filters]));
          }
        };
        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data[0] === "EVENT" && data[2]) {
              const event = data[2] as NostrEvent;
              if (verifyEvent(event)) {
                for (const listener of this.listeners) {
                  listener(event);
                }
              }
            }
          } catch {
            // Ignore malformed relay frame
          }
        };
        ws.onerror = () => {
          // Silent catch to prevent dev console spam / unhandled socket errors
        };
        ws.onclose = () => {
          this.sockets.delete(url);
          const currentCount = this.reconnectCounts.get(url) || 0;
          if (currentCount < this.maxReconnectAttempts) {
            this.reconnectCounts.set(url, currentCount + 1);
            const delay = Math.min(15000, 3000 * Math.pow(2, currentCount));
            setTimeout(() => this.connect(), delay);
          }
        };
        this.sockets.set(url, ws);
      } catch {
        // Socket instantiation error ignored gracefully
      }
    }
  }

  public subscribe(subId: string, filters: Record<string, unknown>[]) {
    this.subscriptions.set(subId, filters);
    for (const ws of this.sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(["REQ", subId, ...filters]));
      }
    }
  }

  public unsubscribe(subId: string) {
    this.subscriptions.delete(subId);
    for (const ws of this.sockets.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(["CLOSE", subId]));
      }
    }
  }

  public publish(event: NostrEvent): Promise<void> {
    const entries = Array.from(this.sockets.entries());
    const promises = entries.map(([, ws]) => {
      return new Promise<void>((resolve) => {
        const send = () => {
          try { ws.send(JSON.stringify(['EVENT', event])); } catch { /* ignore */ }
          resolve();
        };
        if (ws.readyState === WebSocket.OPEN) {
          send();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // Wait for open, timeout after 5 s
          const timer = setTimeout(resolve, 5000);
          const prevOpen = ws.onopen as ((ev: Event) => void) | null;
          ws.onopen = (ev: Event) => {
            clearTimeout(timer);
            send();
            if (prevOpen) prevOpen.call(ws, ev);
          };
          const prevClose = ws.onclose as ((ev: CloseEvent) => void) | null;
          ws.onclose = (ev: CloseEvent) => {
            clearTimeout(timer);
            resolve();
            if (prevClose) prevClose.call(ws, ev);
          };
        } else {
          resolve();
        }
      });
    });
    return Promise.all(promises).then(() => {});
  }

  /**
   * Connect, publish, then close after all relays have acknowledged or timed out.
   * Use this for fire-and-forget engagement events (replies, likes, reposts).
   */
  public async publishAndClose(event: NostrEvent): Promise<void> {
    this.connect();
    await this.publish(event);
    // Give relays a moment to confirm receipt before tearing down
    setTimeout(() => this.close(), 800);
  }

  public addListener(listener: (event: NostrEvent) => void) {
    this.listeners.add(listener);
  }

  public removeListener(listener: (event: NostrEvent) => void) {
    this.listeners.delete(listener);
  }

  public close() {
    for (const ws of this.sockets.values()) {
      ws.close();
    }
    this.sockets.clear();
  }
}
