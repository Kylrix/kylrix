'use client';

import { useRouter } from 'next/navigation';
import { useTransition, useCallback } from 'react';

export function useTransitionNavigate() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (href: string, options?: { replace?: boolean; scroll?: boolean }) => {
      startTransition(() => {
        if (options?.replace) router.replace(href, options as any);
        else router.push(href, options as any);
      });
    },
    [router]
  );

  const replace = useCallback(
    (href: string) => {
      startTransition(() => router.replace(href));
    },
    [router]
  );

  return { navigate, replace, isPending, startTransition };
}
