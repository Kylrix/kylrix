export interface ImportItem {
  name?: string | null;
  url?: string | null;
  username?: string | null;
  password?: string | null;
  notes?: string | null;
  _status: 'new' | 'duplicate' | 'merged';
  _originalId?: string; // For tracking
  _mergeDetails?: string[]; // What happened?
  [key: string]: unknown; // Allow other props
}

export class DeduplicationEngine {
  
  /**
   * Normalizes a URL to its primary registered domain for aggressive matching.
   * e.g. https://login.microsoftonline.com/auth -> microsoftonline.com
   */
  public static normalizeDomain(url?: string | null): string {
    if (!url) return "";
    try {
      let host = url.trim().toLowerCase();
      if (!host.startsWith("http://") && !host.startsWith("https://")) {
        host = "https://" + host;
      }
      const hostname = new URL(host).hostname;
      const parts = hostname.split(".");
      
      // Heuristic for country code TLDs (e.g. co.uk, com.br)
      if (parts.length > 2) {
        const p1 = parts[parts.length - 1];
        const p2 = parts[parts.length - 2];
        if ((p2.length <= 3 && p1.length <= 2) || (p2.length <= 2 && p1.length <= 3)) {
          return parts.slice(-3).join(".");
        }
        return parts.slice(-2).join(".");
      }
      return hostname;
    } catch {
      // Fallback: cleanup string
      let cleaned = (url || "").toLowerCase().trim();
      cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?/, "");
      return cleaned.split("/")[0] || cleaned;
    }
  }

  /**
   * Calculate Levenshtein Distance to detect close username typos/patches.
   */
  private static getLevenshteinDistance(a: string, b: string): number {
    const tmp: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return tmp[a.length][b.length];
  }

  /**
   * Verify if two usernames are highly similar (typos or subsets).
   */
  private static areUsernamesSimilar(u1: string, u2: string): boolean {
    const clean1 = u1.trim().toLowerCase();
    const clean2 = u2.trim().toLowerCase();
    
    if (clean1 === clean2) return true;
    if (!clean1 || !clean2) return true; // Empty merges with populated

    // If Levenshtein distance is small compared to length
    const distance = this.getLevenshteinDistance(clean1, clean2);
    const minLength = Math.min(clean1.length, clean2.length);
    
    if (minLength <= 4) return distance <= 1;
    return distance <= 2;
  }

  /**
   * Phase 1: Identify and Mark Exact Duplicates
   */
  static processExactDuplicates(items: ImportItem[]): ImportItem[] {
    const uniqueMap = new Map<string, ImportItem>();

    for (const item of items) {
      const fingerprint = `${item.url || ''}|${item.username || ''}|${item.password || ''}`;
      
      if (uniqueMap.has(fingerprint)) {
        const existing = uniqueMap.get(fingerprint)!;
        const existingScore = (existing.notes?.length || 0) + (existing.name?.length || 0);
        const currentScore = (item.notes?.length || 0) + (item.name?.length || 0);

        if (currentScore > existingScore) {
          uniqueMap.set(fingerprint, item);
        }
      } else {
        uniqueMap.set(fingerprint, item);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Phase 2: Aggressive Smart Merge
   * Merges matches with similar domains, usernames, and passwords (handles missing passwords and notes merge).
   */
  static processSmartMerge(items: ImportItem[]): ImportItem[] {
    const merged: ImportItem[] = [];

    for (const item of items) {
      let isMerged = false;
      const itemDomain = this.normalizeDomain(item.url);
      const itemUser = (item.username || "").trim();
      const itemPass = (item.password || "").trim();

      for (let i = 0; i < merged.length; i++) {
        const target = merged[i];
        const targetDomain = this.normalizeDomain(target.url);
        const targetUser = (target.username || "").trim();
        const targetPass = (target.password || "").trim();

        // 1. Domain must match
        if (itemDomain !== targetDomain && itemDomain && targetDomain) continue;

        // 2. Check password compatibility:
        // Must either match, or one of them must be empty (which will be filled by the other)
        const isPassCompatible = itemPass === targetPass || !itemPass || !targetPass;
        if (!isPassCompatible) continue;

        // 3. Check username similarity:
        const isUserCompatible = this.areUsernamesSimilar(itemUser, targetUser);
        if (!isUserCompatible) continue;

        // Found matching credential! Merge them.
        const newName = (item.name?.length || 0) > (target.name?.length || 0) ? item.name : target.name;
        
        let newNotes = target.notes || "";
        if (item.notes && !newNotes.includes(item.notes)) {
          newNotes = newNotes ? `${newNotes}\n\n[Merged Note]: ${item.notes}` : item.notes;
        }

        const newUrl = (item.url?.length || 0) > (target.url?.length || 0) ? item.url : target.url;
        const newUsername = itemUser.length > targetUser.length ? itemUser : targetUser;
        const newPassword = itemPass || targetPass;

        merged[i] = {
          ...target,
          name: newName,
          username: newUsername,
          password: newPassword,
          notes: newNotes,
          url: newUrl,
          _status: 'merged',
          _mergeDetails: [...(target._mergeDetails || []), `Aggressively merged with "${item.name || 'Untitled'}"`]};

        isMerged = true;
        break;
      }

      if (!isMerged) {
        merged.push({ ...item });
      }
    }

    return merged;
  }

  /**
   * Helper to check if an incoming item matches an existing item in the database.
   */
  static isDuplicateOfExisting(incoming: ImportItem, existingItems: any[]): boolean {
    const incDomain = this.normalizeDomain(incoming.url);
    const incUser = (incoming.username || "").trim().toLowerCase();
    const incPass = (incoming.password || "").trim();

    return existingItems.some(ext => {
      const extDomain = this.normalizeDomain(ext.url);
      const extUser = (ext.username || "").trim().toLowerCase();
      const extPass = (ext.password || "").trim();

      // Check same domain
      if (incDomain !== extDomain && incDomain && extDomain) return false;

      // Check username match or high similarity
      const usernameMatch = incUser === extUser || this.areUsernamesSimilar(incUser, extUser);
      if (!usernameMatch) return false;

      // If passwords are exact, or incoming has no password (existing has it), it is duplicate
      return incPass === extPass || !incPass;
    });
  }
}
