/**
 * Composable markdown transform pipeline.
 * Flows / tools register layers; note preview runs an ordered stack.
 */

export type MarkdownTransformContext = {
  /** Math Mode / chart / html-preview flags */
  features: {
    math?: boolean;
    charts?: boolean;
    /** Unsafe HTML preview — never enable by default in notes */
    htmlPreview?: boolean;
  };
};

export type MarkdownTransform = {
  id: string;
  /** Lower runs earlier (pre-marked). Higher runs later (post-html). */
  order: number;
  phase: 'pre' | 'post';
  apply: (input: string, ctx: MarkdownTransformContext) => string;
};

const transforms = new Map<string, MarkdownTransform>();

export function registerMarkdownTransform(transform: MarkdownTransform) {
  transforms.set(transform.id, transform);
}

export function listMarkdownTransforms(): MarkdownTransform[] {
  return Array.from(transforms.values()).sort((a, b) => a.order - b.order);
}

export function runMarkdownPipeline(
  source: string,
  phase: 'pre' | 'post',
  ctx: MarkdownTransformContext,
): string {
  let out = source;
  for (const t of listMarkdownTransforms()) {
    if (t.phase !== phase) continue;
    out = t.apply(out, ctx);
  }
  return out;
}

export function defaultMathModeContext(
  enabled: boolean,
): MarkdownTransformContext {
  return {
    features: {
      math: enabled,
      charts: enabled,
      htmlPreview: false,
    },
  };
}
