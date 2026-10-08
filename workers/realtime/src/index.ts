import { DurableObject } from "cloudflare:workers";

export interface Env {
  REALTIME_ROOM: DurableObjectNamespace<KylrixRealtimeRoom>;
}

export class KylrixRealtimeRoom extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight inside DO
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // HTTP POST to broadcast to all clients connected to this room
    if (request.method === "POST") {
      try {
        const body = await request.text();
        const websockets = this.ctx.getWebSockets();
        for (const ws of websockets) {
          try {
            ws.send(body);
          } catch {}
        }
        return new Response(JSON.stringify({ ok: true, recipients: websockets.length }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }
    }

    // WebSocket upgrade
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket Upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    const websockets = this.ctx.getWebSockets();
    for (const client of websockets) {
      if (client !== ws) {
        try {
          client.send(text);
        } catch {}
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, _wasClean: boolean): Promise<void> {
    try {
      ws.close(code, reason);
    } catch {}
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try {
      ws.close(1011, "WebSocket error");
    } catch {}
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    // Health check
    if (url.pathname === "/" || url.pathname === "/health") {
      return new Response(
        JSON.stringify({
          status: "healthy",
          service: "kylrix-realtime",
          version: "1.0.0",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    // Match route: /room/:roomId or /parties/realtime/:roomId or /ws/:roomId or /:roomId
    const segments = url.pathname.split("/").filter(Boolean);
    let roomId = "global";

    if (segments.length >= 2 && (segments[0] === "room" || segments[0] === "ws")) {
      roomId = segments[1];
    } else if (segments.length >= 3 && segments[0] === "parties") {
      roomId = segments[2];
    } else if (segments.length >= 1) {
      roomId = segments[0];
    }

    if (!roomId) {
      return new Response("Missing room parameter", { status: 400 });
    }

    const id = env.REALTIME_ROOM.idFromName(roomId);
    const stub = env.REALTIME_ROOM.get(id);

    return stub.fetch(request);
  },
};
