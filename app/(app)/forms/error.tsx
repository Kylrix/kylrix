'use client';

import { useEffect, useState } from 'react';
import { getLiveErrorDetailsAction, type EngineerErrorDetails } from '@/lib/errors/engineer';
import { downloadBugReportMarkdown } from '@/lib/errors/download-bug-report';
import { FileDown, AlertTriangle } from 'lucide-react';

export default function FormsRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [engDetails, setEngDetails] = useState<EngineerErrorDetails | null>(null);

  useEffect(() => {
    console.error('[FormsRouteError]', error);
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
                  id: `err_forms_${error?.digest || Date.now()}`,
                  category: 'system',
                  title: `Live Forms Bug: ${(details.message || error.message || 'Forms Route Error').slice(0, 40)}...`,
                  message: details.message || error.message || 'Forms route error encountered.',
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

  const rawMessage = error?.message || 'An unexpected error occurred loading forms.';
  const isMasked = rawMessage.includes('Server Components render') || rawMessage.includes('omitted in production');

  const displayMessage = engDetails?.message
    ? engDetails.message
    : isMasked
    ? 'An unexpected error occurred loading forms.'
    : rawMessage;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[60vh] font-satoshi">
      <div className="max-w-md w-full flex flex-col items-center gap-5 bg-[#000000] border-2 border-white/20 rounded-3xl p-7 shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
          <AlertTriangle size={24} />
        </div>
        <div className="flex flex-col gap-2 text-center w-full">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold text-white font-clash">
              {engDetails?.canSeeLiveErrors ? 'Forms Dashboard Error (Engineer View)' : 'Unable to Load Forms'}
            </h2>
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
                className="flex items-center gap-1 text-[11px] font-mono text-rose-400 bg-rose-950/60 hover:bg-rose-900/80 px-2 py-1 rounded border border-rose-800/80 transition-colors cursor-pointer shrink-0"
              >
                <FileDown size={13} />
                <span>Download Bug (.md)</span>
              </button>
            )}
          </div>
          <p className="text-xs text-rose-400 font-mono break-all leading-relaxed bg-[#161412] p-3 rounded-xl border border-white/10 mt-1">
            {displayMessage}
          </p>
          {engDetails?.stack ? (
            <pre className="text-[10px] text-neutral-400 font-mono text-left max-h-36 overflow-y-auto whitespace-pre-wrap break-all bg-black/60 p-2.5 rounded-xl border border-white/5 mt-1">
              {engDetails.stack}
            </pre>
          ) : null}
        </div>
        <div className="flex items-center gap-3 w-full mt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 px-4 py-3 rounded-xl bg-[#6366F1] text-white font-extrabold text-xs hover:bg-[#5254D8] active:scale-95 transition-all cursor-pointer shadow-[0_4px_12px_rgba(99,102,241,0.25)]"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-3 rounded-xl bg-[#161412] border-2 border-white/20 hover:border-white/40 text-white font-extrabold text-xs active:scale-95 transition-all cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
