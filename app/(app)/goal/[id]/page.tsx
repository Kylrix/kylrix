import Link from 'next/link';
import { Flag, Calendar, Lock } from 'lucide-react';
import { getPublicGoalDataSecure } from '@/lib/actions/secure-ops';

import { SharedWorkspaceBar } from '@/components/common/SharedWorkspaceBar';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  done: 'Completed',
  blocked: 'Blocked',
  cancelled: 'Cancelled',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#A1A1AA',
  medium: '#14B8A6',
  high: '#F59E0B',
  urgent: '#EF4444',
};

function AccessUnavailable() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-[#0A0908] px-6 py-16">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1C1A18] border border-[#2C2A28]">
          <Lock className="h-6 w-6 text-[#9B9691]" />
        </div>
        <h1 className="text-xl font-bold text-white font-clash">This goal is not available</h1>
        <p className="text-sm text-[#9B9691] leading-relaxed">
          The link may be wrong, or the owner has not shared this goal publicly.
        </p>
        <Link
          href="/flow"
          className="inline-flex items-center justify-center rounded-xl bg-[#A855F7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9333EA] transition-colors"
        >
          Open Flow
        </Link>
      </div>
    </div>
  );
}

export default async function PublicGoalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const goal = await getPublicGoalDataSecure(id);

  if (!goal) {
    return <AccessUnavailable />;
  }

  const priorityColor = PRIORITY_COLORS[String(goal.priority)] || PRIORITY_COLORS.medium;
  const statusLabel = STATUS_LABELS[String(goal.status)] || String(goal.status);

  return (
    <div className="min-h-[70vh] bg-[#0A0908] text-white">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <SharedWorkspaceBar objectType="goal" />
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#A855F7] mb-3">
          Shared goal
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold font-clash break-words mb-4">
          {goal.title}
        </h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2A28] bg-[#1C1A18] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#9B9691]">
            {statusLabel}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2A28] bg-[#1C1A18] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider"
            style={{ color: priorityColor }}
          >
            <Flag className="h-3 w-3" />
            {String(goal.priority)}
          </span>
          {goal.dueDate && (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2A28] bg-[#1C1A18] px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#9B9691]">
              <Calendar className="h-3 w-3" />
              {new Date(goal.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {goal.description ? (
          <div className="rounded-2xl border border-[#2C2A28] bg-[#141210] p-5">
            <p className="text-sm sm:text-base text-[#D4D1CC] leading-relaxed whitespace-pre-wrap break-words">
              {goal.description}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#9B9691]">No description was added to this goal.</p>
        )}

        <p className="mt-8 text-xs text-[#6B6762]">
          Read-only view. Sign in to collaborate if you were invited.
        </p>
      </div>
    </div>
  );
}
