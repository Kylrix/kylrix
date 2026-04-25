import { Suspense } from 'react';

import DesignStudio from '@/components/designs/DesignStudio';

export default function DesignsPage() {
  return (
    <Suspense fallback={null}>
      <DesignStudio />
    </Suspense>
  );
}
