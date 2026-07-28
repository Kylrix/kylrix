---
name: ui.gpu-compositor-feed-stability
description: Fix GPU compositor tearing and scanline artifacts in live feeds (Nostr, social timelines). Use when feed cards glitch between items, show horizontal static noise bands, or morph content on their own during relay updates.
---

# GPU Compositor Feed Stability

Use when `/connect`, profile feeds, or other live timelines show **horizontal static noise / scanline bands between cards** — not a CSS bug, but Chromium GPU tile rasterizer corruption.

## Root cause

Live feeds (especially Nostr) re-sort on every relay event. That shifts every card's DOM position and forces a full-grid compositor repaint. Large dirty rects on mobile GPUs surface as uninitialized framebuffer memory (noise bands in card gaps).

Compounded by:
- `will-change`, `translate3d`, `backdrop-filter`, `blur`, nested GPU layers
- CSS `line-clamp` / expanding link previews causing layout thrash
- `useEffect` patching visible rows in place (author name resolution, pending-count banners)

## Fix checklist

### 1. Freeze the rendered list

Never re-sort or splice `displayItems` from live subscription traffic.

```ts
// Snapshot only on mount + explicit refresh
const syncDisplay = useCallback(() => {
  setDisplayItems(buildItems(ecosystem, nostrFeed, profiles));
  setCurrentPage(1);
}, []);

// Seed once when data arrives
useEffect(() => {
  if (!hasSeededRef.current && hasData) {
    hasSeededRef.current = true;
    syncDisplay();
  }
}, [ecosystemMoments, nostrFeed]);
```

Relay events accumulate in refs/state but do **not** touch `displayItems` until the user taps refresh.

### 2. Page-based navigation (not infinite scroll)

Match notes pagination: fixed `PAGE_SIZE`, Prev/Next controls, slice per page.

```ts
const items = useMemo(() => {
  const start = (currentPage - 1) * PAGE_SIZE;
  return displayItems.slice(start, start + PAGE_SIZE);
}, [displayItems, currentPage]);
```

No `loadMore` stacking, no auto-insert at top, no in-place row patches.

### 3. Fixed card geometry

```tsx
<article
  style={{
    contentVisibility: 'auto',
    containIntrinsicSize: 'auto 196px',
  }}
  className="h-[196px] overflow-hidden ..."
>
```

- Fixed height, no `line-clamp` (use JS char truncation)
- No link preview cards, no expanding media
- `React.memo` with id/content equality comparator

### 4. Strip GPU layer promotion

Remove from feed chrome and cards:
- `will-change: transform|opacity`
- `transform: translate3d(0,0,0)` / `translateZ(0)`
- `backdrop-filter` / `backdrop-blur` → solid `bg-[#0A0908]`
- `filter: blur()` on decorative elements
- Hover `scale` / `translateY` on list items

Global chrome: `contain: layout style paint` on sidebar/topbar instead of `will-change`.

### 5. Batch relay ingestion

In `useNostrFeed`, queue events and flush every ~2.5s. Feed hook reads from cache but does not re-render the visible page until refresh.

### 6. No in-place morphing

Do **not** run effects that map over `displayItems` to update author names, counts, or previews after render. Resolve profiles at snapshot time only; user refreshes to see updated handles.

## Reference implementation

- `components/connect/useConnectMomentsFeed.ts` — frozen snapshot + page slice
- `components/connect/ConnectMomentsPanel.tsx` — `Pagination` Prev/Next
- `components/connect/MomentCard.tsx` — fixed height, `content-visibility`, memo
- `hooks/useNostrFeed.ts` — batched relay flush

## Related

See `ui.render-glitch-detector` for subscription/animation feedback loops on non-feed surfaces.
