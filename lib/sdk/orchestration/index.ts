type KylrixApp = 'accounts' | 'note' | 'flow' | 'connect' | 'vault' | 'kylrix';

type EcosystemSurfaceKind = 'page' | 'topbar' | 'drawer' | 'sidebar' | 'modal' | 'inline';
type EcosystemObjectKind = 'note' | 'task' | 'event' | 'form' | 'huddle' | 'call' | 'coupon' | 'subscription' | 'referral' | 'message' | 'credential';
export type EcosystemOpenMode = 'same-tab' | 'maximize' | 'drawer' | 'topbar' | 'sidebar' | 'modal';

export interface CrossObjectOrigin {
  sourceApp: KylrixApp;
  sourceId?: string | null;
  sourceKind?: EcosystemObjectKind | null;
  sourceRoute?: string | null;
  surface?: EcosystemSurfaceKind | null;
  sourceLabel?: string | null;
}

interface CrossObjectMetadata extends CrossObjectOrigin {
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

interface EcosystemIntent {
  kind: EcosystemObjectKind;
  targetApp: KylrixApp;
  targetRoute: string;
  openMode: EcosystemOpenMode;
  origin: CrossObjectOrigin;
  title?: string | null;
  metadata?: Record<string, unknown>;
}

interface NavigationPolicyInput {
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


function shouldOpenInSameTab(event?: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; button?: number }) {
  if (!event) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (typeof event.button === 'number' && event.button !== 0) return false;
  return true;
}

