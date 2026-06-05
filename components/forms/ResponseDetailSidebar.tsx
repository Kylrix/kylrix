import React, { useState } from 'react';
import { 
  X, 
  ArrowLeft, 
  Clock, 
  User, 
  Flag, 
  Database,
  FileText
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { useUnifiedDrawer } from '@/context/UnifiedDrawerContext';
import { convertResponseToGoal } from '@/lib/actions/client-ops';

interface ResponseDetailSidebarProps {
  open: boolean;
  onClose: () => void;
  submission: any | null;
  schemaMap?: Record<string, string>;
}

export default function ResponseDetailSidebar({ open, onClose, submission, schemaMap }: ResponseDetailSidebarProps) {
  const { open: openDrawer } = useUnifiedDrawer();
  const { showSuccess, showError } = useToast();
  const [converting, setConverting] = useState(false);

  if (!submission || !open) return null;

  const handleConvertToProject = () => {
    onClose();
    openDrawer('new-project', {
      template: {
        id: 'form-to-project',
        title: 'Project Discussion',
        summary: `Discussion thread based on Response ${submission.$id.slice(-8)}`,
        color: '#6366F1'
      },
      formId: submission.formId,
      formTitle: `Discussion: Response ${submission.$id.slice(-8)}`,
      formDescription: `Discussion thread spawned from form submission ID ${submission.$id.slice(-8)}`,
      selectedResourceId: submission.formId
    });
  };

  const handleConvertToGoal = async () => {
    setConverting(true);
    try {
      await convertResponseToGoal(submission.$id);
      showSuccess('Converted response to Execution Goal!');
      onClose();
    } catch (err: any) {
      showError('Failed to convert response', err.message);
    } finally {
      setConverting(false);
    }
  };

  let data = {};
  try {
    data = JSON.parse(submission.payload);
  } catch (_e) {
    data = { raw: submission.payload };
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 z-[9990]"
        onClick={onClose}
      />

      {/* Slide-over Container */}
      <div className="fixed right-0 top-0 bottom-0 h-dvh bg-[#000000] border-l border-white/5 shadow-2xl flex flex-col z-[9995] w-full sm:w-[480px] transition-transform duration-300 ease-out translate-x-0 font-satoshi text-[#F2F2F2]">
        {/* Header */}
        <div className="p-4 md:p-5 flex items-center justify-between border-b border-white/5 bg-[linear-gradient(to_bottom,rgba(99,102,241,0.05),transparent)] shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-[#6366F1]/10 text-[#6366F1] hover:bg-[#6366F1]/20 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 border border-[#6366F1]/20 text-[#6366F1] flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold font-clash text-white tracking-tight uppercase leading-tight">Response Detail</h3>
              <span className="block text-[10px] text-[#9B9691] font-mono font-bold">ID: {submission.$id.slice(-8)}</span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-[#9B9691] hover:text-white rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 scrollbar-thin">
          {/* Metadata Section */}
          <div className="space-y-3">
            <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">METADATA</span>
            <div className="grid grid-cols-1 gap-2.5">
              <div className="p-3.5 rounded-xl bg-[#161412] border border-white/5 flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#9B9691] shrink-0" />
                <div>
                  <span className="block text-[9px] text-[#9B9691] font-black font-mono">SUBMITTED AT</span>
                  <span className="text-xs font-bold text-white">{new Date(submission.$createdAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#161412] border border-white/5 flex items-center gap-3">
                <User className="w-5 h-5 text-[#9B9691] shrink-0" />
                <div>
                  <span className="block text-[9px] text-[#9B9691] font-black font-mono">SUBMITTER</span>
                  <span className="text-xs font-bold text-white">{submission.submitterName || 'Anonymous User'}</span>
                </div>
              </div>
            </div>
            {submission.flagged && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFB020]/10 text-[#FFB020] text-[10px] font-extrabold font-mono uppercase tracking-wider">
                <Flag className="w-3.5 h-3.5 fill-[#FFB020]" />
                <span>Important / Flagged</span>
              </span>
            )}
          </div>

          {/* Response Fields */}
          <div className="space-y-4">
            <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">RESPONSE DATA</span>
            <div className="space-y-3.5">
              {Object.entries(data).map(([key, value]: [string, any]) => (
                <div key={key} className="space-y-1.5">
                  <span className="block text-xs font-bold text-[#9B9691] capitalize font-satoshi">
                    {schemaMap?.[key] || key.split(/(?=[A-Z])/).join(' ').replace(/_/g, ' ') || 'Field'}
                  </span>
                  <div className="p-4 rounded-[18px] bg-[#161412] border border-white/5 hover:border-[#6366F1]/30 hover:bg-[#6366F1]/[0.02] transition-all duration-200">
                    {Array.isArray(value) ? (
                      <div className="flex flex-wrap gap-1">
                        {value.map((v, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 text-white/60">
                            {String(v)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-white break-words leading-relaxed font-satoshi">
                        {String(value)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono">WORKFLOW ACTIONS</span>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleConvertToProject}
                className="w-full py-3 bg-[#6366F1] text-black font-extrabold text-xs rounded-xl shadow-[0_8px_30px_rgb(99,102,241,0.2)] hover:bg-[#5254E8] hover:translate-y-[-1px] transition-all duration-200 font-satoshi"
              >
                Convert to Project Thread
              </button>
              <button
                type="button"
                disabled={converting}
                onClick={handleConvertToGoal}
                className="w-full py-3 border border-[#EC4899]/30 text-[#EC4899] hover:bg-[#EC4899]/5 hover:border-[#EC4899] font-extrabold text-xs rounded-xl transition-all duration-200 font-satoshi"
              >
                {converting ? 'Converting...' : 'Convert to Execution Goal'}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-5 bg-black border-t border-white/5 shrink-0">
          <span className="block text-[10px] font-black text-[#9B9691] uppercase tracking-wider font-mono mb-2">RAW TELEMETRY</span>
          <pre className="p-3 rounded-xl bg-[#161412] border border-white/5 text-[10px] text-[#6366F1]/80 overflow-auto max-h-[140px] font-mono scrollbar-thin">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </>
  );
}
