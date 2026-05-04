'use client';

import { useEffect, useRef, useState } from 'react';
import { MeshProtocol, MeshMessage } from '@/lib/ecosystem/mesh';

export function useEcosystemNode(nodeId: string) {
  const [messages, setMessages] = useState<MeshMessage[]>([]);
  const [neighbors, setNeighbors] = useState<Record<string, number>>({});
  const pulseInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Subscribe to Mesh
    const unsubscribe = MeshProtocol.subscribe((msg) => {
      setMessages(prev => [msg, ...prev].slice(0, 50));

      // Track health of neighbors via PULSE
      if (msg.type === 'PULSE') {
        setNeighbors(prev => ({
          ...prev,
          [msg.sourceNode]: Date.now()
        }));
      }

      // Handle system-wide commands (e.g. Security Lock)
      if (msg.type === 'COMMAND' && (msg.targetNode === 'all' || msg.targetNode === nodeId)) {
        if (msg.payload.action === 'LOCK_SYSTEM') {
           // Apps can react here
           console.log(`[Mesh] Received Global Lock from ${msg.sourceNode}`);
        }
      }
    });

    // 2. Start Heartbeat (PULSE)
    pulseInterval.current = setInterval(() => {
      MeshProtocol.broadcast({
        type: 'PULSE',
        targetNode: 'all',
        payload: { health: 1.0, load: Math.random() }
      }, nodeId);
    }, 5000);

    return () => {
      unsubscribe();
      if (pulseInterval.current) clearInterval(pulseInterval.current);
    };
  }, [nodeId]);

  const sendRPC = (target: string, method: string, params: any) => {
    MeshProtocol.broadcast({
      type: 'RPC_REQUEST',
      targetNode: target,
      payload: { method, params }
    }, nodeId);
  };

  const syncState = (payload: any) => {
    MeshProtocol.broadcast({
      type: 'STATE_SYNC',
      targetNode: 'all',
      payload
    }, nodeId);
  };

  return {
    messages,
    neighbors,
    sendRPC,
    syncState
  };
}
