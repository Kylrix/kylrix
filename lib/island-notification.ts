/**
 * Unified notification helper to trigger Dynamic Island topbar notifications.
 */
export interface IslandNotificationPayload {
  type?: 'success' | 'error' | 'warning' | 'info' | 'pro' | 'system' | 'suggestion' | 'connect';
  title: string;
  message?: string;
  app?: 'root' | 'vault' | 'flow' | 'note' | 'connect';
  duration?: number;
  majestic?: boolean;
}

export function showIslandNotification(payload: IslandNotificationPayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kylrix:island-notification', {
      detail: {
        type: payload.type || 'connect',
        title: payload.title,
        message: payload.message,
        app: payload.app || 'connect',
        majestic: payload.majestic ?? false,
        duration: payload.duration || 4000,
      }
    }));
  }
}
