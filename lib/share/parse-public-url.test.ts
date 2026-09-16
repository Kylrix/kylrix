import { describe, it, expect } from 'vitest';
import {
  parseKylrixPublicUrl,
  extractUrlsFromText,
  splitEcosystemLinks,
} from './parse-public-url';
import { buildPublicResourceUrl } from './public-url';

describe('share/parse-public-url', () => {
  describe('parseKylrixPublicUrl', () => {
    it('parses relative in-app idea URL', () => {
      const parsed = parseKylrixPublicUrl('/idea/note_123');
      expect(parsed).not.toBeNull();
      expect(parsed?.resourceType).toBe('note');
      expect(parsed?.id).toBe('note_123');
      expect(parsed?.appKey).toBe('note');
    });

    it('parses absolute domain URL for vault credential', () => {
      const parsed = parseKylrixPublicUrl('https://www.kylrix.space/vault/cred_456');
      expect(parsed).not.toBeNull();
      expect(parsed?.resourceType).toBe('credential');
      expect(parsed?.id).toBe('cred_456');
    });

    it('parses totp vault URL sub-path', () => {
      const parsed = parseKylrixPublicUrl('https://app.kylrix.com/vault/totp/totp_789');
      expect(parsed).not.toBeNull();
      expect(parsed?.resourceType).toBe('totp');
      expect(parsed?.id).toBe('totp_789');
    });

    it('parses workspace / project URL', () => {
      const parsed = parseKylrixPublicUrl('/workspace/ws_engineering');
      expect(parsed).not.toBeNull();
      expect(parsed?.resourceType).toBe('project');
      expect(parsed?.id).toBe('ws_engineering');
    });

    it('returns null for non-kylrix external URLs', () => {
      const parsed = parseKylrixPublicUrl('https://github.com/Kylrix/kylrix');
      expect(parsed).toBeNull();
    });

    it('returns null for empty or invalid strings', () => {
      expect(parseKylrixPublicUrl('')).toBeNull();
      expect(parseKylrixPublicUrl('   ')).toBeNull();
    });
  });

  describe('extractUrlsFromText', () => {
    it('extracts embedded kylrix path URLs and web URLs from string', () => {
      const text = 'Check out /idea/note_123 and also https://www.kylrix.space/goal/g_1 for updates.';
      const urls = extractUrlsFromText(text);
      expect(urls).toContain('/idea/note_123');
      expect(urls).toContain('https://www.kylrix.space/goal/g_1');
    });

    it('handles trailing punctuation correctly', () => {
      const text = 'Visit /form/form_99!';
      const urls = extractUrlsFromText(text);
      expect(urls).toContain('/form/form_99');
    });
  });

  describe('splitEcosystemLinks', () => {
    it('separates prose text from ecosystem link cards', () => {
      const text = 'Here is the project spec /workspace/ws_alpha and notes.';
      const { prose, links } = splitEcosystemLinks(text);

      expect(links).toHaveLength(1);
      expect(links[0].resourceType).toBe('project');
      expect(links[0].id).toBe('ws_alpha');
      expect(prose).not.toContain('/workspace/ws_alpha');
    });
  });

  describe('buildPublicResourceUrl', () => {
    it('builds canonical share URLs with provided base URL', () => {
      const url = buildPublicResourceUrl('note', 'note_777', {}, 'https://www.kylrix.space');
      expect(url).toBe('https://www.kylrix.space/idea/note_777');
    });

    it('builds workspace share URL when projectId option is provided', () => {
      const url = buildPublicResourceUrl(
        'note',
        'note_777',
        { projectId: 'ws_team' },
        'https://www.kylrix.space',
      );
      expect(url).toBe('https://www.kylrix.space/workspace/ws_team');
    });
  });
});
