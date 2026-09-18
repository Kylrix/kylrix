'use client';

import { useEffect, useState } from 'react';
import { getLiveErrorDetailsAction, type EngineerErrorDetails } from '@/lib/errors/engineer';
import { downloadBugReportMarkdown } from '@/lib/errors/download-bug-report';
import { FileDown } from 'lucide-react';

export default function VaultError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [engDetails, setEngDetails] = useState<EngineerErrorDetails | null>(null);

  useEffect(() => {
    console.error('[Vault] Next.js Route Error Boundary caught error:', error);
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
                  title: `Live Bug: ${(details.message || error.message || 'Vault Error').slice(0, 40)}...`,
                  message: details.message || error.message || 'Vault error encountered.',
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

  const rawMessage = error?.message || String(error);
  const isMasked = rawMessage.includes('Server Components render') || rawMessage.includes('omitted in production');

  const displayMessage = engDetails?.message
    ? engDetails.message
    : isMasked
    ? 'An unexpected error occurred loading Vault.'
    : rawMessage;

  return (
    <div className="p-8 rounded-3xl bg-[#161412] border border-red-500/30 max-w-xl mx-auto my-12 text-center shadow-2xl">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 text-xl font-bold font-mono">
        !
      </div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-lg font-black text-white font-clash">
          {engDetails?.canSeeLiveErrors ? 'Vault Render Error (Engineer View)' : 'Vault Render Error'}
        </h3>
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
            className="flex items-center gap-1 text-[11px] font-mono text-red-400 bg-red-950/60 hover:bg-red-900/80 px-2 py-1 rounded border border-red-800/80 transition-colors cursor-pointer shrink-0"
          >
            <FileDown size={13} />
            <span>Download Bug (.md)</span>
          </button>
        )}
      </div>
      <p className="text-xs text-red-400 font-mono bg-red-950/40 p-3 rounded-xl border border-red-900/50 mb-6 text-left break-all">
        {displayMessage}
      </p>
      {engDetails?.stack ? (
        <pre className="text-[10px] text-neutral-400 font-mono text-left max-h-32 overflow-y-auto whitespace-pre-wrap break-all bg-black/60 p-3 rounded-xl border border-red-900/30 mb-6">
          {engDetails.stack}
        </pre>
      ) : null}
      <button
        onClick={() => reset()}
        className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs transition-colors cursor-pointer"
      >
        Retry Loading Vault
      </button>
    </div>
  );
}
