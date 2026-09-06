/**
 * Local-only activity notifications — no Appwrite reads.
 * Workspace intel and other ambient tips land here so the bell stays LocalEngine-first.
 */

import type { KylrixNotification } from '@/components/layout/NotificationDrawer';

export function workspaceIntelNotifsKey(userId: string): string {
  return `kylrix_workspace_intel_notifs_${userId}`;
}

export function activityNotifsKey(userId: string): string {
  return `kylrix_activity_notifications_${userId}`;
}

function formatTimeAgo(ts: number): string {
  const diffMin = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

export async function listWorkspaceIntelNotifications(
  userId: string,
): Promise<KylrixNotification[]> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const hit = await LocalEngine.cacheGet<KylrixNotification[]>(workspaceIntelNotifsKey(userId));
  return Array.isArray(hit) ? hit : [];
}

/** Prepend a system tip into LocalEngine notification caches (0 DB). */
export async function pushLocalSystemNotification(
  userId: string,
  input: {
    id: string;
    title: string;
    message: string;
    accent?: string;
    actionHref?: string;
    timestamp?: number;
  },
): Promise<KylrixNotification> {
  const { LocalEngine } = await import('@/lib/services/LocalEngine');
  const ts = input.timestamp ?? Date.now();
  const row: KylrixNotification = {
    id: input.id,
    category: 'system',
    title: input.title,
    message: input.message,
    time: formatTimeAgo(ts),
    timestamp: ts,
    read: false,
    accent: input.accent || '#6366F1',
    actionHref: input.actionHref || '/workspaces',
    source: 'system',
  };

  const intelKey = workspaceIntelNotifsKey(userId);
  const activityKey = activityNotifsKey(userId);
  const prevIntel = (await LocalEngine.cacheGet<KylrixNotification[]>(intelKey)) || [];
  const nextIntel = [row, ...prevIntel.filter((n) => n.id !== row.id)].slice(0, 40);
  await LocalEngine.cacheSet(intelKey, nextIntel);

  const prevActivity = (await LocalEngine.cacheGet<KylrixNotification[]>(activityKey)) || [];
  const nextActivity = [row, ...prevActivity.filter((n) => n.id !== row.id)].slice(0, 100);
  await LocalEngine.cacheSet(activityKey, nextActivity);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('kylrix:local-notifications', { detail: { userId, notification: row } }),
    );
  }

  return row;
}
