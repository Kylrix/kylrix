'use client';

import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Code, 
  Eye, 
  EyeOff, 
  Flag,
  X
} from 'lucide-react';
import { FormsService } from '@/lib/services/forms';
import { FormSubmissions } from '@/generated/appwrite/types';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';

const SubmissionViewerTable = ({ submissions, headers, schemaMap, parsePayload, renderValue, onToggleRead, onToggleFlag, onRowClick }: any) => (
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
          <th className="px-4 py-4 w-24"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.03]">
        {submissions.map((sub: any) => {
          const data = parsePayload(sub.payload);
          const isRead = sub.read || false;
          const isFlagged = sub.flagged || false;

          return (
            <tr
              key={sub.$id}
              onClick={() => onRowClick(sub)}
              className={`hover:bg-white/[0.01] transition-all cursor-pointer ${
                isRead ? 'opacity-70' : 'opacity-100'
              }`}
            >
              <td className="px-4 py-3">
                {!isRead && (
                  <span className="inline-block w-2 h-2 rounded-full bg-[#6366F1] shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                )}
              </td>
              <td className="px-4 py-3 text-[#9B9691] font-mono text-[11px] whitespace-nowrap">
                {new Date(sub.$createdAt).toLocaleString()}
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
                <div className="flex gap-2.5">
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
  const [submissions, setSubmissions] = useState<FormSubmissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmissions | null>(null);

  // Map of field IDs to labels
  const schemaMap = React.useMemo(() => {
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
      await FormsService.updateSubmission(id, { read } as any);
      setSubmissions(prev => prev.map(s => s.$id === id ? { ...s, read } : s));
    } catch (_e) {
        console.error("Failed to update read status", _e);
    }
  };

  const handleToggleFlag = async (id: string, flagged: boolean) => {
    try {
      await FormsService.updateSubmission(id, { flagged } as any);
      setSubmissions(prev => prev.map(s => s.$id === id ? { ...s, flagged } : s));
    } catch (_e) {
        console.error("Failed to update flagged status", _e);
    }
  };

  const handleRowClick = (sub: FormSubmissions) => {
    openDrawer('form-response-detail', {
      submission: sub,
      schemaMap
    });
    if (!(sub as any).read) {
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

  const parsePayload = (payload: string) => {
    try {
      return JSON.parse(payload);
    } catch (_e) {
      return { data: payload };
    }
  };

  const firstPayload = parsePayload(submissions[0].payload);
  const headers = Object.keys(firstPayload);

  const renderValue = (val: any) => {
    if (Array.isArray(val)) {
        return (
            <div className="flex gap-1 flex-wrap">
                {val.map((v, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#6366F1]/15 text-[#6366F1]">
                      {v}
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
    <div>
        <div className="mb-4 flex justify-end gap-2.5">
            <button 
                type="button"
                onClick={() => exportData('csv')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#161412] hover:bg-[#1C1A18] text-[#9B9691] hover:text-white border border-[#34322F] rounded-xl transition-all font-satoshi"
            >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
            </button>
            <button 
                type="button"
                onClick={() => exportData('json')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-[#161412] hover:bg-[#1C1A18] text-[#9B9691] hover:text-white border border-[#34322F] rounded-xl transition-all font-satoshi"
            >
                <Code className="w-3.5 h-3.5" />
                <span>Export JSON</span>
            </button>
        </div>
        <SubmissionViewerTable 
            submissions={submissions} 
            headers={headers} 
            schemaMap={schemaMap}
            parsePayload={parsePayload} 
            renderValue={renderValue} 
            onToggleRead={handleToggleRead}
            onToggleFlag={handleToggleFlag}
            onRowClick={handleRowClick}
        />
    </div>
  );
}
