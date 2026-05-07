'use client';

import React, { createContext, useContext, useCallback, ReactNode, useState } from 'react';
import toast from 'react-hot-toast';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number, defaultExpanded?: boolean) => void;
  dismissToast: (id: string) => void;
  showError: (title: string, message?: string, defaultExpanded?: boolean) => void;
  showSuccess: (title: string, message?: string, defaultExpanded?: boolean) => void;
  showWarning: (title: string, message?: string, defaultExpanded?: boolean) => void;
  showInfo: (title: string, message?: string, defaultExpanded?: boolean) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const showToast = useCallback((type: ToastType, title: string, message?: string, duration = 5000, _defaultExpanded = false) => {
    const content = message ? `${title}\n${message}` : title;
    
    switch (type) {
      case 'error':
        toast.error(content, { duration });
        break;
      case 'success':
        toast.success(content, { duration });
        break;
      case 'warning':
        toast(content, { duration, icon: '⚠️' });
        break;
      case 'info':
        toast(content, { duration, icon: 'ℹ️' });
        break;
    }
  }, []);

  const dismissToast = useCallback((_id: string) => {
    // react-hot-toast handles dismissal internally
  }, []);

  const showError = useCallback((title: string, message?: string, _defaultExpanded = false) => {
    showToast('error', title, message, 5000);
  }, [showToast]);

  const showSuccess = useCallback((title: string, message?: string, _defaultExpanded = false) => {
    showToast('success', title, message, 5000);
  }, [showToast]);

  const showWarning = useCallback((title: string, message?: string, _defaultExpanded = false) => {
    showToast('warning', title, message, 5000);
  }, [showToast]);

  const showInfo = useCallback((title: string, message?: string, _defaultExpanded = false) => {
    showToast('info', title, message, 5000);
  }, [showToast]);

  const value: ToastContextType = {
    showToast,
    dismissToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}
