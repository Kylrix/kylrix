import type { BitwardenItem } from "./bitwarden-types";

/**
 * Removes exact (deep-equal) duplicates from an array of BitwardenItem objects.
 * @param items Array of BitwardenItem objects
 * @returns { deduped: BitwardenItem[], removed: BitwardenItem[] }
 */
export function removeExactDuplicates<T extends object>(
  items: T[],
): { deduped: T[]; removed: T[] } {
  const seen = new Set<string>();
  const deduped: T[] = [];
  const removed: T[] = [];

  for (const item of items) {
    const key = JSON.stringify(item);
    if (seen.has(key)) {
      removed.push(item);
    } else {
      seen.add(key);
      deduped.push(item);
    }
  }

  return { deduped, removed };
}

/**
 * Utility to log removed duplicates for user feedback.
 * @param removed Array of removed duplicate items
 */
export function logRemovedDuplicates<T extends { name?: string; id?: string }>(
  removed: T[],
): void {
  if (removed.length === 0) {
    console.info("No exact duplicates found.");
    return;
  }
  console.warn(`Removed ${removed.length} exact duplicate(s):`);
  removed.forEach((item, idx) => {
    const label = item.name || item.id || JSON.stringify(item).slice(0, 80);
    console.warn(`  [${idx + 1}] ${label}`);
  });
}
