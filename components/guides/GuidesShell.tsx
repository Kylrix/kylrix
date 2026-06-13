'use client';

import React from 'react';

export default function GuidesShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-6 md:pt-8 pb-20 pointer-events-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {children}
      </div>
    </div>
  );
}
