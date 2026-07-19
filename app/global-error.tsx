'use client';

import { useEffect } from 'react';
import RuntimeErrorDrawer from '@/components/errors/RuntimeErrorDrawer';
import { submitRuntimeErrorFeedback } from '@/lib/errors/runtime-feedback';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void submitRuntimeErrorFeedback({ boundary: 'global', error });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <RuntimeErrorDrawer
          error={error}
          reset={reset}
          heading="The app could not finish loading"
          description="We already captured the details. Try again or reload the page."
        />
      </body>
    </html>
  );
}

