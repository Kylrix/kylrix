'use client';

import { Suspense } from 'react';
import { SendComposer } from '@/components/send/SendComposer';

export default function SendPage() {
  return (
    <Suspense fallback={null}>
      <SendComposer />
    </Suspense>
  );
}
