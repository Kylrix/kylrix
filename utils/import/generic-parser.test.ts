import { describe, it, expect } from 'vitest';
import { parseCSV, detectColumnMapping, mapRowsToItems } from './generic-parser';

describe('generic-parser', () => {
  describe('parseCSV', () => {
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

    it('handles escaped quotes and windows CRLF line endings', () => {
      const csv = "\"Header1\",\"Header2\"\r\n\"Val\"\"1\",\"Val2\"\r\n";
      const rows = parseCSV(csv);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(['Header1', 'Header2']);
      expect(rows[1]).toEqual(['Val"1', 'Val2']);
    });

    it('returns empty array for empty string input or whitespace-only input', () => {
      expect(parseCSV('')).toEqual([]);
      expect(parseCSV('   \n\r\n  ')).toEqual([]);
    });

    it('handles newlines inside quoted fields', () => {
      const csv = 'Name,Notes\n"Item 1","Line 1\nLine 2\r\nLine 3"\n"Item 2","Simple note"';
      const rows = parseCSV(csv);
      expect(rows.length).toBe(3);
      expect(rows[0]).toEqual(['Name', 'Notes']);
      expect(rows[1]).toEqual(['Item 1', 'Line 1\nLine 2\r\nLine 3']);
      expect(rows[2]).toEqual(['Item 2', 'Simple note']);
    });

    it('handles lone CR line endings (\r)', () => {
      const csv = 'Header1,Header2\rVal1,Val2\rVal3,Val4';
      const rows = parseCSV(csv);
      expect(rows.length).toBe(3);
      expect(rows[0]).toEqual(['Header1', 'Header2']);
      expect(rows[1]).toEqual(['Val1', 'Val2']);
      expect(rows[2]).toEqual(['Val3', 'Val4']);
    });

    it('trims leading and trailing whitespace around unquoted and quoted values', () => {
      const csv = '  Name  ,  User  ,  Pass  \n  " App Name "  ,  " user@test.com "  ,  " 1234 "  ';
      const rows = parseCSV(csv);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(['Name', 'User', 'Pass']);
      expect(rows[1]).toEqual(['App Name', 'user@test.com', '1234']);
    });

    it('handles empty fields between delimiters', () => {
      const csv = 'a,,c,;d\n,b,,';
      const rows = parseCSV(csv);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(['a', '', 'c', '', 'd']);
      expect(rows[1]).toEqual(['', 'b', '', '']);
    });

    it('parses single column input', () => {
      const csv = 'Header\nValue1\nValue2';
      const rows = parseCSV(csv);
      expect(rows.length).toBe(3);
      expect(rows[0]).toEqual(['Header']);
      expect(rows[1]).toEqual(['Value1']);
      expect(rows[2]).toEqual(['Value2']);
    });

    it('handles unclosed quote gracefully', () => {
      const csv = 'Header1,Header2\n"Unclosed quote,val2';
      const rows = parseCSV(csv);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(['Header1', 'Header2']);
      expect(rows[1]).toEqual(['Unclosed quote,val2']);
    });
  });

  describe('detectColumnMapping', () => {
    it('handles empty rows array', () => {
      expect(detectColumnMapping([])).toEqual({
        nameIdx: -1,
        usernameIdx: -1,
        passwordIdx: -1,
        urlIdx: -1,
        notesIdx: -1,
      });
    });

    it('detects column mappings from standard headers', () => {
      const rows = [
        ['Name', 'Login Email', 'Password', 'Website', 'Comments'],
        ['App', 'user@test.com', 'pass', 'https://test.com', 'notes'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping).toEqual({
        nameIdx: 0,
        usernameIdx: 1,
        passwordIdx: 2,
        urlIdx: 3,
        notesIdx: 4,
      });
    });

    it('detects alternative header keywords with mixed case and padding whitespace', () => {
      const rows = [
        ['  LABEL  ', ' USER ', ' PWD ', ' LINK ', ' DESC '],
        ['Item', 'user1', 'p1', 'http://link.com', 'info'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping).toEqual({
        nameIdx: 0,
        usernameIdx: 1,
        passwordIdx: 2,
        urlIdx: 3,
        notesIdx: 4,
      });
    });

    it('does not overwrite first matched column when multiple headers match same category', () => {
      const rows = [
        ['Title', 'Name', 'Login', 'User'],
        ['App', 'App2', 'user1', 'user2'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping.nameIdx).toBe(0);
      expect(mapping.usernameIdx).toBe(2);
    });

    it('falls back to value detection on row 1 when headers partially match', () => {
      const rows = [
        ['Title', 'CustomCol1', 'CustomCol2'],
        ['My Service', 'https://service.io/login', 'admin@service.io'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping.nameIdx).toBe(0);
      expect(mapping.urlIdx).toBe(1);
      expect(mapping.usernameIdx).toBe(2);
    });

    it('falls back to value detection on row 0 when no headers are present', () => {
      const rows = [
        ['MySecretEntry', 'admin@site.org', 'S3cur3!Pass123', 'https://site.org'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping.usernameIdx).toBe(1);
      expect(mapping.passwordIdx).toBe(2);
      expect(mapping.urlIdx).toBe(3);
      expect(mapping.nameIdx).toBe(0); // remaining unassigned index 0 mapped to nameIdx
    });

    it('handles single header row without data rows (rows.length === 1)', () => {
      const rows = [
        ['Title', 'Username', 'Password', 'URL', 'Notes'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping).toEqual({
        nameIdx: 0,
        usernameIdx: 1,
        passwordIdx: 2,
        urlIdx: 3,
        notesIdx: 4,
      });
    });

    it('assigns remaining unmatched fields sequentially to available unused indices across 5 columns', () => {
      const rows = [
        ['ColA', 'ColB', 'ColC', 'ColD', 'ColE'],
      ];
      // None of the 5 columns match any header keyword or value pattern
      const mapping = detectColumnMapping(rows);
      expect(mapping.nameIdx).toBe(0);
      expect(mapping.usernameIdx).toBe(1);
      expect(mapping.passwordIdx).toBe(2);
      expect(mapping.urlIdx).toBe(3);
      expect(mapping.notesIdx).toBe(4);
    });

    it('leaves extra columns unmapped when total columns exceed 5', () => {
      const rows = [
        ['Name', 'User', 'Pass', 'URL', 'Notes', 'Extra1', 'Extra2'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping).toEqual({
        nameIdx: 0,
        usernameIdx: 1,
        passwordIdx: 2,
        urlIdx: 3,
        notesIdx: 4,
      });
    });

    it('skips already matched indices during value detection fallback', () => {
      const rows = [
        ['Login Email', 'Website Field'],
        ['user@test.com', 'https://test.com'],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping.usernameIdx).toBe(0);
      expect(mapping.urlIdx).toBe(1);
    });

    it('properly tests complex password regex matching in value analysis', () => {
      const validPassRow = [
        ['Val1', 'Val2', 'Complex!Pass12345', 'Val4'],
      ];
      const validPassMapping = detectColumnMapping(validPassRow);
      expect(validPassMapping.passwordIdx).toBe(2);

      const invalidPassRow = [
        ['Val1', 'Val2', 'simplepass', 'Val4'],
      ];
      const invalidPassMapping = detectColumnMapping(invalidPassRow);
      expect(invalidPassMapping.passwordIdx).toBe(2);
    });

    it('handles rows with empty strings or whitespace-only cells', () => {
      const rows = [
        ['', '  ', ''],
      ];
      const mapping = detectColumnMapping(rows);
      expect(mapping.nameIdx).toBe(0);
      expect(mapping.usernameIdx).toBe(1);
      expect(mapping.passwordIdx).toBe(2);
    });
  });

  describe('mapRowsToItems', () => {
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
});
