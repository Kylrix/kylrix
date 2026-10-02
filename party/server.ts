import { Server, routePartykitRequest, type Connection } from "partyserver";

export class WorkspaceServer extends Server {
  onConnect(conn: Connection) {
    console.log(`[party] Client ${conn.id} connected to room ${this.name}`);
  }

  onMessage(conn: Connection, message: string) {
    try {
      // Broadcast updates to all other participants in the room
      this.broadcast(message, [conn.id]);
    } catch (err) {
      console.warn("[party] Error broadcasting message:", err);
    }
  }

  onClose(conn: Connection) {
    console.log(`[party] Client ${conn.id} disconnected from room ${this.name}`);
  }
}

export default {
  async fetch(request: Request, env: any, _ctx: any): Promise<Response> {
    const response = await routePartykitRequest(request, env);
    if (response) return response;
    return new Response("Kylrix Realtime PartyServer OK", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  },
};
