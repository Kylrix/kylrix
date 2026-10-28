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

  it('strips whitespace-prefixed and obfuscated pseudo-protocol URLs', () => {
    const raw1 = '<a href="  javascript:alert(1)">Click1</a>';
    const raw2 = '<a href="vbscript:alert(1)">Click2</a>';
    const raw3 = '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Click3</a>';

    expect(renderMarkdownHtml(raw1)).not.toContain('javascript:');
    expect(renderMarkdownHtml(raw2)).not.toContain('vbscript:');
    expect(renderMarkdownHtml(raw3)).not.toContain('data:text/html');
  });

  it('secures external target=_blank links with rel="noopener noreferrer"', () => {
    const raw = '<a href="https://example.com" target="_blank">External</a>';
    const html = renderMarkdownHtml(raw);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('preserves valid markdown styling and standard safe elements', () => {
    const raw = '**Bold** and *Italic* text with `inline code`';
    const html = renderMarkdownHtml(raw);
    expect(html).toContain('<strong>Bold</strong>');
    expect(html).toContain('<em>Italic</em>');
    expect(html).toContain('<code>inline code</code>');
  });
});
