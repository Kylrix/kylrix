import katex from 'katex';
import { registerMarkdownTransform } from '@/lib/markdown/pipeline';
import { solveEquation, evalExpression } from '@/lib/markdown/expr';

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

function renderFunctionGraphSvg(body: string): string {
  try {
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    let expr = '';
    let xMin = -6.28;
    let xMax = 6.28;

    for (const line of lines) {
      if (/^x\s*:\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)/i.test(line)) {
        const m = line.match(/^x\s*:\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)/i);
        if (m) {
          xMin = parseFloat(m[1]);
          xMax = parseFloat(m[2]);
        }
      } else if (/^y\s*=\s*(.+)/i.test(line)) {
        const m = line.match(/^y\s*=\s*(.+)/i);
        if (m) expr = m[1].trim();
      } else if (!expr && line.length > 0) {
        expr = line;
      }
    }

    if (!expr) return `<div class="kylrix-chart kylrix-chart-err">No equation specified for graph</div>`;
    if (xMin >= xMax) { xMin = -10; xMax = 10; }

    const width = 420;
    const height = 220;
    const pad = 28;
    const samples = 120;
    const points: Array<[number, number]> = [];
    const step = (xMax - xMin) / samples;

    let yMin = Infinity;
    let yMax = -Infinity;

    for (let i = 0; i <= samples; i++) {
      const x = xMin + i * step;
      try {
        const y = evalExpression(expr, { x, X: x });
        if (Number.isFinite(y)) {
          points.push([x, y]);
          if (y < yMin) yMin = y;
          if (y > yMax) yMax = y;
        }
      } catch {}
    }

    if (points.length < 2 || !Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      return `<div class="kylrix-chart kylrix-chart-err">Could not evaluate graph for: ${escapeHtml(expr)}</div>`;
    }

    if (yMin === yMax) { yMin -= 1; yMax += 1; }
    // Add 10% vertical padding
    const yRange = yMax - yMin;
    yMin -= yRange * 0.1;
    yMax += yRange * 0.1;

    const toSvgX = (x: number) => pad + ((x - xMin) / (xMax - xMin)) * (width - 2 * pad);
    const toSvgY = (y: number) => (height - pad) - ((y - yMin) / (yMax - yMin)) * (height - 2 * pad);

    const pathData = points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${toSvgX(p[0]).toFixed(2)} ${toSvgY(p[1]).toFixed(2)}`)
      .join(' ');

    const zeroX = Math.max(pad, Math.min(width - pad, toSvgX(0)));
    const zeroY = Math.max(pad, Math.min(height - pad, toSvgY(0)));

    return `
<div class="kylrix-chart" style="background:#0A0908;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:12px;margin:1rem 0;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding:0 6px;">
    <span style="font-family:var(--font-mono, monospace);font-size:12px;font-weight:800;color:#818CF8;">f(x) = ${escapeHtml(expr)}</span>
    <span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:var(--font-mono, monospace);">[${xMin.toFixed(2)} .. ${xMax.toFixed(2)}]</span>
  </div>
  <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block;overflow:visible;">
    <!-- Axes -->
    <line x1="${pad}" y1="${zeroY}" x2="${width - pad}" y2="${zeroY}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2,2" />
    <line x1="${zeroX}" y1="${pad}" x2="${zeroX}" y2="${height - pad}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="2,2" />
    <!-- Graph Curve -->
    <path d="${pathData}" fill="none" stroke="#A855F7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</div>`;
  } catch (err: any) {
    return `<div class="kylrix-chart kylrix-chart-err">Failed to render graph: ${escapeHtml(err?.message || 'syntax error')}</div>`;
  }
}

/**
 * Pre-marked: protect $...$ / $$...$$ / ```math``` / ```solve``` / ```graph``` from markdown.
 */
export function extractMathPlaceholders(md: string): {
  text: string;
  blocks: string[];
  inlines: string[];
} {
  const blocks: string[] = [];
  const inlines: string[] = [];
  let text = md;

  // Fenced ```graph / ```plot
  text = text.replace(
    /^```(?:graph|plot)\s*\n([\s\S]*?)```/gm,
    (_m, body: string) => {
      const i = blocks.length;
      blocks.push(renderFunctionGraphSvg(body));
      return `\n\n${BLOCK_PH}${i}@@\n\n`;
    },
  );

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
