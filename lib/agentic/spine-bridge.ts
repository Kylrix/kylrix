/**
 * Spine bridge — programmatic agent triggers without manual user prompt.
 */

export type AgenticSpineEvent =
  | { type: 'agentic.run'; prompt: string; source?: string; autoRun?: boolean }
  | { type: 'agentic.tool'; toolKey: string; args?: Record<string, unknown>; specifier?: string }
  | { type: 'workflow.enqueue'; workflowId: string; payload?: Record<string, unknown> };

const CHANNEL = 'agentic.spine';

export function emitAgenticSpineEvent(event: AgenticSpineEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(`kylrix:spine:${CHANNEL}`, { detail: event }));
}

export function subscribeAgenticSpine(
  handler: (event: AgenticSpineEvent) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<AgenticSpineEvent>).detail;
    if (detail) handler(detail);
  };
  window.addEventListener(`kylrix:spine:${CHANNEL}`, listener);
  return () => window.removeEventListener(`kylrix:spine:${CHANNEL}`, listener);
}

/** Wire drawer to open with a prompt when spine fires */
export function initAgenticSpineListeners(): () => void {
  return subscribeAgenticSpine((event) => {
    if (event.type === 'agentic.run') {
      window.dispatchEvent(
        new CustomEvent('kylrix:agentic-pending-prompt', {
          detail: { prompt: event.prompt, autoRun: event.autoRun ?? true, source: event.source },
        }),
      );
      window.dispatchEvent(new CustomEvent('kylrix:open-agentic-drawer'));
    }
  });
}
