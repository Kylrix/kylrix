export interface BottomBarItem {
  id: string;
  label: string;
  href: string;
  active?: boolean;
}

export interface BottomBarSurface {
  items: Array<BottomBarItem & { active: boolean }>;
  mobileDockHeight: number;
  mobileInset: number;
  desktopRailWidth: number;
}

export interface BottomBarSurfaceInput {
  items: BottomBarItem[];
  activeHref: string;
  mobileDockHeight?: number;
  mobileInset?: number;
  desktopRailWidth?: number;
}

export function bottomBarMatches(pathname: string | null | undefined, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href);
}

export function createBottomBarSurface(input: BottomBarSurfaceInput): BottomBarSurface {
  return {
    items: input.items.map((item) => ({
      ...item,
      active: item.active ?? bottomBarMatches(input.activeHref, item.href),
    })),
    mobileDockHeight: input.mobileDockHeight ?? 72,
    mobileInset: input.mobileInset ?? 20,
    desktopRailWidth: input.desktopRailWidth ?? 280,
  };
}

export function getBottomBarViewportOffset(viewport: VisualViewport | null | undefined = typeof window !== 'undefined' ? window.visualViewport : null) {
  if (typeof window === 'undefined') return 0;
  if (!viewport) return 0;
  return Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
}
