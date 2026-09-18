'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FormDetailsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/forms');
  }, [router]);

  return (
    <div className="flex justify-center items-center h-screen bg-[#000000]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#6366F1] border-t-transparent" />
    </div>
  );
}
