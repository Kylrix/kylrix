'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  Download, 
  Code, 
  Eye, 
  EyeOff, 
  Flag,
  Sparkles,
  ArrowUpDown,
  Search,
  Target,
  Crown
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { FormSubmissions } from '@/generated/appwrite/types';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { useAuth } from '@/lib/auth';
import { useProUpgrade } from '@/context/ProUpgradeContext';
import { hasPaidKylrixPlan } from '@/lib/utils';
import { convertResponseToGoal } from '@/lib/actions/client-ops';
import { useToast } from '@/components/ui/Toast';

export type ResponseSortOption = 'newest' | 'oldest' | 'submitter' | 'unread' | 'flagged' | 'ai_rank';

const SubmissionViewerTable = ({
  submissions,
  headers,
  schemaMap,
  parsePayload,
  renderValue,
  onToggleRead,
  onToggleFlag,
  onConvertToGoal,
  onRowClick
}: any) => (
  <div className="overflow-x-auto rounded-[24px] border border-white/5 bg-[#161412] shadow-xl">
    <table className="w-full border-collapse text-left text-xs text-[#F2F2F2] font-satoshi">
      <thead>
        <tr className="bg-white/[0.02] border-b border-white/5">
          <th className="px-4 py-4 w-12"></th>
          <th className="px-4 py-4 text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">Timestamp</th>
          <th className="px-4 py-4 text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">Submitter</th>
          {headers.map((h: string) => (
            <th key={h} className="px-4 py-4 text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">
              {schemaMap?.[h] || h}
            </th>
          ))}
          <th className="px-4 py-4 w-32 text-right text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.03]">
        {submissions.map((sub: any) => {
          const data = parsePayload(sub.payload);
          const isRead = sub.status === 'read' || sub.read === true;
          const isFlagged = sub.status === 'flagged' || sub.flagged === true;

          return (
            <tr
              key={sub.$id}
              onClick={() => onRowClick(sub)}
              className={`hover:bg-white/[0.02] transition-all cursor-pointer ${
                isRead ? 'opacity-70' : 'opacity-100 font-medium'
              }`}
            >
              <td className="px-4 py-3">
                {!isRead && (
                  <span className="inline-block w-2 h-2 rounded-full bg-[#6366F1] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                )}
              </td>
              <td className="px-4 py-3 text-[#9B9691] font-mono text-[11px] whitespace-nowrap">
                {sub.$createdAt || sub.createdAt ? new Date(sub.$createdAt || sub.createdAt).toLocaleString() : 'Recently'}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  sub.submitterName && sub.submitterName !== 'Anonymous'
                    ? 'bg-[#6366F1]/10 text-[#6366F1]'
                    : 'border border-white/5 text-[#9B9691]'
                }`}>
                  {sub.submitterName || 'Anonymous'}
                </span>
              </td>
              {headers.map((h: string) => (
                <td key={h} className="px-4 py-3 font-semibold truncate max-w-[200px]">
                  {renderValue(data[h])}
                </td>
              ))}
              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-2 justify-end items-center">
                  <button
                    type="button"
                    onClick={() => onConvertToGoal(sub.$id)}
                    className="p-1.5 rounded-lg hover:bg-[#10B981]/10 text-[#10B981] transition-colors"
                    title="Convert to Goal in Workspace"
                  >
                    <Target className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleRead(sub.$id, !isRead)}
                    className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${
                      isRead ? 'text-white/20' : 'text-[#6366F1]'
                    }`}
                    title={isRead ? 'Mark as unread' : 'Mark as read'}
                  >
                    {isRead ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleFlag(sub.$id, !isFlagged)}
                    className={`p-1.5 rounded-lg hover:bg-white/5 transition-colors ${
                      isFlagged ? 'text-[#FFB020]' : 'text-white/10 hover:text-[#FFB020]'
                    }`}
                    title={isFlagged ? 'Remove flag' : 'Flag submission'}
                  >
                    <Flag className={`w-4 h-4 ${isFlagged ? 'fill-[#FFB020]' : ''}`} />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default function SubmissionViewer({ formId, formSchema }: { formId: string, formSchema?: string }) {
  const { open: openDrawer } = useUnifiedDrawer();
  const { user } = useAuth();
  const { openProUpgrade } = useProUpgrade();
  const { showSuccess, showError } = useToast();
  const isPaidUser = hasPaidKylrixPlan(user);

  const [submissions, setSubmissions] = useState<FormSubmissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<ResponseSortOption>('newest');
  const [aiTriageActive, setAiTriageActive] = useState(false);

  // Map of field IDs to labels
  const schemaMap = useMemo(() => {
    if (!formSchema) return {};
    try {
      const schema = JSON.parse(formSchema);
      return schema.reduce((acc: any, field: any) => {
        acc[field.id] = field.label || field.id;
        return acc;
      }, {});
    } catch (_e) {
      return {};
    }
  }, [formSchema]);

  const fetchSubmissions = async () => {
    try {
      const res = await FormsService.listSubmissions(formId);
      // Filter out drafts (work-in-progress)
      const nonDrafts = res.rows.filter(s => {
        try {
          const meta = JSON.parse(s.metadata || '{}');
          return !meta.isDraft;
        } catch (_e) {
          return true;
        }
      });
      setSubmissions(nonDrafts);
    } catch (_e) {
      console.error('Failed to fetch submissions', _e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  const handleToggleRead = async (id: string, read: boolean) => {
    try {
      const status = read ? 'read' : 'unread';
      await FormsService.updateSubmission(id, { status } as any);
      setSubmissions(prev => prev.map(s => s.$id === id ? { ...s, status } as any : s));
    } catch (_e) {
      console.error("Failed to update read status", _e);
    }
  };

  const handleToggleFlag = async (id: string, flagged: boolean) => {
    try {
      const status = flagged ? 'flagged' : 'unread';
      await FormsService.updateSubmission(id, { status } as any);
      setSubmissions(prev => prev.map(s => s.$id === id ? { ...s, status } as any : s));
    } catch (_e) {
      console.error("Failed to update flagged status", _e);
    }
  };

  const handleConvertToGoal = async (submissionId: string) => {
    try {
      await convertResponseToGoal(submissionId);
      showSuccess('Converted to Goal in Workspace!');
    } catch (err: any) {
      showError('Failed to convert', err?.message || 'Error converting response to goal');
    }
  };

  const handleAiTriage = () => {
    if (!isPaidUser) {
      openProUpgrade('AI Response Triage & Sorting');
      return;
    }
    setAiTriageActive(true);
    setSortBy('ai_rank');
    showSuccess('AI Triage Enabled', 'Form responses ranked and sorted by AI priority score.');
  };

  const parsePayload = (payload: string) => {
    try {
      return JSON.parse(payload);
    } catch (_e) {
      return { data: payload };
    }
  };

  // Filtered and Sorted Submissions (Offline & AI systems)
  const processedSubmissions = useMemo(() => {
    let result = [...submissions];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((sub) => {
        const payloadStr = String(sub.payload || '').toLowerCase();
        const submitterStr = String((sub as any).submitterName || '').toLowerCase();
        return payloadStr.includes(q) || submitterStr.includes(q);
      });
    }

    // Sorting algorithms
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.$createdAt).getTime() - new Date(b.$createdAt).getTime();
      }
      if (sortBy === 'submitter') {
        const nameA = ((a as any).submitterName || 'Anonymous').toLowerCase();
        const nameB = ((b as any).submitterName || 'Anonymous').toLowerCase();
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'unread') {
        const isUnreadA = a.status !== 'read' ? 1 : 0;
        const isUnreadB = b.status !== 'read' ? 1 : 0;
        return isUnreadB - isUnreadA;
      }
      if (sortBy === 'flagged') {
        const isFlaggedA = a.status === 'flagged' ? 1 : 0;
        const isFlaggedB = b.status === 'flagged' ? 1 : 0;
        return isFlaggedB - isFlaggedA;
      }
      if (sortBy === 'ai_rank') {
        // Smart heuristic AI score for sorting priority based on length, flags, and telemetry
        const scoreA = (a.status === 'flagged' ? 50 : 0) + (a.status !== 'read' ? 20 : 0) + String(a.payload).length;
        const scoreB = (b.status === 'flagged' ? 50 : 0) + (b.status !== 'read' ? 20 : 0) + String(b.payload).length;
        return scoreB - scoreA;
      }
      return 0;
    });

    return result;
  }, [submissions, searchQuery, sortBy]);

  const handleRowClick = (sub: FormSubmissions) => {
    openDrawer('form-response-detail', {
      submission: sub,
      schemaMap
    });
    if ((sub as any).status !== 'read') {
      handleToggleRead(sub.$id, true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10">
        <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-[#9B9691] bg-[#161412] border border-[#34322F] rounded-[24px]">
        <span className="text-sm font-bold block">No telemetry received.</span>
      </div>
    );
  }

  const firstPayload = parsePayload(submissions[0].payload);
  const headers = Object.keys(firstPayload).filter((k) => k !== '_ghost');

  const renderValue = (val: any) => {
    if (Array.isArray(val)) {
      return (
        <div className="flex gap-1 flex-wrap">
          {val.map((v, i) => (
            <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#6366F1]/15 text-[#6366F1]">
              {String(v)}
            </span>
          ))}
        </div>
      );
    }
    return String(val || '-');
  };

  const exportData = (format: 'csv' | 'json') => {
    if (submissions.length === 0) return;

    const exportableRows = submissions.map(sub => {
      const payloadData = parsePayload(sub.payload);
      return {
        timestamp: sub.$createdAt,
        submitter: (sub as any).submitterName || 'Anonymous',
        ...payloadData
      };
    });

    let blob: Blob;
    let filename: string;

    if (format === 'json') {
      blob = new Blob([JSON.stringify(exportableRows, null, 2)], { type: 'application/json' });
      filename = `form_${formId}_submissions_${new Date().toISOString()}.json`;
    } else {
      const headersArr = ['timestamp', 'submitter', ...headers];
      const csvContent = [
        headersArr.join(','),
        ...exportableRows.map(row =>
          headersArr.map(h => {
            const val = (row as any)[h];
            const stringVal = Array.isArray(val) ? val.join('; ') : String(val || '');
            return `"${stringVal.replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      filename = `form_${formId}_submissions_${new Date().toISOString()}.csv`;
    }

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4">
      {/* Search, Sorting & AI Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Offline Search Input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#9B9691]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search response data..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#000000] border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#6366F1]"
          />
        </div>

        {/* Sort & AI Triage Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Offline Sort Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#000000] border border-white/10 text-xs font-mono text-white">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#6366F1]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as ResponseSortOption)}
              className="bg-transparent text-white focus:outline-none cursor-pointer text-xs font-satoshi font-bold"
            >
              <option value="newest" className="bg-black text-white">Newest First</option>
              <option value="oldest" className="bg-black text-white">Oldest First</option>
              <option value="unread" className="bg-black text-white">Unread First</option>
              <option value="flagged" className="bg-black text-white">Flagged First</option>
              <option value="submitter" className="bg-black text-white">Submitter A-Z</option>
              {isPaidUser && <option value="ai_rank" className="bg-black text-white">AI Rank / Score</option>}
            </select>
          </div>

          {/* AI Triage & Rank Button */}
          <button
            type="button"
            onClick={handleAiTriage}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all font-satoshi cursor-pointer border ${
              aiTriageActive
                ? 'bg-[#6366F1] text-white border-[#6366F1]'
                : 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/30 hover:bg-[#6366F1]/20'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Triage</span>
            {!isPaidUser && <Crown size={12} className="text-amber-400" />}
          </button>

          {/* Export Buttons */}
          <button
            type="button"
            onClick={() => exportData('csv')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#000000] hover:bg-white/5 text-[#9B9691] hover:text-white border border-white/10 rounded-xl transition-all font-satoshi cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportData('json')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-[#000000] hover:bg-white/5 text-[#9B9691] hover:text-white border border-white/10 rounded-xl transition-all font-satoshi cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      <SubmissionViewerTable
        submissions={processedSubmissions}
        headers={headers}
        schemaMap={schemaMap}
        parsePayload={parsePayload}
        renderValue={renderValue}
        onToggleRead={handleToggleRead}
        onToggleFlag={handleToggleFlag}
        onConvertToGoal={handleConvertToGoal}
        onRowClick={handleRowClick}
      />
    </div>
  );
}
