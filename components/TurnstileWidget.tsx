'use client';

import { useEffect, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '@/lib/turnstile';
import { Box } from '@mui/material';

declare global {
  interface Window {
    turnstile: any;
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
}

const SCRIPT_ID = 'cf-turnstile-script';

export function TurnstileWidget({ onToken, onError, onExpire, theme = 'auto', size = 'normal' }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenCallbackRef = useRef(onToken);
  const errorCallbackRef = useRef(onError);
  const expireCallbackRef = useRef(onExpire);

  tokenCallbackRef.current = onToken;
  errorCallbackRef.current = onError;
  expireCallbackRef.current = onExpire;

  useEffect(() => {
    if (!containerRef.current || !TURNSTILE_SITE_KEY) return;

    const renderWidget = () => {
      if (!containerRef.current || !window.turnstile) return;
      const widgetId = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme,
        size,
        callback: (token: string) => tokenCallbackRef.current?.(token),
        'error-callback': (error: string) => errorCallbackRef.current?.(error),
        'expired-callback': () => expireCallbackRef.current?.(),
      });
      widgetIdRef.current = widgetId;
    };

    const setup = () => {
      if (window.turnstile) {
        window.turnstile.ready(renderWidget);
      }
    };

    if (window.turnstile) {
      setup();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

      const handleLoad = () => {
        setup();
      };

      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.addEventListener('load', handleLoad, { once: true });
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', handleLoad, { once: true });
      }

      return () => {
        script?.removeEventListener('load', handleLoad);
      };
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e: any) {
          console.warn('Failed to remove Turnstile widget:', e);
        }
      }
    };
  }, [theme, size]);

  return (
    <Box
      ref={containerRef}
      sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        my: 2,
        minHeight: '78px'
      }}
    />
  );
}

