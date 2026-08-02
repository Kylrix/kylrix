import { registerMarkdownTransform } from '@/lib/markdown/pipeline';
import { evalExpression } from '@/lib/markdown/expr';

const CHART_PH = '@@KYLRIX_CHART_';
const stash: string[] = [];

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseKvBlock(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z_][\w-]*)\s*:\s*(.+)\s*$/);
    if (m) out[m[1].toLowerCase()] = m[2].trim();
  }
  return out;
}

function parseList(raw?: string): string[] {
  if (!raw) return [];
  const t = raw.trim();
  if (t.startsWith('[') && t.endsWith(']')) {
    return t
      .slice(1, -1)
      .split(',')
      .map((x) => x.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return t.split(',').map((x) => x.trim()).filter(Boolean);
}

function parseRange(raw?: string): { min: number; max: number } {
  if (!raw) return { min: -5, max: 5 };
  const m = raw.match(/(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)/);
  if (!m) return { min: -5, max: 5 };
  return { min: Number(m[1]), max: Number(m[2]) };
}

export function renderChartSvg(body: string): string {
  const kv = parseKvBlock(body);
  const type = (kv.type || 'bar').toLowerCase();
  const title = kv.title || '';
  const labels = parseList(kv.labels);
  const values = parseList(kv.values).map(Number);
  const w = 420;
  const h = 220;
  const pad = 36;
  const max = Math.max(...values.filter(Number.isFinite), 1);

  let series = '';
  if (type === 'line' && values.length) {
    const pts = values
      .map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
        const y = h - pad - ((Number.isFinite(v) ? v : 0) / max) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(' ');
    series = `<polyline fill="none" stroke="#F59E0B" stroke-width="2.5" points="${pts}" />`;
    series += values
      .map((v, i) => {
        const x = pad + (i * (w - pad * 2)) / Math.max(values.length - 1, 1);
        const y = h - pad - ((Number.isFinite(v) ? v : 0) / max) * (h - pad * 2);
        return `<circle cx="${x}" cy="${y}" r="3.5" fill="#F59E0B" />`;
      })
      .join('');
  } else {
    const gap = 8;
    const barW =
      (w - pad * 2 - gap * Math.max(values.length - 1, 0)) /
      Math.max(values.length, 1);
    series = values
      .map((v, i) => {
        const bh = ((Number.isFinite(v) ? v : 0) / max) * (h - pad * 2);
        const x = pad + i * (barW + gap);
        const y = h - pad - bh;
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="#F59E0B" opacity="0.9" />`;
      })
      .join('');
  }

  const labelEls = labels
    .map((lab, i) => {
      const x =
        type === 'line'
          ? pad + (i * (w - pad * 2)) / Math.max(labels.length - 1, 1)
          : pad +
            i *
              ((w - pad * 2 - 8 * Math.max(values.length - 1, 0)) /
                Math.max(values.length, 1) +
                8) +
            10;
      return `<text x="${x}" y="${h - 12}" text-anchor="middle" fill="#9B9691" font-size="11" font-family="var(--font-satoshi),sans-serif">${escapeHtml(lab)}</text>`;
    })
    .join('');

  return `<figure class="kylrix-chart"><svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" aria-label="${escapeHtml(title || 'Chart')}">
  <rect width="${w}" height="${h}" fill="#0A0908" rx="12" />
  ${title ? `<text x="${pad}" y="22" fill="#fff" font-size="13" font-weight="800" font-family="var(--font-clash),sans-serif">${escapeHtml(title)}</text>` : ''}
  <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#34322F" />
  <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#34322F" />
  ${series}
  ${labelEls}
</svg></figure>`;
}

export function renderGraphSvg(body: string): string {
  const kv = parseKvBlock(body);
  const expr = (kv.y || kv.fn || kv.f || 'sin(x)').replace(/^y\s*=\s*/i, '');
  const { min, max } = parseRange(kv.x || kv.range);
  const w = 420;
  const h = 240;
  const pad = 28;
  const samples = 160;
  const pts: Array<{ x: number; y: number }> = [];
  let yMin = Infinity;
  let yMax = -Infinity;

  for (let i = 0; i <= samples; i++) {
    const x = min + ((max - min) * i) / samples;
    try {
      const y = evalExpression(expr, { x });
      if (!Number.isFinite(y)) continue;
      pts.push({ x, y });
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    } catch {
      /* skip */
    }
  }

  if (!pts.length || !Number.isFinite(yMin)) {
    return `<div class="kylrix-chart-err">Could not plot <code>${escapeHtml(expr)}</code></div>`;
  }

  if (Math.abs(yMax - yMin) < 1e-9) {
    yMin -= 1;
    yMax += 1;
  }

  const mapX = (x: number) => pad + ((x - min) / (max - min)) * (w - pad * 2);
  const mapY = (y: number) =>
    h - pad - ((y - yMin) / (yMax - yMin)) * (h - pad * 2);

  const poly = pts.map((p) => `${mapX(p.x)},${mapY(p.y)}`).join(' ');
  const zeroY =
    yMin < 0 && yMax > 0
      ? `<line x1="${pad}" y1="${mapY(0)}" x2="${w - pad}" y2="${mapY(0)}" stroke="#34322F" stroke-dasharray="4 4" />`
      : '';
  const zeroX =
    min < 0 && max > 0
      ? `<line x1="${mapX(0)}" y1="${pad}" x2="${mapX(0)}" y2="${h - pad}" stroke="#34322F" stroke-dasharray="4 4" />`
      : '';

  return `<figure class="kylrix-chart kylrix-graph"><svg viewBox="0 0 ${w} ${h}" width="100%" height="auto" role="img" aria-label="Graph of ${escapeHtml(expr)}">
  <rect width="${w}" height="${h}" fill="#0A0908" rx="12" />
  <text x="${pad}" y="20" fill="#fff" font-size="12" font-weight="800" font-family="var(--font-mono),monospace">y = ${escapeHtml(expr)}</text>
  ${zeroX}${zeroY}
  <polyline fill="none" stroke="#6366F1" stroke-width="2.25" points="${poly}" />
</svg></figure>`;
}

export function extractChartPlaceholders(md: string): { text: string; charts: string[] } {
  const charts: string[] = [];
  let text = md;

  text = text.replace(/^```chart\s*\n([\s\S]*?)```/gm, (_m, body: string) => {
    const i = charts.length;
    charts.push(renderChartSvg(body));
    return `\n\n${CHART_PH}${i}@@\n\n`;
  });

  text = text.replace(/^```graph\s*\n([\s\S]*?)```/gm, (_m, body: string) => {
    const i = charts.length;
    charts.push(renderGraphSvg(body));
    return `\n\n${CHART_PH}${i}@@\n\n`;
  });

  return { text, charts };
}

export function restoreChartPlaceholders(html: string, charts: string[]): string {
  let out = html;
  out = out.replace(
    new RegExp(`<p>\\s*${CHART_PH}(\\d+)@@\\s*<\\/p>`, 'g'),
    (_m, idx: string) => charts[Number(idx)] || '',
  );
  out = out.replace(
    new RegExp(`${CHART_PH}(\\d+)@@`, 'g'),
    (_m, idx: string) => charts[Number(idx)] || '',
  );
  return out;
}

let lastCharts: string[] | null = null;

export function registerChartTransforms() {
  registerMarkdownTransform({
    id: 'charts.extract',
    order: 25,
    phase: 'pre',
    apply: (input, ctx) => {
      if (!ctx.features.charts) return input;
      const { text, charts } = extractChartPlaceholders(input);
      lastCharts = charts;
      return text;
    },
  });

  registerMarkdownTransform({
    id: 'charts.restore',
    order: 85,
    phase: 'post',
    apply: (input, ctx) => {
      if (!ctx.features.charts || !lastCharts) return input;
      const charts = lastCharts;
      lastCharts = null;
      return restoreChartPlaceholders(input, charts);
    },
  });
}

void stash;
