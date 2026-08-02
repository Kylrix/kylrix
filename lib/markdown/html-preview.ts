/**
 * HTML preview layer for future in-note plugins (games, embeds).
 * Registered as a tool + transform, but NEVER enabled in note preview by default.
 */

import { registerMarkdownTransform } from '@/lib/markdown/pipeline';

const HTML_PH = '@@KYLRIX_HTML_';
let lastHtml: string[] | null = null;

function sanitizeLooseHtml(raw: string): string {
  // Strip scripts / event handlers — still not for untrusted public notes by default.
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

export function extractHtmlPreviewBlocks(md: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const text = md.replace(/^```html-preview\s*\n([\s\S]*?)```/gm, (_m, body: string) => {
    const i = blocks.length;
    blocks.push(
      `<div class="kylrix-html-preview" data-kylrix-html-preview="1">${sanitizeLooseHtml(body)}</div>`,
    );
    return `\n\n${HTML_PH}${i}@@\n\n`;
  });
  return { text, blocks };
}

export function registerHtmlPreviewTransform() {
  registerMarkdownTransform({
    id: 'html.preview.extract',
    order: 30,
    phase: 'pre',
    apply: (input, ctx) => {
      if (!ctx.features.htmlPreview) return input;
      const { text, blocks } = extractHtmlPreviewBlocks(input);
      lastHtml = blocks;
      return text;
    },
  });

  registerMarkdownTransform({
    id: 'html.preview.restore',
    order: 90,
    phase: 'post',
    apply: (input, ctx) => {
      if (!ctx.features.htmlPreview || !lastHtml) return input;
      const blocks = lastHtml;
      lastHtml = null;
      return input
        .replace(
          new RegExp(`<p>\\s*${HTML_PH}(\\d+)@@\\s*<\\/p>`, 'g'),
          (_m, idx: string) => blocks[Number(idx)] || '',
        )
        .replace(
          new RegExp(`${HTML_PH}(\\d+)@@`, 'g'),
          (_m, idx: string) => blocks[Number(idx)] || '',
        );
    },
  });
}
