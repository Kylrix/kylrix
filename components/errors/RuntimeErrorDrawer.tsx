'use client';

import { useEffect, useState } from 'react';
import { getLiveErrorDetailsAction, type EngineerErrorDetails } from '@/lib/errors/engineer';
import { downloadBugReportMarkdown } from '@/lib/errors/download-bug-report';
import { FileDown } from 'lucide-react';

interface RuntimeErrorDrawerProps {
  error: Error & { digest?: string };
  reset: () => void;
  heading?: string;
  description?: string;
}

export default function RuntimeErrorDrawer({
  error,
  reset,
  heading = 'Something went wrong',
  description = 'We hit an unexpected problem. Use one of the options below to recover.'}: RuntimeErrorDrawerProps) {
  const [engDetails, setEngDetails] = useState<EngineerErrorDetails | null>(null);

  useEffect(() => {
    console.error('Application crash:', error);
    async function loadEngineerDetails() {
      let jwt: string | undefined;
      try {
        const { account } = await import('@/lib/appwrite/client');
        const res = await account.createJWT().catch(() => null);
        jwt = res?.jwt;
      } catch {}

      const details = await getLiveErrorDetailsAction(error?.digest || null, jwt).catch(() => null);
      if (details?.canSeeLiveErrors) {
        setEngDetails(details);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('kylrix:local-notifications', {
              detail: {
                notification: {
                  id: `err_${error?.digest || Date.now()}`,
                  category: 'system',
                  title: `Live Bug: ${(details.message || error.message || 'Runtime Error').slice(0, 40)}...`,
                  message: details.message || error.message || 'Runtime error encountered.',
                  time: 'Just now',
                  timestamp: Date.now(),
                  read: false,
                  accent: '#EF4444',
                  source: 'system',
                  errorDetails: {
                    message: details.message || error.message,
                    stack: details.stack,
                    digest: error?.digest || details.digest,
                    timestamp: details.timestamp || new Date().toISOString(),
                  },
                },
              },
            })
          );
        }
      }
    }
    void loadEngineerDetails();
  }, [error]);

  const rawMessage = (() => {
    try {
      return typeof error?.message === 'string' ? error.message : String(error || 'Unknown error.');
    } catch {
      return 'Unknown error.';
    }
  })();

  const isNextServerComponentMasked = rawMessage.includes('Server Components render') || rawMessage.includes('omitted in production');

  const displayMessage = engDetails?.message
    ? engDetails.message
    : isNextServerComponentMasked
    ? 'An unexpected error occurred while rendering this page.'
    : rawMessage;

  return (
    <div className="fixed inset-0 z-[99999] bg-black text-neutral-200 min-h-screen relative antialiased font-sans overflow-hidden select-none">
      <div className="absolute inset-0 bg-neutral-950 z-40" />

      <div className="absolute bottom-0 left-0 right-0 max-w-xl mx-auto p-4 z-50 animate-in slide-in-from-bottom duration-300 ease-out">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <h2 className="font-mono text-xs uppercase tracking-wider font-semibold">
                {engDetails?.canSeeLiveErrors ? 'App Error (Engineer Live View)' : 'App Error'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {engDetails?.canSeeLiveErrors && (
                <button
                  type="button"
                  onClick={() =>
                    downloadBugReportMarkdown({
                      message: displayMessage,
                      stack: engDetails.stack,
                      digest: error?.digest || engDetails.digest,
                      timestamp: engDetails.timestamp,
                    })
                  }
                  title="Download Bug Markdown (.md)"
                  className="flex items-center gap-1 text-[11px] font-mono text-red-400 bg-red-950/60 hover:bg-red-900/80 px-2 py-1 rounded border border-red-800/80 transition-colors cursor-pointer"
                >
                  <FileDown size={13} />
                  <span>Download Bug (.md)</span>
                </button>
              )}
              {error.digest ? (
                <span className="font-mono text-[10px] text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800/60">
                  id: {error.digest}
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-neutral-300">{heading}</p>
            <p className="text-xs text-neutral-400">{description}</p>
            <div className="max-h-36 overflow-y-auto bg-neutral-950 p-2.5 rounded border border-neutral-800/40 space-y-2">
              <p className="font-mono text-xs text-red-400/90 break-all leading-relaxed font-semibold">
                {displayMessage}
              </p>
              {engDetails?.stack ? (
                <pre className="font-mono text-[10px] text-neutral-500 whitespace-pre-wrap break-all leading-tight border-t border-neutral-800/50 pt-2">
                  {engDetails.stack}
                </pre>
              ) : null}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              className="flex-1 bg-neutral-200 text-black hover:bg-white text-xs font-medium py-2 rounded transition-colors duration-150 cursor-pointer"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-neutral-200 text-xs font-medium py-2 rounded transition-colors duration-150 cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
