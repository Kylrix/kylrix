/**
 * Rugged, fail-safe generic format data parsing engine for Kylrix.
 * Handles parsing CSV, TSV, or raw text and mapping columns to credential structures.
 */

import { ImportItem } from '@/lib/import/deduplication';

export interface ColumnMapping {
  nameIdx: number;
  usernameIdx: number;
  passwordIdx: number;
  urlIdx: number;
  notesIdx: number;
}

export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentValue = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ',' || char === ';') && !inQuotes) {
      // support both comma and semicolon delimiters
      row.push(currentValue.trim());
      currentValue = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      row.push(currentValue.trim());
      if (row.length > 0 && row.some(val => val !== "")) {
        lines.push(row);
      }
      row = [];
      currentValue = "";
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentValue += char;
    }
  }
  
  if (currentValue || row.length > 0) {
    row.push(currentValue.trim());
    if (row.some(val => val !== "")) {
      lines.push(row);
    }
  }
  
  return lines;
}

/**
 * Automatically detects column mapping based on headers or values.
 */
export function detectColumnMapping(rows: string[][]): ColumnMapping {
  const mapping: ColumnMapping = {
    nameIdx: -1,
    usernameIdx: -1,
    passwordIdx: -1,
    urlIdx: -1,
    notesIdx: -1,
  };

  if (rows.length === 0) return mapping;

  const firstRow = rows[0];
  const isHeader = firstRow.some(cell => 
    /name|title|login|user|pass|pwd|url|link|uri|note|comment/i.test(cell)
  );

  if (isHeader) {
    firstRow.forEach((cell, idx) => {
      const val = cell.toLowerCase().trim();
      if (/name|title|label/i.test(val) && mapping.nameIdx === -1) {
        mapping.nameIdx = idx;
      } else if (/username|login|email|user/i.test(val) && mapping.usernameIdx === -1) {
        mapping.usernameIdx = idx;
      } else if (/password|pass|pwd/i.test(val) && mapping.passwordIdx === -1) {
        mapping.passwordIdx = idx;
      } else if (/url|website|link|uri/i.test(val) && mapping.urlIdx === -1) {
        mapping.urlIdx = idx;
      } else if (/notes|note|comment|desc/i.test(val) && mapping.notesIdx === -1) {
        mapping.notesIdx = idx;
      }
    });
  }

  // Fallback: If not detected from headers, analyze the first data row (or row 0 if no header)
  const dataRow = isHeader && rows.length > 1 ? rows[1] : rows[0];
  if (dataRow) {
    dataRow.forEach((cell, idx) => {
      // Skip already matched indices
      if (Object.values(mapping).includes(idx)) return;

      const val = cell.trim();
      if (/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i.test(val) && mapping.urlIdx === -1) {
        mapping.urlIdx = idx;
      } else if (val.includes('@') && val.includes('.') && mapping.usernameIdx === -1) {
        mapping.usernameIdx = idx;
      } else if (val.length > 12 && /[A-Z]/.test(val) && /[0-9]/.test(val) && /[^A-Za-z0-9]/.test(val) && mapping.passwordIdx === -1) {
        mapping.passwordIdx = idx;
      }
    });
  }

  // Assign remaining unmatched fields to best guesses
  const availableIndices = Array.from({ length: firstRow.length }, (_, i) => i);
  const usedIndices = new Set(Object.values(mapping).filter(v => v !== -1));

  const remaining = availableIndices.filter(i => !usedIndices.has(i));

  if (mapping.nameIdx === -1 && remaining.length > 0) {
    mapping.nameIdx = remaining.shift()!;
  }
  if (mapping.usernameIdx === -1 && remaining.length > 0) {
    mapping.usernameIdx = remaining.shift()!;
  }
  if (mapping.passwordIdx === -1 && remaining.length > 0) {
    mapping.passwordIdx = remaining.shift()!;
  }
  if (mapping.urlIdx === -1 && remaining.length > 0) {
    mapping.urlIdx = remaining.shift()!;
  }
  if (mapping.notesIdx === -1 && remaining.length > 0) {
    mapping.notesIdx = remaining.shift()!;
  }

  return mapping;
}

/**
 * Maps parsed CSV rows to standard ImportItems using a column mapping.
 */
export function mapRowsToItems(rows: string[][], mapping: ColumnMapping, hasHeader: boolean): ImportItem[] {
  const startIdx = hasHeader ? 1 : 0;
  const items: ImportItem[] = [];

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    
    const name = mapping.nameIdx !== -1 && row[mapping.nameIdx] ? row[mapping.nameIdx] : `Imported Item ${i}`;
    const username = mapping.usernameIdx !== -1 && row[mapping.usernameIdx] ? row[mapping.usernameIdx] : '';
    const password = mapping.passwordIdx !== -1 && row[mapping.passwordIdx] ? row[mapping.passwordIdx] : '';
    const url = mapping.urlIdx !== -1 && row[mapping.urlIdx] ? row[mapping.urlIdx] : '';
    const notes = mapping.notesIdx !== -1 && row[mapping.notesIdx] ? row[mapping.notesIdx] : '';

    if (username || password) {
      items.push({
        name,
        username,
        password,
        url,
        notes,
        _status: 'new',
      });
    }
  }

  return items;
}
