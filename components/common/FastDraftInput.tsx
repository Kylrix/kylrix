'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Box, alpha } from '@mui/material';

export interface FastDraftInputHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  clear: () => void;
  focus: () => void;
}

interface FastDraftInputProps {
  initialValue?: string;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  onEmptyChange?: (isEmpty: boolean) => void;
}

export const FastDraftInput = forwardRef<FastDraftInputHandle, FastDraftInputProps>(function FastDraftInput(
  {
    initialValue = '',
    placeholder,
    rows = 3,
    autoFocus = false,
    onEmptyChange,
  },
  ref,
) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastEmptyRef = useRef<boolean>(!initialValue.trim());

  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);

  useEffect(() => {
    onEmptyChange?.(lastEmptyRef.current);
  }, [onEmptyChange]);

  useImperativeHandle(ref, () => ({
    getValue: () => inputRef.current?.value || '',
    setValue: (value: string) => {
      const next = value ?? '';
      if (inputRef.current) {
        inputRef.current.value = next;
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    clear: () => {
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
    focus: () => inputRef.current?.focus(),
  }), []);

  const syncEmptyState = (value: string) => {
    const isEmpty = !value.trim();
    if (isEmpty === lastEmptyRef.current) return;
    lastEmptyRef.current = isEmpty;
    onEmptyChange?.(isEmpty);
  };

  return (
    <Box
      component="textarea"
      ref={inputRef}
      defaultValue={initialValue}
      placeholder={placeholder}
      rows={rows}
      onInput={(e: React.FormEvent<HTMLTextAreaElement>) => syncEmptyState(e.currentTarget.value)}
      sx={{
        width: '100%',
        border: 'none',
        outline: 'none',
        resize: 'none',
        background: 'transparent',
        color: 'text.primary',
        font: 'inherit',
        fontSize: '1.1rem',
        fontWeight: 500,
        lineHeight: 1.6,
        padding: 0,
        minHeight: `${rows * 1.6}em`,
        '&::placeholder': {
          color: alpha('#FFFFFF', 0.36),
          opacity: 1,
        },
      }}
    />
  );
});

