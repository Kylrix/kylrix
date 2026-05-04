
export interface ImportItem {
  name?: string | null;
  url?: string | null;
  username?: string | null;
  password?: string | null;
  notes?: string | null;
  // Add other credential fields as needed, or extend Partial<Credentials> correctly if type allows
  // For now defining explicitly to fix build error
  _status: 'new' | 'duplicate' | 'merged';
  _originalId?: string; // For tracking
  _mergeDetails?: string[]; // What happened?
  [key: string]: unknown; // Allow other props
}

export class DeduplicationEngine {
  
  /**
   * Normalizes a URL to its hostname for fuzzy matching
   * e.g. https://www.google.com/login -> google.com
   */
  private static normalizeDomain(url?: string | null): string {
    if (!url) return "";
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Phase 1: Identify and Mark Exact Duplicates
   * Strict equality on: URL (Exact) + Username + Password
   */
  static processExactDuplicates(items: ImportItem[]): ImportItem[] {
    const uniqueMap = new Map<string, ImportItem>();

    for (const item of items) {
      // Create a fingerprint for strict equality
      const fingerprint = `${item.url || ''}|${item.username || ''}|${item.password || ''}`;
      
      if (uniqueMap.has(fingerprint)) {
        // We found a duplicate!
        const existing = uniqueMap.get(fingerprint)!;
        
        // Strategy: Keep the one with MORE data (Notes, Name length, etc.)
        const existingScore = (existing.notes?.length || 0) + (existing.name?.length || 0);
        const currentScore = (item.notes?.length || 0) + (item.name?.length || 0);

        if (currentScore > existingScore) {
            // Replace existing with current (better version)
            // Mark existing as duplicate? No, we filter them out in this "Strict" mode usually.
            // But if we want to return a clean list, we just update the map.
            uniqueMap.set(fingerprint, item);
        }
        // Else: Ignore current item, it's a lesser duplicate
      } else {
        uniqueMap.set(fingerprint, item);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Phase 2: Merge Similar (Fuzzy)
   * Matches on: Domain (Fuzzy) + Username
   * Passwords MUST match to merge. If passwords differ, they are treated as unique entries (history/rotation).
   */
  static processSmartMerge(items: ImportItem[]): ImportItem[] {
    const mergedMap = new Map<string, ImportItem>();
    
    for (const item of items) {
      const domain = this.normalizeDomain(item.url);
      // Key: domain + username + password
      // We group by this key. If everything matches except Name/Notes, we merge.
      const key = `${domain}|${item.username || ''}|${item.password || ''}`;

      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        
        // MERGE LOGIC
        // 1. Name: Longest name wins
        const newName = (item.name?.length || 0) > (existing.name?.length || 0) ? item.name : existing.name;

        // 2. Notes: Concatenate unique notes
        let newNotes = existing.notes || "";
        if (item.notes && !newNotes.includes(item.notes)) {
            newNotes = newNotes ? `${newNotes}\n\n[Merged]: ${item.notes}` : item.notes;
        }

        // 3. URL: Keep the most specific one (longest)
        const newUrl = (item.url?.length || 0) > (existing.url?.length || 0) ? item.url : existing.url;

        // 4. Custom Fields: Concatenate (Basic implementation)
        // ideally we parse JSON, but for now treating as string blob logic is risky. 
        // Let's stick to core fields for robust V1.

        const mergedItem: ImportItem = {
            ...existing,
            name: newName,
            notes: newNotes,
            url: newUrl,
            _status: 'merged',
            _mergeDetails: [...(existing._mergeDetails || []), `Merged with "${item.name}"`]
        };

        mergedMap.set(key, mergedItem);

      } else {
        mergedMap.set(key, item);
      }
    }

    return Array.from(mergedMap.values());
  }
}

