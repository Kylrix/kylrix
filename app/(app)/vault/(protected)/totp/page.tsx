"use client";

import { Suspense } from 'react';
import { TOTPPageContent } from './TOTPContent';

export default function TOTPPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-[#0A0908]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      }
    >
      <TOTPPageContent />
    </Suspense>
  );
}
