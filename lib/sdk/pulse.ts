// DISABLED: appwrite 20.1.0 does not export Realtime class
// import { Realtime } from 'appwrite';
// import { TABLE_DB } from './ecosystem';
// 
// export type PulseEvent = 'call.incoming' | 'notification.new' | 'task.update' | 'vault.unlock';
// 
// /**
//  * High-level Orchestrator for Ecosystem Realtime "Gossip"
//  */
// export class KylrixPulse {
//   constructor(private realtime: Realtime) {}
// 
//   /**
//    * Subscribes to a standardized TableDB row event.
//    */
//   subscribeToRow(databaseId: string, tableId: string, rowId: string, callback: (payload: any) => void) {
//     const channel = TABLE_DB.getEventPath(databaseId, tableId, rowId);
//     return this.realtime.subscribe(channel, (response) => {
//       callback(response.payload);
//     });
//   }
// 
//   /**
//    * Subscribes to ecosystem-wide "Pulse" signals.
//    * These are transient events typically broadcasted via a dedicated 'pulse' table.
//    */
//   on(event: PulseEvent, databaseId: string, pulseTableId: string, callback: (data: any) => void) {
//     const channel = TABLE_DB.getEventPath(databaseId, pulseTableId);
//     return this.realtime.subscribe(channel, (response) => {
//       const payload = response.payload as any;
//       if (payload.type === event) {
//         callback(payload.data);
//       }
//     });
//   }
// }

