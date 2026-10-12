import { describe, it, expect } from 'vitest';
import {
  inferAttachmentMimeType,
  resolveAttachmentVisualKind,
  linkHostname,
} from './note-object-visual';

describe('lib/note-object-visual', () => {
  describe('inferAttachmentMimeType', () => {
    it('uses mimeType from metadata if present and trimmed', () => {
      expect(
        inferAttachmentMimeType('photo.png', { mimeType: 'image/webp' }, 'image')
      ).toBe('image/webp');
    });

    it('infers mimeType from file extension', () => {
      expect(inferAttachmentMimeType('document.pdf')).toBe('application/pdf');
      expect(inferAttachmentMimeType('song.mp3')).toBe('audio/mpeg');
      expect(inferAttachmentMimeType('picture.jpg')).toBe('image/jpeg');
      expect(inferAttachmentMimeType('notes.md')).toBe('text/markdown');
    });

    it('falls back to childKind if extension is unknown or missing', () => {
      expect(inferAttachmentMimeType('unknown_file', null, 'image')).toBe('image/jpeg');
      expect(inferAttachmentMimeType('unknown_file', null, 'voice')).toBe('audio/webm');
    });

    it('falls back to application/octet-stream if nothing matches', () => {
      expect(inferAttachmentMimeType('unknown_file')).toBe('application/octet-stream');
      expect(inferAttachmentMimeType(null)).toBe('application/octet-stream');
      expect(inferAttachmentMimeType('', null, 'other')).toBe('application/octet-stream');
    });
  });

  describe('resolveAttachmentVisualKind', () => {
    it('resolves link kind', () => {
      expect(resolveAttachmentVisualKind('', 'link')).toBe('link');
    });

    it('resolves audio kind', () => {
      expect(resolveAttachmentVisualKind('audio/mp3')).toBe('audio');
      expect(resolveAttachmentVisualKind('', 'voice')).toBe('audio');
    });

    it('resolves image kind', () => {
      expect(resolveAttachmentVisualKind('image/png')).toBe('image');
      expect(resolveAttachmentVisualKind('', 'image')).toBe('image');
      expect(resolveAttachmentVisualKind('', undefined, 'graphic.svg')).toBe('image');
    });

    it('resolves pdf kind', () => {
      expect(resolveAttachmentVisualKind('application/pdf')).toBe('pdf');
      expect(resolveAttachmentVisualKind('', undefined, 'report.pdf')).toBe('pdf');
    });

    it('resolves video kind', () => {
      expect(resolveAttachmentVisualKind('video/mp4')).toBe('video');
      expect(resolveAttachmentVisualKind('', undefined, 'movie.mkv')).toBe('video');
    });

    it('resolves document kind', () => {
      expect(resolveAttachmentVisualKind('text/plain')).toBe('document');
      expect(resolveAttachmentVisualKind('', undefined, 'notes.docx')).toBe('document');
    });

    it('defaults to icon kind for unknown types', () => {
      expect(resolveAttachmentVisualKind('application/custom')).toBe('icon');
      expect(resolveAttachmentVisualKind('', undefined, 'file.bin')).toBe('icon');
    });
  });

  describe('linkHostname', () => {
    it('returns empty string for null, undefined or empty input', () => {
      expect(linkHostname(null)).toBe('');
      expect(linkHostname(undefined)).toBe('');
      expect(linkHostname('')).toBe('');
    });

    it('extracts hostname and strips www prefix for valid URLs', () => {
      expect(linkHostname('https://www.example.com/path/to/page')).toBe('example.com');
      expect(linkHostname('https://sub.domain.org')).toBe('sub.domain.org');
      expect(linkHostname('http://www.test.co.uk/query?q=1')).toBe('test.co.uk');
    });

    it('handles invalid/malformed URLs by returning original string (catch error path)', () => {
      expect(linkHostname('not-a-valid-url')).toBe('not-a-valid-url');
      expect(linkHostname('http://')).toBe('http://');
      expect(linkHostname('://invalid')).toBe('://invalid');
      expect(linkHostname('just text')).toBe('just text');
    });
  });
});
