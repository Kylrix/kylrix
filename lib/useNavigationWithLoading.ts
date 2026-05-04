'use client';

import { useRouter } from 'next/navigation';
import { useLoading } from '@/components/ui/LoadingContext';
import { useCallback } from 'react';

export const useNavigationWithLoading = () => {
  const router = useRouter();
  const { showLoading, hideLoading } = useLoading();

  const navigateTo = useCallback((path: string, message?: string) => {
    showLoading(message || 'Loading...');
    
    // Reduced delay to minimize flashing
    setTimeout(() => {
      router.push(path);
      // Reduced loading duration after navigation
      setTimeout(() => {
        hideLoading();
      }, 200); // Reduced from 500ms to 200ms
    }, 50); // Reduced from 100ms to 50ms
  }, [router, showLoading, hideLoading]);

  const navigateBack = useCallback((message?: string) => {
    showLoading(message || 'Going back...');
    
    setTimeout(() => {
      router.back();
      setTimeout(() => {
        hideLoading();
      }, 200); // Reduced from 500ms
    }, 50); // Reduced from 100ms
  }, [router, showLoading, hideLoading]);

  const navigateReplace = useCallback((path: string, message?: string) => {
    showLoading(message || 'Loading...');
    
    setTimeout(() => {
      router.replace(path);
      setTimeout(() => {
        hideLoading();
      }, 200); // Reduced from 500ms
    }, 50); // Reduced from 100ms
  }, [router, showLoading, hideLoading]);

  return {
    navigateTo,
    navigateBack,
    navigateReplace,
    showLoading,
    hideLoading,
  };
};