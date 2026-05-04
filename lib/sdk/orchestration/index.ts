export type KylrixApp = 'accounts' | 'note' | 'flow' | 'connect' | 'vault' | 'kylrix';

export type EcosystemSurfaceKind = 'page' | 'topbar' | 'drawer' | 'sidebar' | 'modal' | 'inline';
export type EcosystemObjectKind = 'note' | 'task' | 'event' | 'form' | 'huddle' | 'call' | 'coupon' | 'subscription' | 'referral' | 'message' | 'credential';
export type EcosystemOpenMode = 'same-tab' | 'maximize' | 'drawer' | 'topbar' | 'sidebar' | 'modal';

export interface CrossObjectOrigin {
  sourceApp: KylrixApp;
  sourceId?: string | null;
  sourceKind?: EcosystemObjectKind | null;
  sourceRoute?: string | null;
  surface?: EcosystemSurfaceKind | null;
  sourceLabel?: string | null;
}

export interface CrossObjectMetadata extends CrossObjectOrigin {
  sourceApp: KylrixApp;
  sourceId: string | null;
  sourceKind: EcosystemObjectKind | null;
  sourceRoute: string | null;
  surface: EcosystemSurfaceKind;
  openMode: EcosystemOpenMode;
  createdAt: string;
  minimized: boolean;
  maximizedRoute: string | null;
}

export interface EcosystemIntent {
  kind: EcosystemObjectKind;
  targetApp: KylrixApp;
  targetRoute: string;
  openMode: EcosystemOpenMode;
  origin: CrossObjectOrigin;
  title?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NavigationPolicyInput {
  suppressBrowserMenu?: boolean;
  suppressReload?: boolean;
  allowModifiedClicks?: boolean;
}

export function createCrossObjectMetadata(
  origin: CrossObjectOrigin,
  options?: {
    openMode?: EcosystemOpenMode;
    minimized?: boolean;
    maximizedRoute?: string | null;
    extra?: Record<string, unknown>;
  },
) {
  return {
    sourceApp: origin.sourceApp,
    sourceId: origin.sourceId ?? null,
    sourceKind: origin.sourceKind ?? null,
    sourceRoute: origin.sourceRoute ?? null,
    surface: origin.surface ?? 'inline',
    sourceLabel: origin.sourceLabel ?? null,
    openMode: options?.openMode ?? 'same-tab',
    createdAt: new Date().toISOString(),
    minimized: options?.minimized ?? true,
    maximizedRoute: options?.maximizedRoute ?? null,
    ...(options?.extra || {}),
  } as CrossObjectMetadata & Record<string, unknown>;
}

export function createEcosystemIntent(intent: EcosystemIntent) {
  return {
    ...intent,
    metadata: {
      ...(intent.metadata || {}),
      origin: createCrossObjectMetadata(intent.origin, {
        openMode: intent.openMode,
        minimized: intent.openMode !== 'maximize',
        maximizedRoute: intent.targetRoute,
      }),
      intentKind: intent.kind,
      targetApp: intent.targetApp,
      targetRoute: intent.targetRoute,
      openMode: intent.openMode,
      title: intent.title || null,
    },
  };
}

export function shouldOpenInSameTab(event?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }) {
  if (!event) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (typeof event.button === 'number' && event.button !== 0) return false;
  return true;
}

export function createNavigationPolicy(input: NavigationPolicyInput = {}) {
  const suppressBrowserMenu = input.suppressBrowserMenu ?? true;
  const suppressReload = input.suppressReload ?? true;
  const allowModifiedClicks = input.allowModifiedClicks ?? false;

  return {
    suppressBrowserMenu,
    suppressReload,
    allowModifiedClicks,
    shouldSuppressContextMenu: () => suppressBrowserMenu,
    shouldSuppressReload: (event?: { key?: string; metaKey?: boolean; ctrlKey?: boolean }) => {
      if (!suppressReload || !event) return false;
      const key = String(event.key || '').toLowerCase();
      return key === 'f5' || ((event.metaKey || event.ctrlKey) && key === 'r');
    },
    shouldOpenInSameTab,
  };
}
