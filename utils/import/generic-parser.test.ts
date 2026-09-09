import { describe, it, expect } from 'vitest';
import { parseCSV, detectColumnMapping, mapRowsToItems } from './generic-parser';

describe('generic-parser', () => {
  it('parses CSV strings with quotes and comma/semicolon delimiters', () => {
    const csv = `Title,Username,Password,URL,Notes
"My App",user@test.com,"p@ss,word","https://example.com","some notes"
"Semi App";admin;123456;"https://semi.com";""`;

    const rows = parseCSV(csv);
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual(['Title', 'Username', 'Password', 'URL', 'Notes']);
    expect(rows[1]).toEqual(['My App', 'user@test.com', 'p@ss,word', 'https://example.com', 'some notes']);
    expect(rows[2]).toEqual(['Semi App', 'admin', '123456', 'https://semi.com', '']);
  });

  it('detects column mappings from headers', () => {
    const rows = [
      ['Name', 'Login Email', 'Password', 'Website', 'Comments'],
      ['App', 'user@test.com', 'pass', 'https://test.com', 'notes'],
    ];
    const mapping = detectColumnMapping(rows);
    expect(mapping.nameIdx).toBe(0);
    expect(mapping.usernameIdx).toBe(1);
    expect(mapping.passwordIdx).toBe(2);
    expect(mapping.urlIdx).toBe(3);
    expect(mapping.notesIdx).toBe(4);
  });

  it('detects column mappings from values when no headers are present', () => {
    const rows = [
      ['Item1', 'admin@site.org', 'S3cur3!Pass123', 'https://site.org'],
    ];
    const mapping = detectColumnMapping(rows);
    expect(mapping.usernameIdx).toBe(1);
    expect(mapping.passwordIdx).toBe(2);
    expect(mapping.urlIdx).toBe(3);
  });

  it('handles empty rows array in detectColumnMapping', () => {
    expect(detectColumnMapping([])).toEqual({
      nameIdx: -1,
      usernameIdx: -1,
      passwordIdx: -1,
      urlIdx: -1,
      notesIdx: -1,
    });
  });

  it('maps CSV rows to ImportItems using mapping with or without header', () => {
    const rows = [
      ['Title', 'User', 'Pass', 'URL', 'Notes'],
      ['Gmail', 'user@gmail.com', 'secret123', 'https://gmail.com', 'Personal mail'],
      ['', 'anon@gmail.com', 'pass456', '', ''],
    ];
    const mapping = {
      nameIdx: 0,
      usernameIdx: 1,
      passwordIdx: 2,
      urlIdx: 3,
      notesIdx: 4,
    };
    const items = mapRowsToItems(rows, mapping, true);
    expect(items.length).toBe(2);
    expect(items[0].name).toBe('Gmail');
    expect(items[1].name).toBe('Imported Item 2');

    const noHeaderItems = mapRowsToItems([['App', 'usr', 'pwd']], { nameIdx: 0, usernameIdx: 1, passwordIdx: 2, urlIdx: -1, notesIdx: -1 }, false);
    expect(noHeaderItems.length).toBe(1);
  });
});
