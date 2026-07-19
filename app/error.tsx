'use client';

import { useEffect } from 'react';
import RuntimeErrorDrawer from '@/components/errors/RuntimeErrorDrawer';
import { submitRuntimeErrorFeedback } from '@/lib/errors/runtime-feedback';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void submitRuntimeErrorFeedback({ boundary: 'route', error });
  }, [error]);

  return (
    <RuntimeErrorDrawer
      error={error}
      reset={reset}
      heading="This page ran into a problem"
      description="We already captured the details. Try again or reload the page."
    />
  );
}

