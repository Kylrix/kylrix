import type * as Party from "partykit/server";

export default class WorkspaceServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // Triggered when a client connects (e.g. opens a workspace, note, or thread)
  onConnect(conn: Party.Connection, _ctx: Party.ConnectionContext) {
    console.log(`[party] Client ${conn.id} connected to room ${this.room.id}`);
  }

  // Handle incoming messages
  onMessage(message: string, sender: Party.Connection) {
    try {
      const data = JSON.parse(message);
      // Broadcast updates to all other participants in the room
      this.room.broadcast(JSON.stringify(data), [sender.id]);
    } catch (err) {
      console.warn('[party] Invalid JSON message received:', err);
    }
  }

  onClose(conn: Party.Connection) {
    console.log(`[party] Client ${conn.id} left room ${this.room.id}`);
  }
}
