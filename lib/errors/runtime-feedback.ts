type RuntimeErrorBoundary = 'route' | 'global';

interface RuntimeErrorFeedbackInput {
  boundary: RuntimeErrorBoundary;
  error: Error & { digest?: string };
}

export async function submitRuntimeErrorFeedback(input: RuntimeErrorFeedbackInput): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (process.env.NODE_ENV !== 'production') {
      void fetch('/api/dev/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: `[Client ${input.boundary}] ${input.error.message}`,
          stack: input.error.stack,
        }),
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[RuntimeFeedback] Failed to log error feedback.', err);
  }
}

