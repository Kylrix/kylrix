import { registerMarkdownTransform } from '@/lib/markdown/pipeline';

const QC_PH = '@@KYLRIX_QC_';
let lastBlocks: string[] | null = null;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function renderQuoteCopyHtml(inner: string, _quote: string = '"'): string {
  const trimmed = inner.trim();
  if (!trimmed) return escapeHtml(inner);
  const escText = escapeHtml(trimmed);
  const escAttr = escapeAttr(trimmed);
  // Cute openbricks: opaque #161412 panel, border white/06 or #34322F, no gradients/blur, top hairline acent #6366F1
  return `<div class="kylrix-quote-copy" data-quote="${escAttr}" style="margin:12px 0;padding:0;position:relative;">` +
    `<div style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:#161412;border:1px solid rgba(255,255,255,0.06);border-radius:14px;position:relative;overflow:hidden;">` +
    `<div style="position:absolute;top:-1px;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(99,102,241,0.55),transparent);"></div>` +
    `<div style="width:28px;height:28px;min-width:28px;border-radius:9px;background:#0A0908;border:1px solid rgba(255,255,255,0.06);display:grid;place-items:center;flex-shrink:0;color:#6366F1;font-size:13px;line-height:1;">✦</div>` +
    `<span class="kylrix-quote-copy-text" style="flex:1;min-width:0;color:rgba(255,255,255,0.92);font-size:14px;line-height:1.6;font-weight:600;word-break:break-word;white-space:pre-wrap;">${escText}</span>` +
    `<button type="button" class="kylrix-quote-copy-btn" data-copy="${escAttr}" aria-label="Copy quote" title="Copy" style="width:32px;height:32px;min-width:32px;border-radius:9px;background:#0A0908;border:1px solid rgba(255,255,255,0.08);display:grid;place-items:center;cursor:pointer;flex-shrink:0;color:rgba(255,255,255,0.7);transition:all 0.16s;">` +
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v3"></path></svg>` +
    `</button>` +
    `</div></div>`;
}

export function extractQuoteCopyPlaceholders(md: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  let text = md;

  // Protect fenced code blocks and inline code first — replace with temp to avoid matching inside them
  const codeFences: string[] = [];
  const CODE_PH = '@@QC_CODE_';
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    const i = codeFences.length;
    codeFences.push(m);
    return `${CODE_PH}${i}@@`;
  });
  const inlineCodes: string[] = [];
  const INLINE_PH = '@@QC_INLINE_';
  text = text.replace(/`[^`]+`/g, (m) => {
    const i = inlineCodes.length;
    inlineCodes.push(m);
    return `${INLINE_PH}${i}@@`;
  });

  // Double-quoted blocks: " ... "  (at least 2 chars, allow spaces, not empty, not across lines)
  text = text.replace(/(^|[^\w\\])"([^"\n]{2,}?)"/g, (m, pre: string, inner: string) => {
    // avoid matching "" empty or "a"
    if (inner.trim().length < 2) return m;
    const i = blocks.length;
    blocks.push(renderQuoteCopyHtml(inner, '"'));
    return `${pre}${QC_PH}${i}@@`;
  });

  // Single-quoted blocks: ' ... '  — require space inside or length>=3 to skip it's/don't
  text = text.replace(/(^|[^\w\\])'([^'\n]{2,}?)'/g, (m, pre: string, inner: string) => {
    const t = inner.trim();
    if (t.length < 2) return m;
    if (!t.includes(' ') && t.length < 3) return m;
    // skip common contractions inside: it's, don't, etc if no space and short
    const i = blocks.length;
    blocks.push(renderQuoteCopyHtml(inner, "'"));
    return `${pre}${QC_PH}${i}@@`;
  });

  // Restore inline code and fences
  text = text.replace(new RegExp(`${INLINE_PH}(\\d+)@@`, 'g'), (_m, idx: string) => inlineCodes[Number(idx)] || '');
  text = text.replace(new RegExp(`${CODE_PH}(\\d+)@@`, 'g'), (_m, idx: string) => codeFences[Number(idx)] || '');

  return { text, blocks };
}

export function restoreQuoteCopyPlaceholders(html: string, blocks: string[]): string {
  let out = html;
  out = out.replace(new RegExp(`<p>\\s*${QC_PH}(\\d+)@@\\s*<\\/p>`, 'g'), (_m, idx: string) => blocks[Number(idx)] || '');
  out = out.replace(new RegExp(`${QC_PH}(\\d+)@@`, 'g'), (_m, idx: string) => blocks[Number(idx)] || '');
  return out;
}

export function registerQuoteCopyTransforms() {
  registerMarkdownTransform({
    id: 'quote-copy.extract',
    order: 22,
    phase: 'pre',
    apply: (input) => {
      const { text, blocks } = extractQuoteCopyPlaceholders(input);
      lastBlocks = blocks;
      return text;
    },
  });
  registerMarkdownTransform({
    id: 'quote-copy.restore',
    order: 82,
    phase: 'post',
    apply: (input) => {
      if (!lastBlocks || !lastBlocks.length) return input;
      const blocks = lastBlocks;
      lastBlocks = null;
      return restoreQuoteCopyPlaceholders(input, blocks);
    },
  });
}

// Global click delegation for copy buttons — runs once on client
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__kylrixQuoteCopyBound ||= (() => {
    const handler = async (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const btn = target.closest('.kylrix-quote-copy-btn') as HTMLButtonElement | null;
      if (!btn) return;
      const text = btn.getAttribute('data-copy') || btn.closest('.kylrix-quote-copy')?.getAttribute('data-quote') || '';
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        const prev = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>`;
        btn.style.borderColor = 'rgba(16,185,129,0.35)';
        btn.style.color = '#10B981';
        setTimeout(() => {
          btn.innerHTML = prev;
          btn.style.borderColor = 'rgba(255,255,255,0.08)';
          btn.style.color = 'rgba(255,255,255,0.7)';
        }, 1200);
      } catch {
        // fallback: select via execCommand
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } catch {}
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('click', handler, true);
    return true;
  })();
}
