'use client';

import { Suspense } from 'react';
import { SendComposer } from '@/components/send/SendComposer';
import { MultiSectionContainer } from '@/context/SectionContext';

export default function SendPage() {
  return (
    <Suspense fallback={null}>
      <MultiSectionContainer>
        <SendComposer />
      </MultiSectionContainer>
    </Suspense>
  );
}
