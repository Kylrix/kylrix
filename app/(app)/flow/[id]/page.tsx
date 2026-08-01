'use client';

import React, { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Layers, Share2 } from 'lucide-react';
import { getFlowAction } from '@/lib/actions/workflows';
import type { WorkflowChain } from '@/lib/workflow-engine';
import { getBuiltinFlow } from '@/lib/flows/builtins';
import { VerifiedMark } from '@/components/flows/FlowDetailDrawer';
import type { FlowPublisher } from '@/lib/flows/types';
import { KYLRIX_PUBLISHER } from '@/lib/flows/types';
import { installFlowLocal, isFlowInstalled } from '@/lib/flows/installed';
import { installFlow } from '@/lib/actions/client-ops';
import { buildPublicResourceUrl } from '@/lib/share/public-url';
import toast from 'react-hot-toast';

function resolvePublisher(flow: WorkflowChain, builtin: boolean): FlowPublisher {
  if (builtin) return KYLRIX_PUBLISHER;
  const meta = (flow as any).metadata;
  try {
    const parsed = typeof meta === 'string' ? JSON.parse(meta) : meta;
    if (parsed?.publisherHandle) {
      return {
        handle: String(parsed.publisherHandle),
        verified:
          parsed.verified === 'kylrix'
            ? 'kylrix'
            : parsed.verified === 'ecosystem' || parsed.verified === true
              ? 'ecosystem'
              : null,
      };
    }
  } catch {
    /* ignore */
  }
  return { handle: '@user', verified: null };
}

export default function FlowSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [flow, setFlow] = useState<WorkflowChain | null>(null);
  const [publisher, setPublisher] = useState<FlowPublisher | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isFlowInstalled(id));
    const load = async () => {
      setLoading(true);
      const builtin = getBuiltinFlow(id);
      if (builtin) {
        setFlow(builtin);
        setPublisher(KYLRIX_PUBLISHER);
        setIsOwner(false);
        setLoading(false);
        return;
      }
      const res = await getFlowAction(id);
      if (!res.success || !res.data) {
        setError(res.error || 'Flow not found');
        setFlow(null);
        setLoading(false);
        return;
      }
      setFlow(res.data);
      setPublisher(resolvePublisher(res.data, false));
      setIsOwner(!!res.isOwner);
      setLoading(false);
    };
    void load();
  }, [id]);

  const shareUrl = buildPublicResourceUrl('flow', id);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied');
    } catch {
      toast.success(shareUrl);
    }
  };

  const handleInstall = async () => {
    try {
      const res = await installFlow({ flowId: id, scope: { type: 'user' } });
      if (!res?.success) {
        toast.error('Install failed');
        return;
      }
      installFlowLocal(id);
      setInstalled(true);
      toast.success(res.created ? 'Installed' : 'Already installed');
      router.push('/flows');
    } catch (err: any) {
      toast.error(err?.message || 'Install failed');
    }
  };

  return (
    <div className="flex-1 min-h-screen font-satoshi text-white">
      <div className="w-full max-w-[640px] mx-auto p-4 md:p-8 space-y-5">
        <button
          type="button"
          onClick={() => router.push('/flows')}
          className="p-2 rounded-xl bg-[#161412] border border-white/[0.06] text-white/60 hover:text-white cursor-pointer"
        >
          <ArrowLeft size={16} />
        </button>

        {loading ? (
          <div className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-8 text-center text-sm text-white/40">
            Loading…
          </div>
        ) : error || !flow ? (
          <div className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-8 text-center space-y-3">
            <p className="text-sm font-bold text-white/50">{error || 'Flow not found'}</p>
            <button
              type="button"
              onClick={() => router.push('/flows')}
              className="px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#A855F7] text-white cursor-pointer"
            >
              Back to Flows
            </button>
          </div>
        ) : (
          <>
            <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-2xl bg-[#0A0908] border border-white/[0.06] text-[#A855F7]">
                  <Layers size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="font-clash text-2xl font-semibold tracking-tight truncate">
                    {flow.name}
                  </h1>
                  {publisher && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-white/50">
                      <span className="font-bold">{publisher.handle}</span>
                      <VerifiedMark kind={publisher.verified} />
                      {flow.isPublic && (
                        <span className="text-white/30">· Discover</span>
                      )}
                    </div>
                  )}
                  {flow.description ? (
                    <p className="mt-3 text-sm text-white/45">{flow.description}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#0A0908] border border-white/[0.08] text-white cursor-pointer"
                >
                  <Share2 size={14} />
                  Share
                </button>
                {!installed ? (
                  <button
                    type="button"
                    onClick={() => void handleInstall()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#A855F7] text-white cursor-pointer"
                  >
                    <Download size={14} />
                    Install
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/flows')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#0A0908] border border-white/[0.08] text-white/60 cursor-pointer"
                  >
                    Installed
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => router.push('/flows')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold text-[#6366F1] cursor-pointer"
                  >
                    Manage
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-[22px] bg-[#161412] border border-white/[0.06] p-5 space-y-2.5">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-white/55">
                Steps
              </h3>
              {flow.steps.map((step, idx) => (
                <div
                  key={`${step.actionId}-${idx}`}
                  className="rounded-xl bg-[#0A0908] border border-white/[0.05] px-3 py-2.5 text-[11px] font-mono text-white/55 truncate"
                >
                  {step.actionId}
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
