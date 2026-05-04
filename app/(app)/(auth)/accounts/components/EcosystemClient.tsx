'use client';

import { useEcosystemNode } from '@/hooks/useEcosystemNode';
import { ecosystemSecurity } from '@/lib/ecosystem/security';
import { useEffect } from 'react';

/**
 * EcosystemClient
 * Responsible for joining the mesh and initializing the security layer
 * for the current node.
 */
export function EcosystemClient({ nodeId }: { nodeId: string }) {
  // Join the mesh
  useEcosystemNode(nodeId);

  useEffect(() => {
    // Initialize security synchronization
    ecosystemSecurity.init(nodeId);
  }, [nodeId]);

  return null; // Invisible logic-only component
}
