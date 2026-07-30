'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export function SyncIndicator() {
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const onStart = () => setSyncing(true);
    const onEnd = () => setSyncing(false);
    window.addEventListener('kylrix:nexus:sync_start', onStart);
    window.addEventListener('kylrix:nexus:sync_end', onEnd);
    return () => {
      window.removeEventListener('kylrix:nexus:sync_start', onStart);
      window.removeEventListener('kylrix:nexus:sync_end', onEnd);
    };
  }, []);

  if (!syncing) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{
        position: 'absolute',
        top: 64,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#6366F1',
        color: 'white',
        padding: '6px 16px',
        borderRadius: '20px',
        fontSize: '0.75rem',
        fontWeight: 900,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 8px 32px rgba(99, 102, 241, 0.4)',
        zIndex: 100}}
    >
      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
      SYNCING WORKSPACE
    </motion.div>
  );
}
