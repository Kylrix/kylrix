/**
 * Kylrix Ecosystem Mesh Protocol
 * Defines the communication and state synchronization between distributed nodes.
 */

export type NodeType = 'control' | 'data' | 'secure' | 'logic' | 'message';

export interface NodeIdentity {
  id: string;
  type: NodeType;
  subdomain: string;
  version: string;
  status: 'online' | 'degraded' | 'offline';
  capabilities: string[];
}

export interface MeshMessage<T = any> {
  id: string;
  sourceNode: string;
  targetNode: string | 'all';
  type: 'RPC_REQUEST' | 'RPC_RESPONSE' | 'STATE_SYNC' | 'PULSE' | 'COMMAND';
  payload: T;
  timestamp: number;
  signature?: string; 
}

export const MeshProtocol = {
  getNodes: (): NodeIdentity[] => [
    { id: 'id', type: 'control', subdomain: 'id', version: '1.0.0', status: 'online', capabilities: ['auth', 'identity', 'quota'] },
    { id: 'note', type: 'data', subdomain: 'note', version: '1.2.0', status: 'online', capabilities: ['knowledge_graph', 'ai_search'] },
    { id: 'vault', type: 'secure', subdomain: 'vault', version: '1.1.0', status: 'online', capabilities: ['vault', 'encryption', 'passkeys'] },
    { id: 'flow', type: 'logic', subdomain: 'flow', version: '1.0.5', status: 'online', capabilities: ['task_orchestration', 'events'] },
    { id: 'connect', type: 'message', subdomain: 'connect', version: '1.0.0', status: 'online', capabilities: ['realtime_comm', 'p2p_relay'] },
  ],

  /**
   * Returns a standardized, premium icon name for a given node ID.
   * Consistent across the entire ecosystem.
   */
  getPremiumIcon: (nodeId: string) => {
    switch (nodeId) {
      case 'id': return 'Fingerprint';
      case 'note': return 'FileText';
      case 'vault': return 'Shield';
      case 'flow': return 'Waypoints';
      case 'connect': return 'Zap';
      default: return 'Layers';
    }
  },

  broadcast: (message: Omit<MeshMessage, 'id' | 'timestamp' | 'sourceNode'>, sourceId: string) => {
    const fullMessage: MeshMessage = {
      ...message,
      id: typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36),
      sourceNode: sourceId,
      timestamp: Date.now()
    };

    if (typeof window !== 'undefined') {
      const channel = new BroadcastChannel('kylrix_mesh_internal');
      channel.postMessage(fullMessage);
    }

    return fullMessage;
  },

  subscribe: (handler: (msg: MeshMessage) => void) => {
    if (typeof window === 'undefined') return () => {};

    const bc = new BroadcastChannel('kylrix_mesh_internal');
    const bcHandler = (e: MessageEvent) => handler(e.data);
    bc.addEventListener('message', bcHandler);

    const winHandler = (e: MessageEvent) => {
      // SECURITY: Validate message origin to prevent XSS spoofing (CVE-KYL-2026-001)
      const isLocalhost = e.origin.startsWith('http://localhost:');
      const isKylrixDomain = e.origin.endsWith('.kylrix.space') || e.origin === 'https://kylrix.space';
      
      if (!isLocalhost && !isKylrixDomain) return;

      if (e.data?.sourceNode && e.data?.type) {
        handler(e.data);
      }
    };
    window.addEventListener('message', winHandler);

    return () => {
      bc.removeEventListener('message', bcHandler);
      window.removeEventListener('message', winHandler);
      bc.close();
    };
  }
};
