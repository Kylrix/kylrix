'use client';

// lib/account/partition.ts — virtual partition abstraction (no rows moved)
// Default single session maps to virtual partition acc_default -> _acc_<currentUserId>
// New accounts lazily create _acc_<newId> DBs. Switch = pointer flip + RAM purge.
const PARTITION_KEY = 'kylrix:activePartition';

export type PartitionId = string; // _acc_<userId> | acc_default

export function getActivePartitionId(): PartitionId | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PARTITION_KEY) as PartitionId | null;
}

export function setActivePartitionId(id: PartitionId) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PARTITION_KEY, id);
}

export function resolvePartitionId(userId?: string | null): PartitionId {
  if (!userId) return (getActivePartitionId() || 'acc_default') as PartitionId;
  return `_acc_${userId}` as PartitionId;
}

export function getRxDBSuffix(partitionId: PartitionId): string {
  if (partitionId === 'acc_default') return '';
  return partitionId; // _acc_<id> -> suffix for RxDB database name
}

export function ensurePartitionForUser(userId: string): PartitionId {
  const pid = `_acc_${userId}` as PartitionId;
  setActivePartitionId(pid);
  return pid;
}

// No-op migration shim: existing DB logically becomes acc_default without copy.
export function ensureVirtualDefault(userId?: string | null) {
  if (!userId) return;
  const current = getActivePartitionId();
  if (!current) setActivePartitionId(`_acc_${userId}` as PartitionId);
}
