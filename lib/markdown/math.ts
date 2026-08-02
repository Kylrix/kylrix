import katex from 'katex';
import { registerMarkdownTransform } from '@/lib/markdown/pipeline';
import { solveEquation } from '@/lib/markdown/expr';

const BLOCK_PH = '@@KYLRIX_MATH_BLOCK_';
const INLINE_PH = '@@KYLRIX_MATH_INLINE_';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'html',
    });
  } catch {
    return `<code class="kylrix-math-error">${escapeHtml(tex)}</code>`;
  }
}

/**
 * Pre-marked: protect $...$ / $$...$$ / ```math``` / ```solve``` from markdown.
 */
export function extractMathPlaceholders(md: string): {
  text: string;
  blocks: string[];
  inlines: string[];
} {
  const blocks: string[] = [];
  const inlines: string[] = [];
  let text = md;

  // Fenced ```math / ```tex / ```latex
  text = text.replace(
    /^```(?:math|tex|latex)\s*\n([\s\S]*?)```/gm,
    (_m, body: string) => {
      const i = blocks.length;
      blocks.push(renderKatex(body, true));
      return `\n\n${BLOCK_PH}${i}@@\n\n`;
    },
  );

  // Fenced ```solve
  text = text.replace(/^```solve\s*\n([\s\S]*?)```/gm, (_m, body: string) => {
    const lines = String(body)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parts: string[] = [];
    for (const line of lines) {
      const solved = solveEquation(line);
      if (solved.ok) {
        parts.push(
          `<div class="kylrix-solve"><div class="kylrix-solve-eq">${renderKatex(line, false)}</div><div class="kylrix-solve-out">${escapeHtml(solved.result)}</div></div>`,
        );
      } else {
        parts.push(
          `<div class="kylrix-solve kylrix-solve-err"><code>${escapeHtml(line)}</code><span>${escapeHtml(solved.error)}</span></div>`,
        );
      }
    }
    const i = blocks.length;
    blocks.push(`<div class="kylrix-solve-stack">${parts.join('')}</div>`);
    return `\n\n${BLOCK_PH}${i}@@\n\n`;
  });

  // Display $$...$$
  text = text.replace(/\$\$([\s\S]+?)\$\$/g, (_m, body: string) => {
    const i = blocks.length;
    blocks.push(renderKatex(body, true));
    return `\n\n${BLOCK_PH}${i}@@\n\n`;
  });

  // Inline $...$ (not $$) — avoid lookbehind for broader engines
  text = text.replace(
    /(^|[^\\$])\$((?:[^$\\\n]|\\.)+?)\$(?!\$)/g,
    (_m, prefix: string, body: string) => {
      const i = inlines.length;
      inlines.push(renderKatex(body, false));
      return `${prefix}${INLINE_PH}${i}@@`;
    },
  );

  return { text, blocks, inlines };
}

export function restoreMathPlaceholders(
  html: string,
  blocks: string[],
  inlines: string[],
): string {
  let out = html;
  out = out.replace(
    new RegExp(`${BLOCK_PH}(\\d+)@@`, 'g'),
    (_m, idx: string) => blocks[Number(idx)] || '',
  );
  // marked may wrap placeholders in <p>
  out = out.replace(
    new RegExp(`<p>\\s*${BLOCK_PH}(\\d+)@@\\s*<\\/p>`, 'g'),
    (_m, idx: string) => blocks[Number(idx)] || '',
  );
  out = out.replace(
    new RegExp(`${INLINE_PH}(\\d+)@@`, 'g'),
    (_m, idx: string) => inlines[Number(idx)] || '',
  );
  return out;
}

/** Session stash so pre + post can share extracted math across pipeline phases. */
const stash = new WeakMap<object, { blocks: string[]; inlines: string[] }>();
let lastStash: { blocks: string[]; inlines: string[] } | null = null;

export function registerMathTransforms() {
  registerMarkdownTransform({
    id: 'math.extract',
    order: 20,
    phase: 'pre',
    apply: (input, ctx) => {
      if (!ctx.features.math) return input;
      const extracted = extractMathPlaceholders(input);
      lastStash = { blocks: extracted.blocks, inlines: extracted.inlines };
      return extracted.text;
    },
  });

  registerMarkdownTransform({
    id: 'math.restore',
    order: 80,
    phase: 'post',
    apply: (input, ctx) => {
      if (!ctx.features.math || !lastStash) return input;
      const { blocks, inlines } = lastStash;
      lastStash = null;
      return restoreMathPlaceholders(input, blocks, inlines);
    },
  });
}

void stash;
