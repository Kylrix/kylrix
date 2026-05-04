/**
 * Utility functions for date formatting with fallback logic for legacy notes
 */

import type { Notes } from '@/types/appwrite';

/**
 * Formats a date with fallback logic for notes
 * 1. Try the custom createdAt/updatedAt field
 * 2. Fall back to Appwrite's $createdAt/$updatedAt 
 * 3. Return '-' if all are null/invalid
 */
export function formatNoteDate(
  customDate: string | null | undefined,
  appwriteDate: string | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  // Default formatting options
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  // Try custom date field first
  if (customDate) {
    const date = new Date(customDate);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, defaultOptions);
    }
  }

  // Fall back to Appwrite's built-in date
  if (appwriteDate) {
    const date = new Date(appwriteDate);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, defaultOptions);
    }
  }

  // Return dash if all dates are null/invalid
  return '-';
}

/**
 * Format the creation date of a note with fallback logic
 */
export function formatNoteCreatedDate(
  note: Notes,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatNoteDate(note.createdAt, note.$createdAt, options);
}

/**
 * Format the updated date of a note with fallback logic
 */
export function formatNoteUpdatedDate(
  note: Notes,
  options?: Intl.DateTimeFormatOptions
): string {
  return formatNoteDate(note.updatedAt, note.$updatedAt, options);
}

/**
 * Check if a note has been updated (different from creation date)
 */
export function noteHasBeenUpdated(note: Notes): boolean {
  const createdDate = note.createdAt || note.$createdAt;
  const updatedDate = note.updatedAt || note.$updatedAt;
  
  // If we don't have both dates, don't show updated
  if (!createdDate || !updatedDate) {
    return false;
  }
  
  // For legacy notes, if they only have $createdAt and $updatedAt, 
  // show updated if they're different by more than 1 second
  const created = new Date(createdDate).getTime();
  const updated = new Date(updatedDate).getTime();
  
  // Show updated field if:
  // 1. Dates are significantly different (more than 1 second)
  // 2. OR we have custom updatedAt field (indicating manual update)
  return Math.abs(updated - created) > 1000 || !!note.updatedAt;
}

/**
 * Simple date formatter that returns '-' for invalid dates
 */
export function formatDateWithFallback(
  dateString: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateString) return '-';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return date.toLocaleDateString(undefined, defaultOptions);
}