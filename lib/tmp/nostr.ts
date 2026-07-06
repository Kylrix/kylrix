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

export function getEventHash(event: Omit<NostrEvent, "id" | "sig">): string {
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
    sig: bytesToHex(sigBytes),
  };
}

export function verifyEvent(event: NostrEvent): boolean {
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

  public connect() {
    for (const url of this.urls) {
      if (this.sockets.has(url)) continue;
      try {
        const ws = new WebSocket(url);
        ws.onopen = () => {
          console.log(`Connected to relay: ${url}`);
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
          } catch (e) {
            console.error("Error processing message from relay:", e);
          }
        };
        ws.onerror = () => {
          console.warn(`WebSocket connection failed or was rate-limited on ${url}`);
        };
        ws.onclose = () => {
          console.log(`Disconnected from relay: ${url}`);
          this.sockets.delete(url);
          // Try to reconnect in 5s
          setTimeout(() => this.connect(), 5000);
        };
        this.sockets.set(url, ws);
      } catch (e) {
        console.error(`Failed to connect to ${url}:`, e);
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
    const promises = Array.from(this.sockets.values()).map((ws) => {
      return new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(["EVENT", event]));
          resolve();
        } else {
          resolve();
        }
      });
    });
    return Promise.all(promises).then(() => {});
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
