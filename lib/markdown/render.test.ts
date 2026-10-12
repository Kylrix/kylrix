import { describe, it, expect } from 'vitest';
import { renderMarkdownHtml } from './render';

describe('renderMarkdownHtml security & sanitization', () => {
  it('strips inline script tags and dangerous execution payloads', () => {
    const raw = '# Hello\n<script>alert("xss")</script>\nWorld';
    const html = renderMarkdownHtml(raw);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('alert');
    expect(html).toContain('Hello');
    expect(html).toContain('World');
  });

  it('removes inline event handler attributes like onerror and onload', () => {
    const raw = '<img src="invalid.png" onerror="alert(1)" onload="alert(2)">';
    const html = renderMarkdownHtml(raw);
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onload');
    expect(html).not.toContain('alert');
    expect(html).toContain('<img src="invalid.png">');
  });

  it('strips javascript: protocol pseudo-URLs in links', () => {
    const raw = '[Click Me](javascript:alert(1))';
    const html = renderMarkdownHtml(raw);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Click Me');
  });

  it('preserves valid markdown styling and standard safe elements', () => {
    const raw = '**Bold** and *Italic* text with `inline code`';
    const html = renderMarkdownHtml(raw);
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>Italic</em>');
    expect(html).toContain('<code>inline code</code>');
  });
});
