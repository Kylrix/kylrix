import { isFlowInstalled } from '@/lib/flows/installed';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Config as DomPurifyConfig } from 'dompurify';
import { preProcessMarkdown } from '@/lib/markdown/preprocess';
import {
  defaultMathModeContext,
  runMarkdownPipeline,
  type MarkdownTransformContext,
} from '@/lib/markdown/pipeline';
import { registerMathTransforms } from '@/lib/markdown/math';

let layersReady = false;

export function ensureMarkdownLayers() {
  if (layersReady) return;
  registerMathTransforms();
  layersReady = true;
}

marked.setOptions({ gfm: true, breaks: true });

const MATH_PURIFY: DomPurifyConfig = {
  ADD_TAGS: [
    'a',
    'math',
    'annotation',
    'semantics',
    'mrow',
    'mi',
    'mo',
    'mn',
    'msup',
    'msub',
    'mfrac',
    'msqrt',
    'mroot',
    'mtable',
    'mtr',
    'mtd',
    'mtext',
    'svg',
    'path',
    'g',
    'line',
    'polyline',
    'circle',
    'rect',
    'text',
    'figure',
  ],
  ADD_ATTR: [
    'class',
    'style',
    'viewBox',
    'xmlns',
    'd',
    'cx',
    'cy',
    'r',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'width',
    'height',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'points',
    'opacity',
    'rx',
    'ry',
    'text-anchor',
    'font-size',
    'font-weight',
    'font-family',
    'role',
    'aria-label',
    'aria-hidden',
    'data-kylrix-html-preview',
    'data-quote',
    'data-copy',
    'title',
    'type',
  ],
  RETURN_TRUSTED_TYPE: false,
};

/**
 * Full markdown → safe HTML with optional Math Mode layers.
 */
export function renderMarkdownHtml(
  source: string,
  ctx?: MarkdownTransformContext,
): string {
  ensureMarkdownLayers();
  const context = ctx || defaultMathModeContext(false);
  const prepped = preProcessMarkdown(source || '');
  const pre = runMarkdownPipeline(prepped, 'pre', context);
  const raw = marked.parse(pre) as string;
  const post = runMarkdownPipeline(raw, 'post', context);
  if (typeof window === 'undefined') return post;
  return String(DOMPurify.sanitize(post, MATH_PURIFY));
}

export function isMathModeFlowInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return isFlowInstalled('kylrix-math-mode');
}
